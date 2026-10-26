import {uid,question,validQuestionPrice,finalRoundError} from './model.js';
const nonnegative=v=>Number.isSafeInteger(v)&&v>=0;
export const validMultiplier=v=>Number.isSafeInteger(v)&&v>=1;
export function priceSettings(p,r){const c=r?.pricing||p.pricing||{};return {basePrice:nonnegative(c.basePrice)?c.basePrice:100,priceStep:nonnegative(c.priceStep)?c.priceStep:100,questions:Number.isSafeInteger(c.questions)&&c.questions>=0&&c.questions<=100?c.questions:5,multiplyPrices:c.multiplyPrices!==false};}
export function roundMultiplier(p,r){return validMultiplier(r.priceMultiplier)?r.priceMultiplier:Math.max(1,p.rounds.indexOf(r)+1);}
export function newQuestionPrice(p,r,index){if(r.type==='final')return 0;if(r.type==='interlude'){if(!validQuestionPrice(r.questionPrice))throw Error('Укажите корректную стоимость вопросов интерлюдии.');return r.questionPrice;}const c=priceSettings(p,r),price=(c.basePrice+index*c.priceStep)*roundMultiplier(p,r);if(!nonnegative(price))throw Error('Стоимость слишком велика. Уменьшите множитель раунда.');return price;}
export function newRoundTheme(p,r,name='Новая тема'){const last=r.themes.at(-1),count=r.type==='final'?1:last?last.questions.length:priceSettings(p,r).questions;return {id:uid(),name,questions:Array.from({length:count},(_,i)=>question(newQuestionPrice(p,r,i)))};}
export function newRound(p,type){if(!['standard','final','interlude'].includes(type))return null;const final=type==='final',r={id:uid(),name:final?'Финал':type==='interlude'?'Интерлюдия':`Раунд ${p.rounds.filter(r=>r.type==='standard').length+1}`,type,priceMultiplier:priceSettings(p).multiplyPrices?null:1,themes:[]};
 if(type==='interlude')r.questionPrice=validQuestionPrice(priceSettings(p).basePrice)?priceSettings(p).basePrice:100;
 // Price calculation uses the future position without mutating the current package.
 const context={...p,rounds:[...p.rounds,r]};r.themes=final?Array.from({length:7},(_,i)=>newRoundTheme(context,r,`Финальная тема ${i+1}`)):[newRoundTheme(context,r)];return r;
}
export function pricingMetadata(p){return {version:1,pricing:priceSettings(p),rounds:p.rounds.map(r=>({name:r.name,type:r.type,...(r.type==='interlude'?{questionPrice:r.questionPrice}:{}),priceMultiplier:validMultiplier(r.priceMultiplier)?r.priceMultiplier:null,...(r.pricing?{pricing:priceSettings(p,r)}:{})}))};}
const validSettings=c=>c&&nonnegative(c.basePrice)&&nonnegative(c.priceStep)&&Number.isSafeInteger(c.questions)&&c.questions>=0&&c.questions<=100&&typeof c.multiplyPrices==='boolean';
// Optional editor metadata may identify an interlude only when the XML prices agree.
export function restorePricing(p,data){
 if(data?.version!==1||!data.pricing||!Array.isArray(data.rounds)||data.rounds.length!==p.rounds.length)return;
 const c=data.pricing;
 if(!validSettings(c)||data.rounds.some((r,i)=>{
  const target=p.rounds[i];
  return !r||r.name!==target.name||!(r.type===target.type||r.type==='interlude'&&target.type==='standard')||
   r.priceMultiplier!==null&&!validMultiplier(r.priceMultiplier)||r.pricing!==undefined&&!validSettings(r.pricing)||
   r.type==='interlude'&&(!validQuestionPrice(r.questionPrice)||target.themes.some(t=>t.questions.some(q=>q.price!==r.questionPrice)));
 }))return;
 p.pricing={...c};
 p.rounds.forEach((r,i)=>{const saved=data.rounds[i];r.priceMultiplier=saved.priceMultiplier;if(saved.pricing)r.pricing={...saved.pricing};else delete r.pricing;if(saved.type==='interlude'){r.type='interlude';r.questionPrice=saved.questionPrice;}});
}
export function interludePrice(r){
 const first=r.themes.flatMap(t=>t.questions)[0]?.price;
 return validQuestionPrice(r.questionPrice)?r.questionPrice:validQuestionPrice(first)?first:100;
}
export function roundSettingsError(r,{type,questionPrice,priceMultiplier}){
 if(!['standard','final','interlude'].includes(type))return 'Выберите тип раунда.';
 if(type==='final')return finalRoundError(r);
 if(type==='interlude')return validQuestionPrice(questionPrice)?'':'Укажите целую стоимость вопросов от 0 до 2147483647.';
 return priceMultiplier===null||validMultiplier(priceMultiplier)?'':'Укажите целый множитель от 1.';
}
export function applyRoundSettings(r,settings){
 const error=roundSettingsError(r,settings);if(error)throw Error(error);
 r.type=settings.type;if(settings.name!==undefined)r.name=settings.name;
 if(r.type==='standard')r.priceMultiplier=settings.priceMultiplier;
 if(r.type==='interlude'){
  r.questionPrice=settings.questionPrice;
  for(const t of r.themes)for(const q of t.questions)q.price=r.questionPrice;
 }else delete r.questionPrice;
}
