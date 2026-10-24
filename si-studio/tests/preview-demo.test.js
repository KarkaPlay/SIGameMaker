import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,question,step} from '../dist/model.js';
import {createPreviewDemo,runDemoEvents} from '../dist/preview-demo.js';
function fixture(type='simple'){const pack=initial(),round=pack.rounds[0],theme=round.themes[0],q=question(200,'Вопрос','Верный ответ');q.type=type;return {pack,round,theme,q};}
test('demo is deterministic and read-only; snapshots support restart and back',()=>{
 const {pack,round,theme,q}=fixture(),before=structuredClone({pack,q}),a=createPreviewDemo(q,round,theme);
 assert.deepEqual(a,createPreviewDemo(q,round,theme));assert.deepEqual({pack,q},before);
 assert.deepEqual(a.frames.at(-1).players.map(p=>p.score),[1800,2700,3000]);
 a.frames.at(-1).players[0].score=0;assert.equal(a.frames[0].players[0].score,2000);
});
test('ordinary answers are one automatic stage: wrong answer, resume timer, correct answer',()=>{
 const {q,round,theme}=fixture(),frames=createPreviewDemo(q,round,theme).frames,f=frames.find(f=>f.answerWindow);
 assert.equal(frames.filter(f=>f.answerWindow).length,1);
 assert.deepEqual(f.events.filter(e=>e.popup?.verdict).map(e=>[e.popup.player,e.popup.verdict]),[[0,'wrong'],[1,'correct']]);
 const wrong=f.events.findIndex(e=>e.popup?.verdict==='wrong'),right=f.events.findIndex(e=>e.popup?.verdict==='correct');
 assert.ok(f.events.slice(wrong+1,right).some(e=>e.clock));assert.ok(f.events.some(e=>e.exit));
});
test('cat preserves transfer rules, disclosure and allowed cost while actions are bubbles',()=>{
 const {q,round,theme}=fixture('bagcat');q.cat={theme:'Секретная тема',selectionMode:'exceptCurrent',price:{minimum:350,maximum:350,step:0}};
 let frames=createPreviewDemo(q,round,theme).frames;
 assert.ok(!JSON.stringify(frames[0]).includes('Секретная тема'));assert.match(frames.find(f=>f.title==='Передача кота').events[0].popup.text,/Игроку 2/);
 assert.match(frames.find(f=>f.title==='Стоимость кота').events[0].popup.text,/350/);assert.equal(frames.at(-1).players[1].score,2850);
 q.cat.selectionMode='any';q.cat.showBeforeTransfer=true;frames=createPreviewDemo(q,round,theme).frames;
 assert.match(frames.find(f=>f.title==='Кот в мешке').scene,/Секретная тема/);assert.match(frames.find(f=>f.title==='Передача кота').events[0].popup.text,/Оставляю себе/);assert.equal(frames.at(-1).players[0].score,2350);
 q.cat.price={minimum:0,maximum:0,step:0};assert.match(createPreviewDemo(q,round,theme).frames.find(f=>f.title==='Выбор стоимости').events[0].popup.text,/500/);
 q.cat.price={minimum:100,maximum:400,step:100};assert.match(createPreviewDemo(q,round,theme).frames.find(f=>f.title==='Выбор стоимости').events[0].popup.text,/400/);
});
test('open auction animates ascending bids and passes, then only the winner answers',()=>{
 const {q,round,theme}=fixture('stake'),frames=createPreviewDemo(q,round,theme).frames;
 assert.deepEqual(frames.find(f=>f.title==='Открытые торги').events.filter(e=>e.popup).map(e=>e.popup.text),['Ставка 200','Ставка 300','Пас','Пас','Играю за 300']);
 assert.deepEqual(frames.find(f=>f.answerWindow).events.filter(e=>e.popup).map(e=>e.popup.player),[1,1]);
 assert.deepEqual(frames.at(-1).players.map(p=>p.score),[2000,2800,3000]);
});
test('hidden stakes mask every score, show the right answer first, then unmask verdicts one by one',()=>{
 const {q,round,theme}=fixture('stakeAll'),frames=createPreviewDemo(q,round,theme).frames,answer=frames.find(f=>f.answerWindow),check=frames.find(f=>f.title==='Проверка ответов');
 assert.ok(answer.players.every(p=>p.hidden));assert.ok(!JSON.stringify(answer).includes(q.answer));
 const reveal=frames.findIndex(f=>f.title==='Показать правильный ответ');assert.ok(reveal>=0&&reveal<frames.indexOf(check));
 assert.deepEqual(check.events.filter(e=>e.popup?.verdict).map(e=>e.players.map(p=>p.hidden)),[[false,true,true],[false,false,true],[false,false,false]]);
 assert.deepEqual(frames.at(-1).players.map(p=>p.score),[2200,2200,3400]);
});
test('content and reveal media retain IDs; configured answer duration remains intact',()=>{
 const {q,round,theme}=fixture();q.steps[1].duration=17;q.steps.push({...step('image'),mediaId:'answer-image'});
 const frames=createPreviewDemo(q,round,theme).frames;assert.equal(frames.find(f=>f.answerWindow).clockSeconds,17);
 assert.equal(frames.find(f=>f.step?.mediaId==='answer-image').contentIndex,2);
 round.type='final';assert.ok(createPreviewDemo(q,round,theme).frames.some(f=>f.title==='Проверка ответов'));
});
test('runner pauses countdown during bubbles, resumes thinking, completes once and cancels safely',()=>{
 let now=0,tick,cancelled=0,done=0;const seen=[],clocks=[];
 const frame={clockSeconds:2,events:[{duration:1000,clock:true},{duration:1000,popup:{text:'Ответ'}},{duration:1000,clock:true}]};
 const stop=runDemoEvents(frame,{onEvent:e=>seen.push(e),onClock:(left,running)=>clocks.push([left,running]),onDone:()=>done++},{now:()=>now,schedule:fn=>{tick=fn;return 1;},cancel:()=>cancelled++});
 now=500;tick();assert.deepEqual(clocks.at(-1),[1.5,true]);now=1500;tick();assert.deepEqual(clocks.at(-1),[1,false]);now=2500;tick();assert.deepEqual(clocks.at(-1),[.5,true]);now=3100;tick();tick();stop();assert.equal(done,1);assert.equal(cancelled,1);assert.equal(seen.length,3);
 let late=0;const cancel=runDemoEvents(frame,{onEvent(){},onClock(){},onDone:()=>late++},{now:()=>now,schedule:fn=>{tick=fn;return 2;},cancel(){}});cancel();now+=10000;tick();assert.equal(late,0);
});

