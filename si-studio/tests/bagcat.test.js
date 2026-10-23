import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {initial,catSettings,catSettingsError,answerLabel,issues,questionChecklist} from '../dist/model.js';
import {contentXML} from '../dist/siq.js';
test('cat exports native secret with escaped theme, recipient rule, numberSet and answer duration',()=>{
 const p=initial(),q=p.rounds[0].themes[0].questions[0];q.type='bagcat';q.cat={theme:'Коты <&> «тема»',selectionMode:'any',price:{minimum:100,maximum:500,step:100}};q.steps[1].duration=17;
 const before=structuredClone(q),xml=contentXML(p);assert.deepEqual(q,before);assert.deepEqual(issues(p),[]);assert.match(xml,/<question price="100" type="secret">/);assert.match(xml,/<param name="theme">Коты &lt;&amp;&gt; «тема»<\/param>/);assert.match(xml,/<param name="selectionMode">any<\/param>/);assert.match(xml,/<numberSet minimum="100" maximum="500" step="100"\/>/);assert.match(xml,/name="answerDuration">17/);assert.equal(answerLabel(q,p.rounds[0]),'Получатель кота отвечает');
 const dir=mkdtempSync(join(tmpdir(),'si-cat-'));writeFileSync(join(dir,'cat.xml'),xml);execFileSync('xmllint',['--noout','--schema','docs/siq_5.xsd',join(dir,'cat.xml')]);
});
test('cat defaults use round prices and only another player; switching type retains settings',()=>{
 const p=initial(),q=p.rounds[0].themes[0].questions[0];q.type='bagcat';assert.deepEqual(catSettings(q),{theme:'',selectionMode:'exceptCurrent',price:{minimum:0,maximum:0,step:0}});assert.match(contentXML(p),/<numberSet minimum="0" maximum="0" step="0"/);
 q.cat={theme:'Своя тема',selectionMode:'any',price:{minimum:500,maximum:500,step:0}};q.type='simple';assert.doesNotMatch(contentXML(p),/<param name="theme">/);q.type='bagcat';assert.match(contentXML(p),/<numberSet minimum="500" maximum="500" step="0"/);
});
test('invalid recipient and price rules block readiness and direct export; final disallows cats',()=>{
 const p=initial(),q=p.rounds[0].themes[0].questions[0];q.type='bagcat';
 for(const price of [{minimum:500,maximum:100,step:1},{minimum:100,maximum:500,step:300},{minimum:-1,maximum:500,step:1},{minimum:0,maximum:2147483648,step:1},{minimum:0.5,maximum:500,step:1}]){q.cat={theme:'Тема',selectionMode:'exceptCurrent',price};assert.ok(catSettingsError(q.cat));assert.ok(issues(p).length);assert.ok(questionChecklist(q,p.rounds[0]).some(c=>!c.passed));assert.throws(()=>contentXML(p),/стоимость кота/);}
 q.cat={...catSettings({}),selectionMode:'nobody'};assert.throws(()=>contentXML(p),/правило передачи/);delete q.cat;p.rounds[0].themes.forEach(t=>t.questions=t.questions.slice(0,1));p.rounds[0].type='final';assert.throws(()=>contentXML(p),/скрытые ставки/);
});
