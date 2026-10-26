import {revealMode} from './scenario.js';
import {questionType,catSettings,kinds,stepKind,stepSummary,answerLabel} from './model.js';

// Each stage has a deterministic local animation, with snapshots for back/restart.
export function createPreviewDemo(q,round,theme){
 const type=round.type==='final'?'stakeAll':questionType(q),nominal=Math.max(0,Number(q.price)||0),base=Math.max(1000,nominal*10),right=q.answer.trim()||'Ответ не указан';
 let players=Array.from({length:3},(_,i)=>({name:`Игрок ${i+1}`,score:base+i*500,hidden:false})),price=nominal,recipient=1;
 const frames=[],bids=[Math.max(1,nominal),Math.max(1,nominal)+100,Math.max(1,nominal)+200];
 const snapshot=()=>structuredClone(players);
 const add=(title,extra={})=>{const frame={title,kind:'answer',players:snapshot(),events:[],...extra};frames.push(frame);return frame;};
 const popup=(frame,player,text,duration=1100,extra={})=>frame.events.push({duration,popup:{player,text},players:snapshot(),...extra});
 const clear=frame=>frame.events.push({duration:250,exit:true,players:snapshot()});
 const judge=(frame,i,correct,amount)=>{
  popup(frame,i,correct?right:'Другой ответ',1200);
  players[i].score+=correct?amount:type==='noRisk'?0:-amount;players[i].hidden=false;
  popup(frame,i,correct?'Верно':'Неверно',1000,{popup:{player:i,text:correct?'Верно':'Неверно',verdict:correct?'correct':'wrong',delta:(correct?'+':'−')+amount}});clear(frame);
 };
 const board=add('Выбор вопроса',{kind:'board',board:'select',summary:'Тема 2 · 300',autoAdvance:true});
 board.events.push({duration:500,boardSelection:false,players:snapshot()},{duration:1000,boardSelection:true,players:snapshot()});
 if(type==='bagcat'){
  const cat=catSettings(q),p=cat.price,prices=round.themes.flatMap(t=>t.questions.map(q=>q.price)).filter(n=>Number.isFinite(n)&&n>=0);
  price=p.maximum===0?Math.max(0,...prices):p.minimum===p.maximum?p.minimum:p.step?p.minimum+Math.floor((p.maximum-p.minimum)/p.step)*p.step:p.maximum;
  add('Кот в мешке',{kind:'bagcat',scene:cat.showBeforeTransfer?`${cat.theme||theme.name} · ${price}`:'Кот в мешке'});
  recipient=cat.selectionMode==='any'?0:1;const transfer=add('Передача кота',{kind:'bagcat',scene:'Кому достанется вопрос?'});
  popup(transfer,0,recipient===0?'Оставляю себе':'Передаю Игроку 2');clear(transfer);popup(transfer,recipient,'Вопрос мой');clear(transfer);
  add('Тема кота',{kind:'bagcat',scene:cat.theme||theme.name});const cost=add(p.maximum!==0&&p.minimum===p.maximum?'Стоимость кота':'Выбор стоимости',{kind:'bagcat',scene:cat.theme||theme.name});
  popup(cost,recipient,p.maximum!==0&&p.minimum===p.maximum?`Стоимость ${price}`:`Выбираю ${price}`);clear(cost);
 }else if(type==='noRisk'){
  price=nominal*2;recipient=0;add('Без риска',{scene:`Верный ответ: +${price}. Ошибка: без потери очков.`,summary:'Отвечает выбравший вопрос',symbol:'♡'});
 }else if(type==='stake'){
  price=nominal+100;const auction=add('Открытые торги',{kind:'stake',scene:'Аукцион'});
  popup(auction,0,`Ставка ${nominal}`);clear(auction);popup(auction,1,`Ставка ${price}`);clear(auction);popup(auction,2,'Пас');clear(auction);popup(auction,0,'Пас');clear(auction);popup(auction,1,`Играю за ${price}`);clear(auction);
 }else if(type==='stakeAll'){
  const stake=add('Скрытые ставки',{kind:'stake',scene:'Скрытые ставки'});
  for(let i=0;i<3;i++){players[i].hidden=true;popup(stake,i,'Ставка сделана',800);clear(stake);}
 }
 const marker=q.steps.findIndex(st=>st.type==='answer'),split=marker<0?q.steps.length:marker,lastVisual=q.steps.slice(0,split).findLastIndex(st=>['text','image'].includes(st.type)&&(!st.placement||st.placement==='screen'));
 const contentFrame=(i,extra={})=>{const st=q.steps[i],kind=stepKind(st),replic=kind==='replic',previous=q.steps.slice(0,i).findLastIndex(s=>['text','image'].includes(s.type)&&(!s.placement||s.placement==='screen'));return add(kinds[kind][0],{kind,summary:stepSummary(st),contentIndex:replic?(previous>=0?previous:undefined):i,step:st,...(replic?{replic:st.value}:{}),...extra});};
 for(let i=0;i<split;i++)contentFrame(i);
 const duration=q.steps[marker]?.duration||10,answer=add(answerLabel(q,round),{kind:'answer',summary:stepSummary(q.steps[marker]||{type:'answer',duration:0}),answerWindow:true,step:q.steps[marker]||{type:'answer',duration:0},contentIndex:lastVisual>=0?lastVisual:undefined,scene:'Время ответа',clockSeconds:duration});
 const think=fraction=>answer.events.push({duration:duration*1000*fraction,clock:true,players:snapshot()});
 if(type==='simple'){
  think(.3);judge(answer,0,false,price);think(.3);judge(answer,1,true,price);
 }else if(type==='stakeAll'){
  think(.7);for(let i=0;i<3;i++){popup(answer,i,'Ответ записан',450);clear(answer);}think(.3);
 }else{think(.5);judge(answer,type==='stake'?1:recipient,true,price);}
 if(revealMode(q)==='standard'){
  const reveal=add('Показать правильный ответ',{kind:'answer',symbol:'✓',summary:right,scene:right,reveal:true,autoAdvance:type==='stakeAll'});if(type==='stakeAll')reveal.events.push({duration:1400,players:snapshot()});
 }else{
  for(let i=split+1;i<q.steps.length;i++)contentFrame(i,{reveal:true,autoAdvance:type==='stakeAll'&&i===q.steps.length-1});
 }
 if(type==='stakeAll'){
  const check=add('Проверка ответов',{scene:'Проверка ответов игроков',reveal:true,autoAdvance:true});for(let i=0;i<3;i++)judge(check,i,i!==1,bids[i]);
 }
 add('Возврат к игровому полю',{kind:'board',board:'return',summary:'Игра продолжается',finished:true});
 return {questionId:q.id,frames};
}

export {runDemoEvents} from './preview-timer.js';
