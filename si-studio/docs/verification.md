import {createAnswerListMotion} from './answer-list-motion.js';
import {createPanelMotion} from './panel-motion.js';
import {roundMultiplier,newRoundTheme,newQuestionPrice,newRound,validMultiplier} from './pricing.js';
import {scenarioParts,insertScenarioStep,ensureAnswerStep,removeScenarioStep} from './scenario.js';
import {countdown} from './preview-timer.js';
import {uid,kinds,step,question,initial,questions,issues,answerEntries,updateAnswerEntries,questionChecklist,questionTypes,questionType,isAuction,auctionLabel,answerLabel,canAddQuestion,finalRoundError,catSettings,catSettingsError} from './model.js';
import {exportSIQ} from './siq.js';
import {importReportHTML,importReadyHTML} from './import-report.js';
import {createImportReview} from './import-review.js';
import {createImportMotion} from './import-motion.js';
import * as storage from './storage.js';
import {installStepDrag,reorderSteps} from './step-drag.js';
import {welcomeHTML,installWelcomeDrop} from './welcome.js';
import {defaultSetup,setupHTML,setupRoundsHTML,setupPreviewHTML,buildPack} from './setup.js';
const panelMotion=createPanelMotion(),answerListMotion=createAnswerListMotion(),importMotion=createImportMotion();
const $=s=>document.querySelector(s),e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(action,label,cls='',extra='')=>`<button ${extra.includes('type="submit"')?'':'type="button"'} class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{settings:'<path d="m9 3-.7 2.2-2 .9-2.1-.5-1.5 2.6 1.5 1.7v2.2l-1.5 1.7 1.5 2.6 2.1-.5 2 .9L9 19h3l.7-2.2 2-.9 2.1.5 1.5-2.6-1.5-1.7V9.9l1.5-1.7-1.5-2.6-2.1.5-2-.9L12 3Z"/><circle cx="10.5" cy="11" r="3"/>',edit:'<path d="m15 5 4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15Z"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',media:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',grid:'<rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',auction:'<g transform="rotate(90 12 12)"><path d="m14 13-8 8-3-3 8-8M14 3l7 7-4 4-7-7 4-4Z"/></g><path d="M8 22h13"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',home:'<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/>'}[name]||''}</svg>`;
let setupConfig=defaultSetup(),setupStage=0,setupSelected=0;
let stepFocus=null,stopPreviewTimer=()=>{};
let answerExtraOwner=null,answerExtraOpen=false;
let screen='home',hasDraft=false,mediaLoaded=false,opening=false;
let pack,media=new Map(),urls=new Map(),roundId,themeId,questionId,previewIndex=0,history=[],future=[],saveTimer,saveQueue=Promise.resolve(),saveRevision=0,savedRevision=0,storageOK=true,focused=false,uploadTarget;
const activeRound=()=>pack.rounds.find(r=>r.id===roundId)||pack.rounds[0];
const activeTheme=()=>activeRound()?.themes.find(t=>t.id===themeId)||activeRound()?.themes[0];
const activeQuestion=()=>activeTheme()?.questions.find(q=>q.id===questionId)||activeTheme()?.questions[0];
function select(r,t,q){roundId=r?.id;themeId=t?.id;questionId=q?.id;previewIndex=0;}
function snapshot(){history.push(structuredClone(pack));if(history.length>40)history.shift();future=[];}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
function changed(redraw=true){persist();if(redraw)render();else{const undo=$('[data-action="undo"]'),redo=$('[data-action="redo"]');if(undo)undo.disabled=!history.length;if(redo)redo.disabled=!future.length;const status=$('.question-status');if(status){const bad=issues(pack,media).some(x=>x.question===activeQuestion()?.id);status.textContent=bad?'В работе':'Готово';status.classList.toggle('draft',bad);}}}
async function persist(){const data=structuredClone(pack),revision=++saveRevision;$('#save-status')?.replaceChildren(document.createTextNode('Сохраняем…'));saveQueue=saveQueue.catch(()=>{}).then(()=>storage.saveDraft(data));try{await saveQueue;savedRevision=revision;storageOK=true;hasDraft=true;if(revision===saveRevision)$('#save-status')?.replaceChildren(document.createTextNode('Сохранено на устройстве'));}catch{storageOK=false;$('#save-status')?.replaceChildren(document.createTextNode('Не сохранено'));toast('Не удалось сохранить. Скачайте .siq, чтобы не потерять изменения.');}}
const url=id=>{if(!media.has(id))return '';if(!urls.has(id))urls.set(id,URL.createObjectURL(media.get(id)));return urls.get(id);};

function board(){const r=activeRound(),q=activeQuestion(),bad=new Set(issues(pack,media).map(x=>x.question));if(r?.type==='final')return finalBoard(r,q,bad);return `<section class="studio-board-pane" aria-labelledby="board-title"><div class="studio-pane-heading"><div><h2 id="board-title">Игровое поле</h2><p>Выберите вопрос, чтобы собрать его сценарий.</p></div></div><div class="studio-board-scroll" data-round="${r?.id||''}"><div class="studio-board">${r?.themes.map(t=>`<div class="studio-board-row" data-theme-id="${t.id}"><div class="studio-theme-name"><span title="${e(t.name)}">${e(t.name)}</span>${btn('theme-settings',icon('edit'),'studio-theme-edit',`data-id="${t.id}" aria-label="Настройки темы ${e(t.name)}"`)}</div><div class="studio-price-row">${t.questions.map(qq=>`<button type="button" class="studio-question-cell ${isAuction(qq)?'studio-question-auction':questionType(qq)==='bagcat'?'studio-question-cat':''} ${!bad.has(qq.id)?'complete':''}" data-action="board-question" data-theme="${t.id}" data-id="${qq.id}" ${qq.id===q?.id?'aria-current="true"':''} aria-label="${e(t.name)}, ${isAuction(qq)?auctionLabel(qq).toLowerCase():questionType(qq)==='bagcat'?'кот в мешке':'вопрос'} за ${qq.price}" title="${isAuction(qq)?auctionLabel(qq)+' · ':questionType(qq)==='bagcat'?'Кот в мешке · ':''}${e(qq.steps.find(s=>s.type==='text')?.value||'Новый вопрос')}"><span>${r.type==='final'?'?':qq.price}</span>${isAuction(qq)?`<b class="studio-question-kind" aria-hidden="true">${icon('auction')}</b>`:questionType(qq)==='bagcat'?'<b class="studio-question-kind" aria-hidden="true">?</b>':''}<i aria-hidden="true"></i></button>`).join('')}${btn('board-add-question','+','studio-add-cell',`data-id="${t.id}" aria-label="Добавить вопрос в тему ${e(t.name)}"`)}</div></div>`).join('')||'<div class="studio-board-empty">Добавьте первую тему — здесь появятся ваши вопросы.</div>'}${btn('add-theme','+','studio-add-cell studio-add-theme','aria-label="Добавить тему" title="Добавить тему"')}</div></div><div class="studio-board-bottom"><div class="studio-board-legend"><span><i></i> В работе</span><span><i class="ready"></i> Готов</span></div></div></section>`;}
function finalBoard(r,q,bad){return `<section class="studio-board-pane" aria-labelledby="board-title"><div class="studio-pane-heading"><div><h2 id="board-title">Темы финала</h2><p>По одному вопросу в теме. Игроки исключают темы, пока не останется одна.</p></div></div><div class="studio-board-scroll" data-round="${r.id}"><div class="studio-board studio-final-board">${r.themes.map(t=>`<div class="studio-final-theme" data-theme-id="${t.id}"><div class="studio-final-questions">${t.questions.map((qq,i)=>btn('board-question',`<span>${e(t.name)}</span><small>${t.questions.length>1?`Вопрос ${i+1} · оставьте один в теме`:'Финальный вопрос'}</small><i aria-hidden="true"></i>`,`studio-question-cell studio-final-question ${!bad.has(qq.id)?'complete':''}`,`data-theme="${t.id}" data-id="${qq.id}" ${qq.id===q?.id?'aria-current="true"':''} aria-label="${e(t.name)}, финальный вопрос${t.questions.length>1?' '+(i+1):''}"`)).join('')||btn('board-add-question',`<span>${e(t.name)}</span><small>+ Добавить единственный вопрос</small>`,'studio-question-cell studio-final-question',`data-id="${t.id}"`)}</div>${btn('theme-settings',icon('edit'),'studio-final-theme-edit studio-theme-edit',`data-id="${t.id}" aria-label="Настройки темы ${e(t.name)}"`)}</div>`).join('')||'<div class="studio-board-empty">Добавьте тему — в ней появится один финальный вопрос.</div>'}${btn('add-theme','+ Добавить тему','studio-add-cell studio-add-theme','aria-label="Добавить тему"')}</div></div><div class="studio-board-bottom"><div class="studio-board-legend"><span><i></i> В работе</span><span><i class="ready"></i> Готов</span></div></div></section>`;}
function editor(){const t=activeTheme(),q=activeQuestion();if(!q)return `<section class="studio-question-pane studio-empty"><span>✦</span><h2>С чего начнём?</h2><p>Добавьте тему или выберите вопрос на поле слева.</p>${btn(t?'add-question':activeRound()?'add-theme':'add-round','+ Добавить '+(t?'вопрос':activeRound()?'тему':'раунд'),'primary')}</section>`;const bad=issues(pack,media).some(x=>x.question===q.id);return `<section class="studio-question-pane" aria-labelledby="question-title"><div class="studio-question-heading"><div><p class="studio-question-theme">${e(t.name)}</p><h1 id="question-title">${activeRound()?.type==='final'?'Финальный вопрос':`<span class="studio-question-price-heading">Вопрос за ${btn('question-settings',e(q.price),'studio-question-price-button',`aria-label="Изменить стоимость вопроса: ${q.price}" aria-haspopup="dialog" title="Изменить стоимость"`)}</span>`}${btn('question-readiness',bad?'В работе':'Готово',`question-status ${bad?'draft':''}`,'aria-haspopup="dialog" title="Что нужно для готовности вопроса"')}</h1></div><div class="studio-question-actions">${btn('preview','▷ Смотреть','secondary','title="Предпросмотр вопроса"')}${btn('delete-question',icon('trash'),'icon-button studio-delete-question',activeRound()?.type==='final'&&t.questions.length===1?'aria-label="Удалить тему с вопросом" title="Удалить тему с вопросом"':'aria-label="Удалить вопрос" title="Удалить вопрос"')}</div></div><div class="studio-question-content" data-question="${q.id}">${questionTypeHTML(q)}${scenarioHTML(q)}<section class="studio-answer" aria-labelledby="correct-answer-title"><div class="studio-answer-heading"><div class="studio-answer-copy"><h2 id="correct-answer-title"><label for="correct-answer">Правильный ответ</label></h2><p id="correct-answer-hint">До ответа видит только ведущий</p></div></div><input id="correct-answer" aria-describedby="correct-answer-hint" data-field="answer" value="${e(q.answer)}" placeholder="Что должны назвать игроки?">${answerExtraHTML(q)}</section></div></section>`;}
const answerListTitles={alternatives:'Другие верные формулировки',wrong:'Неверные ответы'};
function answerListHTML(q,field){const entries=answerEntries(q[field]),title=answerListTitles[field];
 return `<section class="studio-answer-list" data-answer-list="${field}" aria-label="${title}"><ul role="list"><li class="studio-answer-list-heading" role="presentation">${title}:</li>${entries.map((text,i)=>`<li>${btn('answer-entry-edit',e(text),'studio-answer-entry',`data-answer-field="${field}" data-index="${i}" aria-label="Изменить ответ: ${e(text)}" title="${e(text)} — изменить"`)}</li>`).join('')}<li class="studio-answer-add-slot" role="presentation">${btn('answer-entry-add','+','studio-answer-list-add',`data-answer-field="${field}" aria-label="Добавить: ${title.toLowerCase()}" title="Добавить ответ"`)}</li></ul></section>`;
}

function updateAnswerList(q,field,{index,after,remove}){
 const card=$('.studio-answer'),list=card?.querySelector(`[data-answer-list="${field}"]`);if(!card||!list)return;
 const inserted=index===null&&!remove?(after===null?answerEntries(q[field]).length-1:after+1):null;
 const items=phase=>{
  const result=new Map();
  for(const group of card.querySelectorAll('[data-answer-list]'))for(const li of group.querySelectorAll('li')){
   const entry=li.querySelector('[data-action="answer-entry-edit"]');let key;
   if(entry){let i=Number(entry.dataset.index);if(phase==='after'&&group.dataset.answerList===field){if(remove&&i>=index)i++;else if(inserted!==null){if(i===inserted){result.set(`${field}:new`,li);continue;}if(i>inserted)i--;}}key=`entry:${i}`;}
   else key=li.classList.contains('studio-answer-add-slot')?'add':'heading';
   result.set(`${group.dataset.answerList}:${key}`,li);
  }
  for(const label of card.querySelectorAll('.studio-extra-fields>label'))result.set(`field:${label.querySelector('[data-field]').dataset.field}`,label);
  return result;
 };
 answerListMotion.run(card,items,()=>{const template=document.createElement('div');template.innerHTML=answerListHTML(q,field);list.replaceWith(template.firstElementChild);});
}

