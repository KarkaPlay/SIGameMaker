import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {initial,step,question,issues,interludeRoundError} from '../dist/model.js';
import {newRound,newRoundTheme,newQuestionPrice,applyRoundSettings,interludePrice,pricingMetadata,restorePricing} from '../dist/pricing.js';
import {reorderRounds} from '../dist/round-drag.js';
import {contentXML,exportSIQ,importSIQ} from '../dist/siq.js';
import {zipSync,unzipSync,strFromU8,strToU8} from '../dist/vendor/fflate.js';
import {addMergeItem} from '../dist/merge-model.js';
import {FixtureDOMParser} from './helpers/xml-parser.js';
globalThis.DOMParser=FixtureDOMParser;
const prices=r=>r.themes.flatMap(t=>t.questions.map(q=>q.price));
const configure=(r,price)=>applyRoundSettings(r,{type:'interlude',questionPrice:price,name:'Интерлюдия'});
const fill=r=>{for(const t of r.themes)for(const q of t.questions){q.steps[0].value='Вопрос';q.answer='Ответ';}};

test('new interlude has a shared price for every question regardless of index or position',()=>{
 const p=initial(),before=structuredClone(p),r=newRound(p,'interlude');
 assert.equal(r.type,'interlude');assert.equal(r.name,'Интерлюдия');assert.equal(r.questionPrice,100);assert.equal(r.themes[0].questions.length,5);
 assert.ok(prices(r).every(price=>price===100));assert.deepEqual(p,before);
 p.rounds.push(r);configure(r,450);p.rounds=reorderRounds(p.rounds,r.id,p.rounds[0].id);
 assert.equal(newQuestionPrice(p,r,99),450);assert.equal(newQuestionPrice(p,r,0),450);
 r.themes.push(newRoundTheme(p,r));assert.ok(prices(r).every(price=>price===450));
 r.themes[0].questions.push(question(newQuestionPrice(p,r,5)));assert.ok(prices(r).every(price=>price===450));
});
test('conversion and shared price edits preserve whole questions, IDs, scripts and media',()=>{
 const p=initial(),r=p.rounds[0],q=r.themes[0].questions[0];q.steps.push({...step('image'),mediaId:'photo',filename:'фото.png',duration:12});
 const before=structuredClone(r),questions=r.themes.flatMap(t=>t.questions),scripts=questions.map(q=>structuredClone(q.steps));
 assert.equal(interludePrice(r),100);configure(r,700);assert.equal(interludeRoundError(r),'');
 assert.ok(prices(r).every(price=>price===700));assert.deepEqual(r.themes.flatMap(t=>t.questions.map(q=>q.steps)),scripts);
 assert.deepEqual(r.themes.map(t=>t.id),before.themes.map(t=>t.id));assert.deepEqual(r.themes.flatMap(t=>t.questions.map(q=>q.id)),questions.map(q=>q.id));
 assert.equal(r.themes[0].questions[0],q);configure(r,200);assert.ok(prices(r).every(price=>price===200));
});
test('zero and maximum integer prices are supported; invalid inputs never mutate a round',()=>{
 const r=initial().rounds[0];
 for(const price of [0,2147483647]){configure(r,price);assert.ok(prices(r).every(p=>p===price));assert.equal(interludeRoundError(r),'');}
 for(const price of [-1,1.5,NaN,Infinity,2147483648,undefined,'100']){const before=structuredClone(r);assert.throws(()=>configure(r,price),/целую стоимость/);assert.deepEqual(r,before);}
});
test('switching back to standard keeps current prices and restores ordinary generation; final conversion remains guarded',()=>{
 const p=initial(),r=p.rounds[0];configure(r,250);
 assert.throws(()=>applyRoundSettings(r,{type:'final'}),/ровно один/);assert.equal(r.type,'interlude');
 applyRoundSettings(r,{type:'standard',priceMultiplier:3});assert.ok(prices(r).every(p=>p===250));assert.equal(r.questionPrice,undefined);
 assert.equal(newQuestionPrice(p,r,1),600);
 const one={...newRound(p,'final')};configure(one,350);applyRoundSettings(one,{type:'final'});assert.equal(one.type,'final');assert.equal(one.questionPrice,undefined);
});
test('validation and direct export reject inconsistent interlude prices without silently rewriting content',()=>{
 const p=initial(),r=p.rounds[0];configure(r,500);r.themes[0].questions[1].price=600;
 const before=structuredClone(p);assert.match(interludeRoundError(r),/одинаково/);assert.ok(issues(p).some(x=>x.round===r.id&&x.message.includes('одинаково')));
 assert.throws(()=>contentXML(p),/одинаково/);assert.deepEqual(p,before);
 configure(r,500);assert.equal(interludeRoundError(r),'');assert.deepEqual(issues(p),[]);
 delete r.questionPrice;assert.throws(()=>contentXML(p),/целую стоимость/);
});
test('interlude exports ordinary SIQ with equal nominals, validates XSD and round-trips type, media and settings',async()=>{
 const p=initial(),r=p.rounds[0];configure(r,325);r.priceMultiplier=4;
 const q=r.themes[0].questions[0];q.steps.splice(1,0,{...step('audio'),mediaId:'sound',filename:'звук.mp3',duration:17});q.steps.find(s=>s.type==='answer').duration=23;
 const media=new Map([['sound',new Blob([new Uint8Array([0,128,255])])]]),before=structuredClone(p),files=unzipSync(await exportSIQ(p,media)),xml=strFromU8(files['content.xml']);
 assert.match(xml,/<round name="Интерлюдия" type="standard">/);assert.doesNotMatch(xml,/type="interlude"/);
 assert.equal([...xml.matchAll(/<question price="325"/g)].length,25);
 const dir=mkdtempSync(join(tmpdir(),'si-interlude-'));writeFileSync(join(dir,'interlude.xml'),xml);execFileSync('xmllint',['--noout','--schema','docs/siq_5.xsd',join(dir,'interlude.xml')]);
 const result=importSIQ(zipSync(files)),restored=result.pack.rounds[0],audio=restored.themes[0].questions[0].steps.find(s=>s.type==='audio');
 assert.equal(restored.type,'interlude');assert.equal(restored.questionPrice,325);assert.equal(restored.priceMultiplier,4);assert.ok(prices(restored).every(price=>price===325));assert.equal(newQuestionPrice(result.pack,restored,5),325);
 assert.equal(audio.duration,17);assert.equal(restored.themes[0].questions[0].steps.find(s=>s.type==='answer').duration,23);assert.deepEqual([...new Uint8Array(await result.media.get(audio.mediaId).arrayBuffer())],[0,128,255]);
 assert.deepEqual(p,before);
});
test('metadata is emitted for an interlude even in a legacy package with no pricing fields',async()=>{
 const p=initial();delete p.pricing;configure(p.rounds[0],0);delete p.rounds[0].priceMultiplier;
 const result=importSIQ(await exportSIQ(p,new Map()));assert.equal(result.pack.rounds[0].type,'interlude');assert.equal(result.pack.rounds[0].questionPrice,0);
});
test('missing or mismatched metadata preserves XML content and never invents an interlude',async()=>{
 const p=initial();configure(p.rounds[0],400);const files=unzipSync(await exportSIQ(p,new Map()));
 const metadata=JSON.parse(strFromU8(files['SIGameMaker.json']));metadata.rounds[0].questionPrice=500;files['SIGameMaker.json']=strToU8(JSON.stringify(metadata));
 let result=importSIQ(zipSync(files));assert.equal(result.pack.rounds[0].type,'standard');assert.ok(prices(result.pack.rounds[0]).every(p=>p===400));
 delete files['SIGameMaker.json'];result=importSIQ(zipSync(files));assert.equal(result.pack.rounds[0].type,'standard');assert.ok(prices(result.pack.rounds[0]).every(p=>p===400));
 const copy=structuredClone(p),bad=pricingMetadata(p);bad.rounds[0].questionPrice=-1;restorePricing(copy,bad);assert.deepEqual(copy,p);
});
test('draft/history snapshots preserve conversion, shared edits and round order',()=>{
 let p=initial();const undo=structuredClone(p);configure(p.rounds[0],800);const saved=structuredClone(p);configure(p.rounds[0],200);const redo=structuredClone(p);
 p=structuredClone(saved);assert.equal(p.rounds[0].questionPrice,800);assert.ok(prices(p.rounds[0]).every(p=>p===800));
 p=structuredClone(undo);assert.equal(p.rounds[0].type,'standard');assert.deepEqual(prices(p.rounds[0]),prices(undo.rounds[0]));
 p=structuredClone(redo);assert.equal(p.rounds[0].questionPrice,200);assert.ok(prices(p.rounds[0]).every(p=>p===200));
});
test('merging a theme from another interlude applies the destination shared price to the copy',()=>{
 const targetPack=initial(),target=targetPack.rounds[0];configure(target,300);
 const sourcePack=initial(),source=sourcePack.rounds[0];configure(source,900);fill(source);const before=structuredClone(source);
 addMergeItem(targetPack,new Map(),{pack:sourcePack,media:new Map()},0,0,target.id);
 assert.ok(prices(target).every(price=>price===300));assert.equal(interludeRoundError(target),'');assert.deepEqual(source,before);
});
