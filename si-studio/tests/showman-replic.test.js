import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {initial,step,stepKind,kinds,stepSummary,issues,answerLabel} from '../dist/model.js';
import {contentXML,exportSIQ,importSIQ,escapeXML} from '../dist/siq.js';
import {insertScenarioStep,setRevealMode} from '../dist/scenario.js';
import {reorderSteps} from '../dist/step-drag.js';
import {createPreviewDemo} from '../dist/preview-demo.js';
import {previewStageHTML} from '../dist/preview-view.js';
import {FixtureDOMParser} from './helpers/xml-parser.js';
globalThis.DOMParser=FixtureDOMParser;
function fixture(){const p=initial(),r=p.rounds[0],t=r.themes[0],q=t.questions[0];return {p,r,t,q};}
test('showman event uses native text placement and can move across the answer boundary intact',()=>{
 const {p,q}=fixture(),s=step('replic','Реплика');s.duration=9;s.wait=false;
 assert.equal(s.type,'text');assert.equal(s.placement,'replic');assert.equal(stepKind(s),'replic');
 q.steps=insertScenarioStep(q.steps,s,'before');assert.equal(q.steps[1],s);assert.deepEqual(issues(p),[]);
 const before=structuredClone(q);q.steps=reorderSteps(q.steps,s.id,null);assert.equal(q.steps.at(-1),s);assert.equal(s.duration,9);assert.equal(s.wait,false);
 setRevealMode(q,'standard');assert.equal(q.customRevealSteps[0],s);setRevealMode(q,'custom');assert.equal(q.steps.at(-1),s);
 const restored=structuredClone(before);assert.equal(stepKind(restored.steps[1]),'replic');assert.equal(restored.steps[1].id,s.id);
 s.value='  ';assert.ok(issues(p).some(i=>i.message.includes('пустое слово ведущего')));
});
test('showman replicas round-trip before and after answering with timing, wait and escaped text; XML validates',async()=>{
 const {p,q}=fixture(),a=step('replic','Ведущий <&> «говорит»\nВторая строка'),b=step('replic','Объяснение ответа');a.duration=7;a.wait=false;b.duration=12;
 q.steps.splice(1,0,a);q.steps.push(b);const xml=contentXML(p);
 assert.match(xml,/<item type="text" placement="replic" duration="00:00:07" waitForFinish="False">/);
 const dir=mkdtempSync(join(tmpdir(),'si-replic-'));writeFileSync(join(dir,'replic.xml'),xml);execFileSync('xmllint',['--noout','--schema','docs/siq_5.xsd',join(dir,'replic.xml')]);
 const result=importSIQ(await exportSIQ(p,new Map())),copy=result.pack.rounds[0].themes[0].questions[0];
 assert.deepEqual(copy.steps.map(stepKind),['text','replic','answer','replic']);
 for(const [original,again]of [[a,copy.steps[1]],[b,copy.steps[3]]])for(const key of ['type','placement','value','duration','wait'])assert.equal(again[key],original[key]);
 assert.equal(copy.answer,q.answer);assert.equal(result.media.size,0);
});
test('editor enables the event on both sides, labels imported replicas and edits text with timing controls',()=>{
 const source=readFileSync('dist/app.js','utf8'),context={kinds,stepKind,stepSummary,answerLabel,e:escapeXML,media:new Map(),oversizedMedia:()=>false,activeRound:()=>({type:'standard'}),durationControl:()=>'<div>Длительность шага</div>',
 btn:(action,label,cls,attrs)=>`<button data-action="${action}" class="${cls}" ${attrs||''}>${label}</button>`};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function stepPalette('),source.indexOf('function revealContentHTML(')),context);
 vm.runInContext(source.slice(source.indexOf('function stepCard('),source.indexOf('const stepWindow=')),context);
 for(const side of ['before','after']){const html=context.stepPalette(side);assert.match(html,/data-type="replic"/);assert.match(html,/Слово ведущего/);assert.doesNotMatch(html,/скоро|disabled/);}
 const s={...step('text','<script>'),placement:'replic'};
 assert.match(context.stepCard(s,0,{}),/Слово ведущего/);const body=context.stepEditorBody(s,0);
 assert.match(body,/Напишите реплику ведущего/);assert.match(body,/На игровом экране он не показывается/);assert.match(body,/Длительность шага/);assert.match(body,/data-step-field="wait"/);assert.match(body,/&lt;script&gt;/);assert.doesNotMatch(body,/data-action="upload"/);
});
test('preview separates spoken replicas from screen content and preserves the screen for answering',()=>{
 const {q,r,t}=fixture(),first=step('replic','Вступление'),spoken=step('replic','Слушайте внимательно'),after=step('replic','Пояснение');q.steps.unshift(first);q.steps.splice(2,0,spoken);q.steps.push(after);
 const before=structuredClone(q),frames=createPreviewDemo(q,r,t).frames,replicas=frames.filter(f=>f.kind==='replic');
 assert.equal(replicas.length,3);assert.equal(replicas[0].contentIndex,undefined);assert.equal(replicas[1].contentIndex,1);
 assert.equal(replicas[1].replic,spoken.value);assert.equal(replicas[2].reveal,true);assert.equal(frames.find(f=>f.answerWindow).contentIndex,1);
 assert.match(previewStageHTML(replicas[0],0),/Слово ведущего/);assert.deepEqual(q,before);
});