function answerExtraHTML(q){const open=answerExtraOwner===q.id&&answerExtraOpen;
 return `<div class="studio-extra ${open?'is-open':''}">${btn('toggle-answer-extra','<span>Варианты ответа и заметки</span><span class="studio-extra-chevron" aria-hidden="true">⌄</span>','studio-extra-toggle',`aria-expanded="${open}" aria-controls="answer-extra-content"`)}<div class="studio-extra-reveal" id="answer-extra-content" aria-hidden="${!open}" ${open?'':'inert'}><div class="studio-extra-clip"><div class="studio-extra-fields">${answerListHTML(q,'alternatives')}${answerListHTML(q,'wrong')}<label>Комментарий ведущему<textarea data-field="comment" placeholder="Уточнения и пояснения">${e(q.comment)}</textarea></label><label>Источник<input data-field="source" value="${e(q.source)}" placeholder="Ссылка или название источника"></label></div></div></div></div>`;
}
function toggleAnswerExtra(button){
 const block=button.closest('.studio-extra'),open=!block.classList.contains('is-open');answerExtraOwner=activeQuestion().id;answerExtraOpen=open;
 block.classList.toggle('is-open',open);button.setAttribute('aria-expanded',String(open));const reveal=block.querySelector('.studio-extra-reveal');reveal.inert=!open;reveal.setAttribute('aria-hidden',String(!open));
}
function answerEntryPopup(anchor,edit=false){
 const q=activeQuestion(),field=anchor.dataset.answerField;if(!q||!Object.hasOwn(answerListTitles,field))return;
 const entries=answerEntries(q[field]),index=edit?Number(anchor.dataset.index):null,after=anchor.hasAttribute('data-after')?Number(anchor.dataset.after):null;
 if(edit&&(!Number.isInteger(index)||!entries[index]))return;
 dialog(edit?'Изменить ответ':field==='alternatives'?'Добавить верную формулировку':'Добавить неверный ответ',`<form id="answer-entry-form" class="studio-answer-entry-form" data-question="${q.id}" data-answer-field="${field}" ${index===null?'':`data-index="${index}"`} ${after===null?'':`data-after="${after}"`}><label for="answer-entry-input">${field==='alternatives'?'Верная формулировка':'Неверный ответ'}</label><input id="answer-entry-input" name="text" value="${e(edit?entries[index]:'')}" placeholder="Введите ответ" required autocomplete="off"><div class="dialog-footer">${edit?btn('answer-entry-delete',icon('trash')+' Удалить','studio-answer-entry-delete'):''}${btn('save-answer-entry',edit?'Сохранить':'Добавить','primary','type="submit"')}</div></form>`,'',anchor);
 const form=$('#answer-entry-form');form.dataset.original=q[field]||'';$('#dialog').classList.add('studio-answer-entry-dialog');positionSettings();
 // This window opens specifically for text input; the close button never receives initial focus.
 form.elements.text.focus({preventScroll:true});
}
async function saveAnswerEntry(form,remove=false){
 if(panelMotion.isClosing($('#dialog')))return;
 const q=activeQuestion(),field=form.dataset.answerField;if(!q||q.id!==form.dataset.question||!Object.hasOwn(answerListTitles,field))return;
 if((q[field]||'')!==form.dataset.original){toast('Список изменился. Откройте ответ заново.');return;}
 const index=form.hasAttribute('data-index')?Number(form.dataset.index):null,after=form.hasAttribute('data-after')?Number(form.dataset.after):null;
 let next;try{next=updateAnswerEntries(q[field],{text:form.elements.text.value,index,after,remove});}catch(err){form.elements.text.setCustomValidity(err.message);form.elements.text.reportValidity();return;}
 const modified=next!==q[field];if(modified){snapshot();q[field]=next;focused=false;changed(false);}
 await closeDialog();if(screen!=='editor'||activeQuestion()!==q)return;
 if(modified)updateAnswerList(q,field,{index,after,remove});
 const list=$(`[data-answer-list="${field}"]`),newIndex=remove?null:index??(after===null?answerEntries(next).length-1:after+1);
 const target=newIndex===null?list?.querySelector('.studio-answer-list-add'):list?.querySelector(`[data-action="answer-entry-edit"][data-index="${newIndex}"]`);target?.focus({preventScroll:true});

}

function questionReadinessPopup(anchor){
 const q=activeQuestion(),r=activeRound();if(!q)return;
 const checks=questionChecklist(q,r,media),missing=checks.filter(check=>!check.passed).length;
 dialog('Готовность вопроса',`<ul class="studio-readiness-list">${checks.map(check=>`<li class="${check.passed?'is-complete':'is-missing'}">${check.passed?`<span class="studio-readiness-mark" aria-hidden="true">✓</span><span>${e(check.label)}</span>`:btn('fix-readiness',`<span class="studio-readiness-mark" aria-hidden="true">○</span><span>${e(check.label)}</span>`,'studio-readiness-fix',`data-target="${check.target}" data-step="${check.stepId||''}" data-field="${check.field||''}"`)}</li>`).join('')}</ul><p class="studio-readiness-note">${missing?'Нажмите на пункт, чтобы заполнить.':'Все необходимые поля заполнены.'}</p>`,'',anchor);
 $('#dialog').dataset.question=q.id;$('#dialog').classList.add('studio-readiness-dialog');positionSettings();
}
async function fixReadiness(button){
 const q=activeQuestion(),owner=q?.id;if(!q||$('#dialog').dataset.question!==owner)return;
 const target=button.dataset.target,id=button.dataset.step,field=button.dataset.field;
 await closeDialog();if(activeQuestion()?.id!==owner||screen!=='editor')return;
 if(target==='type'){if(questionType(q)==='bagcat')catSettingsDialog();else questionTypePicker($('#question-type'));return;}
 if(target==='answer'){const input=$('#correct-answer');input?.scrollIntoView({block:'nearest'});input?.focus({preventScroll:true});return;}
 let st=q.steps.find(st=>st.id===id);
 if(target==='content'){
  const before=scenarioParts(q.steps).before;st=before.find(st=>st.type==='text'&&!st.value.trim()||['image','audio','video'].includes(st.type)&&!media.has(st.mediaId));
  if(!st){st=step('text');snapshot();q.steps=insertScenarioStep(q.steps,st,'before');changed();}
 }
 if(!st)return;
 $(`.studio-step[data-step="${st.id}"]`)?.scrollIntoView({block:'nearest'});openStepEditor(st.id);
 if(field==='duration'){
  const options=stepWindow.querySelector('.studio-step-options');if(options)setStepOptions(options,true);
  const control=stepWindow.querySelector('[data-duration-toggle]');control?.focus({preventScroll:true});
 }else stepWindow.querySelector(st.type==='text'?'textarea':'.studio-upload')?.focus({preventScroll:true});
}

