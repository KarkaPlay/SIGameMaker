import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {initial,step,issues,roundOrderError} from '../dist/model.js';
import {newRound,newQuestionPrice} from '../dist/pricing.js';
import {contentXML,exportSIQ,importSIQ} from '../dist/siq.js';
import {copyMergeItem,mergeIssues} from '../dist/merge-model.js';
import {zipSync,strToU8} from '../dist/vendor/fflate.js';
import {FixtureDOMParser} from './helpers/xml-parser.js';
globalThis.DOMParser=FixtureDOMParser;
const archive=xml=>zipSync({'content.xml':strToU8(xml)});
const validate=xml=>execFileSync('xmllint',['--noout','--schema','docs/siq_5.xsd','-'],{input:xml,stdio:'pipe'});

test('theme information survives import, copy/merge and repeated SIQ export, with XML escaping',async()=>{
 const p=initial(),info='<info><authors><author>A &amp; B</author><author>C</author></authors><sources><source>Source &lt;one&gt;</source><source>Two</source></sources><comments>Theme note</comments><showmanComments>Host note</showmanComments><extension>Extra</extension></info>';
 const xml=contentXML(p).replace('<theme name="Вокруг света">','<theme name="Вокруг света">'+info);validate(xml);
 const imported=importSIQ(archive(xml)),theme=imported.pack.rounds[0].themes[0];
 assert.deepEqual(theme.info,{authors:['A & B','C'],sources:['Source <one>','Two'],comments:'Theme note',showmanComments:'Host note',extension:'Extra'});
 const copied=copyMergeItem(theme,imported.media).item;assert.deepEqual(copied.info,theme.info);
 imported.pack.rounds[0].themes=[copied];const again=importSIQ(await exportSIQ(imported.pack,imported.media));
 assert.deepEqual(again.pack.rounds[0].themes[0].info,theme.info);validate(contentXML(again.pack));
 assert.throws(()=>importSIQ(archive(xml.replace('Theme note','<unknown/>'))),/сведения темы/);
});

test('ordinary price boundaries are shared by generation, readiness and direct export',()=>{
 const p=initial(),r=p.rounds[0],q=r.themes[0].questions[0];
 r.priceMultiplier=30000000;assert.throws(()=>newQuestionPrice(p,r,0),/слишком велика/);
 for(const price of [-1,0.5,2147483648,3000000000,Infinity]){q.price=price;assert.ok(issues(p).some(x=>x.message.includes('стоимость')));assert.throws(()=>contentXML(p),/2147483647/);}
 for(const price of [0,2147483647]){q.price=price;assert.deepEqual(issues(p),[]);validate(contentXML(p));}
 r.priceMultiplier=1;r.pricing={basePrice:2147483647,priceStep:1};assert.equal(newQuestionPrice(p,r,0),2147483647);assert.throws(()=>newQuestionPrice(p,r,1),/слишком велика/);
});

test('a final is unique and last in readiness, merger, direct export and import',()=>{
 const p=initial(),final=newRound(p,'final');for(const t of final.themes){t.questions[0].steps[0].value='Q';t.questions[0].answer='A';}p.rounds.push(final);
 assert.equal(roundOrderError(p.rounds),'');assert.throws(()=>newRound(p,'final'),/уже добавлен/);
 const standard=newRound(p,'standard');assert.equal(standard.themes[0].questions[0].price,200);
 const good=contentXML(p);
 for(const rounds of [[final,p.rounds[0]],[...p.rounds,structuredClone(final)]]){
  const bad={...p,rounds};assert.ok(roundOrderError(rounds));assert.ok(issues(bad).length);assert.ok(mergeIssues(bad,new Map()).length);assert.throws(()=>contentXML(bad),/Финал|финальный/);
 }
 const finalXML=good.match(/<round name="Финал"[\s\S]*?<\/round>/)[0];
 assert.throws(()=>importSIQ(archive(good.replace('</rounds>',finalXML+'</rounds>'))),/финальный раунд/);
 assert.throws(()=>importSIQ(archive(good.replace('<rounds>','<rounds>'+finalXML).replace(finalXML+'</rounds>','</rounds>'))),/последним/);
});

