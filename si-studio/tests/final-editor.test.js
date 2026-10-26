import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {question} from '../dist/model.js';
import {numberField} from '../dist/number-control.js';

function editor(){
 const source=readFileSync('dist/app.js','utf8'),q=question(0),t={id:'topic',name:'Финальная <тема>',questions:[q]},r={id:'final',type:'final',themes:[t]};
 let snapshots=0,saves=0,dialogBody='';
 const cell={name:'',attrs:{},querySelector(){return {set textContent(value){cell.name=value;}};},setAttribute(key,value){this.attrs[key]=value;}};
 const context={activeRound:()=>r,activeTheme:()=>t,focused:false,
  e:value=>String(value).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  btn:(action,label,cls='',attrs='')=>`<button class="${cls}" data-action="${action}" ${attrs}>${label}</button>`,
  $:()=>({querySelectorAll:()=>[cell]}),snapshot(){snapshots++;},changed(redraw){assert.equal(redraw,false);saves++;},syncQuestionState(){},numberField,
  dialog(title,body){dialogBody=body;},editableSettingsTitle(){},settingsButton(){},
 };
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function finalBoard('),source.indexOf('function editor(')),context);
 vm.runInContext(source.slice(source.indexOf('function themeSettings('),source.indexOf('function editableSettingsTitle(')),context);
 return {context,r,t,q,cell,counts:()=>({snapshots,saves}),body:()=>dialogBody};
}
test('final has a small question caption, editable topic heading and no topic-settings button on its board',()=>{
 const {context,r,t,q}=editor(),heading=context.questionHeadingHTML(t,q,false),board=context.finalBoard(r,q,new Set());
 assert.match(heading,/<p class="studio-question-theme">Финальный вопрос<\/p>/);
 assert.match(heading,/<h1[^>]*><span class="studio-final-title-field">/);
 assert.match(heading,/id="final-theme-title"/);
 assert.match(heading,/value="Финальная &lt;тема&gt;"/);
 assert.ok(!heading.includes('data-action="question-settings"'));
 assert.ok(!board.includes('data-action="theme-settings"'));
 assert.match(board,/data-action="board-question"/);
 r.type='standard';
 assert.match(context.questionHeadingHTML(t,q,false),/data-action="question-settings"/);
});
test('inline final topic edits update its board, save without redrawing and keep one history entry per typing session',()=>{
 const {context,r,t,q,cell,counts}=editor(),before=structuredClone(q),measure={textContent:''},input={dataset:{themeId:t.id},value:'Новое имя',placeholder:'Название темы',parentElement:{querySelector:()=>measure}};
 context.saveFinalThemeName(input);
 input.value='Новое имя темы';context.saveFinalThemeName(input);
 assert.equal(t.name,'Новое имя темы');assert.equal(cell.name,t.name);assert.equal(measure.textContent,t.name);
 assert.equal(cell.attrs['aria-label'],'Новое имя темы, финальный вопрос');
 assert.deepEqual(counts(),{snapshots:1,saves:2});assert.deepEqual(q,before);assert.equal(t.questions.length,1);
 input.dataset.themeId='stale';input.value='Чужая тема';context.saveFinalThemeName(input);
 assert.equal(t.name,'Новое имя темы');
 input.dataset.themeId=t.id;r.type='standard';context.saveFinalThemeName(input);
 assert.deepEqual(counts(),{snapshots:1,saves:2});
});
test('a final topic never renders a question-count control',()=>{
 const {context,r,t,body}=editor();
 context.themeSettings(r,t);assert.ok(!body().includes('questionCount'));
 r.type='standard';context.themeSettings(r,t);assert.match(body(),/name="questionCount"/);
});