const questionTypeChoices=[['simple','Обычный вопрос',icon('grid')],['stake','Вопрос-аукцион',icon('auction')],['bagcat','Кот в мешке','?'],['norisk','Без риска',icon('heart')]];
function questionTypeHTML(q){if(activeRound()?.type==='final')return `<section class="studio-final-rules"><strong>Скрытые ставки</strong><p>Все финалисты делают свою ставку и отвечают письменно. Стоимость определяется ставкой каждого игрока.</p>${questionType(q)!=='simple'?btn('use-final-rules','Применить правила финала','secondary'):''}</section>`;
 const type=questionType(q),choice=questionTypeChoices.find(c=>c[0]===(isAuction(q)?'stake':type))||questionTypeChoices[0];
 return `<section class="studio-question-type" aria-labelledby="question-type-title"><h2 class="studio-type-label" id="question-type-title">Тип вопроса</h2><div class="studio-type-layout"><div class="studio-current-type">${btn('question-type-picker',`<span class="studio-round-choice-symbol" aria-hidden="true">${choice[2]}</span><span>${choice[1]}</span>`,'studio-round-choice studio-type-trigger',`id="question-type" aria-label="Тип вопроса: ${choice[1]}" aria-haspopup="dialog"`)}${isAuction(q)?btn('auction-settings','Режим аукциона','secondary','aria-haspopup="dialog"'):''}${type==='bagcat'?`${btn('cat-settings','Настроить кота','secondary','aria-haspopup="dialog" aria-controls="step-editor" aria-expanded="false"')}`:''}</div><div class="studio-type-details"><p id="question-type-help">${isAuction(q)?auctionHelp(q):type==='bagcat'?catHelp(q):'Отвечает первый нажавший кнопку. После ошибки могут отвечать другие игроки.'}</p>${type==='bagcat'?`<dl class="studio-cat-summary">${catSummary(q)}</dl>`:''}</div></div></section>`;
}
function auctionHelp(q){return questionType(q)==='stakeAll'?'Скрытые ставки: все допущенные игроки делают ставку и отвечают письменно. За верный ответ каждый получает свою ставку, за неверный — теряет её. Допуск игроков определяется правилами SIGame.':`Открытые торги: отвечает только победитель. За верный ответ он получает свою ставку, за неверный — теряет её. Номинальная стоимость — ${q.price}.`;}
function auctionSettingsDialog(anchor){
 const q=activeQuestion();if(!q||!isAuction(q)||activeRound()?.type==='final')return;
 dialog('Режим аукциона',`<div class="studio-auction-modes" role="group" aria-label="Режим аукциона">${[['stake','Открытые торги','Отвечает победитель торгов.'],['stakeAll','Скрытые ставки всех игроков','Все допущенные игроки делают свою ставку и отвечают письменно.']].map(([type,label,description])=>btn('select-auction-mode',`<strong>${label}</strong><span>${description}</span>`,'studio-auction-mode',`data-type="${type}" aria-pressed="${questionType(q)===type}"`)).join('')}</div>`,'',anchor);
 const d=$('#dialog');d.dataset.question=q.id;d.dataset.round=activeRound().id;
}
function catHelp(q){return catSettings(q).showBeforeTransfer?'Тема и стоимость известны до передачи вопроса. Отвечает только получатель кота.':'Выбравший вопрос передаёт его игроку. Затем раскрывается тема, выбирается стоимость и отвечает только получатель кота.';}
function catSummary(q){
 const c=catSettings(q),p=c.price,price=p.maximum===0?'Минимум или максимум раунда':p.minimum===p.maximum?String(p.minimum):`${p.minimum}–${p.maximum}${p.step?' · шаг '+p.step:''}`;
 return [['Тема',c.theme||activeTheme()?.name],['Стоимость',price],['Передача',c.selectionMode==='any'?'Любому, включая себя':'Только другому игроку'],['Раскрытие',c.showBeforeTransfer?'До передачи':'После передачи']].map(([label,value])=>`<div><dt>${label}</dt><dd>${e(value)}</dd></div>`).join('');
}
function catChoiceButtons(name,current,choices){return `<div class="studio-round-choices studio-cat-choices" role="group" aria-label="${name==='selectionMode'?'Кому можно отдать вопрос':'Стоимость кота'}">${choices.map(([value,label,symbol])=>btn('cat-choice',`<span class="studio-round-choice-symbol" aria-hidden="true">${symbol}</span><span>${label}</span>`,'studio-round-choice',`data-field-name="${name}" data-value="${value}" aria-pressed="${current===value}"`)).join('')}</div>`;}
function catSettingsBody(q){
 const c=catSettings(q),p=c.price,mode=p.maximum===0?'round':p.minimum===p.maximum?'fixed':'range';
 const field=(label,name,value)=>`<label>${label}<input name="${name}" type="number" min="0" max="2147483647" step="1" required value="${value}"></label>`;
 const symbol=(paths,viewBox='0 0 24 24')=>`<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
 return `<form id="cat-settings-form" class="settings-form" novalidate data-question="${q.id}" data-round="${activeRound().id}"><div class="studio-step-body"><label>Тема кота<input name="theme" value="${e(c.theme)}" placeholder="${e(activeTheme().name)}"></label><p class="dialog-description">Пустое поле — тема с игрового поля.</p><label class="studio-cat-reveal-toggle"><input type="checkbox" name="showBeforeTransfer" ${c.showBeforeTransfer?'checked':''}><span>Показывать тему и стоимость до передачи</span></label><fieldset class="studio-cat-choice-field"><legend>Кому можно отдать вопрос</legend><input type="hidden" name="selectionMode" value="${c.selectionMode}">${catChoiceButtons('selectionMode',c.selectionMode,[['exceptCurrent','Другому игроку',symbol('<circle cx="5" cy="6" r="3"/><path d="M1 21v-5a4 4 0 0 1 8 0v5"/><circle cx="31" cy="6" r="3"/><path d="M27 21v-5a4 4 0 0 1 8 0v5M13 12h10m-3-3 3 3-3 3"/>','0 0 36 24')],['any','Можно себе',symbol('<circle cx="16" cy="12" r="3"/><path d="M10 24v-2a6 6 0 0 1 12 0v2M7 6a13 13 0 1 1-3 17M4 28v-5h5"/>','0 0 32 32')]])}</fieldset><fieldset class="studio-cat-choice-field"><legend>Стоимость кота</legend><input type="hidden" name="priceMode" value="${mode}">${catChoiceButtons('priceMode',mode,[['round','По раунду',symbol('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10m6-10v10"/>')],['fixed','Фиксированная',symbol('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>')],['range','Диапазон',symbol('<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3" fill="white"/><circle cx="16" cy="17" r="3" fill="white"/>')]])}</fieldset><p class="dialog-description" data-cat-price-hint></p><div data-cat-prices><div data-cat-fixed>${field('Стоимость','fixed',p.maximum||q.price||100)}</div><div data-cat-range class="form-row">${field('От','minimum',mode==='range'?p.minimum:100)}${field('До','maximum',p.maximum||500)}${field('Шаг (0 — любой)','step',p.step)}</div></div><p class="dialog-description" role="alert" id="cat-settings-error"></p></div><div class="studio-step-window-footer"><span>Изменения сохраняются автоматически</span>${btn('close-step-editor','Готово','secondary')}</div></form>`;
}
function catSettingsDialog(){
 const q=activeQuestion();if(!q||questionType(q)!=='bagcat'||activeRound()?.type==='final')return;
 if(stepWindow.open)closeStepEditor(true);
 stepPanelMode='cat';stepOwner=q.id;focused=false;stepWindow.inert=false;stepWindow.replaceChildren();paintStepEditor();
 stepWindow.show();positionStepEditor();markEditedStep();stepWindow.querySelector('h2').focus({preventScroll:true});panelMotion.open(stepWindow);
}
function selectCatChoice(button){
 const form=button.closest('#cat-settings-form');if(!form)return;
 const name=button.dataset.fieldName;if(form.elements[name].value===button.dataset.value)return;
 const update=()=>{form.elements[name].value=button.dataset.value;
 for(const choice of form.querySelectorAll(`[data-field-name="${name}"]`))choice.setAttribute('aria-pressed',String(choice===button));
 syncCatPriceFields();focused=false;saveCatSettings(form,name);focused=false;};
 if(name==='priceMode')animateCatLayout(update);else update();positionStepEditor();
}
let catLayoutMotion=null;
function stopCatLayoutMotion(){
 const state=catLayoutMotion;if(!state)return;catLayoutMotion=null;
 for(const motion of state.motions)motion.cancel();stepWindow.classList.remove('is-cat-resizing');
}
function animateCatLayout(update){
 const prices=stepWindow.querySelector('[data-cat-prices]'),before=stepWindow.getBoundingClientRect(),beforePrices=prices.getBoundingClientRect().height;
 stopCatLayoutMotion();update();positionStepEditor();
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const after=stepWindow.getBoundingClientRect(),afterPrices=prices.getBoundingClientRect().height;
 const state={motions:[]};catLayoutMotion=state;stepWindow.classList.add('is-cat-resizing');
 const options={duration:240,easing:'cubic-bezier(.2,.75,.25,1)'};
 const animate=(node,frames)=>{const motion=node.animate(frames,options);state.motions.push(motion);return motion;};
 const resize=animate(stepWindow,[{height:`${before.height}px`,top:`${before.top}px`},{height:`${after.height}px`,top:`${after.top}px`}]);
 animate(prices,[{height:`${beforePrices}px`},{height:`${afterPrices}px`}]);
 const incoming=prices.querySelector(':scope > :not([hidden])');
 for(const node of [incoming,stepWindow.querySelector('[data-cat-price-hint]')].filter(Boolean))animate(node,[{opacity:0,transform:'translateY(-4px)'},{opacity:1,transform:'translateY(0)'}]);
 resize.onfinish=()=>{if(catLayoutMotion!==state)return;stopCatLayoutMotion();positionStepEditor();};
}
function syncCatPriceFields(){const form=$('#cat-settings-form');if(!form)return;for(const [selector,mode]of [['[data-cat-fixed]','fixed'],['[data-cat-range]','range']]){const box=form.querySelector(selector),shown=form.elements.priceMode.value===mode;box.hidden=!shown;for(const input of box.querySelectorAll('input'))input.disabled=!shown;}form.querySelector('[data-cat-price-hint]').textContent=({round:'Получатель выберет минимум или максимум раунда.',fixed:'Эта стоимость назначается получателю.',range:'Получатель выберет стоимость в указанном диапазоне.'})[form.elements.priceMode.value];}
function saveCatSettings(form,field){
 if(!stepWindow.open||panelMotion.isClosing(stepWindow))return;
 const q=settingsTarget('question',form.dataset.question,form.dataset.round);if(!q||q.id!==activeQuestion()?.id||questionType(q)!=='bagcat')return;
 const v=new FormData(form),cat=structuredClone(catSettings(q));
 if(field==='theme')cat.theme=v.get('theme').trim();
 else if(field==='selectionMode')cat.selectionMode=v.get('selectionMode');
 else if(field==='showBeforeTransfer'){cat.showBeforeTransfer=v.has('showBeforeTransfer');focused=false;}
 else{
  const mode=v.get('priceMode'),inputs=[...form.querySelectorAll('input[type="number"]')].filter(input=>!input.disabled);
  const valid=inputs.every(input=>input.value.trim()!==''&&input.validity.valid);
  const price=mode==='round'?{minimum:0,maximum:0,step:0}:mode==='fixed'?{minimum:Number(v.get('fixed')),maximum:Number(v.get('fixed')),step:0}:{minimum:Number(v.get('minimum')),maximum:Number(v.get('maximum')),step:Number(v.get('step'))};
  const error=!valid?'Заполните стоимость целыми неотрицательными числами.':catSettingsError({...cat,price})||(mode!=='round'&&price.maximum===0?'Для нулевой стоимости выберите правила раунда.':'');
  $('#cat-settings-error').textContent=error?`${error} Стоимость пока не сохранена.`:'';
  if(error)return;
  cat.price=price;
 }
 if(JSON.stringify(cat)===JSON.stringify(catSettings(q)))return;
 if(!focused){snapshot();focused=true;}q.cat=cat;changed(false);if(field==='showBeforeTransfer')focused=false;
 const summary=$('.studio-cat-summary');if(summary)summary.innerHTML=catSummary(q);const help=$('#question-type-help');if(help)help.textContent=catHelp(q);syncQuestionState();
}
function questionTypePicker(anchor){
 const q=activeQuestion();if(!q||activeRound()?.type==='final')return;
 dialog('Тип вопроса',`<div class="studio-round-choices">${questionTypeChoices.map(([type,label,symbol])=>{const available=Object.hasOwn(questionTypes,type);return btn('select-question-type',`<span class="studio-round-choice-symbol" aria-hidden="true">${symbol}</span><span>${label}</span>${available?'':'<small>Скоро</small>'}`,'studio-round-choice',`data-type="${type}" ${available?`aria-pressed="${questionType(q)===type||type==='stake'&&isAuction(q)}"`:'disabled aria-disabled="true"'} aria-label="${label}${available?'':' — скоро'}"`);}).join('')}</div>`,'',anchor);
 const d=$('#dialog');d.classList.add('studio-round-picker');d.dataset.question=q.id;d.dataset.round=activeRound().id;positionSettings();
}

function stepPalette(section,disabled=false){return `<div class="studio-step-palette"><div>${['text','image','audio','video'].map(type=>btn('add-step',`<span aria-hidden="true">${kinds[type][1]}</span> ${{text:'Текст',image:'Фото',audio:'Аудио',video:'Видео'}[type]}`,'studio-add-step',`data-type="${type}" data-section="${section}" ${disabled?'disabled':''}`)).join('')}${btn('coming-soon','Слово ведущего — скоро','studio-add-step studio-coming-soon','disabled aria-disabled="true" title="Скоро появится"')}</div></div>`;}
function scenarioHTML(q){
 const parts=scenarioParts(q.steps);
 const cards=steps=>steps.map(st=>stepCard(st,q.steps.indexOf(st),q)).join('');
 return `<div class="studio-timeline-heading"><h2>Сценарий вопроса</h2><span>Событий: ${q.steps.length} · сверху вниз</span></div><div class="studio-steps"><section class="studio-scenario-section" data-section="before" aria-label="До ответа игроков"><div class="studio-section-steps">${cards(parts.before)}</div>${stepPalette('before')}</section><section class="studio-scenario-section studio-response-section" data-section="answer" aria-label="Ответ игроков"><div class="studio-section-steps">${cards(parts.answer)}</div></section><section class="studio-scenario-section" data-section="after" aria-label="После ответа игроков"><div class="studio-section-divider"><h3>${activeRound()?.type==='final'?'После ответов финалистов':questionType(q)==='stakeAll'?'После ответов игроков':['stake','stakeAll','bagcat'].includes(questionType(q))?'После ответа или окончания времени':'После таймера или верного ответа'}</h3></div><div class="studio-section-steps">${cards(parts.after)}</div>${stepPalette('after',!parts.answer.length)}</section></div>`;
}
function durationControl(st,i){
 const custom=st.duration>0,label=st.type==='answer'?'Время на ответ':'Длительность шага';
 return `<div class="studio-duration"><label class="studio-check"><input type="checkbox" data-duration-toggle data-id="${st.id}" ${custom?'checked':''} aria-label="Своя длительность шага ${i+1}"> Своя длительность</label>${custom?`<div class="studio-duration-slider"><input type="range" min="1" max="60" step="1" data-step-field="duration" data-id="${st.id}" value="${Math.min(60,Math.max(1,st.duration))}" aria-label="${label}, шаг ${i+1}"><output class="studio-duration-value" data-id="${st.id}">${st.duration} сек</output></div><div class="studio-duration-scale"><span>1 сек</span><span>60 сек</span></div>${st.duration>60?`<p>В загруженном паке — ${st.duration} сек. Слайдер задаёт от 1 до 60 сек.</p>`:''}`:'<p>Время определит игра.</p>'}</div>`;
}
function stepSummary(st){
 if(st.type==='text')return String(st.value||'').trim().replace(/\s+/g,' ')||'Добавьте текст';
 if(st.type==='answer')return st.duration?`${st.duration} сек на ответ`:'Время по настройкам игры';
 return st.filename||'Файл ещё не выбран';
}
function stepCard(st,i,q){const [name,symbol]=kinds[st.type];return `<div class="studio-event-row"><article class="studio-step studio-timeline-event studio-type-${st.type}" data-step="${st.id}"><button type="button" class="studio-step-handle" draggable="true" aria-label="Перетащить шаг ${i+1}" title="Перетащить шаг">⠿</button>${btn('edit-step',`<span class="studio-step-number">${String(i+1).padStart(2,'0')}</span><span class="studio-step-symbol ${st.type}" aria-hidden="true">${symbol}</span><span class="studio-event-copy"><strong class="studio-step-label">${st.type==='answer'?answerLabel(q,activeRound()):name}</strong><span class="studio-event-summary">${e(stepSummary(st))}</span></span>`,'studio-event-trigger',`data-id="${st.id}" aria-haspopup="dialog" aria-controls="step-editor" aria-expanded="false"`)}</article>${btn('step-actions','⋯','studio-event-actions',`data-id="${st.id}" aria-label="Действия с событием ${i+1}" aria-haspopup="dialog" title="Действия с событием"`)}</div>`;}
function stepEditorBody(st,i,q){return `<div class="studio-step-body">${st.type==='answer'?`${durationControl(st,i)}`:st.type==='text'?`<textarea class="studio-step-text" data-step-field="value" data-id="${st.id}" aria-label="Текст шага ${i+1}" placeholder="Напишите вопрос или часть истории…">${e(st.value)}</textarea>`:`<button type="button" class="studio-upload" data-action="upload" data-id="${st.id}">${st.mediaId&&st.type==='image'?`<img src="${url(st.mediaId)}" alt="${e(st.filename)}">`:`<span aria-hidden="true">${st.mediaId?'✓':'↥'}</span>`}<strong>${st.mediaId?e(st.filename):'Выбрать файл'}</strong><small>${st.mediaId?'Нажмите, чтобы заменить файл':st.type==='image'?'PNG, JPG, WebP или GIF':st.type==='audio'?'MP3, WAV или OGG':'MP4 или WebM'}</small></button>`}<div class="studio-step-bottom">${st.type!=='answer'?`<div class="studio-step-options">${btn('toggle-step-options','Параметры шага <span aria-hidden="true">⌄</span>','studio-options-toggle',`aria-expanded="false" aria-controls="step-options-${st.id}"`)}<div class="studio-options-reveal" id="step-options-${st.id}" aria-hidden="true" inert><div class="studio-options-clip">${durationControl(st,i)}<label class="studio-check"><input type="checkbox" data-step-field="wait" data-id="${st.id}" ${st.wait?'checked':''}> Пауза перед следующим шагом</label></div></div></div>`:'<span></span>'}</div></div>`;}
const stepWindow=document.createElement('dialog');stepWindow.id='step-editor';stepWindow.className='studio-step-editor';document.body.append(stepWindow);
let stepOwner=null,stepClosingFocus=null,stepPanelMode='step';
function markEditedStep(){document.querySelectorAll('.studio-event-trigger').forEach(b=>{const selected=stepPanelMode==='step'&&stepWindow.open&&!panelMotion.isClosing(stepWindow)&&b.dataset.id===stepFocus;b.setAttribute('aria-expanded',String(selected));b.closest('.studio-step').classList.toggle('is-editing',selected);});const cat=$('[data-action="cat-settings"]');cat?.setAttribute('aria-expanded',String(stepPanelMode==='cat'&&stepWindow.open&&!panelMotion.isClosing(stepWindow)));}
function positionStepEditor(){
 if(!stepWindow.open||panelMotion.isClosing(stepWindow)||catLayoutMotion)return;
 const anchor=stepPanelMode==='cat'?$('[data-action="cat-settings"]'):$(`.studio-event-trigger[data-id="${stepFocus}"]`),pane=$('.studio-question-content');if(!anchor||!pane)return;
 const a=anchor.getBoundingClientRect(),r=pane.getBoundingClientRect(),w=stepWindow.offsetWidth,h=stepWindow.offsetHeight;
 // Sit beside the timeline, overlapping the board instead of obscuring the event list.
 const left=Math.max(12,Math.min(r.left-w+14,innerWidth-w-12));
 const top=Math.max(12,Math.min(a.top-12,innerHeight-h-12));
 stepWindow.style.left=`${left}px`;stepWindow.style.top=`${top}px`;stepWindow.style.transformOrigin=`right ${Math.max(20,Math.min(a.top+a.height/2-top,h-20))}px`;
}
function paintStepEditor(){
 const q=activeQuestion();
 if(stepPanelMode==='cat'){
  if(screen!=='editor'||q?.id!==stepOwner||questionType(q)!=='bagcat'||activeRound()?.type==='final'){closeStepEditor(true);return;}
  // Keep an in-progress settings form intact when unrelated editor content redraws.
  if(!stepWindow.querySelector('#cat-settings-form')){
   stepWindow.className='studio-step-editor studio-type-text studio-cat-editor';
   stepWindow.innerHTML=`<div class="studio-step-window-heading"><div><p>Настройки вопроса</p><h2 id="step-editor-title" tabindex="-1">Кот в мешке</h2></div>${btn('close-step-editor','×','icon-button','aria-label="Закрыть настройки кота"')}</div>${catSettingsBody(q)}`;
   stepWindow.setAttribute('aria-labelledby','step-editor-title');syncCatPriceFields();
  }
  positionStepEditor();markEditedStep();return;
 }
 const st=q?.steps.find(st=>st.id===stepFocus);
 if(screen!=='editor'||q?.id!==stepOwner||!st){closeStepEditor(true);return;}
 const previousFocus=stepWindow.contains(document.activeElement)?document.activeElement:null,focusAction=previousFocus?.dataset.action,optionsOpen=stepWindow.querySelector('.studio-step-options')?.classList.contains('is-open'),scroll=stepWindow.scrollTop;
 const i=q.steps.indexOf(st);stepWindow.className=`studio-step-editor studio-type-${st.type}`;
 stepWindow.innerHTML=`<div class="studio-step-window-heading"><div><p>Событие ${i+1} из ${q.steps.length}</p><h2 id="step-editor-title" tabindex="-1">${st.type==='answer'?answerLabel(q,activeRound()):kinds[st.type][0]}</h2></div>${btn('close-step-editor','×','icon-button','aria-label="Закрыть редактирование события"')}</div>${stepEditorBody(st,i,q)}<div class="studio-step-window-footer"><span>Изменения сохраняются автоматически</span>${btn('close-step-editor','Готово','secondary')}</div>`;
 stepWindow.setAttribute('aria-labelledby','step-editor-title');const options=stepWindow.querySelector('.studio-step-options');if(options&&optionsOpen)setStepOptions(options,true);stepWindow.scrollTop=scroll;if(stepWindow.open&&previousFocus){const next=focusAction?stepWindow.querySelector(`[data-action="${focusAction}"]`):null;(next&&!next.disabled?next:stepWindow.querySelector('h2')).focus({preventScroll:true});}positionStepEditor();markEditedStep();
}
function openStepEditor(id){
 if(!activeQuestion()?.steps.some(st=>st.id===id))return;
 if(stepWindow.open)closeStepEditor(true);
 stepPanelMode='step';stepFocus=id;stepOwner=activeQuestion()?.id;focused=false;stepWindow.inert=false;stepWindow.replaceChildren();paintStepEditor();
 if(!stepWindow.querySelector('#step-editor-title'))return;
 stepWindow.show();positionStepEditor();markEditedStep();stepWindow.querySelector('h2').focus({preventScroll:true});panelMotion.open(stepWindow);
}
function closeStepEditor(immediate=false,{restoreFocus=true}={}){
 stopCatLayoutMotion();const id=stepFocus,mode=stepPanelMode;if(!panelMotion.isClosing(stepWindow))stepClosingFocus={restore:restoreFocus};else if(!restoreFocus)stepClosingFocus.restore=false;const focusPolicy=stepClosingFocus;stepWindow.inert=true;focused=false;const result=panelMotion.close(stepWindow,{immediate});markEditedStep();
 result.then(()=>{if(stepWindow.open)return;markEditedStep();const trigger=mode==='cat'?$('[data-action="cat-settings"]'):$(`.studio-event-trigger[data-id="${id}"]`);if(!focusPolicy.restore){if(document.activeElement===trigger)trigger.blur();return;}if(stepWindow.contains(document.activeElement)||document.activeElement===document.body)trigger?.focus({preventScroll:true});});return result;
}
new ResizeObserver(positionStepEditor).observe(stepWindow);
window.addEventListener('resize',positionStepEditor);document.addEventListener('scroll',positionStepEditor,true);
stepWindow.addEventListener('close',()=>{if(!stepWindow.open)markEditedStep();});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&stepWindow.open&&!$('#dialog').open){ev.preventDefault();closeStepEditor();}});
document.addEventListener('pointerdown',ev=>{if(stepWindow.open&&!stepWindow.contains(ev.target)&&!ev.target.closest('[data-action="edit-step"],[data-action="cat-settings"]'))closeStepEditor(false,{restoreFocus:false});});

function setStepOptions(options,open){
 options.classList.toggle('is-open',open);options.querySelector('.studio-options-toggle').setAttribute('aria-expanded',String(open));
 const reveal=options.querySelector('.studio-options-reveal');reveal.inert=!open;reveal.setAttribute('aria-hidden',String(!open));
}
function stepActions(anchor){
 const q=activeQuestion(),i=q?.steps.findIndex(st=>st.id===anchor.dataset.id);if(i===undefined||i<0)return;
 dialog('Действия с событием',`<div class="studio-event-menu">${btn('step-menu-up','<span aria-hidden="true">↑</span> Поднять','',`data-id="${anchor.dataset.id}" ${i===0?'disabled':''}`)}${btn('step-menu-down','<span aria-hidden="true">↓</span> Опустить','',`data-id="${anchor.dataset.id}" ${i===q.steps.length-1?'disabled':''}`)}${q.steps[i].type==='answer'?'':btn('step-menu-delete',icon('trash')+' Удалить','studio-event-delete',`data-id="${anchor.dataset.id}"`)}</div>`,'',anchor);
 $('#dialog').classList.add('studio-event-menu-dialog');$('#dialog').dataset.question=q.id;positionSettings();
}
function stepMenuAction(button,action){
 if($('#dialog').dataset.question!==activeQuestion()?.id)return;
 closeDialog();action(button);
}

function mediaPage(){const used=new Map();for(const q of questions(pack))for(const s of q.steps)if(s.mediaId)used.set(s.mediaId,s);return `<div class="board-page"><div class="eyebrow">ВСЁ В ОДНОМ МЕСТЕ</div><h1>Медиатека</h1><p class="section-description">Файлы, которые используются в вашем паке. Добавляйте их в шагах вопросов.</p><div class="media-grid">${[...used.values()].map(s=>`<article class="media-card">${s.type==='image'?`<img src="${url(s.mediaId)}" alt="${e(s.filename)}">`:s.type==='audio'?`<audio controls src="${url(s.mediaId)}"></audio>`:`<video controls src="${url(s.mediaId)}"></video>`}<strong>${e(s.filename)}</strong><small>${kinds[s.type][0]} · ${((media.get(s.mediaId)?.size||0)/1024/1024).toFixed(1)} МБ</small></article>`).join('')||'<div class="empty media-empty"><span>▧</span><h2>Место для ваших находок</h2><p>Фото, музыка и видео появятся здесь,<br>когда вы добавите их в вопрос.</p></div>'}</div></div>`;}
function previewContent(q,index){if(!q)return '<p>Выберите вопрос</p>';const s=q.steps[index];if(!s)return '<p>Добавьте первый шаг</p>';if(s.type==='answer')return `<div class="answer-preview"><span>⌁</span><h3>${answerLabel(q,activeRound())}</h3><p>Осталось <strong id="preview-countdown" role="timer">${s.duration||10}</strong> сек${s.duration?'':'<br>В предпросмотре — 10 сек; в игре — по её настройкам'}</p></div>`;if(s.type==='text')return `<p class="screen-text">${e(s.value)||'Текст вашего вопроса'}</p>`;if(!s.mediaId)return `<div class="screen-placeholder">${kinds[s.type][1]}<small>Загрузите ${s.type==='image'?'изображение':s.type==='audio'?'аудио':'видео'}</small></div>`;if(s.type==='image')return `<img src="${url(s.mediaId)}" alt="${e(s.filename)}">`;if(s.type==='audio')return `<div class="screen-audio"><span>♫</span><audio controls src="${url(s.mediaId)}"></audio></div>`;return `<video controls src="${url(s.mediaId)}"></video>`;}
function captureEditorMotion(){
 if(screen!=="editor")return null;
 const groups=[[".studio-round-item","data-round-id"],[".studio-board-row","data-theme-id"],[".studio-question-cell","data-id"],[".studio-step","data-step"]],items=new Map();
 for(const [selector,attr] of groups)for(const node of document.querySelectorAll(selector)){const key=node.getAttribute(attr);if(!key)continue;const rect=node.getBoundingClientRect();items.set(`${selector}:${key}`,{node,rect,selector,key});}
 return {items,question:document.querySelector(".studio-question-content")?.dataset.question||null};
}
function animateEditorMotion(before){
 if(!before||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
 const groups=[[".studio-round-item","data-round-id"],[".studio-board-row","data-theme-id"],[".studio-question-cell","data-id"],[".studio-step","data-step"]],live=new Set();
 for(const [selector,attr] of groups)for(const node of document.querySelectorAll(selector)){const key=node.getAttribute(attr),id=`${selector}:${key}`,old=before.items.get(id);live.add(id);const rect=node.getBoundingClientRect();if(!old){node.animate([{opacity:0,transform:"translateY(9px) scale(.985)"},{opacity:1,transform:"translateY(0) scale(1)"}],{duration:240,easing:"cubic-bezier(.2,.75,.25,1)"});continue;}const dx=old.rect.left-rect.left,dy=old.rect.top-rect.top;if(Math.abs(dx)>1||Math.abs(dy)>1)node.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:"translate(0,0)"}],{duration:210,easing:"cubic-bezier(.2,.75,.25,1)"});}
 for(const [id,old] of before.items)if(!live.has(id)&&old.rect.width&&old.rect.height){const ghost=old.node.cloneNode(true),r=old.rect;Object.assign(ghost.style,{position:"fixed",left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`,margin:"0",zIndex:"999",pointerEvents:"none",transformOrigin:"center"});document.body.append(ghost);ghost.animate([{opacity:1,transform:"scale(1) translateY(0)"},{opacity:0,transform:"scale(.96) translateY(-5px)"}],{duration:190,easing:"ease-in"}).onfinish=()=>ghost.remove();}
 const content=document.querySelector(".studio-question-content");if(content&&before.question&&before.question!==content.dataset.question)content.animate([{opacity:.45,transform:"translateY(7px)"},{opacity:1,transform:"translateY(0)"}],{duration:230,easing:"cubic-bezier(.2,.75,.25,1)"});
}
function render(){if(stepWindow.open&&(screen!=='editor'||activeQuestion()?.id!==stepOwner))closeStepEditor(true);const motionBefore=captureEditorMotion();document.body.classList.toggle('at-home',screen==='home');document.body.classList.toggle('at-setup',screen==='setup');document.body.classList.toggle('at-editor',screen==='editor');if(screen==='setup'){$('#app').innerHTML=setupHTML(setupConfig,setupStage,hasDraft,pack.name,setupSelected);return;}if(screen==='home'){$('#app').innerHTML=welcomeHTML(pack,hasDraft,storageOK);return;}const oldLogo=$('.studio-header .brand-logo'),oldBoard=$('.studio-board-scroll'),oldQuestion=$('.studio-question-content');const r=activeRound(),t=activeTheme(),q=activeQuestion();const boardScroll=oldBoard?.dataset.round===r?.id?{top:oldBoard.scrollTop,left:oldBoard.scrollLeft}:null,questionScroll=oldQuestion?.dataset.question===q?.id?oldQuestion.scrollTop:0;roundId=r?.id;themeId=t?.id;questionId=q?.id;$('#app').innerHTML=`<div class="studio-shell"><header class="studio-header"><a class="brand" href="./" data-action="home" aria-label="SIGameMaker — на главную"><img class="brand-logo" src="./assets/logo-horizontal.png" alt="SIGameMaker"></a><span class="studio-header-divider"></span><span class="studio-pack-name" title="${e(pack.name)}">${e(pack.name)}</span><span class="studio-save" id="save-status">${!storageOK?'Не сохранено':saveRevision>savedRevision?'Сохраняем…':'Сохранено на устройстве'}</span><div class="studio-history">${btn('undo','↶','icon-button','aria-label="Отменить" '+(!history.length?'disabled':''))}${btn('redo','↷','icon-button','aria-label="Повторить" '+(!future.length?'disabled':''))}</div><nav class="studio-header-actions" aria-label="Действия с паком">${btn('pack-settings',icon('settings')+'<span>Настройки</span>','studio-header-button','aria-label="Настройки пака"')}${btn('view-media',icon('media')+'<span>Медиатека</span>','studio-header-button')}${btn('home',icon('home')+'<span>В меню</span>','studio-header-button','aria-label="Вернуться в меню"')}</nav>${btn('export','↓ Экспорт .siq','primary')}</header><div class="studio-round-bar"><nav class="studio-round-tabs" aria-label="Раунды пака">${pack.rounds.map((rr,i)=>`<div class="studio-round-item" data-round-id="${rr.id}" ${rr.id===r?.id?'data-current="true"':''}>${btn('select-round',`<span>${rr.type==='final'?'⚑':String(i+1).padStart(2,'0')}</span><span class="studio-round-name">${e(rr.name)}</span>`,'studio-round-tab',`data-id="${rr.id}" ${rr.id===r?.id?'aria-current="true"':''}`)}${btn('round-settings',icon('settings'),'studio-round-settings',`data-id="${rr.id}" aria-label="Настройки раунда ${e(rr.name)}" title="Настройки раунда ${e(rr.name)}"`)}</div>`).join('')}${btn('add-round','+','studio-add-round','aria-label="Добавить раунд" title="Добавить раунд"')}</nav></div><main class="studio-workspace">${board()}${editor()}</main></div>`;if(oldLogo)$('.studio-header .brand-logo')?.replaceWith(oldLogo);if(boardScroll)$('.studio-board-scroll').scrollTo(boardScroll.left,boardScroll.top);const content=$('.studio-question-content');if(content)content.scrollTop=questionScroll;animateEditorMotion(motionBefore);if(stepWindow.open&&!panelMotion.isClosing(stepWindow))paintStepEditor();}
function dialog(title,body,foot='',anchor=null){closeStepEditor(true);stopPreviewTimer();const d=$('#dialog');if(panelMotion.isClosing(d))closeDialog(true);if(d.open&&d.classList.contains('studio-settings-popover'))closeDialog(true);clearSettingsAnchor();d.className=anchor?'studio-settings-popover':'';d.innerHTML=`<div class="dialog-heading"><h2 id="dialog-title" tabindex="-1" autofocus>${title}</h2>${btn('close-dialog','×','icon-button','aria-label="Закрыть"')}</div>${body}${foot?`<div class="dialog-footer">${foot}</div>`:''}`;d.setAttribute('aria-labelledby','dialog-title');if(!d.open)d.showModal();d.querySelector('#dialog-title').focus({preventScroll:true});if(anchor)anchorSettings(d,anchor);}
function closeDialog(immediate=false){const d=$('#dialog');importMotion.stop(d);return panelMotion.close(d,{immediate:immediate||!d.classList.contains('studio-settings-popover')&&!d.classList.contains('import-review-dialog')});}
// Settings keep their focus/keyboard behavior while opening beside their trigger.
let settingsAnchor=null,settingsObserver=null,settingsPreferredSide=null;
function settingsButton(type,id){
 const buttons=[...document.querySelectorAll(`[data-action="${type}-settings"]`)];
 return buttons.find(b=>b.dataset.id===id)||buttons[0]||$('.studio-header-actions [data-action="pack-settings"]');
}
function clearSettingsAnchor(){
 settingsObserver?.disconnect();settingsObserver=null;settingsPreferredSide=null;
 settingsAnchor?.removeAttribute('aria-expanded');settingsAnchor=null;
 const d=$('#dialog');d.style.removeProperty('left');d.style.removeProperty('top');d.style.removeProperty('transform-origin');
}
function positionSettings(){
 const d=$('#dialog');if(!d.open||!settingsAnchor||panelMotion.isClosing(d))return;
 const rect=settingsAnchor.getBoundingClientRect(),gap=8,edge=12;
 const width=d.offsetWidth,height=d.offsetHeight;
 const left=Math.max(edge,Math.min(rect.left,innerWidth-width-edge));
 const below=innerHeight-rect.bottom-gap-edge,above=rect.top-gap-edge;
 settingsPreferredSide??=height>below&&above>below?'above':'below';
 const opensAbove=settingsPreferredSide==='above';
 const top=Math.max(edge,Math.min(opensAbove?rect.top-gap-height:rect.bottom+gap,innerHeight-height-edge));
 d.style.left=`${left}px`;d.style.top=`${top}px`;
 d.style.transformOrigin=`${Math.max(16,Math.min(rect.left+rect.width/2-left,width-16))}px ${opensAbove?'bottom':'top'}`;
 d.dataset.side=opensAbove?'above':'below';
}
function anchorSettings(d,anchor){
 settingsAnchor=anchor;anchor.setAttribute('aria-expanded','true');
 positionSettings();settingsObserver=new ResizeObserver(positionSettings);settingsObserver.observe(d);
 panelMotion.open(d);
}
window.addEventListener('resize',()=>{settingsPreferredSide=null;positionSettings();});
document.addEventListener('scroll',positionSettings,true);
function roundChoices(action,current){return `<div class="studio-round-choices">${[['standard','Обычный раунд','▦'],['final','Финальный раунд','⚑'],['interlude','Интерлюдия','♪']].map(([type,label,symbol])=>btn(action,`<span class="studio-round-choice-symbol" aria-hidden="true">${symbol}</span><span>${label}</span>${type==='interlude'?'<small>Скоро</small>':''}`,'studio-round-choice',`data-type="${type}" ${type==='interlude'?'disabled aria-disabled="true"':current?`aria-pressed="${current===type}"`:''} aria-label="${label}${type==='interlude'?' — скоро':''}"`)).join('')}</div>`;}
function roundPicker(anchor){
 dialog('Добавить раунд',roundChoices('create-round'),'',anchor||$('[data-action="add-round"]'));
 $('#dialog').classList.add('studio-round-picker');positionSettings();
}
function createEditorRound(type){
 let r;try{r=newRound(pack,type);}catch(err){toast(err.message);return;}if(!r)return;
 snapshot();const closing=closeDialog();pack.rounds.push(r);select(r,r.themes[0],r.themes[0].questions[0]);changed();
 const tab=$(`.studio-round-item[data-round-id="${r.id}"] .studio-round-tab`);tab?.scrollIntoView({block:'nearest',inline:'nearest'});closing.then(()=>{if(tab?.isConnected)tab.focus({preventScroll:true});});
}
function multiplierFields(r){const automatic=!validMultiplier(r.priceMultiplier),index=Math.max(1,pack.rounds.indexOf(r)+1);return `<fieldset class="studio-multiplier" ${r.type==='final'?'hidden disabled':''}><label class="studio-auto-multiplier"><input name="autoMultiplier" type="checkbox" ${automatic?'checked':''} data-auto-value="${index}"> По номеру раунда (×${index})</label><div class="studio-multiplier-reveal ${automatic?'':'is-open'}" aria-hidden="${automatic}" ${automatic?'inert':''}><div class="studio-multiplier-reveal-clip"><label class="studio-manual-multiplier">Множитель очков<input name="priceMultiplier" type="number" min="1" step="1" value="${roundMultiplier(pack,r)}" ${automatic?'disabled':''} required></label></div></div><p>Для новых тем и вопросов. Существующие цены не меняются.</p></fieldset>`;}