test('every preview starts with the same animated schematic selection and returns to the board with final scores',()=>{
 for(const type of ['simple','stake','stakeAll','bagcat']){
  const {q,round,theme}=fixture(type),before=structuredClone(q),frames=createPreviewDemo(q,round,theme).frames;
  assert.equal(frames[0].board,'select');assert.equal(frames[0].autoAdvance,true);
  assert.deepEqual(frames[0].events.map(e=>e.boardSelection),[false,true]);
  assert.equal(frames[0].summary,'Тема 2 · 300');
  assert.equal(frames.at(-1).board,'return');assert.equal(frames.at(-1).finished,true);
  assert.equal(frames.at(-1).reveal,undefined);assert.equal(frames.at(-1).scene,undefined);
  assert.ok(!frames.some(f=>f.scene==='Вопрос завершён'));assert.deepEqual(q,before);
  const lastVerdict=frames.flatMap(f=>f.events).findLast(e=>e.popup?.verdict);
  assert.deepEqual(frames.at(-1).players,lastVerdict.players);
 }
});
test('scenario frame labels and summaries use editor event names on both sides of answering',async()=>{
 const {kinds,stepSummary,answerLabel}=await import('../dist/model.js');
 const {q,round,theme}=fixture();q.steps.splice(1,0,{...step('image'),filename:'Фото.png',caption:'Подпись'});
 q.steps.push({...step('audio'),filename:'Ответ.mp3'},step('text','Пояснение'));
 const frames=createPreviewDemo(q,round,theme).frames;
 for(const frame of frames.filter(f=>f.step&&!f.answerWindow)){
  assert.equal(frame.title,kinds[frame.step.type][0]);assert.equal(frame.kind,frame.step.type);assert.equal(frame.summary,stepSummary(frame.step));
 }
 assert.equal(frames.find(f=>f.answerWindow).title,answerLabel(q,round));
 assert.equal(frames.some(f=>/Событие|Раскрытие · событие/.test(f.title)),false);
});
