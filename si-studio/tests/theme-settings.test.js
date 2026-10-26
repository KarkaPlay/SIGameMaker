import test from 'node:test';
import assert from 'node:assert/strict';
import {initial} from '../dist/model.js';
import {resizedThemeQuestions,applyRoundSettings} from '../dist/pricing.js';

test('growing a theme keeps existing question objects and uses round pricing for appended questions',()=>{
 const p=initial(),r=p.rounds[0],t=r.themes[0],before=structuredClone(t),existing=[...t.questions];
 r.priceMultiplier=3;
 const next=resizedThemeQuestions(p,r,t,7);
 assert.deepEqual(t,before);
 assert.equal(next.length,7);
 existing.forEach((q,i)=>assert.equal(next[i],q));
 assert.deepEqual(next.slice(5).map(q=>q.price),[1800,2100]);
 assert.equal(new Set(next.map(q=>q.id)).size,7);
});
test('shrinking removes questions from the end and does not mutate the original or retained scripts',()=>{
 const p=initial(),r=p.rounds[0],t=r.themes[0],before=structuredClone(t);
 const next=resizedThemeQuestions(p,r,t,2);
 assert.equal(next.length,2);assert.equal(next[0],t.questions[0]);assert.equal(next[1],t.questions[1]);
 assert.deepEqual(t,before);
});
test('interlude additions use the shared price; failed generation does not partly resize a theme',()=>{
 const p=initial(),r=p.rounds[0],t=r.themes[0];
 applyRoundSettings(r,{type:'interlude',questionPrice:325});
 assert.ok(resizedThemeQuestions(p,r,t,8).every(q=>q.price===325));
 const before=structuredClone(t);
 for(const count of [0,-1,1.5,NaN,101])assert.throws(()=>resizedThemeQuestions(p,r,t,count),/количество/);
 r.questionPrice=NaN;
 assert.throws(()=>resizedThemeQuestions(p,r,t,8),/стоимость/);
 assert.deepEqual(t,before);
});
test('final theme settings preserve question count and never silently trim an imported invalid final',()=>{
 const p=initial(),r=p.rounds.at(-1),t=r.themes[0];
 r.type='final';
 t.questions=t.questions.slice(0,1);
 assert.equal(resizedThemeQuestions(p,r,t,1)[0],t.questions[0]);
 assert.throws(()=>resizedThemeQuestions(p,r,t,2),/один вопрос/);
 t.questions.push({...t.questions[0],id:'extra'});
 assert.equal(resizedThemeQuestions(p,r,t,2).length,2);
});