function settingsTarget(type,id,ownerRoundId){
 if(type==='pack')return pack.id===id?pack:null;
 if(type==='round')return pack.rounds.find(r=>r.id===id);
 const r=pack.rounds.find(r=>r.id===ownerRoundId);
 if(type==='theme')return r?.themes.find(t=>t.id===id);
 if(type==='question')return r?.themes.flatMap(t=>t.questions).find(q=>q.id===id);
 return null;
}
function settings(type,id,anchor){if(type==='question'&&activeRound()?.type==='final')return;const r=type==='round'&&id?pack.rounds.find(r=>r.id===id):activeRound(),t=id?r?.themes.find(t=>t.id===id):activeTheme(),q=activeQuestion();let target=type==='pack'?pack:type==='round'?r:type==='theme'?t:q;if(!target)return;const title={pack:'Настройки пака',round:'Настройки раунда',theme:'Настройки темы',question:'Стоимость вопроса'}[type];const input=(label,field,value,attrs='')=>`<label>${label}<input name="${field}" value="${e(value)}" ${attrs}></label>`;dialog(title,`<form id="settings-form" data-type="${type}" data-id="${target.id}" data-round="${r?.id||''}" class="settings-form">${type==='question'?input('Стоимость','price',q.price,'type="number" min="0" max="1000000" step="1" required'):input('Название','name',target.name,'required maxlength="150"')}${type==='pack'?`${input('Автор','author',pack.author)}<label>Описание<textarea name="description">${e(pack.description)}</textarea></label><div class="form-row"><label>Сложность<select name="difficulty">${Array.from({length:10},(_,i)=>`<option ${pack.difficulty===i+1?'selected':''}>${i+1}</option>`).join('')}</select></label><label>Язык<select name="language"><option value="ru-RU" ${pack.language==='ru-RU'?'selected':''}>Русский</option><option value="en-US" ${pack.language==='en-US'?'selected':''}>English</option></select></label></div>`:''}${type==='round'?`<div class="studio-round-type-field"><span>Тип раунда</span><input type="hidden" name="type" value="${r.type}">${roundChoices('select-round-type',r.type)}</div>${multiplierFields(r)}`:''}<div class="dialog-footer">${['round','theme'].includes(type)?btn('delete-'+type,'Удалить '+({round:'раунд',theme:'тему'}[type]),'danger',`data-id="${target.id}" data-round="${r?.id||''}"`):''}${btn('save-settings','Сохранить','primary','type="submit"')}</div></form>`,'',anchor||settingsButton(type,target.id));if(type==='round'){$('#dialog').classList.add('studio-round-picker');positionSettings();}}
function showValidation(forExport=false){const list=issues(pack,media);if(!list.length){if(forExport)return download();toast('Пак готов к игре!');return;}dialog('Немного доработаем пак',`<p class="dialog-description">Перед экспортом исправьте ${list.length} замечаний.</p><div class="issues-list">${list.map(x=>`<button data-action="go-issue" data-round="${x.round||''}" data-theme="${x.theme||''}" data-id="${x.question||''}"><span>!</span>${e(x.message)} <b>›</b></button>`).join('')}</div>`);}
async function download(){const b=$('[data-action="export"]');if(b)b.disabled=true;try{const bytes=await exportSIQ(pack,media),link=document.createElement('a'),href=URL.createObjectURL(new Blob([bytes],{type:'application/zip'}));link.href=href;link.download=`${pack.name.replace(/[\\/:*?"<>|]/g,'_')||'pack'}.siq`;link.click();setTimeout(()=>URL.revokeObjectURL(href),10000);toast('Пак .siq готов. Загрузите его в SIGame.');}catch(err){toast(err.message);}finally{if(b)b.disabled=false;}}
function showPreview(){if(!activeQuestion()?.steps.length)return toast('Сначала добавьте шаг в сценарий.');previewIndex=0;paintPreviewDialog();}
function paintPreviewDialog(){
 const q=activeQuestion();if(!q)return;
 const st=q.steps[previewIndex],marker=q.steps.findIndex(s=>s.type==='answer'),revealing=!st||marker>=0&&previewIndex>marker;
 const content=st?previewContent(q,previewIndex):`<div class="screen-text">${e(q.answer)||'Ответ ещё не указан'}</div>`;
 dialog('Предпросмотр вопроса',`<div class="full-preview"><div class="game-screen"><div class="screen-header"><span>${e(questionType(q)==='bagcat'?(catSettings(q).theme||activeTheme()?.name):activeTheme()?.name)}</span><b>${activeRound()?.type==='final'?'Финал':isAuction(q)?auctionLabel(q):questionType(q)==='bagcat'?'Кот в мешке':q.price}</b></div><div class="screen-content">${content}</div><div class="screen-brand">${revealing?'ПРАВИЛЬНЫЙ ОТВЕТ':'СВОЯ ИГРА ✦'}</div></div><div class="preview-control"><span>${st?`Шаг ${previewIndex+1} из ${q.steps.length}`:'Правильный ответ'}</span><div>${btn('play-prev','←','secondary',previewIndex===0?'disabled aria-label="Предыдущий шаг"':'aria-label="Предыдущий шаг"')}${st?.type==='answer'&&activeRound()?.type!=='final'&&questionType(q)!=='stakeAll'?btn('play-correct','Ответили верно','primary'):btn(revealing&&previewIndex>=q.steps.length-1?'close-dialog':'play-next',revealing&&previewIndex>=q.steps.length-1?'Завершить просмотр':previewIndex===q.steps.length-1?'Правильный ответ':'Следующий шаг →','primary')}</div></div><div class="preview-restart">${btn('preview','↻ Начать заново','secondary')}<p>${activeRound()?.type==='final'?'Исключение тем, скрытые ставки и ответы финалистов проходят в SIGame; здесь показан сценарий вопроса. ':''}${questionType(q)==='stakeAll'&&activeRound()?.type!=='final'?'Скрытые ставки и приём ответов всех игроков проходят в SIGame; здесь показан только сценарий вопроса. ':''}${questionType(q)==='stake'&&activeRound()?.type!=='final'?'Торги проходят в SIGame перед показом вопроса; здесь показан сценарий для победителя. ':''}${questionType(q)==='bagcat'&&activeRound()?.type!=='final'?'Передача кота и выбор стоимости проходят в SIGame; здесь показан сценарий для получателя. ':''}Шаги переключаются вручную. Таймер ответа отсчитывается автоматически.</p></div></div>`);
 $('#dialog').classList.add('studio-preview-dialog');
 if(st?.type==='answer')stopPreviewTimer=countdown(st.duration||10,left=>{const label=$('#preview-countdown');if(label)label.textContent=left;},()=>{if($('#dialog').open)actions['play-next']();});
 const player=$('#dialog audio, #dialog video');if(player)player.play().catch(()=>{});
}

