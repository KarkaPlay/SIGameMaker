import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {question,step,initial,issues} from '../dist/model.js';
import {revealMode,setRevealMode,scenarioParts,expandCaptions,canReorderScenario} from '../dist/scenario.js';
import {reorderSteps} from '../dist/step-drag.js';
import {contentXML,exportSIQ,importSIQ} from '../dist/siq.js';
import {createPreviewDemo} from '../dist/preview-demo.js';
import {unzipSync,zipSync,strFromU8,strToU8} from '../dist/vendor/fflate.js';
import {FixtureDOMParser} from './helpers/xml-parser.js';
import {mergeMedia} from '../dist/merge-model.js';
globalThis.DOMParser=FixtureDOMParser;
const fixture=()=>{const p=initial(),r=p.rounds[0],t=r.themes[0],q=t.questions[0];t.questions=[q];return {p,r,t,q};};
const image=(caption='')=>({...step('image'),mediaId:'picture',filename:'picture.png',caption,duration:7});
const media=new Map([['picture',new Blob([new Uint8Array([0,12,255])])]]);
test('new questions are standard; legacy custom content is retained across mode changes and history snapshots',()=>{
 const q=question(100,'Вопрос','Ответ');assert.equal(revealMode(q),'standard');
 const st=image('Подпись');q.steps.push(st);assert.equal(revealMode(q),'custom');
 const before=structuredClone(q);assert.equal(setRevealMode(q,'standard'),true);
 assert.equal(scenarioParts(q.steps).after.length,0);assert.equal(q.customRevealSteps[0],st);
 const saved=structuredClone(q);assert.equal(setRevealMode(saved,'custom'),true);
 assert.deepEqual(saved.steps,before.steps);assert.equal(saved.steps.at(-1).id,st.id);
 assert.equal(setRevealMode(saved,'custom'),false);assert.equal(setRevealMode(saved,'invalid'),false);
 saved.steps.pop();assert.equal(revealMode(saved),'custom');
});
test('standard mode cannot receive content by dragging or moving the answer marker',()=>{
 const q=question(),[text,answer]=q.steps;
 assert.equal(canReorderScenario(q,reorderSteps(q.steps,text.id,null)),false);
 assert.equal(canReorderScenario(q,reorderSteps(q.steps,answer.id,text.id)),false);
 assert.equal(canReorderScenario(q,q.steps),true);
 setRevealMode(q,'custom');assert.equal(canReorderScenario(q,[answer,text]),true);
});
test('caption expands into one simultaneous screen group without mutating the image or losing the following boundary',()=>{
 for(const wait of [true,false]){
  const st={...image('Фото & подпись\nВторая строка'),wait},before=structuredClone(st),[pic,text]=expandCaptions([st]);
  assert.equal(pic.wait,false);assert.equal(text.wait,wait);assert.equal(text.type,'text');
  assert.equal(text.value,st.caption);assert.equal(pic.duration+text.duration,st.duration);assert.deepEqual(st,before);
 }
 const st=image('  ');assert.deepEqual(expandCaptions([st]),[st]);
});
test('captions before and after answers survive SIQ export/import, timing, groups and binary files',async()=>{
 const {p,q}=fixture();q.steps.splice(1,0,image('Вопрос < & >'));q.steps.push({...image('Ответ\nс подписью'),wait:false},step('text','Следующий экран'));
 const bytes=await exportSIQ(p,media),files=unzipSync(bytes),xml=strFromU8(files['content.xml']);
 assert.match(xml,/type="image"[^>]*waitForFinish="False"/);assert.match(xml,/Вопрос &lt; &amp; &gt;/);
 const dir=mkdtempSync(join(tmpdir(),'si-caption-'));writeFileSync(join(dir,'caption.xml'),xml);
 execFileSync('xmllint',['--noout','--schema','docs/siq_5.xsd',join(dir,'caption.xml')]);
 const back=importSIQ(bytes),qq=back.pack.rounds[0].themes[0].questions[0];
 assert.deepEqual(qq.steps.map(({id,mediaId,filename,placement,...s})=>s),q.steps.map(({id,mediaId,filename,placement,...s})=>s));
 const pics=qq.steps.filter(st=>st.type==='image');assert.equal(pics[0].mediaId,pics[1].mediaId);
 assert.deepEqual([...new Uint8Array(await back.media.get(pics[0].mediaId).arrayBuffer())],[0,12,255]);
 assert.equal(revealMode(qq),'custom');assert.deepEqual(issues(back.pack,back.media),[]);
});
test('caption sidecar cannot replace XML text and missing hints leave lossless ordinary grouped steps',async()=>{
 const {p,q}=fixture();q.steps.splice(1,0,image('Настоящая подпись'));
 const files=unzipSync(await exportSIQ(p,media));
 files['SIStudio-captions.json']=strToU8(JSON.stringify({version:1,captions:[[{index:1,text:'Подмена'}]]}));
 const qq=importSIQ(zipSync(files)).pack.rounds[0].themes[0].questions[0];
 assert.equal(qq.steps[1].caption,undefined);assert.equal(qq.steps[2].value,'Настоящая подпись');
 delete files['SIStudio-captions.json'];const plain=importSIQ(zipSync(files)).pack.rounds[0].themes[0].questions[0];
 assert.equal(plain.steps[1].wait,false);assert.equal(plain.steps[2].value,'Настоящая подпись');
});
test('standard exports only active behavior; inactive custom files do not block readiness or export',async()=>{
 const {p,q}=fixture();q.steps.push(image('Скрытая подпись'));setRevealMode(q,'standard');
 assert.deepEqual(issues(p),[]);const files=unzipSync(await exportSIQ(p,new Map())),xml=strFromU8(files['content.xml']);
 assert.doesNotMatch(xml,/name="answer" type="content"|type="image"|Скрытая подпись/);
 assert.equal(Object.keys(files).length,1);assert.equal(q.customRevealSteps.length,1);
 assert.equal(mergeMedia(p,media).has('picture'),true);
 const back=importSIQ(zipSync(files));assert.equal(revealMode(back.pack.rounds[0].themes[0].questions[0]),'standard');
 setRevealMode(q,'custom');assert.equal(q.steps.at(-1).caption,'Скрытая подпись');
});
test('empty custom disclosure is rejected on export; imported empty disclosure remains editable',async()=>{
 const {p,q}=fixture(),xml=contentXML(p).replace('</params>','<param name="answer" type="content"></param></params>');
 setRevealMode(q,'custom');assert.throws(()=>contentXML(p),/Добавьте события.*стандартное поведение/);
 await assert.rejects(exportSIQ(p,new Map()),/Добавьте события.*стандартное поведение/);
 const qq=importSIQ(zipSync({'content.xml':strToU8(xml)})).pack.rounds[0].themes[0].questions[0];assert.equal(revealMode(qq),'custom');
 assert.ok(issues({...p,rounds:[{...p.rounds[0],themes:[{...p.rounds[0].themes[0],questions:[qq]}]}]}).some(issue=>issue.question===qq.id&&issue.message.includes('Добавьте события')));
});

