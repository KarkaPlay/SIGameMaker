import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {initial} from '../dist/model.js';
import {numberField} from '../dist/number-control.js';
import {contentXML,escapeXML,exportSIQ,importSIQ} from '../dist/siq.js';
import {copyMergeItem} from '../dist/merge-model.js';
import {zipSync,strToU8} from '../dist/vendor/fflate.js';
import {FixtureDOMParser} from './helpers/xml-parser.js';
const source=readFileSync('dist/app.js','utf8');
const archive=xml=>zipSync({'content.xml':strToU8(xml)});
const validate=xml=>execFileSync('xmllint',['--noout','--schema','docs/siq_5.xsd','-'],{input:xml,stdio:'pipe'});
globalThis.DOMParser=FixtureDOMParser;

test('imported package ID remains one form attribute when settings are rendered',()=>{
 const payload='x"><img src=x onerror="alert(1)"><input value="',xml=contentXML(initial()).replace(/id="[^"]*"/,'id="'+escapeXML(payload)+'"');validate(xml);
 const pack=importSIQ(archive(xml)).pack;let html;
 const context={pack,activeRound:()=>pack.rounds[0],activeQuestion:()=>pack.rounds[0].themes[0].questions[0],e:escapeXML,numberField,btn:()=>'',dialog:(_,body)=>{html=body;},editableSettingsTitle(){},settingsButton(){}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function settings(type,'),source.indexOf('function showValidation(')),context);context.settings('pack');
 const nodes=JSON.parse(execFileSync('python3',['-c',`import sys,json\nfrom html.parser import HTMLParser\nclass Parser(HTMLParser):\n def handle_starttag(self,tag,attrs): nodes.append([tag,dict(attrs)])\nnodes=[]\nParser().feed(sys.stdin.read())\nprint(json.dumps(nodes))`],{input:html,encoding:'utf8'}));
 assert.equal(nodes.find(([tag])=>tag==='form')[1]['data-id'],payload);assert.ok(!nodes.some(([tag])=>tag==='img'));
});

function backupFixture(exportSIQ){
 const button={disabled:false,textContent:'Копия скачана',dataset:{},hasAttribute:name=>name==='data-backup'},exportButton={disabled:false},messages=[];let click,downloads=0;
 const context={pack:initial(),media:new Map(),Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},document:{createElement:()=>({click(){downloads++;}})},setTimeout(){},$:()=>exportButton,exportSIQ,toast:message=>messages.push(message),notify:message=>messages.push(message),loadMedia:async()=>{},busy:false,closingModal:false,transitioning:false,outsidePress:false,modalKind:'replace',overlay:{addEventListener(_,fn){click=fn;}}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function download('),source.indexOf('function showPreview(')),context);
 vm.runInContext('onBackup='+source.match(/onBackup:(async\(\)=>\{[^}]*\})/)[1],context);
 const wizard=readFileSync('dist/setup-ui.js','utf8');vm.runInContext(wizard.slice(wizard.indexOf(" overlay.addEventListener('click'"),wizard.indexOf(" toast.addEventListener('click'")),context);
 return {button,exportButton,messages,context,downloads:()=>downloads,click:()=>click({target:{closest:()=>button}})};
}
test('failed backup export never confirms a copy and leaves the draft unchanged',async()=>{
 const fixture=backupFixture(async()=>{throw Error('Пак больше 250 МБ');}),before=structuredClone(fixture.context.pack);
 await fixture.click();assert.equal(fixture.button.textContent,'Скачать текущий .siq');assert.equal(fixture.downloads(),0);assert.deepEqual(fixture.messages,['Пак больше 250 МБ']);assert.equal(fixture.button.disabled,false);assert.equal(fixture.exportButton.disabled,false);assert.equal(fixture.context.busy,false);assert.deepEqual(fixture.context.pack,before);
});
test('successful backup confirms a copy only after the download is started',async()=>{
 const fixture=backupFixture(async()=>new Uint8Array([1]));await fixture.click();assert.equal(fixture.downloads(),1);assert.equal(fixture.button.textContent,'Копия скачана');assert.equal(fixture.button.disabled,false);
});
test('media restoration failure also leaves the backup unconfirmed and usable for retry',async()=>{
 const fixture=backupFixture(()=>assert.fail('Should not export'));fixture.context.loadMedia=async()=>{throw Error('Медиа недоступно');};await fixture.click();assert.equal(fixture.button.textContent,'Скачать текущий .siq');assert.equal(fixture.button.disabled,false);assert.deepEqual(fixture.messages,['Медиа недоступно']);
});

test('round and question information survives copying, draft cloning and repeated SIQ export',async()=>{
 const info={authors:['Author & <one>','Другой автор'],sources:['Source\nline two','Second source'],comments:'Обычный комментарий',showmanComments:'Только ведущему',extension:'<extra>'};
 const p=initial(),r=p.rounds[0],q=r.themes[0].questions[0];r.info=structuredClone(info);q.info=structuredClone(info);q.comment=info.showmanComments;q.source=info.sources.join('\n');
 validate(contentXML(p));const first=importSIQ(await exportSIQ(p,new Map())).pack,copy=copyMergeItem(first.rounds[0],new Map()).item;
 assert.deepEqual(copy.info,info);assert.deepEqual(copy.themes[0].questions[0].info,info);
 const cloned=structuredClone(first);cloned.rounds=[copy];const again=importSIQ(await exportSIQ(cloned,new Map())).pack,restored=again.rounds[0].themes[0].questions[0];
 assert.deepEqual(again.rounds[0].info,info);assert.deepEqual(restored.info,info);validate(contentXML(again));
 restored.comment='Новая заметка ведущему';restored.source='Новый источник';const editedPack=importSIQ(await exportSIQ(again,new Map())).pack,edited=editedPack.rounds[0].themes[0].questions[0];
 assert.equal(edited.comment,'Новая заметка ведущему');assert.equal(edited.info.comments,info.comments);assert.deepEqual(edited.info.authors,info.authors);assert.deepEqual(edited.info.sources,['Новый источник']);assert.equal(edited.info.extension,info.extension);
 // Clearing the visible host note must not bring back the separate general comment.
 edited.comment='';const cleared=importSIQ(archive(contentXML(editedPack))).pack.rounds[0].themes[0].questions[0];assert.equal(cleared.comment,'');assert.equal(cleared.info.comments,info.comments);
});

test('legacy comments remain intact and unsupported round/question information is reported',()=>{
 const base=contentXML(initial()),xml=base.replace('<showmanComments></showmanComments>','<comments>Старая заметка</comments>');validate(xml);
 const p=importSIQ(archive(xml)).pack,q=p.rounds[0].themes[0].questions[0];assert.equal(q.comment,'Старая заметка');assert.equal(importSIQ(archive(contentXML(p))).pack.rounds[0].themes[0].questions[0].info.comments,'Старая заметка');
 const roundXML=base.replace('<round name="Первый раунд" type="standard">','<round name="Первый раунд" type="standard"><info><comments><unknown/></comments></info>');
 assert.throws(()=>importSIQ(archive(roundXML)),error=>error.issues.some(i=>i.target?.kind==='round'&&i.message.includes('сведения раунда')));
 assert.throws(()=>importSIQ(archive(base.replace('<showmanComments></showmanComments>','<showmanComments><unknown/></showmanComments>'))),error=>error.issues.some(i=>i.target?.kind==='question'&&i.message.includes('сведения вопроса')));
});