function remove(type,id,ownerRoundId=activeRound()?.id){
 const fallback=type==='round'?activeRound():type==='theme'?activeTheme():activeQuestion();
 const target=settingsTarget(type,id||fallback?.id,ownerRoundId);
 if(!target)return;
 if(!confirm(`Удалить ${{round:'раунд со всеми темами',theme:'тему со всеми вопросами',question:'этот вопрос'}[type]}? Действие можно отменить.`))return;
 snapshot();
 if(type==='round')pack.rounds=pack.rounds.filter(r=>r.id!==target.id);
 const r=pack.rounds.find(r=>r.id===ownerRoundId);
 if(type==='theme')r.themes=r.themes.filter(t=>t.id!==target.id);
 if(type==='question'){const t=r.themes.find(t=>t.questions.some(q=>q.id===target.id));t.questions=t.questions.filter(q=>q.id!==target.id);}
 closeDialog();changed();
}

const actions={
 'close-dialog':()=>{pendingImport=null;closeDialog();},
 'import-repair':b=>resolveImportIssue(b,'repair'),
 'import-clear':b=>resolveImportIssue(b,'clear'),
 'import-open':b=>openReviewedPack(b),
 'toggle-answer-extra':b=>toggleAnswerExtra(b),
 'answer-entry-add':b=>answerEntryPopup(b),
 'answer-entry-edit':b=>answerEntryPopup(b,true),
 'answer-entry-delete':b=>saveAnswerEntry(b.closest('form'),true),
 'edit-step':b=>openStepEditor(b.dataset.id),
 'question-readiness':b=>questionReadinessPopup(b),
 'fix-readiness':b=>fixReadiness(b),
 'step-actions':b=>stepActions(b),
 'step-menu-up':b=>stepMenuAction(b,x=>moveStep(x,-1)),
 'step-menu-down':b=>stepMenuAction(b,x=>moveStep(x,1)),
 'step-menu-delete':b=>stepMenuAction(b,x=>actions['delete-step'](x)),
 'toggle-step-options':b=>{const options=b.closest('.studio-step-options');setStepOptions(options,!options.classList.contains('is-open'));},
 'close-step-editor':()=>closeStepEditor(),
'view-media':()=>{dialog('Медиатека',mediaPage());$('#dialog').classList.add('studio-wide-dialog');},
 'select-round':b=>{const r=pack.rounds.find(r=>r.id===b.dataset.id);select(r,r.themes[0],r.themes[0]?.questions[0]);render();},
 'select-theme':b=>{const t=activeRound().themes.find(t=>t.id===b.dataset.id);select(activeRound(),t,t.questions[0]);render();},
 'select-question':b=>{questionId=b.dataset.id;previewIndex=0;render();},
 'board-question':b=>{themeId=b.dataset.theme;questionId=b.dataset.id;previewIndex=0;render();},
 'add-round':b=>roundPicker(b),'create-round':b=>createEditorRound(b.dataset.type),
 'add-theme':()=>{const r=activeRound();if(!r)return actions['add-round']();let t;try{t=newRoundTheme(pack,r);}catch(err){toast(err.message);return;}snapshot();r.themes.push(t);select(r,t,t.questions[0]);changed();settings('theme');},
 'add-question':()=>{const r=activeRound(),t=activeTheme();if(!t)return actions['add-theme']();if(!canAddQuestion(r,t))return;let price;try{price=newQuestionPrice(pack,r,t.questions.length);}catch(err){toast(err.message);return;}snapshot();const q=question(price);t.questions.push(q);questionId=q.id;changed();},
 'board-add-question':b=>{themeId=b.dataset.id;actions['add-question']();},
 'add-step':b=>{const q=activeQuestion();if(!q||!['text','image','audio','video'].includes(b.dataset.type))return;const st=step(b.dataset.type),next=insertScenarioStep(q.steps,st,b.dataset.section);if(next===q.steps)return;snapshot();q.steps=next;previewIndex=q.steps.indexOf(st);stepFocus=st.id;changed();const detail=$(`.studio-step[data-step="${st.id}"]`);detail?.scrollIntoView({block:'nearest'});openStepEditor(st.id);},
 'delete-step':b=>{const q=activeQuestion(),next=removeScenarioStep(q.steps,b.dataset.id);if(next===q.steps)return;snapshot();closeStepEditor(true);q.steps=next;changed();},
 'step-up':b=>moveStep(b,-1),'step-down':b=>moveStep(b,1),
 'upload':b=>{uploadTarget={q:activeQuestion(),id:b.dataset.id};const s=uploadTarget.q.steps.find(s=>s.id===uploadTarget.id);$('#media-file').accept=({image:'.png,.jpg,.jpeg,.webp,.gif',audio:'.mp3,.wav,.ogg',video:'.mp4,.webm'})[s.type];$('#media-file').click();},
 'pack-settings':b=>settings('pack',null,b),'round-settings':b=>settings('round',b?.dataset.id,b),'theme-settings':b=>settings('theme',b?.dataset.id,b),'question-settings':b=>settings('question',null,b),
 'delete-round':b=>remove('round',b?.dataset.id),'delete-theme':b=>remove('theme',b?.dataset.id,b?.dataset.round||activeRound()?.id),'delete-question':()=>remove(activeRound()?.type==='final'&&activeTheme().questions.length===1?'theme':'question'),
 'use-final-rules':()=>{if(activeRound()?.type!=='final')return;snapshot();activeQuestion().type='simple';changed();},
 'select-round-type':b=>{const form=b.closest('#settings-form');if(!form||!['standard','final'].includes(b.dataset.type))return;form.elements.type.value=b.dataset.type;form.querySelectorAll('[data-action="select-round-type"]:not(:disabled)').forEach(button=>button.setAttribute('aria-pressed',String(button===b)));const multiplier=form.querySelector('.studio-multiplier');multiplier.hidden=multiplier.disabled=b.dataset.type==='final';positionSettings();},
 'cat-settings':()=>catSettingsDialog(),
 'cat-choice':b=>selectCatChoice(b),
 'question-type-picker':b=>questionTypePicker(b),
 'auction-settings':b=>auctionSettingsDialog(b),
 'select-auction-mode':b=>{const d=$('#dialog'),r=pack.rounds.find(r=>r.id===d.dataset.round),q=settingsTarget('question',d.dataset.question,d.dataset.round),type=b.dataset.type;if(!q||!isAuction(q)||r?.type==='final'||!['stake','stakeAll'].includes(type))return;const closing=closeDialog();if(questionType(q)!==type){snapshot();q.type=type;focused=false;changed();}closing.then(()=>$('[data-action="auction-settings"]')?.focus({preventScroll:true}));},
 'select-question-type':b=>{const d=$('#dialog'),r=pack.rounds.find(r=>r.id===d.dataset.round),q=settingsTarget('question',d.dataset.question,d.dataset.round),type=b.dataset.type==='stake'&&q&&isAuction(q)?questionType(q):b.dataset.type;if(!q||r?.type==='final'||!Object.hasOwn(questionTypes,type))return;const different=questionType(q)!==type;const closing=closeDialog();if(different){snapshot();q.type=type;focused=false;changed();}closing.then(()=>$('#question-type')?.focus({preventScroll:true}));},
 'new-pack':()=>createPackForm(),
 'create-pack':()=>createPackForm(),
 'setup-cancel':()=>{screen='home';render();window.scrollTo(0,0);},
 'setup-select-round':b=>{const current=$('#setup-form input[name^="roundName"]');if(current&&!current.reportValidity())return;captureSetup();setupSelected=Number(b.dataset.index);render();const tab=$('.structure-filmstrip button[aria-current]');tab?.focus({preventScroll:true});tab?.scrollIntoView({block:'nearest',inline:'nearest'});},
 'setup-back':()=>{captureSetup();setupStage=Math.max(0,setupStage-1);render();window.scrollTo(0,0);},
 'setup-edit':b=>{setupStage=Number(b.dataset.stage);render();window.scrollTo(0,0);},
 'home':async()=>{await saveQueue.catch(()=>{});screen='home';render();},
 'resume-pack':()=>enterEditor(),
 'open-demo':()=>openDemo(),
 'export':()=>showValidation(true),'import':()=>$('#import-file').click(),
 'undo':()=>{if(!history.length)return;if(stepPanelMode==='cat')closeStepEditor(true);future.push(structuredClone(pack));pack=history.pop();for(const q of questions(pack))q.steps=ensureAnswerStep(q.steps);changed();},'redo':()=>{if(!future.length)return;if(stepPanelMode==='cat')closeStepEditor(true);history.push(structuredClone(pack));pack=future.pop();for(const q of questions(pack))q.steps=ensureAnswerStep(q.steps);changed();},
 'preview':()=>showPreview(),
 'play-correct':()=>{const q=activeQuestion();previewIndex=q.steps.findLastIndex(s=>s.type==='answer');actions['play-next']();},
 'play-prev':()=>{previewIndex=Math.max(0,previewIndex-1);paintPreviewDialog();},'play-next':()=>{const q=activeQuestion();previewIndex=Math.min(q.steps.length,previewIndex+1);paintPreviewDialog();},
 'go-issue':b=>{closeDialog();if(!b.dataset.round)return settings('pack');roundId=b.dataset.round;themeId=b.dataset.theme;questionId=b.dataset.id;render();},
 'help':()=>dialog('Соберите свой хороший вечер',`<div class="help-content"><p><b>1. Постройте игровое поле</b><br>Создайте раунды и темы. В каждой теме уже есть пять слотов для вопросов.</p><p><b>2. Расскажите вопрос по шагам</b><br>Выберите обычный вопрос или аукцион. В настройках аукциона выберите открытые торги с одним отвечающим или скрытые ставки всех игроков. Добавьте текст, картинку, аудио или видео. Перетаскивайте шаги за ручку ⠿ или используйте стрелки. Шаг «Игроки отвечают» отделяет вопрос от раскрытия ответа.</p><p><b>3. Укажите правильный ответ</b><br>Добавьте допустимые формулировки и заметки ведущему.</p><p><b>4. Проверьте и скачайте .siq</b><br>Экспорт включает все медиафайлы. Откройте SIGame Online и выберите скачанный пак при создании игры.</p><p class="muted">Черновик хранится в этом браузере. Для резервной копии скачайте .siq. Импортируются обычные вопросы и аукционы SIQ 4 и 5, скрытые ставки всех игроков и коты SIQ 5; остальные специальные типы и скрипты пока не поддерживаются.</p><p><a href="https://github.com/VladimirKhil/SI/wiki/SIQ-file-format-version-5" target="_blank" rel="noreferrer">О формате SIQ ↗</a></p></div>`,btn('close-dialog','Всё понятно','primary'))
};
installStepDrag({getQuestion:()=>screen==='editor'?activeQuestion():null,onMove:({id,beforeId,questionId})=>{const q=activeQuestion();if(q?.id!==questionId)return;const next=reorderSteps(q.steps,id,beforeId);if(next===q.steps)return;snapshot();q.steps=next;changed();toast('Порядок шагов изменён');}});
function moveStep(b,delta){const a=activeQuestion().steps,i=a.findIndex(s=>s.id===b.dataset.id);if(i<0||i+delta<0||i+delta>=a.length)return;snapshot();[a[i],a[i+delta]]=[a[i+delta],a[i]];changed();}
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-action]');if(panelMotion.isClosing($('#dialog'))&&b?.closest('#dialog'))return;if(panelMotion.isClosing(stepWindow)&&b?.closest('#step-editor'))return;if(!b||b.disabled||b.type==='submit'&&b.closest('form'))return;if(b.tagName==='A')ev.preventDefault();actions[b.dataset.action]?.(b);});
document.addEventListener('submit',ev=>{if(panelMotion.isClosing($('#dialog'))&&ev.target.closest('#dialog')){ev.preventDefault();return;}if(ev.target.id==='cat-settings-form'){ev.preventDefault();return;}if(ev.target.id==='answer-entry-form'){ev.preventDefault();saveAnswerEntry(ev.target);return;}if(ev.target.id==='setup-form'){ev.preventDefault();captureSetup();if(setupStage===0&&!setupConfig.name.trim()){const input=$('#setup-form input[name="name"]');input.setCustomValidity('Введите название пака.');input.reportValidity();input.addEventListener('input',()=>input.setCustomValidity(''),{once:true});return;}if(setupStage<2){setupStage++;render();window.scrollTo(0,0);}else{try{const next=buildPack(setupConfig);startPack(next,next.name);}catch(err){toast(err.message);}}return;}if(ev.target.id!=='settings-form')return;ev.preventDefault();const form=ev.target,type=form.dataset.type,target=settingsTarget(type,form.dataset.id,form.dataset.round);if(!target){toast('Объект больше не существует. Откройте настройки заново.');return;}const values=new FormData(form);if(type==='round'&&values.get('type')==='final'&&target.type!=='final'){const error=finalRoundError(target);if(error){toast(error);return;}}const nextRoundType=values.get('type');if(type==='round'&&nextRoundType!=='final'&&!values.has('autoMultiplier')&&!validMultiplier(Number(values.get('priceMultiplier')))){toast('Укажите целый множитель от 1.');return;}snapshot();if(type==='round'){if(nextRoundType!=='final')target.priceMultiplier=values.has('autoMultiplier')?null:Number(values.get('priceMultiplier'));values.delete('priceMultiplier');values.delete('autoMultiplier');}for(const [key,value]of values)target[key]=['price','difficulty'].includes(key)?Number(value):value.trim();closeDialog();changed();});
function syncQuestionState(){const q=activeQuestion();if(!q)return;for(const st of q.steps){const card=$(`.studio-step[data-step="${st.id}"]`);if(!card)continue;card.querySelector('.studio-event-summary').textContent=stepSummary(st);if(st.type==='answer')card.querySelector('.studio-step-label').textContent=answerLabel(q,activeRound());}const bad=issues(pack,media).some(x=>x.question===q.id);const cell=$(`.studio-question-cell[data-id="${q.id}"]`);if(cell){cell.classList.toggle('complete',!bad);cell.title=(isAuction(q)?auctionLabel(q)+' · ':questionType(q)==='bagcat'?'Кот в мешке · ':'')+(q.steps.find(st=>st.type==='text')?.value||'Новый вопрос');}}

