import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSetup,buildPack} from '../dist/setup.js';
import {roundMultiplier,newQuestionPrice,newRoundTheme,newRound,pricingMetadata,restorePricing} from '../dist/pricing.js';
import {exportSIQ} from '../dist/siq.js';
import {unzipSync,strFromU8} from '../dist/vendor/fflate.js';
const pack=()=>{const c=defaultSetup();c.name='Стоимость';c.hasFinal=false;c.basePrice=50;c.priceStep=25;c.questions=3;return buildPack(c);};
test('setup keeps the price scale and auto multipliers; a new round uses its own position',()=>{const p=pack(),before=structuredClone(p),r=newRound(p,'standard');assert.equal(roundMultiplier(p,p.rounds[1]),2);assert.deepEqual(r.themes[0].questions.map(q=>q.price),[150,225,300]);assert.equal(r.priceMultiplier,null);assert.deepEqual(p,before);const c=defaultSetup();c.name='Без умножения';c.multiplyPrices=false;const flat=buildPack(c);assert.ok(flat.rounds.slice(0,-1).every(r=>r.priceMultiplier===1));assert.deepEqual(newRound(flat,'standard').themes[0].questions.map(q=>q.price),[100,200,300,400,500]);});
test('new themes copy the last theme count, while new questions use the current multiplier and keep existing prices',()=>{const p=pack(),r=p.rounds[1];r.themes.at(-1).questions.pop();const old=structuredClone(r.themes);r.priceMultiplier=4;assert.deepEqual(newRoundTheme(p,r).questions.map(q=>q.price),[200,300]);assert.equal(newQuestionPrice(p,r,3),500);assert.deepEqual(r.themes,old);r.priceMultiplier=null;assert.equal(newQuestionPrice(p,r,3),250);p.rounds.unshift(newRound(p,'standard'));assert.equal(roundMultiplier(p,r),3);assert.deepEqual(r.themes,old);});
test('legacy drafts have safe defaults; final rounds keep one zero-priced question; unsafe prices are rejected',()=>{const p={rounds:[]},r=newRound(p,'standard');p.rounds.push(r);assert.deepEqual(r.themes[0].questions.map(q=>q.price),[100,200,300,400,500]);const final=newRound(p,'final');final.priceMultiplier=90;assert.equal(final.themes.length,7);assert.ok(final.themes.every(t=>t.questions.length===1&&t.questions[0].price===0));assert.equal(newQuestionPrice(p,final,1),0);r.priceMultiplier=Number.MAX_SAFE_INTEGER;assert.throws(()=>newQuestionPrice(p,r,3),/слишком велика/);assert.equal(newRound(p,'unsupported'),null);});
test('price settings travel in the SIQ archive and restore by round order without changing question prices',async()=>{const p=pack();p.rounds[1].priceMultiplier=7;const zip=unzipSync(await exportSIQ(p,new Map())),metadata=JSON.parse(strFromU8(zip['SIGameMaker.json'])),copy=structuredClone(p);delete copy.pricing;copy.rounds.forEach(r=>{r.id=crypto.randomUUID();delete r.priceMultiplier;});const questionsBefore=copy.rounds.map(r=>structuredClone(r.themes));restorePricing(copy,metadata);assert.deepEqual(copy.pricing,p.pricing);assert.equal(copy.rounds[1].priceMultiplier,7);assert.deepEqual(copy.rounds.map(r=>r.themes),questionsBefore);const baseline=structuredClone(copy);restorePricing(copy,{...pricingMetadata(p),rounds:[{priceMultiplier:0}]});assert.deepEqual(copy,baseline);const renamed=structuredClone(metadata);renamed.rounds[0].name='Другой раунд';restorePricing(copy,renamed);assert.deepEqual(copy,baseline);});

test('independent round price scales survive SIQ and keep new questions on that scale',async()=>{
 const {FixtureDOMParser}=await import('./helpers/xml-parser.js');
 const {importSIQ}=await import('../dist/siq.js');
 globalThis.DOMParser=FixtureDOMParser;
 const c=defaultSetup();c.name='Разные раунды';c.rounds[0]={name:'Лёгкий',themes:2,questions:3,basePrice:40,priceStep:20,multiplyPrices:false};c.rounds[1]={name:'Сложный',themes:3,questions:4,basePrice:150,priceStep:50,multiplyPrices:true};
 const p=buildPack(c);for(const r of p.rounds)for(const t of r.themes)for(const q of t.questions){q.steps[0].value='Вопрос';q.answer='Ответ';}
 const restored=importSIQ(await exportSIQ(p,new Map())).pack;
 assert.deepEqual(restored.rounds[0].themes[0].questions.map(q=>q.price),[40,60,80]);
 assert.deepEqual(restored.rounds[1].themes[0].questions.map(q=>q.price),[300,400,500,600]);
 assert.equal(newQuestionPrice(restored,restored.rounds[0],3),100);
 assert.equal(newQuestionPrice(restored,restored.rounds[1],4),700);
 const bad=pricingMetadata(p);bad.rounds[1].pricing.priceStep=-1;
 const before=structuredClone(restored);restorePricing(restored,bad);assert.deepEqual(restored,before);
});

test('zero global and per-round price steps survive SIQ and future question generation',async()=>{
 const {FixtureDOMParser}=await import('./helpers/xml-parser.js');
 const {importSIQ}=await import('../dist/siq.js');
 globalThis.DOMParser=FixtureDOMParser;
 const c=defaultSetup();c.name='Нулевой шаг';c.priceStep=0;
 c.rounds[1]={name:'Вторая шкала',themes:2,questions:3,basePrice:250,priceStep:0,multiplyPrices:true};
 const p=buildPack(c);
 for(const r of p.rounds)for(const t of r.themes)for(const q of t.questions){q.steps[0].value='Вопрос';q.answer='Ответ';}
 const restored=importSIQ(await exportSIQ(p,new Map())).pack;
 assert.equal(restored.pricing.priceStep,0);
 assert.equal(restored.rounds[1].pricing.priceStep,0);
 assert.equal(newQuestionPrice(restored,restored.rounds[0],9),100);
 assert.equal(newQuestionPrice(restored,restored.rounds[1],9),500);
 assert.deepEqual(newRoundTheme(restored,restored.rounds[1]).questions.map(q=>q.price),[500,500,500]);
});
