import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,questionReadiness,issues,step} from '../dist/model.js';

function fixture(){const p=initial(),r=p.rounds[0],t=r.themes[0],q=t.questions[0];return {p,r,q};}
function failed(q,r,media){return questionReadiness(q,r,media).filter(check=>!check.passed).map(check=>check.id);}

test('readiness and question validation use the same requirements, with optional metadata left optional',()=>{
 const {p,r,q}=fixture();assert.deepEqual(failed(q,r),[]);
 q.answer=' ';q.steps[0].value=' ';q.price=-1;q.type='unknown';
 assert.deepEqual(failed(q,r),['content','answer','events','type','price']);
 const checkErrors=questionReadiness(q,r).flatMap(check=>check.errors);
 const exportErrors=issues(p).filter(error=>error.question===q.id);
 assert.equal(checkErrors.length,exportErrors.length);
 for(const error of checkErrors)assert.ok(exportErrors.some(item=>item.message.endsWith(error.message)));
});

test('readiness requires content before one answer event and verifies media and event timing on both sides',()=>{
 const {r,q}=fixture();q.steps=[step('answer'),step('text','Only a reveal')];assert.deepEqual(failed(q,r),['content']);
 q.steps.unshift({...step('image'),mediaId:'picture'});assert.deepEqual(failed(q,r),['events']);
 const media=new Map([['picture',new Blob(['image'])]]);assert.deepEqual(failed(q,r,media),[]);
 q.steps.at(-1).duration=-1;q.steps.push(step('answer'));assert.deepEqual(failed(q,r,media),['answer-event','events']);
 q.steps=q.steps.filter(s=>s.type!=='answer');assert.ok(failed(q,r,media).includes('answer-event'));
});

test('final readiness omits a fixed price and requires the final-compatible type',()=>{
 const {r,q}=fixture();r.type='final';q.price=-1;
 assert.deepEqual(failed(q,r),[]);assert.equal(questionReadiness(q,r).some(check=>check.id==='price'),false);
 q.type='stake';assert.deepEqual(failed(q,r),['type']);
});

test('compact checklist uses action text per error and targets stable event IDs',async()=>{
 const {questionChecklist}=await import('../dist/model.js');
 const {r,q}=fixture();q.answer='';q.steps[0].value='';const image=step('image');q.steps.splice(1,0,image);
 const rows=questionChecklist(q,r),missing=rows.filter(row=>!row.passed);
 assert.ok(missing.some(row=>row.target==='content'&&row.label==='Добавьте текст или медиа перед ответом игроков'));
 assert.ok(missing.some(row=>row.stepId===q.steps[0].id&&row.field==='value'&&row.label==='Событие 1: добавьте текст'));
 assert.ok(missing.some(row=>row.stepId===image.id&&row.field==='media'&&row.label==='Событие 2: загрузите файл'));
 assert.ok(missing.some(row=>row.target==='answer'));
 q.steps[0].value='Вопрос';q.answer='Ответ';const media=new Map([[image.id,new Blob()]]);image.mediaId=image.id;
 const complete=questionChecklist(q,r,media);assert.equal(complete.length,3);assert.ok(complete.every(row=>row.passed));
 assert.equal(complete.some(row=>/Стоимость|тип вопроса|одно событие/.test(row.label)),false);
});