document.addEventListener('focusin',ev=>{if(ev.target.matches('[data-field],[data-step-field],#cat-settings-form input'))focused=false;});
document.addEventListener('input',ev=>{const form=ev.target.closest('#cat-settings-form');if(form)saveCatSettings(form,ev.target.name);});
document.addEventListener('input',ev=>{if(ev.target.id==='answer-entry-input')ev.target.setCustomValidity('');const el=ev.target,q=activeQuestion();if(!q||!el.matches('[data-field],[data-step-field]'))return;if(!focused){snapshot();focused=true;}if(el.dataset.field)q[el.dataset.field]=el.value;else{const s=q.steps.find(s=>s.id===el.dataset.id);s[el.dataset.stepField]=el.type==='checkbox'?el.checked:el.type==='range'?Math.max(1,Math.min(60,Math.round(Number(el.value)||1))):el.value;}if(el.dataset.stepField==='duration'){const out=$(`.studio-duration-value[data-id="${el.dataset.id}"]`);if(out)out.textContent=`${q.steps.find(st=>st.id===el.dataset.id).duration} сек`;}changed(false);syncQuestionState();});
document.addEventListener('change',ev=>{const el=ev.target;if(!el.matches('[name="autoMultiplier"]'))return;const input=el.closest('form').elements.priceMultiplier;const reveal=input.closest('.studio-multiplier-reveal');input.disabled=el.checked;reveal.classList.toggle('is-open',!el.checked);reveal.inert=el.checked;reveal.setAttribute('aria-hidden',String(el.checked));if(el.checked)input.value=el.dataset.autoValue;});
document.addEventListener('change',ev=>{const el=ev.target;if(!el.matches('[data-duration-toggle]'))return;const q=activeQuestion(),st=q?.steps.find(st=>st.id===el.dataset.id);if(!st)return;snapshot();if(el.checked)st.duration=st.customDuration||10;else{st.customDuration=st.duration;st.duration=0;}focused=false;el.closest('.studio-duration').outerHTML=durationControl(st,q.steps.indexOf(st));changed(false);syncQuestionState();});
document.addEventListener('change',ev=>{if(ev.target.matches('[data-field],[data-step-field]')){focused=false;}});
document.addEventListener('keydown',ev=>{if((ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='z'&&!ev.target.matches('input,textarea')&&!$('#dialog').open&&screen==='editor'){ev.preventDefault();actions[ev.shiftKey?'redo':'undo']();}});
$('#dialog').addEventListener('close',()=>{if($('#dialog').open)return;importMotion.stop($('#dialog'));if(!importingPack)pendingImport=null;clearSettingsAnchor();stopPreviewTimer();$('#dialog').querySelectorAll('audio,video').forEach(player=>player.pause());});
$('#dialog').addEventListener('cancel',ev=>{stopPreviewTimer();if($('#dialog').classList.contains('import-review-dialog')){ev.preventDefault();pendingImport=null;closeDialog();return;}if($('#dialog').classList.contains('studio-settings-popover')){ev.preventDefault();closeDialog();}});
// A click on the transparent backdrop dismisses compact settings, not clicks inside or text selection dragged outside.
let compactPointerOutside=false;
function outsideCompactDialog(ev){const d=$('#dialog'),r=d.getBoundingClientRect();return d.open&&d.classList.contains('studio-settings-popover')&&ev.target===d&&(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom);}
$('#dialog').addEventListener('pointerdown',ev=>{compactPointerOutside=outsideCompactDialog(ev);});
$('#dialog').addEventListener('click',ev=>{if(compactPointerOutside&&outsideCompactDialog(ev))closeDialog();compactPointerOutside=false;});
$('#media-file').addEventListener('change',async ev=>{const file=ev.target.files[0];ev.target.value='';if(!file||!uploadTarget)return;if(file.size>100*1024*1024)return toast('Выберите файл до 100 МБ');const {q,id}=uploadTarget,s=q.steps.find(s=>s.id===id);if(!s)return;const allowed={image:['png','jpg','jpeg','webp','gif'],audio:['mp3','wav','ogg'],video:['mp4','webm']};if(!allowed[s.type].includes(file.name.split('.').pop().toLowerCase()))return toast('Формат файла не подходит для этого шага');try{const mediaId=uid();await storage.putMedia(mediaId,file);snapshot();media.set(mediaId,file);s.mediaId=mediaId;s.filename=file.name;s.value='';changed();toast('Файл добавлен и сохранён на устройстве');}catch{toast('Не удалось сохранить файл. Возможно, закончилось место в браузере.');}});
let importingPack=false,pendingImport=null;
async function showImportReview(session,state,{row=null}={}){
 const d=$('#dialog'),updating=d.open&&d.classList.contains('import-review-dialog');
 const valid=()=>pendingImport===session&&d.open&&d.classList.contains('import-review-dialog')&&!panelMotion.isClosing(d);
 const renderReview=()=>{
  session.state=state;
  const scroll=$('.import-problems')?.scrollTop||0,ready=Boolean(state.result);
  const body=ready?importReadyHTML(state,session.filename):importReportHTML(state.error,session.filename,{interactive:true,revision:state.revision,notice:state.notice,outcome:state.outcome});
  const footer=btn('close-dialog','Отмена','secondary')+(ready?btn('import-open','Открыть пак','primary',`data-revision="${state.revision}"`):'');
  dialog(ready?'Пак готов к открытию':'Проблемы импорта',`<div class="import-review-body">${body}</div>`,footer);
  d.classList.add('import-review-dialog');const list=$('.import-problems');if(list)list.scrollTop=scroll;
 };
 if(updating)await importMotion.update(d,renderReview,{row:state.outcome==='success'?row:null,valid});
 else if(pendingImport===session){renderReview();panelMotion.open(d);await importMotion.enter(d);}
}
async function openReviewedPack(button){
 const session=pendingImport;
 if(!session?.state?.result||importingPack||Number(button.dataset.revision)!==session.state.revision)return;
 importingPack=true;const label=button.textContent;button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Открываем…';
 try{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(pendingImport===session)await finishImport(session,session.state);}
 catch(error){pendingImport=null;dialog('Не удалось открыть пак',importReportHTML(error,session.filename),btn('close-dialog','Понятно','primary'));}
 finally{importingPack=false;if(button.isConnected){button.disabled=false;button.removeAttribute('aria-busy');button.textContent=label;}}
}
async function finishImport(session,state){
 const result=state.result;if(pendingImport!==session)return;
 if(hasDraft&&!confirm(`Открыть «${result.pack.name}» вместо черновика «${pack.name}»? Для отдельной копии сначала скачайте текущий пак. Замену можно отменить в редакторе.`)){pendingImport=null;closeDialog();return;}
 for(const [id,blob]of result.media)await storage.putMedia(id,blob);
 await loadMedia();if(pendingImport!==session)return;
 if($('#dialog').classList.contains('import-review-dialog')){await closeDialog();if(pendingImport!==session)return;}
 snapshot();pack=result.pack;for(const q of questions(pack))q.steps=ensureAnswerStep(q.steps);
 for(const [id,blob]of result.media)media.set(id,blob);
 select(pack.rounds[0],pack.rounds[0]?.themes[0],pack.rounds[0]?.themes[0]?.questions[0]);screen='editor';pendingImport=null;closeDialog();changed();await importMotion.revealEditor($('#app'));toast(session.edited?'Ошибки импорта устранены. Пак открыт.':'Пак открыт');
}
async function resolveImportIssue(button,action){
 const session=pendingImport;if(!session||importingPack)return;
 importingPack=true;const label=button.textContent;button.disabled=true;button.setAttribute('aria-busy','true');button.textContent=action==='repair'?'Исправляем…':'Очищаем…';
 try{
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(pendingImport!==session)return;
  const state=session.review.apply(Number(button.dataset.index),action,Number(button.dataset.revision));
  if(!state||pendingImport!==session)return;
  session.edited=true;
  await showImportReview(session,state,{row:button.closest('li')});
 }catch(error){dialog('Не удалось открыть пак',importReportHTML(error,session.filename),btn('close-dialog','Понятно','primary'));pendingImport=null;}
 finally{importingPack=false;if(button.isConnected){button.disabled=false;button.removeAttribute('aria-busy');button.textContent=label;}}
}
async function openPackFile(file){
 if(!file||importingPack)return;
 if(!/\.siq$/i.test(file.name))return toast('Выберите файл пака в формате .siq');
 if(file.size>250*1024*1024)return dialog('Не удалось открыть пак',importReportHTML(new Error('Пак больше 250 МБ. Разделите его на несколько паков.'),file.name),btn('close-dialog','Понятно','primary'));
 importingPack=true;pendingImport=null;
 try{
  const session={filename:file.name,review:createImportReview(new Uint8Array(await file.arrayBuffer())),edited:false};
  pendingImport=session;const state=session.review.scan();
  if(state.result)await finishImport(session,state);else await showImportReview(session,state);
 }catch(error){pendingImport=null;dialog('Не удалось открыть пак',importReportHTML(error,file.name),btn('close-dialog','Понятно','primary'));}
 finally{importingPack=false;}
}
$('#import-file').addEventListener('change',ev=>{const file=ev.target.files[0];ev.target.value='';openPackFile(file);});
installWelcomeDrop({enabled:()=>screen==='home'&&!$('#dialog').open&&!importingPack,onFile:openPackFile,onError:toast});
window.addEventListener('beforeunload',ev=>{if(!storageOK||saveRevision>savedRevision){ev.preventDefault();ev.returnValue='';}});
async function loadMedia(){if(mediaLoaded)return;if(!storageOK&&!hasDraft){mediaLoaded=true;return;}try{media=await storage.getMedia();mediaLoaded=true;}catch{storageOK=false;toast('Не удалось загрузить медиа из браузера.');throw Error('Не удалось восстановить медиафайлы черновика.');}}
function ensurePackAnswers(){let repaired=false;for(const q of questions(pack)){const next=ensureAnswerStep(q.steps);if(next!==q.steps){if(!repaired)snapshot();repaired=true;q.steps=next;}}return repaired;}
async function enterEditor(){if(opening)return;opening=true;try{await loadMedia();const repaired=ensurePackAnswers();screen='editor';if(repaired)changed();else render();}catch(err){toast(err.message);}finally{opening=false;}}
function captureSetup(){const form=$('#setup-form');if(!form)return;const data=new FormData(form);if(setupStage===0){setupConfig.name=String(data.get('name')||'');setupConfig.author=String(data.get('author')||'');setupConfig.language=String(data.get('language')||'ru-RU');}if(setupStage===1){for(let i=0;i<setupConfig.rounds.length;i++){if(data.has(`roundName${i}`))setupConfig.rounds[i].name=String(data.get(`roundName${i}`));if(data.has(`roundThemes${i}`))setupConfig.rounds[i].themes=Number(data.get(`roundThemes${i}`));}for(const k of ['questions','basePrice','priceStep'])setupConfig[k]=Number(data.get(k));if(data.has('finalThemes'))setupConfig.finalThemes=Number(data.get('finalThemes'));setupConfig.hasFinal=data.has('hasFinal');setupConfig.multiplyPrices=data.has('multiplyPrices');}}
function createPackForm(){if($('#dialog').open)closeDialog(true);setupConfig=defaultSetup();setupStage=0;setupSelected=0;screen='setup';render();window.scrollTo(0,0);}
function presence(el,show){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let state=el._presenceMotion;
 if(state&&state.visible===show)return;
 if(state&&state.animation.playState!=='finished'){state.visible=show;if(show)restoreFlow(el);state.animation.reverse();state.animation.onfinish=()=>finishPresence(el,state);return;}
 if(state){state.animation.cancel();restoreFlow(el);delete el._presenceMotion;state=null;}
 if(reduced){if(!show)el.remove();return;}
 if(!show)takeOutOfFlow(el);
 const themeIndex=Number(el.dataset.themeIndex||0),priceIndex=Number(el.dataset.priceIndex||0),delay=show?(themeIndex*42+priceIndex*18):0;
 state={visible:show,animation:el.animate(show?[{opacity:0,transform:'translateY(12px) scale(.88)'},{opacity:1,transform:'translateY(-2px) scale(1.025)',offset:.72},{opacity:1,transform:'none'}]:[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(8px) scale(.88)'}],{duration:420,delay,easing:'cubic-bezier(.2,.75,.25,1)',fill:'both'})};el._presenceMotion=state;state.animation.onfinish=()=>finishPresence(el,state);
}
function finishPresence(el,state){if(el._presenceMotion!==state)return;if(!state.visible){el.remove();delete el._presenceMotion;return;}state.animation.cancel();restoreFlow(el);delete el._presenceMotion;}
function takeOutOfFlow(el){const parent=el.parentElement;if(!parent)return;const box=el.getBoundingClientRect(),base=parent.getBoundingClientRect();if(getComputedStyle(parent).position==='static')parent.style.position='relative';el.style.position='absolute';el.style.left=`${box.left-base.left+parent.scrollLeft}px`;el.style.top=`${box.top-base.top+parent.scrollTop}px`;el.style.width=`${box.width}px`;el.style.height=`${box.height}px`;el.style.margin='0';el.style.zIndex='2';}
function restoreFlow(el){for(const key of ['position','left','top','width','height','margin','zIndex'])el.style.removeProperty(key);}
function reconcilePresence(parent,wanted,keyOf,update,animateNew=true){const existing=new Map([...parent.children].filter(x=>x.dataset.presenceKey).map(x=>[keyOf(x),x])),keys=new Set(wanted.map(keyOf));for(const child of [...existing.values()])if(!keys.has(keyOf(child)))presence(child,false);let cursor=parent.firstElementChild;for(const source of wanted){const key=keyOf(source);let node=existing.get(key);if(!node){node=source.cloneNode(true);node.dataset.presenceKey=key;}else{update(node,source);if(node._presenceMotion&&!node._presenceMotion.visible)presence(node,true);}while(cursor&&(!cursor.dataset.presenceKey||!keys.has(keyOf(cursor))))cursor=cursor.nextElementSibling;if(node!==cursor)parent.insertBefore(node,cursor);if(animateNew&&!existing.has(key))presence(node,true);cursor=node.nextElementSibling;}}
function syncTab(node,source){node.toggleAttribute('aria-current',source.hasAttribute('aria-current'));node.dataset.index=source.dataset.index;node.children[0].textContent=source.children[0].textContent;node.children[1].textContent=source.children[1].textContent;}
function syncPrice(node,source){node.textContent=source.textContent;node.className=source.className;node.dataset.priceIndex=source.dataset.priceIndex;node.dataset.presenceKey=source.dataset.presenceKey;node.style.setProperty('--price-index',source.style.getPropertyValue('--price-index'));}
function syncThemeRow(node,source){node.dataset.themeIndex=source.dataset.themeIndex;node.style.setProperty('--theme-index',source.style.getPropertyValue('--theme-index'));node.firstElementChild.textContent=source.firstElementChild.textContent;const row=node.lastElementChild,sourceRow=source.lastElementChild,wanted=[...sourceRow.children],keep=new Set(wanted.map(x=>x.dataset.presenceKey)),before=new Map([...row.children].filter(cell=>keep.has(cell.dataset.presenceKey)&&!cell._presenceMotion).map(cell=>[cell.dataset.presenceKey,cell.getBoundingClientRect()]));reconcilePresence(row,wanted,x=>x.dataset.presenceKey,syncPrice);row.style.setProperty('--question-count',sourceRow.style.getPropertyValue('--question-count'));for(const cell of [...row.children]){if(!keep.has(cell.dataset.presenceKey)||cell._presenceMotion)continue;const old=before.get(cell.dataset.presenceKey);if(!old)continue;const now=cell.getBoundingClientRect(),dx=old.left-now.left,dy=old.top-now.top,sx=now.width?old.width/now.width:1,sy=now.height?old.height/now.height:1;if(Math.abs(dx)+Math.abs(dy)+Math.abs(sx-1)+Math.abs(sy-1)<.015)continue;cell._layoutMotion?.cancel();cell._layoutMotion=cell.animate([{transformOrigin:'left center',transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`},{transformOrigin:'left center',transform:'none'}],{duration:360,easing:'cubic-bezier(.2,.75,.25,1)'});cell._layoutMotion.onfinish=()=>{cell._layoutMotion?.cancel();delete cell._layoutMotion;};}}
function updateSetupPreviewKeyed(){const preview=$('#setup-structure-preview');if(!preview)return;const strip=preview.querySelector('.structure-filmstrip'),scroll=preview.querySelector('.structure-screen-scroll'),stripLeft=strip.scrollLeft,boardTop=scroll.scrollTop,boardLeft=scroll.scrollLeft,template=document.createElement('div');template.innerHTML=setupPreviewHTML(setupConfig,setupSelected);const fresh=template,newTop=fresh.querySelector('.structure-stage-top'),oldTop=preview.querySelector('.structure-stage-top');oldTop.children[1].textContent=newTop.children[1].textContent;const wantedTabs=[...fresh.querySelector('.structure-filmstrip').children];reconcilePresence(strip,wantedTabs,x=>x.dataset.presenceKey,syncTab);const screen=preview.querySelector('.structure-game-screen'),newScreen=fresh.querySelector('.structure-game-screen');screen.classList.toggle('is-final',newScreen.classList.contains('is-final'));screen.setAttribute('aria-label',newScreen.getAttribute('aria-label'));const heading=screen.querySelector('.structure-screen-heading'),newHeading=newScreen.querySelector('.structure-screen-heading');heading.children[0].children[0].textContent=newHeading.children[0].children[0].textContent;heading.querySelector('h2').textContent=newHeading.querySelector('h2').textContent;heading.children[1].textContent=newHeading.children[1].textContent;const board=screen.querySelector('.structure-board'),wantedRows=[...fresh.querySelectorAll('.structure-theme-row')];reconcilePresence(board,wantedRows,x=>x.dataset.presenceKey,syncThemeRow);preview.querySelector('.structure-stage-hint').textContent=fresh.querySelector('.structure-stage-hint').textContent;strip.scrollLeft=stripLeft;scroll.scrollTo(boardLeft,boardTop);}
function updateSetupPreview(){const preview=$('#setup-structure-preview');if(!preview)return;const strip=preview.querySelector('.structure-filmstrip'),scroll=preview.querySelector('.structure-screen-scroll'),stripLeft=strip.scrollLeft,boardTop=scroll.scrollTop,boardLeft=scroll.scrollLeft;try{updateSetupPreviewKeyed();}catch(error){console.error('Не удалось синхронизировать предпросмотр структуры',error);preview.innerHTML=setupPreviewHTML(setupConfig,setupSelected,true);initializeStructureMotion();preview.querySelector('.structure-filmstrip').scrollLeft=stripLeft;preview.querySelector('.structure-screen-scroll').scrollTo(boardLeft,boardTop);}}
function initializeStructureMotion(){const preview=$('#setup-structure-preview');if(!preview)return;for(const el of preview.querySelectorAll('.is-entering')){el.classList.remove('is-entering');presence(el,true);}}
const structureMotionObserver=new MutationObserver(initializeStructureMotion);structureMotionObserver.observe($('#app'),{childList:true,subtree:true});
document.addEventListener('input',ev=>{if(screen!=='setup'||setupStage!==1||!ev.target.closest('#setup-form'))return;captureSetup();if(ev.target.name==='roundCount'){const n=Number(ev.target.value);if(!Number.isInteger(n)||n<1||n>10)return;while(setupConfig.rounds.length<n)setupConfig.rounds.push({name:`Раунд ${setupConfig.rounds.length+1}`,themes:6});setupConfig.rounds.length=n;setupSelected=Math.min(setupSelected,n-1);$('.setup-rounds').innerHTML=setupRoundsHTML(setupConfig,setupSelected);}if(ev.target.name!=='hasFinal')updateSetupPreview();});
document.addEventListener('change',ev=>{if(screen!=='setup'||setupStage!==1)return;if(ev.target.name==='hasFinal'){captureSetup();if(!setupConfig.hasFinal)setupSelected=Math.min(setupSelected,setupConfig.rounds.length-1);$('.setup-rounds').innerHTML=setupRoundsHTML(setupConfig,setupSelected);updateSetupPreview();}else if(ev.target.name==='multiplyPrices'){captureSetup();updateSetupPreview();}});

async function startPack(next,name){if(opening)return;opening=true;try{await loadMedia();if(hasDraft)snapshot();next.name=name;pack=next;for(const q of questions(pack))q.steps=ensureAnswerStep(q.steps);select(pack.rounds[0],pack.rounds[0]?.themes[0],pack.rounds[0]?.themes[0]?.questions[0]);closeDialog();screen='editor';changed();}catch(err){toast(err.message);}finally{opening=false;}}
async function openDemo(){if(hasDraft&&!confirm(`Открыть пример вместо черновика «${pack.name}»? Для отдельной копии сначала скачайте текущий пак. Замену можно отменить в редакторе.`))return;await startPack(initial(true),'Хороший вечер');}
try{await storage.openDB();const draft=await storage.getDraft();hasDraft=!!draft;pack=draft||initial(false);}catch{pack=initial(false);storageOK=false;toast('Браузер не разрешил автосохранение. Скачивайте .siq для сохранения работы.');}select(pack.rounds[0],pack.rounds[0]?.themes[0],pack.rounds[0]?.themes[0]?.questions[0]);render();


## Восстановление welcome.css после ошибочной записи — 23.10.2026

- По скриншоту и исходному файлу подтверждена причина: welcome.css был ошибочно заменён содержимым app.js при последнем добавлении busy-стилей. Базовые style.css/editor.css оставались CSS, поэтому часть оформления отображалась, а меню и конструктор потеряли компоновку. В cloudflare-upload/welcome.css обнаружена та же подмена после пользовательской сборки.
- Восстановлен исходный welcome.css из текущего HEAD с сохранением drag-and-drop и заново добавлены актуальные стили отчёта, кнопок, итогов, анимаций и busy-индикатора. app.js не откатывался, механика импорта сохранена.
- Добавлен validate-styles.mjs: проверка явных JavaScript-конструкций вместо CSS и наличия CSS-правил. Сборщик применяет её ко всем CSS до замены выходной папки. Это защита от подмены типа файла, а не полноценная проверка синтаксиса CSS. Регрессионные тесты проверяют все три подключённых стиля, необходимые правила welcome/setup/import и отказ при перезаписи/дописывании JS.
- Проверки без браузера: 87/87 Node-тестов, синтаксис сборщика и валидатора, git diff --check. Браузер и визуальная приёмка не проводились. Сборка не запускалась, повреждённую генерируемую папку пользователь обновляет через «Собрать сайт.command».


## Медиатека с категориями и галереей — 24.10.2026

- Добавлены боковые категории «Фото», «Видео», «Аудио» со счётчиками уникальных используемых файлов. Для фото/видео доступны сетка и крупная галерея с горизонтальной лентой; для аудио — вертикальный список со штатными controls (пауза и перемотка).
- Режим и выбранный файл запоминаются отдельно для фото и видео в пределах открытого окна. Выбор в ленте поддерживает стрелки, Home и End. Длинные имена обрезаются визуально, полное имя доступно в подсказке. Окно ограничено размером экрана; категории, сетка, аудиосписок и лента имеют внутреннюю прокрутку, компоновка остаётся горизонтальной.
- Обработчик play в фазе capture останавливает и перематывает остальные дорожки/видео. При смене содержимого и закрытии медиатеки проигрыватели останавливаются, обработчики удаляются. Пак, привязки файлов, история и хранилище не изменяются.
- Без браузера: пройдены все 90 Node-тестов, включая новые проверки уникальности файлов, остановки и перемотки предыдущей дорожки, очистки обработчика и незагруженного медиа. Синтаксис app.js и media-library.js проверен. Сборка не запускалась.
- По прямой просьбе пользователя браузер не открывался. Визуальная проверка 1280×720 и 1440×900, реальные медиа, перемотка и воспроизведение остаются для ручной проверки пользователем.


## Переходы, группировка и загрузка медиатеки по видимости — 24.10.2026

- Добавлены анимации смены категории/группировки, переход сетки в галерею с увеличением выбранного изображения и перемещением видимых соседних карточек к позициям в нижней ленте, обратный переход. Используются координаты элементов и временные копии декодированных пикселей; копии не держат видеодекодеры. Очистка отменяет анимации, удаляет слой и восстанавливает видимость. Системное уменьшение движения учитывается.
- Группировка доступна для всех категорий: без групп, по раундам, по темам с названием раунда. При повторном использовании файла сохраняются все места использования; внутри группы копий нет. Порядок групп соответствует порядку раундов и тем; счётчик категории остаётся количеством уникальных файлов.
- IntersectionObserver с нулевым запасом подключает источник только при пересечении видимой области с учётом вложенной прокрутки. Выход из области отключает источник, останавливает медиа, сбрасывает загрузку проигрывателя и отзывает временный object URL после исчезновения последнего видимого использования файла. Обработчики загрузки и наблюдатель очищаются при закрытии; запоздавшие события не восстанавливают источники. При смене крупного файла наблюдение обновляется без повторной загрузки видимой ленты.
- Видимые видеоминиатюры получают preload=auto и небольшой seek после метаданных для декодирования кадра без play; после получения кадра preload возвращается к metadata. Аналогично готовится крупное видео. Ошибка декодирования показывает «Нет превью». Выбор обоснован тем, что preload — подсказка браузеру, а не гарантия готового кадра: [WebKit preload](https://developer.apple.com/documentation/webkitjs/htmlmediaelement/1633059-preload), [WebKit HTMLMediaElement](https://developer.apple.com/documentation/webkitjs/htmlmediaelement).
- Оптимизация освобождает ресурсы просмотра и декодирования медиатеки. Общая модель хранения исходных Blob в приложении не менялась; уменьшение памяти конкретного браузера не измерялось. Разметка лёгких карточек остаётся в DOM, сами невидимые медиа не загружаются.
- Автоматически: все 100 Node-тестов прошли. Новые проверки покрывают группы и повторное использование, отсутствие источников у скрытых объектов, загрузку/выгрузку/повторный вход, разделение object URL, декодирование без play, очистку и запоздалые события, сохранение ленты при смене крупного файла, траектории анимаций, обратный переход, отмену и уменьшение движения.
- По действующему указанию пользователя браузер не открывался. Реальные кадры видео, визуальная плавность, поведение прокрутки и размеры 1280×720/1440×900 требуют ручной приёмки. Сборка не запускалась.


## Уточнение качества перехода сетка ↔ галерея — 24.10.2026

- Причина растягивания найдена в прежней реализации: снимок 320×200 содержал поля вокруг изображения, а scaleX/scaleY независимо подгоняли его к прямоугольнику другого соотношения сторон. Увеличивались также элементы карточки.
- Вместо копии карточки перемещается отдельный слой только с пикселями изображения/видеокадра. Начальные и конечные координаты вычисляются по фактической области object-fit:contain; используется единый scale. Подписи и поверхности появляются отдельно без растягивания. Скругление учитывается лишь там, где картинка действительно заполняет углы контейнера.
- Размер снимка вычисляется из исходного разрешения, размеров окна и devicePixelRatio, без искусственного увеличения исходника; установлен предел 8 Мп для основного слоя и 1 Мп для соседних. Растр подготавливается до движения; основной переход занимает 540 мс с плавным замедлением, соседние кадры — 460 мс. Размывающих фильтров и пружинного перелёта нет.
- После движения слой остаётся на месте до готовности изображения назначения (load + decode) или видеокадра, затем растворяется за 120 мс. Ожидание ограничено 1800 мс на случай ошибки/отсутствия источника. Невидимые назначения не загружаются ради перехода. Оригинал с низким разрешением всё равно ограничивает доступную детализацию.
- Быстрый обратный переход считывает текущие отрисованные координаты движущихся слоёв до отмены анимации и продолжает движение оттуда с тем же качественным растром. Отмена и закрытие убирают слои, ожидания и временную невидимость; запоздалые завершения не затрагивают новую анимацию.
- Проверено без браузера: 105/105 Node-тестов, синтаксис library-motion.js и git diff --check. Обновлённые тесты покрывают landscape/portrait/square/panorama, единый масштаб, Retina-разрешение, предел памяти, отсутствие искусственного апскейла, ожидание decode и растворение, обратное переключение из текущей позиции, отмену и уменьшение движения.
- Браузер по просьбе пользователя не открывался. Плавность на реальном экране, реальные видеокодеки и субъективное качество анимации не измерялись. Сборка не запускалась.


## Направленное перелистывание файлов галереи — 24.10.2026

- Вместо простого появления добавлена горизонтальная смена кадра: следующий файл справа входит справа, предыдущий уходит влево; при выборе слева направления обратные. Учитывается порядок всех записей ленты, в том числе пропуск нескольких файлов и переход через границу группы. Работает при клике и клавиатурном выборе.
- Перемещаются две отдельные страницы с качественными снимками декодированных фото/видеокадров в их конечном размере, без изменения масштаба. Область просмотра обрезает выходящие страницы; подпись появляется с небольшим направленным сдвигом. Основное перелистывание — 380 мс, передача оригиналу — 80 мс.
- Предыдущий кадр сохраняется до готовности нового. Настоящий новый проигрыватель остаётся в своей видимой позиции, поэтому IntersectionObserver не выгружает его из-за перемещения за границы экрана. Нижняя лента не перезагружается, старое видео останавливается при замене.
- Быстрый выбор другого файла составляет текущие видимые части обоих кадров в один временный снимок с учётом плотности экрана (предел 8 Мп) и начинает следующий переход от него. Закрытие, смена категории и другие отмены убирают слой, ожидания и временное скрытие медиа. Уменьшение движения меняет файл сразу.
- Автоматические проверки покрывают обе траектории, выбор через группы, сохранение пропорций, готовность нового кадра, отмену ожидания, быстрые повторные переходы и уменьшение движения. Полный набор — 111 тестов. Синтаксис изменённых модулей и git diff --check проверены.
- Браузер по действующему указанию пользователя не открывался; фактическая визуальная плавность и реальные видео требуют ручной проверки. Сборка не запускалась.