test('preview uses standard answer or custom disclosure, including final order, without an extra answer screen',()=>{
 const {q,r,t}=fixture();let frames=createPreviewDemo(q,r,t).frames;assert.equal(frames.filter(f=>f.title==='Показать правильный ответ').length,1);
 q.steps.push(image('Подпись'));for(const type of ['standard','final']){
  r.type=type;frames=createPreviewDemo(q,r,t).frames;
  assert.equal(frames.some(f=>f.title==='Показать правильный ответ'),false);
  const at=frames.findIndex(f=>f.step?.type==='image');assert.equal(frames[at].step.caption,'Подпись');
  if(type==='final')assert.ok(at<frames.findIndex(f=>f.title==='Проверка ответов'));
 }
 setRevealMode(q,'standard');assert.equal(createPreviewDemo(q,r,t).frames.some(f=>f.step?.type==='image'),false);
});

test('caption timing stays in whole SIQ seconds, including odd totals, with a minimum of two',()=>{
 for(const seconds of [0,2,3,7,60,35999]){
  const st={...image('Подпись'),duration:seconds},pair=expandCaptions([st]);
  assert.ok(pair.every(item=>Number.isInteger(item.duration)));
  assert.equal(pair[0].duration+pair[1].duration,seconds);
  if(seconds)assert.ok(pair.every(item=>item.duration>=1));
 }
 const {p,q}=fixture();q.steps.splice(1,0,{...image('Подпись'),duration:1});
 assert.ok(issues(p,media).some(issue=>issue.message.includes('не менее 2 сек')));
 assert.throws(()=>contentXML(p),/не менее 2 сек/);
});
