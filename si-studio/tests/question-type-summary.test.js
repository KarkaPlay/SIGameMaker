import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {question,questionType,isAuction,catSettings,catSettingsError} from '../dist/model.js';

// Exercise the actual rendering and live-save functions without opening IndexedDB.
function editor(){
 const source=readFileSync('dist/app.js','utf8'),q=question();q.type='bagcat';
 const summary={innerHTML:''},help={textContent:''},error={textContent:''};
 const context={questionType,isAuction,catSettings,catSettingsError,structuredClone,icon:()=>'',e:value=>String(value??''),
  btn:(action,label,cls,attrs)=>`<button class="${cls}" data-action="${action}" ${attrs||''}>${label}</button>`,
  activeRound:()=>({type:'standard'}),activeTheme:()=>({name:'Исходная тема'}),activeQuestion:()=>q,
  stepWindow:{open:true},panelMotion:{isClosing:()=>false},settingsTarget:()=>q,focused:false,
  snapshot(){},changed(){},syncQuestionState(){},
  $:selector=>selector==='[data-cat-summary]'?summary:selector==='#question-type-help'?help:selector==='#cat-settings-error'?error:null,
  FormData:class{constructor(form){this.values=form.values;}get(key){return this.values.get(key)??null;}has(key){return this.values.has(key);}}
 };
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('const questionTypeChoices='),source.indexOf('function catChoiceButtons')),context);
 vm.runInContext(source.slice(source.indexOf('function saveCatSettings('),source.indexOf('function questionTypePicker(')),context);
 const form={dataset:{question:q.id,round:'round'},values:new Map(),querySelectorAll:()=>[{value:'350',validity:{valid:true}}]};
 return {context,q,summary,help,form,error};
}
test('cat summary updates live for theme, recipient, disclosure and price using its rendered binding',()=>{
 const {context,q,summary,help,form}=editor();
 assert.match(context.questionTypeHTML(q),/data-cat-summary/);
 for(const [field,key,value,expected] of [['theme','theme','Новая тема','Новая тема'],['selectionMode','selectionMode','any','Любому, включая себя'],['showBeforeTransfer','showBeforeTransfer','on','До передачи']]){
  form.values.set(key,value);context.saveCatSettings(form,field);assert.ok(summary.innerHTML.includes(expected));
 }
 assert.match(help.textContent,/известны до передачи/);
 form.values.set('priceMode','fixed');form.values.set('fixed','350');context.saveCatSettings(form,'fixed');assert.match(summary.innerHTML,/>350</);
 const saved=summary.innerHTML;form.querySelectorAll=()=>[{value:'',validity:{valid:false}}];context.saveCatSettings(form,'fixed');assert.equal(summary.innerHTML,saved);assert.match(context.$('#cat-settings-error').textContent,/не сохранена/);
});
test('settings action precedes the heading and auction mode is not repeated in its details',()=>{
 const {context,q}=editor();
 const cat=context.questionTypeHTML(q);assert.ok(cat.indexOf('data-action="cat-settings"')<cat.indexOf('<h3>Параметры кота'));
 q.type='stake';const auction=context.questionTypeHTML(q);assert.ok(auction.indexOf('data-action="auction-settings"')<auction.indexOf('<h3>Параметры аукциона'));
 assert.equal((auction.match(/Открытые торги/g)||[]).length,1);
 q.type='stakeAll';assert.equal((context.questionTypeHTML(q).match(/Скрытые ставки всех игроков/g)||[]).length,1);
});
