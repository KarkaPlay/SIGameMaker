import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {FixtureDOMParser} from './helpers/xml-parser.js';
import {importSIQ,exportSIQ,contentXML,SIQImportError} from '../dist/siq.js';
import {issues} from '../dist/model.js';
import {zipSync,strToU8} from '../dist/vendor/fflate.js';
globalThis.DOMParser=FixtureDOMParser;
const question=`<question price="0" type="Другой"><info><sources><source>Источник</source></sources><showmanComments>Ведущему</showmanComments></info><params><param name="question" type="content"><item>Вопрос о звёздах</item></param></params><right><answer>Чёрная вдова</answer><answer>Черная вдова</answer></right><wrong><answer>Другое</answer></wrong></question>`;
const pack=q=>`<package name="Космос" version="5"><rounds><round name="ФИНАЛ" type="final"><themes><theme name="Звёздные пары"><questions>${q}</questions></theme></themes></round></rounds></package>`;
const zip=(xml,files={})=>zipSync({'content.xml':strToU8(xml),...files});
const approval={repairQuestions:new Set(['r:0/t:0/q:0'])};
const first=p=>p.rounds[0].themes[0].questions[0];
const rejected=xml=>assert.throws(()=>importSIQ(zip(xml)),e=>e instanceof SIQImportError&&e.issues.some(i=>i.code==='question-type'));
test('literal Другой is rejected first and repaired only after explicit approval',async()=>{
 const bytes=zip(pack(question)),before=bytes.slice();assert.throws(()=>importSIQ(bytes),e=>e instanceof SIQImportError&&e.issues.some(i=>i.canRepair));const result=importSIQ(bytes,approval),q=first(result.pack);
 assert.deepEqual(bytes,before);assert.equal(q.type,'simple');assert.equal(q.answer,'Чёрная вдова');assert.equal(q.alternatives,'Черная вдова');assert.equal(q.wrong,'Другое');assert.equal(q.comment,'Ведущему');assert.equal(q.source,'Источник');assert.deepEqual(q.steps.map(s=>s.type),['text','answer']);assert.deepEqual(issues(result.pack),[]);
 assert.equal(result.repairs.length,1);assert.match(result.repairs[0].location,/ФИНАЛ.*Звёздные пары.*вопрос 1/);assert.equal(result.repairs[0].fromType,'Другой');assert.equal(result.repairs[0].toType,'simple');
 const xml=contentXML(result.pack);assert.doesNotMatch(xml,/type="Другой"|type="simple"/);const dir=mkdtempSync(join(tmpdir(),'si-final-other-'));writeFileSync(join(dir,'fixed.xml'),xml);execFileSync('xmllint',['--noout','--schema','docs/siq_5.xsd',join(dir,'fixed.xml')]);
 const back=importSIQ(await exportSIQ(result.pack,result.media));assert.equal(first(back.pack).answer,q.answer);assert.equal(first(back.pack).type,'simple');assert.deepEqual(back.repairs,[]);
});
test('repair retains standard answer content, timer, embedded binary media and step properties',async()=>{
 const q=question.replace('</params>','<param name="answerDuration">17</param><param name="answer" type="content"><item type="image" isRef="true" duration="00:00:04" waitForFinish="false">image.png</item></param></params>');
 const result=importSIQ(zip(pack(q),{'Images/image.png':new Uint8Array([1,2,255])}),approval),rq=first(result.pack);assert.equal(rq.steps[1].duration,17);assert.equal(rq.steps[2].duration,4);assert.equal(rq.steps[2].wait,false);assert.equal(result.repairs.length,1);
 const back=importSIQ(await exportSIQ(result.pack,result.media)),image=first(back.pack).steps[2];assert.deepEqual([...new Uint8Array(await back.media.get(image.mediaId).arrayBuffer())],[1,2,255]);assert.equal(first(back.pack).steps[1].duration,17);
});
test('repair is limited to exact Другой in finals without scripts, special parameters or legacy scenarios',()=>{
 rejected(pack(question).replace('type="final"','type="standard"'));
 rejected(pack(question).replace('version="5"','version="4"'));
 for(const type of ['Другое','другой','Other','custom'])rejected(pack(question.replace('type="Другой"',`type="${type}"`)));
 for(const extra of ['<script/>','<script><step type="setAnswerer"/></script>','<scenario><atom>Legacy</atom></scenario>','<type name="Другой"><param name="custom">x</param></type>','<custom/>'])rejected(pack(question.replace('<params>',extra+'<params>')));
 for(const name of ['custom','theme','price','selectionMode'])rejected(pack(question.replace('<params>',`<params><param name="${name}">x</param>`)));
 rejected(pack(question.replace('name="question" type="content"','name="question" type="content" isRef="true"')));
 rejected(pack(question.replace('<params><param name="question" type="content"><item>Вопрос о звёздах</item></param></params>','')));
});
test('ordinary validation still rejects invalid content, timers, missing media and multiple final questions',()=>{
 for(const q of [question.replace('<item>','<item type="html">'),question.replace('</params>','<param name="answerDuration">bad</param></params>'),question.replace('<item>Вопрос о звёздах</item>','<item type="image" isRef="true">missing.png</item>'),question.replace('</params>','<param name="answerDuration">1</param><param name="answerDuration">2</param></params>')])assert.throws(()=>importSIQ(zip(pack(q)),approval),SIQImportError);
 assert.throws(()=>importSIQ(zip(pack(question+question))),e=>e instanceof SIQImportError&&e.issues.some(i=>i.code==='final-structure'));
});
