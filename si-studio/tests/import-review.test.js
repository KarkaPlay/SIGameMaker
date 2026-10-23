import test from 'node:test';
import assert from 'node:assert/strict';
import {FixtureDOMParser} from './helpers/xml-parser.js';
import {createImportReview} from '../dist/import-review.js';
import {importReportHTML,importReadyHTML} from '../dist/import-report.js';
import {zipSync,strToU8} from '../dist/vendor/fflate.js';
globalThis.DOMParser=FixtureDOMParser;
const q=(type='Другой',extra='')=>`<question price="600" type="${type}">${extra}<params><param name="question" type="content"><item>Вопрос</item></param></params><right><answer>Ответ</answer></right></question>`;
const round=(qs,type='final')=>`<round name="Раунд" type="${type}"><themes><theme name="Тема"><questions>${qs}</questions></theme></themes></round>`;
const pack=rounds=>`<package name="Тест" version="5"><rounds>${rounds}</rounds></package>`;
const review=xml=>createImportReview(zipSync({'content.xml':strToU8(xml)}));
const first=s=>s.result.pack.rounds[0].themes[0].questions[0];
test('review rejects first, offers located actions and repairs only after explicit action',()=>{
 const bytes=zipSync({'content.xml':strToU8(pack(round(q())))}),before=bytes.slice(),r=createImportReview(bytes),state=r.scan();assert.equal(state.result,undefined);assert.equal(state.issues.length,1);assert.equal(state.issues[0].canRepair,true);assert.equal(state.issues[0].target.key,'r:0/t:0/q:0');
 const html=importReportHTML(state.error,'пак.siq',{interactive:true,revision:state.revision});assert.match(html,/>Исправить<\/button>/);assert.match(html,/>Очистить<\/button>/);assert.match(html,/содержимое вопроса/);
 const fixed=r.apply(0,'repair',state.revision);assert.ok(fixed.result);assert.equal(first(fixed).type,'simple');assert.equal(first(fixed).answer,'Ответ');assert.equal(fixed.result.repairs.length,1);assert.deepEqual(bytes,before);
});
test('unsafe repair keeps every error and clear replaces only the selected question with an empty slot',()=>{
 const r=review(pack(round(q('custom','<script/>')+q('simple'), 'standard')));let state=r.scan();assert.equal(state.issues.length,2);const failed=r.apply(0,'repair',state.revision);assert.equal(failed.result,undefined);assert.deepEqual(failed.issues.map(i=>i.code),state.issues.map(i=>i.code));assert.match(failed.notice,/Не удалось исправить/);
 const cleared=r.apply(1,'clear',failed.revision);assert.ok(cleared.result);const qs=cleared.result.pack.rounds[0].themes[0].questions;assert.equal(qs.length,2);assert.equal(qs[0].price,600);assert.equal(qs[0].answer,'');assert.equal(qs[0].type,'simple');assert.deepEqual(qs[0].steps.map(s=>s.type),['text','answer']);assert.equal(qs[0].steps[0].value,'');assert.equal(qs[1].answer,'Ответ');assert.equal(cleared.result.media.size,0);
});
test('round errors clear a round without touching its neighbors or final rules',()=>{
 const r=review(pack(round(q('simple')+q('simple'))+round(q('simple'),'standard')));const state=r.scan();assert.equal(state.issues.length,1);assert.equal(state.issues[0].target.kind,'round');assert.match(importReportHTML(state.error,'pack.siq',{interactive:true}),/всех вопросов раунда/);
 const clear=r.apply(0,'clear',state.revision);assert.ok(clear.result);assert.equal(clear.result.pack.rounds.length,2);assert.equal(clear.result.pack.rounds[0].type,'final');assert.equal(clear.result.pack.rounds[0].themes[0].questions.length,1);assert.equal(first(clear).answer,'');assert.equal(clear.result.pack.rounds[1].themes[0].questions[0].answer,'Ответ');
});
test('decisions retain original positions across multiple errors; stale row revisions cannot clear neighbors',()=>{
 const r=review(pack(round(q())+round(q())));let state=r.scan();assert.equal(state.issues.length,2);const stale=state.revision;state=r.apply(0,'repair',state.revision);assert.equal(state.issues.length,1);assert.equal(state.issues[0].target.key,'r:1/t:0/q:0');const ignored=r.apply(0,'clear',stale);assert.equal(ignored,state);
 state=r.apply(0,'repair',state.revision);assert.ok(state.result);assert.equal(state.result.repairs.length,2);assert.equal(state.result.pack.rounds[1].themes[0].questions[0].answer,'Ответ');assert.equal(first(state).answer,'Ответ');
});
test('successful type repair does not conceal other errors in that question',()=>{
 const broken=q().replace('<item>Вопрос</item>','<item type="image" isRef="true">missing.png</item>');const r=review(pack(round(broken)));let state=r.scan();assert.equal(state.issues.length,2);state=r.apply(state.issues.findIndex(i=>i.canRepair),'repair',state.revision);assert.equal(state.result,undefined);assert.equal(state.issues.length,1);assert.match(state.issues[0].message,/missing.png/);state=r.apply(0,'clear',state.revision);assert.ok(state.result);assert.equal(first(state).answer,'');
});
test('fatal archives show an unavailable clear action and cannot mutate anything by guessing a target',()=>{
 const r=createImportReview(new Uint8Array([1,2,3]));let state=r.scan();assert.equal(state.result,undefined);assert.equal(state.issues[0].target,undefined);const html=importReportHTML(state.error,'<pack>.siq',{interactive:true});assert.match(html,/>Исправить<\/button>/);assert.match(html,/disabled title="Не удалось определить вопрос или раунд">Очистить/);assert.doesNotMatch(html,/<pack>/);
 state=r.apply(0,'repair',state.revision);assert.equal(state.result,undefined);state=r.apply(0,'clear',state.revision);assert.equal(state.result,undefined);assert.match(state.notice,/Очистка недоступна/);
});
test('discarding a review discards its clearing decisions; a fresh import still reports original errors',()=>{
 const xml=pack(round(q('custom','<script/>'),'standard')),r=review(xml),state=r.scan();assert.ok(r.apply(0,'clear',state.revision).result);const fresh=review(xml).scan();assert.equal(fresh.result,undefined);assert.ok(fresh.issues.some(i=>i.code==='question-type'));assert.ok(fresh.issues.some(i=>i.code==='script'));
});

