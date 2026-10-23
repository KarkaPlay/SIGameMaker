import {uid,question} from './model.js';
const nonnegative=v=>Number.isSafeInteger(v)&&v>=0;
export const validMultiplier=v=>Number.isSafeInteger(v)&&v>=1;
export function priceSettings(p){const c=p.pricing||{};return {basePrice:nonnegative(c.basePrice)?c.basePrice:100,priceStep:validMultiplier(c.priceStep)?c.priceStep:100,questions:Number.isSafeInteger(c.questions)&&c.questions>=0&&c.questions<=100?c.questions:5,multiplyPrices:c.multiplyPrices!==false};}
export function roundMultiplier(p,r){return validMultiplier(r.priceMultiplier)?r.priceMultiplier:Math.max(1,p.rounds.indexOf(r)+1);}
export function newQuestionPrice(p,r,index){if(r.type==='final')return 0;const c=priceSettings(p),price=(c.basePrice+index*c.priceStep)*roundMultiplier(p,r);if(!nonnegative(price))throw Error('Стоимость слишком велика. Уменьшите множитель раунда.');return price;}
export function newRoundTheme(p,r,name='Новая тема'){const last=r.themes.at(-1),count=r.type==='final'?1:last?last.questions.length:priceSettings(p).questions;return {id:uid(),name,questions:Array.from({length:count},(_,i)=>question(newQuestionPrice(p,r,i)))};}
export function newRound(p,type){if(!['standard','final'].includes(type))return null;const final=type==='final',r={id:uid(),name:final?'Финал':`Раунд ${p.rounds.filter(r=>r.type==='standard').length+1}`,type,priceMultiplier:priceSettings(p).multiplyPrices?null:1,themes:[]};
 // Price calculation uses the future position without mutating the current package.
 const context={...p,rounds:[...p.rounds,r]};r.themes=final?Array.from({length:7},(_,i)=>newRoundTheme(context,r,`Финальная тема ${i+1}`)):[newRoundTheme(context,r)];return r;
}
export function pricingMetadata(p){return {version:1,pricing:priceSettings(p),rounds:p.rounds.map(r=>({name:r.name,type:r.type,priceMultiplier:validMultiplier(r.priceMultiplier)?r.priceMultiplier:null}))};}
export function restorePricing(p,data){if(data?.version!==1||!data.pricing||!Array.isArray(data.rounds)||data.rounds.length!==p.rounds.length)return;const c=data.pricing;if(!nonnegative(c.basePrice)||!validMultiplier(c.priceStep)||!Number.isSafeInteger(c.questions)||c.questions<0||c.questions>100||typeof c.multiplyPrices!=='boolean'||data.rounds.some((r,i)=>!r||r.name!==p.rounds[i].name||r.type!==p.rounds[i].type||r.priceMultiplier!==null&&!validMultiplier(r.priceMultiplier)))return;p.pricing={basePrice:c.basePrice,priceStep:c.priceStep,questions:c.questions,multiplyPrices:c.multiplyPrices};p.rounds.forEach((r,i)=>r.priceMultiplier=data.rounds[i].priceMultiplier);}
