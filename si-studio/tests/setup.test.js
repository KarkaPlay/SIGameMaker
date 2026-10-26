import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSetup,buildPack,setupCounts,setupErrors} from '../dist/setup.js';
test('setup creates different theme counts per round, requested questions and a real final round',()=>{const c=defaultSetup();c.name='Тестовая игра';c.rounds=[{name:'Разминка',themes:3},{name:'Сложнее',themes:4}];c.questions=6;c.finalThemes=5;const p=buildPack(c);assert.equal(p.rounds.length,3);assert.equal(p.rounds[0].themes.length,3);assert.equal(p.rounds[1].themes.length,4);assert.equal(p.rounds[0].themes[0].questions.length,6);assert.equal(p.rounds[2].type,'final');assert.equal(p.rounds[2].themes.length,5);assert.ok(p.rounds[2].themes.every(t=>t.questions.length===1&&t.questions[0].price===0));assert.deepEqual(setupCounts(c),{themes:12,questions:47});const ids=p.rounds.flatMap(r=>[r.id,...r.themes.flatMap(t=>[t.id,...t.questions.flatMap(q=>[q.id,...q.steps.map(s=>s.id)])])]);assert.equal(new Set(ids).size,ids.length);});
test('setup respects custom prices, multiplication and a game without final',()=>{const c=defaultSetup();c.name='Цены';c.hasFinal=false;c.basePrice=50;c.priceStep=25;c.questions=3;let p=buildPack(c);assert.equal(p.rounds.length,2);assert.deepEqual(p.rounds[1].themes[0].questions.map(q=>q.price),[100,150,200]);c.multiplyPrices=false;p=buildPack(c);assert.deepEqual(p.rounds[1].themes[0].questions.map(q=>q.price),[50,75,100]);});
test('invalid structures are rejected before creating a package',()=>{const c=defaultSetup();assert.throws(()=>buildPack(c),/название/);c.name='Игра';c.rounds[0].themes=0;assert.ok(setupErrors(c).length);assert.throws(()=>buildPack(c),/12 тем/);c.rounds[0].themes=6;c.questions=1.5;assert.throws(()=>buildPack(c),/вопросов/);});

test('per-round settings build the same board, totals and final name as the wizard',async()=>{
 const {toSetupConfig}=await import('../dist/setup.js');
 const {newQuestionPrice,newRoundTheme,pricingMetadata,restorePricing}=await import('../dist/pricing.js');
 const s={name:'Кино & музыка',author:'Автор',english:true,rounds:[{type:'standard',name:'Кино',themes:4,questions:3,base:50,step:25,multiply:false},{type:'standard',name:'Музыка',themes:2,questions:6,base:200,step:50,multiply:true},{type:'final',name:'Суперфинал',themes:3,questions:1}]};
 const c=toSetupConfig(s),p=buildPack(c);
 assert.equal(p.language,'en-US');assert.equal(p.rounds[2].name,'Суперфинал');
 assert.deepEqual(setupCounts(c),{themes:9,questions:27});
 assert.deepEqual(p.rounds[0].themes[0].questions.map(q=>q.price),[50,75,100]);
 assert.deepEqual(p.rounds[1].themes[0].questions.map(q=>q.price),[400,500,600,700,800,900]);
 assert.equal(newQuestionPrice(p,p.rounds[1],6),1000);
 assert.equal(newRoundTheme(p,p.rounds[1]).questions.length,6);
 const copy=structuredClone(p);delete copy.pricing;copy.rounds.forEach(r=>delete r.pricing);
 restorePricing(copy,pricingMetadata(p));assert.equal(newQuestionPrice(copy,copy.rounds[1],6),1000);
 c.rounds[1].questions=NaN;assert.throws(()=>buildPack(c),/вопросов/);
});

test('numeric controls nudge counts by one and prices by 100 without changing manual precision',async()=>{
 const {nudgeSetupValue}=await import('../dist/setup.js');
 assert.equal(nudgeSetupValue(6,'themes',1,1,12),7);
 assert.equal(nudgeSetupValue(12,'themes',1,1,12),12);
 assert.equal(nudgeSetupValue(1,'questions',-1,1,10),1);
 assert.equal(nudgeSetupValue(125,'base',1,0,9999),225);
 assert.equal(nudgeSetupValue(125,'step',-1,1,9999),25);
 assert.equal(nudgeSetupValue(50,'base',-1,0,9999),0);
 assert.equal(nudgeSetupValue(50,'step',-1,0,9999),0);
 assert.equal(nudgeSetupValue(9950,'base',1,0,9999),9999);
});

test('the shared round picker can create a valid interlude with one price for all its questions',async()=>{
 const {toSetupConfig}=await import('../dist/setup.js');
 const {interludeRoundError}=await import('../dist/model.js');
 const {newRoundTheme,newQuestionPrice}=await import('../dist/pricing.js');
 const s={name:'Три типа',author:'',english:false,rounds:[
  {type:'standard',name:'Начало',themes:2,questions:3,base:100,step:100,multiply:true},
  {type:'interlude',name:'Музыка',themes:3,questions:4,base:350,step:100,multiply:true},
  {type:'final',name:'Финал',themes:5,questions:1},
 ]};
 const p=buildPack(toSetupConfig(s)),r=p.rounds[1];
 assert.deepEqual(p.rounds.map(r=>r.type),['standard','interlude','final']);
 assert.equal(r.questionPrice,350);assert.equal(interludeRoundError(r),'');
 assert.ok(r.themes.every(t=>t.questions.every(q=>q.price===350)));
 assert.equal(newQuestionPrice(p,r,9),350);
 assert.ok(newRoundTheme(p,r).questions.every(q=>q.price===350));
});


test('zero price step survives generation, metadata and future questions',async()=>{
 const {nudgeSetupValue}=await import('../dist/setup.js');
 const {priceSettings,pricingMetadata,restorePricing,newQuestionPrice}=await import('../dist/pricing.js');
 assert.equal(nudgeSetupValue(100,'step',-1,0,9999),0);
 assert.equal(nudgeSetupValue(0,'step',1,0,9999),100);
 const c=defaultSetup();c.name='Одинаковые цены';c.priceStep=0;
 c.rounds[1].priceStep=0;
 const p=buildPack(c),saved=pricingMetadata(p),restored=structuredClone(p);
 delete restored.pricing;for(const r of restored.rounds)delete r.pricing;
 restorePricing(restored,saved);
 for(const r of restored.rounds.filter(r=>r.type==='standard')){
  assert.equal(priceSettings(restored,r).priceStep,0);
  assert.ok(r.themes.every(t=>t.questions.every(q=>q.price===t.questions[0].price)));
  assert.equal(newQuestionPrice(restored,r,9),r.themes[0].questions[0].price);
 }
});

test('review Back selects the first round; clicking a card selects that exact round',async()=>{
 const {setupReviewRound}=await import('../dist/setup.js');
 const rounds=[{id:5},{id:8},{id:13}];
 assert.equal(setupReviewRound(rounds).id,5);
 assert.equal(setupReviewRound(rounds,8).id,8);
 assert.equal(setupReviewRound(rounds,'13').id,13);
 assert.equal(setupReviewRound(rounds,999).id,5);
});
