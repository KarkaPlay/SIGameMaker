import {createPanelMotion} from './panel-motion.js';
import {uid} from './model.js';
import {importSIQ,exportSIQ} from './siq.js';
import {emptyMergePack,addMergeItem,mergeIssues,mergeMedia} from './merge-model.js';
import {getMergeDraft,saveMergeDraft} from './storage.js';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const b=(action,label,attrs='')=>`<button type="button" data-merge="${action}" ${attrs}>${label}</button>`;
const count=(n,forms)=>`${n} ${forms[n%100>=11&&n%100<=14?2:n%10===1?0:n%10>=2&&n%10<=4?1:2]}`;
const stats=p=>[count(p.rounds.length,['раунд','раунда','раундов']),count(p.rounds.reduce((n,r)=>n+r.themes.length,0),['тема','темы','тем']),count(p.rounds.reduce((n,r)=>n+r.themes.reduce((m,t)=>m+t.questions.length,0),0),['вопрос','вопроса','вопросов'])].join(' · ');
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({chevron:'<path d="m8 10 4 4 4-4"/>',plus:'<path d="M12 5v14M5 12h14"/>',up:'<path d="m7 12 5-5 5 5M12 7v11"/>',down:'<path d="m7 12 5 5 5-5M12 6v11"/>',remove:'<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',undo:'<path d="m8 5-4 4 4 4M4 9h9a6 6 0 0 1 0 12"/>',redo:'<path d="m16 5 4 4-4 4M20 9h-9a6 6 0 0 0 0 12"/>',upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/>',download:'<path d="M12 4v12m-5-5 5 5 5-5M4 17v4h16v-4"/>'})[name]||''}</svg>`;
const actionIcon=(action,symbol,label,attrs='')=>b(action,icon(symbol),`class="merge-icon-button ${symbol==='remove'?'merge-remove':''}" aria-label="${e(label)}" title="${e(label)}" ${attrs}`);
export function mergeMetadataHTML(key,title,body,expanded=false){return `<div class="merge-metadata ${expanded?'is-open':''}" data-metadata="${key}">${b('metadata',`<span data-pack-title>${e(title||'Без названия')}</span>${icon('chevron')}`,`class="merge-metadata-toggle" data-key="${key}" aria-expanded="${expanded}" aria-controls="merge-meta-${key}" title="Сведения о паке: ${e(title||'Без названия')}"`)}<div class="merge-metadata-reveal" id="merge-meta-${key}" ${expanded?'':'inert'}><div class="merge-metadata-clip"><div class="merge-metadata-fields">${body}</div></div></div></div>`;}
export function setMergeMetadataExpanded(panel,expanded){
 const button=panel.querySelector('[data-merge="metadata"]'),content=panel.querySelector('.merge-metadata-reveal');
 if(!expanded&&content.contains(document.activeElement))button.focus({preventScroll:true});
 button.setAttribute('aria-expanded',String(expanded));content.inert=!expanded;panel.classList.toggle('is-open',expanded);
}
// Native details keep their keyboard behavior; height follows the current visible frame on reversal.
export function createMergeDisclosureMotion({reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches}={}){
 const active=new Map();
 function settle(details){active.get(details)?.finish();}
 function toggle(details){
  const previous=active.get(details),expanded=previous?!previous.expanded:!details.open;
  const height=details.getBoundingClientRect().height;
  settle(details);
  for(const other of [...active.keys()])if(details.contains?.(other)||other.contains?.(details))settle(other);
  if(reduceMotion()){details.open=expanded;return;}
  const saved={height:details.style.height,overflow:details.style.overflow};
  details.open=true;
  const target=expanded?details.getBoundingClientRect().height:details.querySelector('summary').getBoundingClientRect().height;
  const state={expanded,finish(){
   if(active.get(details)!==state)return;
   active.delete(details);details.open=expanded;state.motion.cancel();Object.assign(details.style,saved);
  }};
  active.set(details,state);details.style.overflow='hidden';
  state.motion=details.animate([{height:`${height}px`},{height:`${target}px`}],{duration:280,easing:'cubic-bezier(.08,1,.16,1)',fill:'both'});
  state.motion.onfinish=state.finish;
 }
 function stop(){for(const details of [...active.keys()])settle(details);}
 return {toggle,stop};
}
export function createMerger({root,onHome,toast}){
 let state={sources:[null,null],pack:emptyMergePack(),media:new Map(),stage:0},active,history=[],future=[],busy=false,loaded=false,saveQueue=Promise.resolve(),pending=0,unsaved=false,drag=null,saveTimer,dirty=false,editOwner=null,renderedSources=[],renderedStage=-1,renderedBusy=false,renderedTarget=null,transferOrigin=null,loadingSide=null;
 const panelMotion=createPanelMotion(),motions=new Set(),expandedMetadata=new Set(),disclosureMotion=createMergeDisclosureMotion();
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 function move(node,frames,duration=480){if(!node||reduced())return;const a=node.animate(frames,{duration,easing:'cubic-bezier(.08,1,.16,1)'});motions.add(a);a.onfinish=a.oncancel=()=>motions.delete(a);return a;}
 function stopMotion(){for(const a of motions)a.cancel();motions.clear();}
 function showNotice(box,owner){
  box.setAttribute('aria-label',box.querySelector('h2').textContent);
  const ownerData=owner?{action:owner.dataset.merge,side:owner.dataset.side}:null;
  const close=()=>panelMotion.close(box);
  box.querySelector('button').onclick=close;
  box.addEventListener('cancel',ev=>{ev.preventDefault();close();});
  box.addEventListener('close',()=>{box.remove();const target=owner?.isConnected?owner:[...root.querySelectorAll('[data-merge]')].find(el=>el.dataset.merge===ownerData?.action&&el.dataset.side===ownerData?.side);target?.focus({preventScroll:true});},{once:true});
  document.body.append(box);box.showModal();panelMotion.open(box);
 }
 const saveStatus=()=>{const el=root.querySelector('#merge-save-status');if(el)el.textContent=loadingSide!==null?'Читаем '+(loadingSide===0?'первый':'второй')+' пак…':!state.stage&&!pending&&!dirty&&!unsaved?'Исходные паки остаются без изменений':unsaved?'Не сохранено · скачайте .siq':pending||dirty?'Сохраняем сборку…':'Сборка сохранена на устройстве';};
 const persistState=()=>{const value=structuredClone(state);pending++;saveStatus();saveQueue=saveQueue.catch(()=>{}).then(()=>saveMergeDraft(value)).then(()=>{unsaved=false;},()=>{unsaved=true;toast('Сборка не сохранена. Скачайте .siq перед закрытием.');}).finally(()=>{pending--;saveStatus();});};
 const save=()=>{dirty=true;clearTimeout(saveTimer);saveStatus();saveTimer=setTimeout(()=>{dirty=false;persistState();},300);};
 const flushSave=()=>{clearTimeout(saveTimer);if(dirty){dirty=false;persistState();}return saveQueue;};
 const record=()=>{history.push({pack:structuredClone(state.pack),active});if(history.length>30)history.shift();future=[];};
 const finish=()=>{save();render();};
 const round=()=>state.pack.rounds.find(r=>r.id===active)||state.pack.rounds[0];
 function sourceHTML(source,side){
  const key=`source-${side}`,attrs=(ri,ti)=>`data-side="${side}" data-ri="${ri}" ${ti===undefined?'':`data-ti="${ti}"`}`;
  const transfer=(ri,ti)=>state.stage?`class="merge-transfer" draggable="true" ${attrs(ri,ti)} title="Перетащите в общий пак"`:'';
  const add=(ri,ti,name)=>{
   if(!state.stage)return '';
   const type=source.pack.rounds[ri].type,target=round();
   const reason=ti===undefined?(type==='final'&&state.pack.rounds.some(r=>r.type==='final')?'Финал уже добавлен. Можно добавить его темы.':''):!target?'Сначала создайте или добавьте раунд':type!==target.type?(type==='final'?'Выберите финальный раунд':type==='interlude'?'Выберите интерлюдию':'Выберите обычный раунд'):'';
   return actionIcon('copy','plus',reason||`Добавить ${ti===undefined?'раунд':'тему'} «${name}»`,`${attrs(ri,ti)} ${busy||reason?'disabled':''}`);
  };
  const header=source?mergeMetadataHTML(key,source.pack.name,`<p>${stats(source.pack)}</p>${source.pack.author?`<p class="merge-source-author">${e(source.pack.author)}</p>`:''}${b('load','Заменить пак',`data-side="${side}" class="secondary" ${busy?'disabled':''}`)}`,expandedMetadata.has(key)):`<h2>${side===0?'Первый пак':'Второй пак'}</h2>`;
  return `<section class="merge-pane merge-source" data-side="${side}" aria-label="${side===0?'Первый':'Второй'} исходный пак"><header>${header}</header><div class="merge-scroll">${source?source.pack.rounds.map((r,ri)=>`
   <article class="merge-source-round ${state.stage?'has-transfer':''}"><details data-key="source-${side}-${r.id}" open>
    <summary ${transfer(ri)}><span class="merge-source-name">${e(r.name)}</span>${r.type==='final'?'<span class="merge-final-label">Финал</span>':''}</summary>
    <div class="merge-source-themes">${r.themes.map((t,ti)=>`
     <article class="merge-source-theme ${state.stage?'has-transfer':''}"><details data-key="source-${side}-${t.id}">
      <summary ${transfer(ri,ti)}><span class="merge-source-name">${e(t.name)}</span><small>${count(t.questions.length,['вопрос','вопроса','вопросов'])}</small></summary>
      <ol>${t.questions.map(q=>`<li><strong>${r.type==='final'?'Финал':q.price}</strong> ${e(q.steps.find(s=>s.type==='text')?.value||'Медиавопрос')}<small>Ответ: ${e(q.answer)}</small></li>`).join('')}</ol>
     </details>${add(ri,ti,t.name)}</article>`).join('')}</div>
   </details>${add(ri,undefined,r.name)}</article>`).join(''):`<div class="merge-upload-hint"><span aria-hidden="true">${icon('upload')}</span><p>Перетащите сюда .siq</p>${b('load','Выбрать файл',`data-side="${side}" class="secondary" ${busy?'disabled':''}`)}<small>Пак останется без изменений</small></div>`}</div></section>`;
 }
 function centerHTML(){
  const r=round();
  const metadata=`<label>Название<input data-merge-name="pack" value="${e(state.pack.name)}" maxlength="200" placeholder="Название пака"></label><label>Авторы<input data-merge-name="author" value="${e(state.pack.author)}" placeholder="Авторы исходных паков"></label><p>${stats(state.pack)}</p>`;
  return `<section class="merge-pane merge-result" aria-label="Общий пак">
   <header>${mergeMetadataHTML('result',state.pack.name,metadata,expandedMetadata.has('result'))}</header>
   <div class="merge-result-tools"><div>${b('new-round',icon('plus')+'Раунд')}${!state.pack.rounds.some(x=>x.type==='final')?b('new-final','+ Финал'):''}</div><div class="merge-history" role="group" aria-label="История изменений">${actionIcon('undo','undo','Отменить',history.length?'':'disabled')}${actionIcon('redo','redo','Повторить',future.length?'':'disabled')}</div></div>
   <nav class="merge-round-tabs" aria-label="Раунды общего пака">${state.pack.rounds.map(rr=>b('select',e(rr.name),`data-id="${rr.id}" title="${e(rr.name)}" ${rr.type==='final'?'class="is-final"':''} ${rr.id===r?.id?'aria-current="true"':''}`)).join('')}</nav>
   <div class="merge-scroll merge-drop" data-drop="true" data-round="${r?.id||''}">${r?`
    <div class="merge-target-heading"><label><span class="merge-field-label">${r.type==='final'?'Финальный раунд':'Название раунда'}</span><input data-merge-name="round" value="${e(r.name)}" maxlength="200" placeholder="Название раунда"></label><div class="merge-item-actions">${actionIcon('round-up','up','Раунд раньше',state.pack.rounds.indexOf(r)<=0||r.type==='final'?'disabled':'')}${actionIcon('round-down','down','Раунд позже',state.pack.rounds.indexOf(r)>=state.pack.rounds.length-1||state.pack.rounds[state.pack.rounds.indexOf(r)+1]?.type==='final'?'disabled':'')}${actionIcon('remove-round','remove','Удалить раунд')}</div></div>
    ${r.themes.map((t,i)=>`<article class="merge-result-theme" data-theme-id="${t.id}"><div class="merge-theme-title"><span class="merge-theme-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><input aria-label="Название темы ${i+1}" data-merge-theme="${t.id}" value="${e(t.name)}" maxlength="200" placeholder="Название темы"></div><div class="merge-theme-bottom"><p>${count(t.questions.length,['вопрос','вопроса','вопросов'])}</p><div class="merge-item-actions">${actionIcon('theme-up','up','Тему выше',`data-id="${t.id}" ${i===0?'disabled':''}`)}${actionIcon('theme-down','down','Тему ниже',`data-id="${t.id}" ${i===r.themes.length-1?'disabled':''}`)}${actionIcon('remove-theme','remove','Убрать тему',`data-id="${t.id}"`)}</div></div>${r.type!=='final'&&t.questions.length?`<div class="merge-prices" aria-label="Цены вопросов">${t.questions.map(q=>`<span>${q.price}</span>`).join('')}</div>`:''}</article>`).join('')}
    <p class="merge-drop-hint">${r.themes.length?'Добавьте ещё темы из исходных паков':'Добавьте темы из исходных паков'}<br><span>Кнопкой + или перетаскиванием</span></p>`:'<p class="merge-drop-hint">Добавьте раунд из исходного пака<br>или создайте пустой.</p>'}</div>
   <footer>${b('export',icon('download')+'Скачать .siq',`class="primary" ${busy?'disabled':''}`)}</footer>
  </section>`;
 }
 function render(){
  disclosureMotion.stop();
  const oldCenter=root.querySelector('.merge-start'),centerRect=oldCenter?.getBoundingClientRect();
  const oldStage=root.querySelector('.merge-result')?1:0,oldRound=root.querySelector('[data-drop]')?.dataset.round;
  const themeRects=new Map([...root.querySelectorAll('[data-theme-id]')].map(el=>[el.dataset.themeId,el.getBoundingClientRect()]));
  const focused=document.activeElement,focusData=focused&&root.contains(focused)?{action:focused.dataset.merge,id:focused.dataset.id,key:focused.dataset.key,side:focused.dataset.side,ri:focused.dataset.ri,ti:focused.dataset.ti,name:focused.dataset.mergeName,theme:focused.dataset.mergeTheme,start:focused.selectionStart,end:focused.selectionEnd}:null;
  const scope=el=>el.closest('.merge-source')?.dataset.side??'result';
  const scrollKey=el=>`${scope(el)}:${el.classList.contains('merge-round-tabs')?'tabs':el.dataset.round??'source'}`;
  const scrolls=new Map([...root.querySelectorAll('.merge-scroll,.merge-round-tabs')].map(el=>[scrollKey(el),[el.scrollTop,el.scrollLeft]]));
  const details=new Map([...root.querySelectorAll('details[data-key]')].map(el=>[el.dataset.key,el.open]));
  const sources=[...root.querySelectorAll('.merge-source')];
  stopMotion();
  root.innerHTML=`<div class="merge-shell" aria-busy="${busy}"><header class="merge-header"><a class="brand" href="./" data-merge="home"><img class="brand-logo" src="./assets/logo-horizontal.png" alt="SIGameMaker"></a><div><h1>Объединение паков</h1><p>${state.stage?'Добавляйте раунды целиком или выбирайте отдельные темы':'Соберите новую игру из любимых раундов и тем'}</p></div></header><main class="merge-workspace ${state.stage?'':'merge-loading'}">${sourceHTML(state.sources[0],0)}<div class="merge-center">${state.stage?centerHTML():`<section class="merge-start"><span class="merge-start-symbol" aria-hidden="true">＋</span><h2>Два пака.<br>Одна новая игра.</h2><p>Выберите нужные раунды и темы на следующем шаге.</p>${b('start','Собрать общий пак',`class="primary" ${state.sources.every(Boolean)?'':'disabled'}`)}<small>Сборка сохраняется отдельно от черновика редактора.</small></section>`}</div>${sourceHTML(state.sources[1],1)}</main><footer class="merge-footer">${b('home','← В меню')}<span id="merge-save-status" role="status">Исходные паки остаются без изменений</span><span class="merge-step">${state.stage?'02 · Сборка и экспорт':'01 · Выбор паков'}</span></footer><input type="file" id="merge-file" accept=".siq" hidden></div>`;
  for(const source of sources){const replacement=root.querySelector(`.merge-source[data-side="${source.dataset.side}"]`);if(replacement&&renderedSources[Number(source.dataset.side)]===state.sources[Number(source.dataset.side)]&&renderedStage===state.stage&&renderedBusy===busy&&renderedTarget===`${round()?.type||''}:${state.pack.rounds.some(r=>r.type==='final')}`)replacement.replaceWith(source);}
  renderedSources=[...state.sources];renderedStage=state.stage;renderedBusy=busy;renderedTarget=`${round()?.type||''}:${state.pack.rounds.some(r=>r.type==='final')}`;
  for(const el of root.querySelectorAll('details[data-key]'))if(details.has(el.dataset.key))el.open=details.get(el.dataset.key);
  for(const el of root.querySelectorAll('.merge-scroll,.merge-round-tabs')){const pos=scrolls.get(scrollKey(el));if(pos){el.scrollTop=pos[0];el.scrollLeft=pos[1];}}
  if(focusData?.action){const next=[...root.querySelectorAll('[data-merge]')].find(el=>['action','id','key','side','ri','ti'].every(k=>(k==='action'?el.dataset.merge:el.dataset[k])===focusData[k]));next?.focus({preventScroll:true});}
  if(focusData?.name||focusData?.theme){const input=[...root.querySelectorAll('input')].find(el=>el.dataset.mergeName===focusData.name&&el.dataset.mergeTheme===focusData.theme);input?.focus({preventScroll:true});if(input&&focusData.start!==null)input.setSelectionRange(focusData.start,focusData.end);}
  const selectedTab=root.querySelector('.merge-round-tabs [aria-current]');if(oldRound!==round()?.id)selectedTab?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
  const content=root.querySelector('[data-drop]');
  if(state.stage!==oldStage){
   const target=root.querySelector('.merge-result'),width=target?.getBoundingClientRect().width||400;
   if(oldCenter&&centerRect&&!reduced()){
    oldCenter.inert=true;oldCenter.setAttribute('aria-hidden','true');
    Object.assign(oldCenter.style,{position:'absolute',left:'0',top:'0',width:`${centerRect.width}px`,height:`${centerRect.height}px`,pointerEvents:'none',zIndex:'2'});
    target.parentElement.append(oldCenter);const out=move(oldCenter,[{transform:'none',opacity:1},{transform:`translateX(-${width}px)`,opacity:0}]);
    out.finished.catch(()=>{}).finally(()=>oldCenter.remove());
   }
   move(target,[{transform:`translateX(${width}px)`,opacity:0},{transform:'none',opacity:1}]);root.querySelector('.merge-result [data-merge="metadata"]')?.focus({preventScroll:true});}
  else if(content&&oldRound!==content.dataset.round){move(content,[{transform:'translateY(32px)',opacity:0},{transform:'none',opacity:1}]);}
  else{const items=[...root.querySelectorAll('[data-theme-id]')].map(el=>({el,rect:el.getBoundingClientRect(),old:themeRects.get(el.dataset.themeId)}));for(const {el,rect,old} of items){if(old){const dy=old.top-rect.top;if(Math.abs(dy)>1)move(el,[{transform:`translateY(${dy}px)`},{transform:'none'}],420);}else {const x=transferOrigin?transferOrigin.left-rect.left:0,y=transferOrigin?transferOrigin.top-rect.top:24;move(el,[{transform:`translate(${x}px,${y}px)`,opacity:0},{transform:'none',opacity:1}],420);}}}
  transferOrigin=null;saveStatus();
 }

 async function load(file,side){if(busy||!file)return;if(!/\.siq$/i.test(file.name)){toast('Выберите файл .siq');return;}if(file.size>250*1024*1024){toast('Пак больше 250 МБ');return;}busy=true;loadingSide=side;render();try{const result=importSIQ(new Uint8Array(await file.arrayBuffer()));state.sources[side]=result;save();toast('Пак загружен'+(result.repairs?.length?' · применены обычные правила финала':''));}catch(err){toast('Не удалось загрузить пак. '+err.message);const box=document.createElement('dialog');box.className='merge-error';const title=document.createElement('h2');title.textContent='Пак не загружен';const text=document.createElement('pre');text.textContent=err.message;const close=document.createElement('button');close.textContent='Закрыть';close.onclick=()=>box.close();box.append(title,text,close);showNotice(box,root.querySelector(`[data-merge=load][data-side="${side}"]`));}finally{busy=false;loadingSide=null;render();}}
 function copy(data){if(busy)return;const side=Number(data.side),ri=Number(data.ri),ti=data.ti===undefined?null:Number(data.ti);const next=structuredClone(state.pack),files=new Map(state.media);try{const id=addMergeItem(next,files,state.sources[side],ri,ti,round()?.id);record();transferOrigin=[...root.querySelectorAll('.merge-transfer')].find(el=>el.dataset.side===String(side)&&el.dataset.ri===String(ri)&&(ti===null?el.dataset.ti===undefined:el.dataset.ti===String(ti)))?.getBoundingClientRect();state.pack=next;state.media=files;active=id;finish();toast(ti===null?'Раунд добавлен':'Тема добавлена');}catch(err){toast(err.message);}}
 root.addEventListener('click',async ev=>{const summary=ev.target.closest('.merge-source summary');if(summary){ev.preventDefault();if(!busy)disclosureMotion.toggle(summary.parentElement);return;}const el=ev.target.closest('[data-merge]');if(!el||el.disabled)return;ev.preventDefault();if(busy)return;const action=el.dataset.merge;if(action==='metadata'){const key=el.dataset.key,expanded=!expandedMetadata.has(key);if(expanded)expandedMetadata.add(key);else expandedMetadata.delete(key);setMergeMetadataExpanded(el.closest('[data-metadata]'),expanded);return;}if(action==='home'){if(busy)return;busy=true;disclosureMotion.stop();root.inert=true;await flushSave();stopMotion();const exit=move(root.querySelector('.merge-workspace'),[{transform:'none',opacity:1},{transform:`translateX(${window.innerWidth}px)`,opacity:0}],300);if(exit)await exit.finished.catch(()=>{});busy=false;root.inert=false;onHome();return;}if(action==='load'){const input=root.querySelector('#merge-file');input.onchange=()=>load(input.files[0],Number(el.dataset.side));input.click();return;}if(action==='start'){state.stage=1;if(!state.pack.author)state.pack.author=[...new Set(state.sources.map(s=>s.pack.author).filter(Boolean))].join(', ');finish();return;}if(action==='select'){active=el.dataset.id;render();return;}if(action==='copy'){copy(el.dataset);return;}if(action==='undo'||action==='redo'){const from=action==='undo'?history:future,to=action==='undo'?future:history;if(!from.length)return;to.push({pack:structuredClone(state.pack),active});const old=from.pop();state.pack=old.pack;active=old.active;finish();return;}if(action==='export'){const errors=mergeIssues(state.pack,state.media);if(errors.length){const box=document.createElement('dialog');box.className='merge-error';box.innerHTML=`<h2>Перед экспортом</h2><p>Исправьте замечания. Вопросы можно доработать в основном редакторе исходного пака и загрузить его заново.</p><ul>${errors.map(x=>`<li>${e(x.message)}</li>`).join('')}</ul><button>Закрыть</button>`;box.querySelector('button').onclick=()=>box.close();showNotice(box,el);return;}busy=true;render();try{const bytes=await exportSIQ(state.pack,state.media),url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download=(state.pack.name.replace(/[\\/:*?"<>|]/g,'_')||'Общий пак')+'.siq';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('Общий пак .siq готов');}catch(err){toast(err.message);}finally{busy=false;render();}return;}record();const r=round(),themes=r?.themes,i=themes?.findIndex(t=>t.id===el.dataset.id),ri=state.pack.rounds.indexOf(r);if(action==='new-round'||action==='new-final'){const next={id:uid(),name:action==='new-final'?'Финал':`Раунд ${state.pack.rounds.length+1}`,type:action==='new-final'?'final':'standard',themes:[]};const fi=state.pack.rounds.findIndex(x=>x.type==='final');state.pack.rounds.splice(fi<0?state.pack.rounds.length:fi,0,next);active=next.id;}else if(action==='remove-round')state.pack.rounds.splice(ri,1);else if(action==='remove-theme')themes.splice(i,1);else if(action==='theme-up'||action==='theme-down'){const j=i+(action==='theme-up'?-1:1);[themes[i],themes[j]]=[themes[j],themes[i]];}else if(action==='round-up'||action==='round-down'){const j=ri+(action==='round-up'?-1:1);[state.pack.rounds[ri],state.pack.rounds[j]]=[state.pack.rounds[j],state.pack.rounds[ri]];}finish();});
 root.addEventListener('keydown',ev=>{if(ev.key!=='Escape')return;const panel=ev.target.closest('[data-metadata].is-open');if(!panel)return;ev.preventDefault();expandedMetadata.delete(panel.dataset.metadata);setMergeMetadataExpanded(panel,false);});
 root.addEventListener('focusout',()=>{editOwner=null;});
 root.addEventListener('input',ev=>{const el=ev.target;if(!el.matches('[data-merge-name],[data-merge-theme]'))return;if(editOwner!==el){record();editOwner=el;const undo=root.querySelector('[data-merge=undo]'),redo=root.querySelector('[data-merge=redo]');if(undo)undo.disabled=false;if(redo)redo.disabled=true;}const field=el.dataset.mergeName;if(field==='pack'){state.pack.name=el.value;const title=root.querySelector('.merge-result [data-pack-title]');if(title){title.textContent=el.value.trim()||'Без названия';title.parentElement.title='Сведения о паке: '+(el.value.trim()||'Без названия');}}else if(field==='author')state.pack.author=el.value;else if(field==='round'){round().name=el.value;const tab=[...root.querySelectorAll('[data-merge=select]')].find(x=>x.dataset.id===round().id);if(tab){tab.textContent=el.value;tab.title=el.value;}}else round().themes.find(t=>t.id===el.dataset.mergeTheme).name=el.value;save();});
 root.addEventListener('dragstart',ev=>{const item=ev.target.closest('.merge-transfer');if(!item||busy){ev.preventDefault();return;}drag={...item.dataset};ev.dataTransfer.effectAllowed='copy';ev.dataTransfer.setData('text/plain','SI Studio');});
 root.addEventListener('dragend',()=>{drag=null;root.querySelectorAll('.merge-hover').forEach(x=>x.classList.remove('merge-hover'));});
 root.addEventListener('dragover',ev=>{const area=ev.target.closest('[data-drop],.merge-source');if(!area||busy||!(drag?area.hasAttribute('data-drop'):area.matches('.merge-source')&&[...ev.dataTransfer.types].includes('Files')))return;ev.preventDefault();ev.dataTransfer.dropEffect='copy';area.classList.add('merge-hover');if(area.matches('[data-drop]')){const rect=area.getBoundingClientRect();if(ev.clientY<rect.top+45)area.scrollTop-=15;if(ev.clientY>rect.bottom-45)area.scrollTop+=15;}});
 root.addEventListener('dragleave',ev=>{const area=ev.target.closest('.merge-hover');if(area&&!area.contains(ev.relatedTarget))area.classList.remove('merge-hover');});
 root.addEventListener('drop',ev=>{const area=ev.target.closest('[data-drop],.merge-source');if(!area)return;ev.preventDefault();area.classList.remove('merge-hover');if(area.dataset.drop&&drag){copy(drag);drag=null;}else if(area.matches('.merge-source')&&ev.dataTransfer.files.length){if(ev.dataTransfer.files.length!==1){toast('Перетащите один .siq в каждую панель');return;}load(ev.dataTransfer.files[0],Number(area.dataset.side));}});
 window.addEventListener('beforeunload',ev=>{if(pending||dirty||unsaved){ev.preventDefault();ev.returnValue='';}});
 return {async open(){if(!loaded){try{const saved=await getMergeDraft();if(saved){state=saved;state.media=mergeMedia(state.pack,state.media);}}catch{toast('Сохранённая сборка недоступна');}loaded=true;}render();move(root.querySelector('.merge-workspace'),[{transform:`translateX(${window.innerWidth}px)`,opacity:0},{transform:'none',opacity:1}]);}};
}
