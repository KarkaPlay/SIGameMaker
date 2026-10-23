import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {FixtureDOMParser} from './helpers/xml-parser.js';
import {initial,step,issues,answerLabel,isAuction,auctionLabel,questionChecklist} from '../dist/model.js';
import {contentXML,exportSIQ,importSIQ,SIQImportError} from '../dist/siq.js';
import {zipSync,strToU8} from '../dist/vendor/fflate.js';
globalThis.DOMParser=FixtureDOMParser;
const first=p=>p.rounds[0].themes[0].questions[0];
const fixture=()=>{const p=initial();first(p).type='stakeAll';return p;};
test('ordinary rounds accept native stakeAll, identify its auction family and label all answerers',()=>{
 const p=fixture(),q=first(p);assert.deepEqual(issues(p),[]);assert.equal(isAuction(q),true);assert.equal(isAuction({type:'stake'}),true);assert.equal(isAuction({type:'bagcat'}),false);assert.equal(isAuction({}),false);assert.equal(auctionLabel(q),'Скрытые ставки');assert.equal(answerLabel(q,p.rounds[0]),'Все игроки отвечают письменно');assert.ok(questionChecklist(q,p.rounds[0]).every(c=>c.passed));
 delete q.type;assert.equal(isAuction(q),false);assert.match(contentXML(p),/type="simple"/);
});
test('SIQ exports stakeAll explicitly in a standard round, keeps its nominal and timer, and validates by XSD',()=>{
 const p=fixture(),q=first(p);q.price=1000;q.steps[1].duration=23;
 const before=structuredClone(p),xml=contentXML(p);assert.match(xml,/<round name="Первый раунд" type="standard">/);assert.match(xml,/<question price="1000" type="stakeAll">/);assert.match(xml,/<param name="answerDuration">23<\/param>/);assert.doesNotMatch(xml,/name="(?:stakeVisibility|stake|hiddenStakes)"/);assert.deepEqual(p,before);
 const dir=mkdtempSync(join(tmpdir(),'si-stake-all-'));writeFileSync(join(dir,'stakeAll.xml'),xml);execFileSync('xmllint',['--noout','--schema','docs/siq_5.xsd',join(dir,'stakeAll.xml')]);
});
test('mixed stake/stakeAll/simple questions round-trip with answers, metadata, six binary media and timing',async()=>{
 const p=fixture(),q=first(p),media=new Map();p.rounds[0].themes[0].questions[1].type='stake';q.alternatives='Вариант';q.wrong='Ошибка';q.comment='Ведущему';q.source='Источник';q.steps[1].duration=19;
 for(const type of ['image','audio','video'])for(const reveal of [false,true]){const s=step(type);s.mediaId=crypto.randomUUID();s.filename='медиа.'+({image:'png',audio:'mp3',video:'mp4'})[type];s.duration=4;s.wait=false;media.set(s.mediaId,new Blob([type+reveal]));q.steps.splice(reveal?q.steps.length:q.steps.findIndex(s=>s.type==='answer'),0,s);}
 let result=importSIQ(await exportSIQ(p,media));
 for(let iteration=0;iteration<2;iteration++){
  const rq=first(result.pack),qs=result.pack.rounds[0].themes[0].questions;assert.equal(rq.type,'stakeAll');assert.equal(qs[1].type,'stake');assert.equal(qs[2].type,'simple');for(const k of ['price','answer','alternatives','wrong','comment','source'])assert.equal(rq[k],q[k]);assert.equal(rq.steps.find(s=>s.type==='answer').duration,19);assert.deepEqual(rq.steps.map(s=>s.type),['text','image','audio','video','answer','image','audio','video']);
  for(const [i,s]of rq.steps.entries())if(s.mediaId){assert.equal(await result.media.get(s.mediaId).text(),s.type+(i>4));assert.equal(s.duration,4);assert.equal(s.wait,false);}assert.deepEqual(issues(result.pack,result.media),[]);result=importSIQ(await exportSIQ(result.pack,result.media));
 }
});
test('switching auction modes changes only type and preserves nominal, content and answer data',async()=>{
 const p=fixture(),q=first(p);q.price=500;q.cat={theme:'Сохранённые настройки другого типа'};const before=structuredClone(q);
 for(const type of ['stake','stakeAll','stake','stakeAll']){q.type=type;const result=importSIQ(await exportSIQ(p,new Map()));assert.equal(first(result.pack).type,type);assert.deepEqual({...q,type:before.type},before);}
});
test('ordinary stakeAll coexists with a final; explicit final stakeAll still imports to native final rules',async()=>{
 const p=fixture(),final=structuredClone(p.rounds[0]);final.id=crypto.randomUUID();final.type='final';final.name='ФИНАЛ';for(const t of final.themes){t.questions=t.questions.slice(0,1);t.questions[0].type='simple';}p.rounds.push(final);
 const xml=contentXML(p),explicit=xml.replace(/(<round name="ФИНАЛ" type="final">[\s\S]*?<question price="0")>/,'$1 type="stakeAll">');
 const result=importSIQ(zipSync({'content.xml':strToU8(explicit)}));assert.equal(first(result.pack).type,'stakeAll');assert.equal(result.pack.rounds[1].type,'final');assert.equal(result.pack.rounds[1].themes[0].questions[0].type,'simple');const out=contentXML(result.pack).split('<round name="ФИНАЛ"')[1];assert.doesNotMatch(out,/type="stakeAll"/);assert.deepEqual(issues(result.pack),[]);
});
test('unsupported parameters on stakeAll are still reported and SIQ 4 custom stakeAll is not guessed',()=>{
 const p=fixture(),xml=contentXML(p).replace('<params>','<params><param name="custom">x</param>');assert.throws(()=>importSIQ(zipSync({'content.xml':strToU8(xml)})),err=>err instanceof SIQImportError&&err.issues.some(i=>i.message.includes('custom')));
 const old='<package version="4"><rounds><round><themes><theme><questions><question><type name="stakeAll"/><scenario><atom>Вопрос</atom></scenario></question></questions></theme></themes></round></rounds></package>';assert.throws(()=>importSIQ(zipSync({'content.xml':strToU8(old)})),/Тип вопроса «stakeAll»/);
});
