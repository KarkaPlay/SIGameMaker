import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {FixtureDOMParser} from './helpers/xml-parser.js';
import {importSIQ,exportSIQ,SIQImportError,contentXML} from '../dist/siq.js';
import {importReportHTML} from '../dist/import-report.js';
import {zipSync,strToU8} from '../dist/vendor/fflate.js';
import {initial} from '../dist/model.js';
globalThis.DOMParser=FixtureDOMParser;
const legacy=(questions,version='4')=>`<?xml version="1.0" encoding="utf-8"?><package version="${version}" name="Старый пак"><rounds><round name="Первый"><themes><theme name="Города"><questions>${questions}</questions></theme></themes></round></rounds></package>`;
const question=atoms=>`<question price="300"><scenario>${atoms}</scenario><right><answer>Ответ</answer></right></question>`;
const archive=(xml,files={},name='content.xml')=>zipSync({[name]:typeof xml==='string'?strToU8(xml):xml,...files});
const first=result=>result.pack.rounds[0].themes[0].questions[0];
const failure=bytes=>{try{importSIQ(bytes);assert.fail('Expected rejected import');}catch(err){assert.ok(err instanceof SIQImportError,err.stack);return err;}};
test('SIQ 4 oral/say/voice and time=-1 preserve replic, background, concurrent playback and answer marker',async()=>{
 const result=importSIQ(archive(legacy(question('<atom type="oral">Реплика</atom><atom type="say">Ещё реплика</atom><atom type="voice" time="-1">@песня.mp3</atom><atom time="5">Вопрос</atom><atom type="marker"/><atom>Раскрытие</atom>')),{'Audio/песня.mp3':new Uint8Array([0,1,255])}));
 const q=first(result);assert.deepEqual(q.steps.map(s=>s.type),['text','text','audio','text','answer','text']);assert.equal(q.steps[0].placement,'replic');assert.equal(q.steps[1].placement,'replic');assert.equal(q.steps[2].placement,'background');assert.equal(q.steps[2].wait,false);assert.equal(q.steps[2].duration,0);assert.equal(q.steps[3].duration,5);
 const back=importSIQ(await exportSIQ(result.pack,result.media)),again=first(back);assert.deepEqual(again.steps.map(({id,mediaId,filename,...s})=>s),q.steps.map(({id,mediaId,filename,...s})=>s));assert.deepEqual([...new Uint8Array(await back.media.get(again.steps[2].mediaId).arrayBuffer())],[0,1,255]);
 const dir=mkdtempSync(join(tmpdir(),'si-import-'));writeFileSync(join(dir,'legacy.xml'),contentXML(result.pack));execFileSync('xmllint',['--noout','--schema','docs/siq_5.xsd',join(dir,'legacy.xml')]);
});
test('archive names resolve URI escapes, Unicode normalization, case and backslash differences',()=>{
 const xml=legacy(question('<atom type="image">@Фото é.png</atom><atom type="image">@Фото%20%C3%A9.png</atom>'));
 const file='images\\'+encodeURIComponent('Фото e\u0301.png');const result=importSIQ(archive(xml,{[file]:new Uint8Array([7,8])},'Content.XML'));
 assert.equal(result.media.size,1);assert.equal(first(result).steps[0].mediaId,first(result).steps[1].mediaId);
});
test('modern filenames starting with @ stay literal; ambiguous normalized names fail with details',()=>{
 const xml=contentXML(initial()).replace('type="text"','type="image" isRef="True"').replace('В какой стране находится город Киото, который больше тысячи лет был столицей государства?','@photo.png');
 assert.equal(importSIQ(archive(xml,{'Images/@photo.png':new Uint8Array([1])})).media.size,1);
 const err=failure(archive(legacy(question('<atom type="image">@photo.png</atom>')),{'images/PHOTO.PNG':new Uint8Array([1]),'IMAGES/Photo.png':new Uint8Array([2])}));assert.match(err.message,/Неоднозначное имя/);
});
test('UTF-16 with BOM and Windows-1251 XML declarations decode without corrupting text',()=>{
 const xml=legacy(question('<atom>Москва</atom>')).replace('utf-8','utf-16');const buffer=Buffer.concat([Buffer.from([255,254]),Buffer.from(xml,'utf16le')]);assert.equal(first(importSIQ(archive(buffer))).steps[0].value,'Москва');
 const cp=legacy(question('<atom>Тест</atom>')).replace('utf-8','windows-1251').replace('Старый пак','Pack').replace('Первый','Round').replace('Города','Theme').replace('Ответ','Answer');
 const bytes=Uint8Array.from([...cp].map(c=>c.charCodeAt(0)<128?c.charCodeAt(0):c.charCodeAt(0)-0x410+0xc0));assert.equal(first(importSIQ(archive(bytes))).steps[0].value,'Тест');
});
test('all independent question, parameter, script and media blockers are reported with locations',()=>{
 const qs='<question price="100"><type name="sponsored"><param name="custom">x</param></type><script/><scenario><atom type="html">@page.html</atom><atom type="image">@missing.png</atom><atom type="voice">https://example.org/a.mp3</atom></scenario></question><question price="200" type="secretPublicPrice"><params><param name="question" type="content"><item type="video" isRef="true">missing.mp4</item></param><param name="unknown">x</param><param name="unknown">y</param><param name="answerDuration">bad</param></params></question>';
 const err=failure(archive(legacy(qs)));assert.ok(err.issues.length>=10);assert.match(err.message,/sponsored/);assert.match(err.message,/secretPublicPrice/);assert.match(err.message,/custom/);assert.match(err.message,/<script>/);assert.match(err.message,/missing.png/);assert.match(err.message,/missing.mp4/);assert.match(err.message,/https:\/\/example.org/);assert.match(err.message,/unknown/);assert.match(err.message,/задан несколько раз/);assert.match(err.message,/bad/);assert.ok(err.issues.every(i=>i.location.includes('Первый')&&i.location.includes('Города')));assert.ok(err.issues.some(i=>i.location.includes('вопрос 2')));
});
test('reports explain archive, XML, unsupported version, empty package and invalid times',()=>{
 assert.equal(failure(new Uint8Array([1,2,3])).issues[0].code,'archive');assert.equal(failure(zipSync({})).issues[0].code,'missing-content');assert.match(failure(archive('<package>')).message,/content.xml/);assert.match(failure(archive('<package version="3"/>')).message,/Версия SIQ «3»/);assert.match(failure(archive('<package version="4"/>')).message,/нет раундов/);
 assert.match(failure(archive(legacy(question('<atom time="-2">x</atom><atom type="marker"/><atom type="marker"/>')))).message,/time="-2"[\s\S]*несколько маркеров/);
});
test('unsupported content parameters, nested XML and invalid final structure cannot be silently flattened',()=>{
 const xml=legacy('<question><params><param name="question" type="group"><param name="nested"/><item type="text"><b>bold</b></item></param><param name="answer" type="content"><item type="html">https://example.org</item></param></params></question>','5').replace('<round name="Первый">','<round name="Первый" type="final">').replace('</questions>',question('<atom>Second</atom>')+'</questions>');
 const err=failure(archive(xml));assert.match(err.message,/group/);assert.match(err.message,/<param>/);assert.match(err.message,/вложенные XML/);assert.match(err.message,/html/);assert.match(err.message,/ровно один вопрос/);
});
test('failed import returns no partial package and never mutates a previously loaded pack or media',async()=>{
 const current=importSIQ(archive(legacy(question('<atom>Current</atom>')))),before=JSON.stringify(current.pack);failure(archive(legacy(question('<atom type="html">bad</atom>'))));assert.equal(JSON.stringify(current.pack),before);assert.equal(current.media.size,0);
 const demo=importSIQ(new Uint8Array(readFileSync('examples/good-evening.siq')));assert.equal(demo.pack.name,'Хороший вечер');assert.equal(first(importSIQ(await exportSIQ(demo.pack,demo.media))).answer,first(demo).answer);
});
test('import report escapes filenames and every located reason',()=>{
 const err=new SIQImportError([{location:'Тема <img src=x>',message:'Нет "a.png" & <script>'},{location:'Вопрос 2',message:'Тип custom'}]);const html=importReportHTML(err,'<pack>.siq');assert.match(html,/Найдено причин: 2/);assert.equal((html.match(/<li(?:\s|>)/g)||[]).length,2);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<img|<script>/);assert.match(html,/Текущий черновик не заменён/);
});
test('deprecated auction/scenario in SIQ 5, legacy SIQ 4 auction and native final remain importable',()=>{
 for(const version of ['4','5']){const xml=legacy(question('<atom>Вопрос</atom><atom type="marker"/><atom>Раскрытие</atom>').replace('<scenario>','<type name="auction"/><scenario>'),version);const q=first(importSIQ(archive(xml)));assert.equal(q.type,'stake');assert.equal(q.price,300);assert.deepEqual(q.steps.map(s=>s.type),['text','answer','text']);}
 const p=initial(false);p.rounds[0].type='final';p.rounds[0].themes[0].questions.length=1;assert.equal(importSIQ(archive(contentXML(p))).pack.rounds[0].type,'final');
});
test('SIQ 5 secret, all media on both sides, answer timer and metadata survive import/export',async()=>{
 const p=initial(false),q=p.rounds[0].themes[0].questions[0];q.type='bagcat';q.cat={theme:'Настоящая тема',selectionMode:'any',price:{minimum:100,maximum:500,step:100}};q.answer='Ответ';q.alternatives='Вариант';q.wrong='Ошибка';q.comment='Ведущему';q.source='Источник';q.steps[0].value='Вопрос';q.steps[1].duration=17;
 const xml=contentXML(p).replace('<item type="text"','<item type="image" isRef="true"').replace('>Вопрос</item>','>photo%2Epng</item>').replace('</params>','<param name="answer" type="content"><item type="audio" isRef="true" waitForFinish="false">sound.mp3</item><item type="video" isRef="true" duration="00:00:03">video.mp4</item></param></params>');
 const files={'Images/photo%2Epng':new Uint8Array([1]),'Audio/sound.mp3':new Uint8Array([2]),'Video/video.mp4':new Uint8Array([3])},result=importSIQ(archive(xml,files)),copy=first(result);
 assert.deepEqual(copy.cat,q.cat);for(const key of ['answer','alternatives','wrong','comment','source'])assert.equal(copy[key],q[key]);assert.deepEqual(copy.steps.map(s=>s.type),['image','answer','audio','video']);assert.equal(copy.steps[1].duration,17);assert.equal(copy.steps[2].wait,false);assert.equal(copy.steps[3].duration,3);assert.equal(copy.steps[0].filename,'photo.png');assert.equal(result.media.get(copy.steps[0].mediaId).type,'image/png');
 const back=importSIQ(await exportSIQ(result.pack,result.media));assert.equal(back.media.size,3);for(const [i,s]of first(back).steps.filter(s=>s.mediaId).entries())assert.deepEqual([...new Uint8Array(await back.media.get(s.mediaId).arrayBuffer())],[i+1]);assert.deepEqual(first(back).cat,q.cat);
});
test('both SIQ 5 cat types restore one editor type and round-trip visibility, prices and recipients',async()=>{
 for(const showBeforeTransfer of [false,true])for(const selectionMode of ['any','exceptCurrent'])for(const price of [{minimum:0,maximum:0,step:0},{minimum:600,maximum:600,step:0},{minimum:200,maximum:1000,step:200}]){
  const p=initial(false),q=p.rounds[0].themes[0].questions[0];q.type='bagcat';q.cat={theme:'МКС <&>',selectionMode,price,showBeforeTransfer};q.answer='Ответ';q.steps[0].value='Вопрос';q.steps[1].duration=15;
  const bytes=await exportSIQ(p,new Map()),result=importSIQ(bytes),rq=first(result),expected=showBeforeTransfer?'secretPublicPrice':'secret';
  assert.equal(rq.type,'bagcat');assert.equal(Boolean(rq.cat.showBeforeTransfer),showBeforeTransfer);assert.equal(rq.cat.theme,q.cat.theme);assert.equal(rq.cat.selectionMode,selectionMode);assert.deepEqual(rq.cat.price,price);assert.equal(rq.steps[1].duration,15);assert.equal(rq.answer,q.answer);
  assert.match(contentXML(result.pack),new RegExp('type="'+expected+'"'));const again=importSIQ(await exportSIQ(result.pack,result.media));assert.equal(Boolean(first(again).cat.showBeforeTransfer),showBeforeTransfer);
 }
});
test('imported public-price cat can switch to secret and back without changing other question data',async()=>{
 const p=initial(false),q=p.rounds[0].themes[0].questions[0];q.type='bagcat';q.cat={theme:'МКС',selectionMode:'exceptCurrent',price:{minimum:200,maximum:1000,step:200}};q.answer='Ответ';q.steps[0].value='Вопрос';
 const xml=contentXML(p).replace('type="secret"','type="secretPublicPrice"').replace('name="selectionMode"','name="selectionMode" type="simple"').replace('name="theme"','name="theme" type="simple"');
 const result=importSIQ(archive(xml)),rq=first(result);assert.equal(rq.cat.showBeforeTransfer,true);
 const initialState=structuredClone(rq);rq.cat.showBeforeTransfer=false;const off=importSIQ(await exportSIQ(result.pack,result.media));assert.equal(Boolean(first(off).cat.showBeforeTransfer),false);assert.match(contentXML(off.pack),/type="secret"/);
 rq.cat.showBeforeTransfer=true;assert.deepEqual(rq,initialState);assert.match(contentXML(result.pack),/type="secretPublicPrice"/);
 // An old draft without the new field keeps the former hidden-theme behavior.
 delete rq.cat.showBeforeTransfer;assert.match(contentXML(result.pack),/type="secret"/);
});