test('oversized exports fail before reading blobs; repeated references count only once',async()=>{
 const p=initial(),q=p.rounds[0].themes[0].questions[0],media=new Map();let reads=0;
 for(let i=0;i<3;i++){q.steps.splice(1,0,{...step('video'),mediaId:'video'+i,filename:'v.mp4'});media.set('video'+i,{size:90*1024*1024,arrayBuffer(){reads++;throw Error('Must not read');}});}
 await assert.rejects(exportSIQ(p,media),/250 МБ.*21 МБ/);assert.equal(reads,0);
 const small=initial(),sq=small.rounds[0].themes[0].questions[0],blob=new Blob(['video']);sq.steps.splice(1,0,{...step('video'),mediaId:'one',filename:'v.mp4'});sq.steps.splice(1,0,structuredClone(sq.steps[1]));
 const result=importSIQ(await exportSIQ(small,new Map([['one',blob]])));assert.equal(result.media.size,1);assert.equal(await [...result.media.values()][0].text(),'video');
 // ZIP headers themselves can cross the limit even when the media sum does not.
 media.clear();q.steps=q.steps.filter(s=>s.type!=='video');q.steps.splice(1,0,{...step('video'),mediaId:'edge',filename:'v.mp4'});media.set('edge',{size:250*1024*1024,arrayBuffer(){throw Error('Must not read');}});
 await assert.rejects(exportSIQ(p,media),/250 МБ/);
});

test('editor inserts new rounds before its final and disables adding another final',async()=>{
 const {readFileSync}=await import('node:fs'),{default:vm}=await import('node:vm');
 const source=readFileSync('dist/app.js','utf8'),p=initial();p.rounds.push(newRound(p,'final'));
 let snapshots=0,saves=0;const finalChoice={disabled:false},dialog={classList:{add(){}},querySelector:()=>finalChoice};
 const context={screen:'editor',pack:p,newRound,snapshot(){snapshots++;},changed(){saves++;},select(){},closeDialog:()=>Promise.resolve(),$:selector=>selector==='#dialog'?dialog:null,dialog(){},roundChoices(){},positionSettings(){},toast:message=>assert.fail(message)};vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function roundPicker('),source.indexOf('function multiplierFields(')),context);
 context.roundPicker({});assert.equal(finalChoice.disabled,true);context.createEditorRound('standard');await Promise.resolve();
 assert.deepEqual(p.rounds.map(r=>r.type),['standard','standard','final']);assert.equal(p.rounds[1].themes[0].questions[0].price,200);assert.equal(snapshots,1);assert.equal(saves,1);
});

test('ZIP size preflight includes headers and accepts the exact 250 MiB boundary',async()=>{
 const p=initial(),q=p.rounds[0].themes[0].questions[0];q.steps.splice(1,0,{...step('video'),mediaId:'edge',filename:'v.mp4'});
 const overhead=22+76+2*strToU8('content.xml').length+strToU8(contentXML(p)).length+76+2*strToU8('Video/edge.mp4').length;
 let reads=0;
 class SizeOnlyBlob extends Blob{constructor(bytes){super([]);this.bytes=bytes;}get size(){return this.bytes;}arrayBuffer(){reads++;throw Error('Reached media read');}}
 await assert.rejects(exportSIQ(p,new Map([['edge',new SizeOnlyBlob(250*1024*1024-overhead)]])),/Reached media read/);assert.equal(reads,1);
 await assert.rejects(exportSIQ(p,new Map([['edge',new SizeOnlyBlob(250*1024*1024-overhead+1)]])),/250 МБ/);assert.equal(reads,1);
});