test('successful repair produces a separate ready summary; failed repair remains an explicit failure',()=>{
 const r=review(pack(round(q()))),initial=r.scan(),fixed=r.apply(0,'repair',initial.revision);
 assert.equal(fixed.outcome,'success');assert.equal(fixed.summary.repairedQuestions,1);assert.equal(fixed.issues.length,0);
 const ready=importReadyHTML(fixed,'<пак>.siq');assert.match(ready,/Проблем импорта больше нет/);assert.match(ready,/Удалось исправить тип вопроса/);assert.match(ready,/Теперь можно открыть/);assert.match(ready,/пока не заменён/);assert.doesNotMatch(ready,/<пак>|Не удалось открыть/);
 const unsafe=review(pack(round(q('custom'),'standard'))),bad=unsafe.scan(),failed=unsafe.apply(0,'repair',bad.revision);assert.equal(failed.outcome,'failure');assert.equal(failed.result,undefined);
 const report=importReportHTML(failed.error,'pack.siq',{interactive:true,revision:failed.revision,notice:failed.notice,outcome:failed.outcome});assert.match(report,/is-failure/);assert.match(report,/Не удалось исправить/);assert.match(report,/Осталось ошибок импорта: 1/);assert.match(report,/primary import-repair-button/);assert.match(report,/secondary import-clear-button/);
});
test('ready summary after multiple operations retains the notice that cleared questions need filling',()=>{
 const r=review(pack(round(q('custom'),'standard')+round(q())));let state=r.scan();state=r.apply(0,'clear',state.revision);assert.equal(state.result,undefined);assert.equal(state.summary.clearedQuestions,1);state=r.apply(0,'repair',state.revision);
 assert.ok(state.result);assert.equal(state.summary.clearedQuestions,1);assert.equal(state.summary.repairedQuestions,1);assert.match(importReadyHTML(state,'pack.siq'),/Очищенные вопросы остались пустыми/);assert.match(state.notice,/Удалось исправить/);
});
