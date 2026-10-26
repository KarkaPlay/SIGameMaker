import {initial,uid,question} from './model.js';

export function defaultSetup(){return {name:'',author:'',language:'ru-RU',rounds:[{name:'Первый раунд',themes:6},{name:'Второй раунд',themes:6}],questions:5,basePrice:100,priceStep:100,multiplyPrices:true,hasFinal:true,finalThemes:7};}
const settings=(c,r)=>({questions:r.questions??c.questions,basePrice:r.basePrice??c.basePrice,priceStep:r.priceStep??c.priceStep,multiplyPrices:r.multiplyPrices??c.multiplyPrices});
// Returning without a clicked card always selects the first round.
export function setupReviewRound(rounds,id=null){return (id===null?null:rounds.find(r=>String(r.id)===String(id)))||rounds[0];}
// Price nudges preserve manually entered integers, including values not divisible by 100.
export function nudgeSetupValue(value,key,direction,min,max){const numeric=Number(value),start=Number.isFinite(numeric)?numeric:min;return Math.max(min,Math.min(max,start+direction*(['base','step'].includes(key)?100:1)));}
// Keep the generator compatible with saved global settings and the wizard's per-round settings.
export function toSetupConfig(s){const standard=s.rounds.filter(r=>r.type!=='final'),final=s.rounds.find(r=>r.type==='final'),first=standard[0];return {...defaultSetup(),name:s.name,author:s.author,language:s.english?'en-US':'ru-RU',rounds:standard.map(r=>({... (r.type==='interlude'?{type:'interlude'}:{}),name:r.name,themes:r.themes,questions:r.questions,basePrice:r.base,priceStep:r.step,multiplyPrices:r.multiply})),questions:first?.questions,basePrice:first?.base,priceStep:first?.step,multiplyPrices:first?.multiply,hasFinal:!!final,finalThemes:final?.themes??7,finalName:final?.name??'Финал'};}
export function setupErrors(c){
 const errors=[],integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 if(!c.name.trim())errors.push('Введите название пака.');
 if(!integer(c.rounds.length,1,10))errors.push('Выберите от 1 до 10 раундов.');
 for(const [i,r] of c.rounds.entries()){
  if(!r.name.trim())errors.push(`Укажите название раунда ${i+1}.`);
  if(!integer(r.themes,1,12))errors.push(`В раунде ${i+1} должно быть от 1 до 12 тем.`);
  const v=settings(c,r);
  if(r.type!==undefined&&!['standard','interlude'].includes(r.type))errors.push('Выберите корректный тип раунда.');
  if(!integer(v.questions,1,10))errors.push('Выберите от 1 до 10 вопросов в теме.');
  if(!integer(v.basePrice,0,100000)||!integer(v.priceStep,0,100000))errors.push('Укажите корректную начальную стоимость и шаг цены.');
 }
 if(c.hasFinal&&!integer(c.finalThemes,1,12))errors.push('В финале должно быть от 1 до 12 тем.');
 if(c.hasFinal&&c.finalName!==undefined&&!c.finalName.trim())errors.push('Укажите название финала.');
 return errors;
}
export function setupCounts(c){return {themes:c.rounds.reduce((n,r)=>n+r.themes,0)+(c.hasFinal?c.finalThemes:0),questions:c.rounds.reduce((n,r)=>n+r.themes*settings(c,r).questions,0)+(c.hasFinal?c.finalThemes:0)};}
export const setupQuestionPrice=(c,round,index)=>{const r=c.rounds[round],v=settings(c,r);if(r.type==='interlude')return v.basePrice;return (v.basePrice+index*v.priceStep)*(v.multiplyPrices?round+1:1);};
export function buildPack(c){
 const errors=setupErrors(c);if(errors.length)throw Error(errors[0]);
 const p=initial(false);p.name=c.name.trim();p.author=c.author.trim();p.language=c.language;
 p.pricing={basePrice:c.basePrice,priceStep:c.priceStep,questions:c.questions,multiplyPrices:c.multiplyPrices};
 p.rounds=c.rounds.map((r,i)=>{const v=settings(c,r);return {id:uid(),name:r.name.trim(),type:r.type||'standard',...(r.type==='interlude'?{questionPrice:v.basePrice}:{}),priceMultiplier:r.type==='interlude'?1:v.multiplyPrices?null:1,...(r.basePrice!==undefined?{pricing:{basePrice:v.basePrice,priceStep:v.priceStep,questions:v.questions,multiplyPrices:v.multiplyPrices}}:{}),themes:Array.from({length:r.themes},(_,t)=>({id:uid(),name:`Тема ${t+1}`,questions:Array.from({length:v.questions},(_,q)=>question(setupQuestionPrice(c,i,q)))}))};});
 if(c.hasFinal)p.rounds.push({id:uid(),name:c.finalName?.trim()||'Финал',type:'final',themes:Array.from({length:c.finalThemes},(_,i)=>({id:uid(),name:`Финальная тема ${i+1}`,questions:[question(0)]}))});
 return p;
}
