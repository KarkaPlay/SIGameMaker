import {createPanelMotion} from './panel-motion.js';
import {oversizedMedia} from './media-warning.js';
import {installLibraryLoading} from './library-loading.js';
import {createLibraryMotion,gallerySlideDirection} from './library-motion.js';
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories=[['image','Фото','▧'],['video','Видео','▷'],['audio','Аудио','♪']];

export function collectLibraryMedia(pack){
 const used=new Map();
 for(const [ri,round] of pack.rounds.entries())for(const [ti,theme] of round.themes.entries())for(const [qi,question] of theme.questions.entries())for(const [si,step] of question.steps.entries()){
  if(!step.mediaId||!categories.some(([type])=>type===step.type))continue;
  if(!used.has(step.mediaId))used.set(step.mediaId,{id:step.mediaId,type:step.type,filename:step.filename||'Без названия',locations:[]});
  const locations=used.get(step.mediaId).locations,roundKey=round.id||`round-${ri}`,themeKey=theme.id||`theme-${ti}`;
  let location=locations.find(location=>location.roundKey===roundKey&&location.themeKey===themeKey);if(!location){location={roundKey,themeKey,roundOrder:ri,themeOrder:ti,round:round.name||`Раунд ${ri+1}`,theme:theme.name||`Тема ${ti+1}`,uses:[]};locations.push(location);}location.uses.push({roundId:round.id,themeId:theme.id,questionId:question.id,stepId:step.id,questionNumber:qi+1,stepNumber:si+1,price:question.price});
 }
 return [...used.values()];
}

export function groupLibraryMedia(items){
 const groups=new Map();
 for(const item of items)for(const location of item.locations||[]){
  const key=JSON.stringify([location.roundKey,location.themeKey]);
  if(!groups.has(key))groups.set(key,{key,label:location.theme,roundKey:location.roundKey,round:location.round,theme:location.theme,roundOrder:location.roundOrder,themeOrder:location.themeOrder,items:[]});
  const group=groups.get(key);if(!group.items.some(file=>file.id===item.id))group.items.push(item);
 }
 return [...groups.values()].sort((a,b)=>a.roundOrder-b.roundOrder||a.themeOrder-b.themeOrder);
}

// Capture play events: native media controls do not bubble them.
export function installExclusivePlayback(root){
 const stop=player=>{player.pause();if(player.readyState>0)player.currentTime=0;};
 const onPlay=event=>{
  if(!event.target.matches('audio,video'))return;
  for(const player of root.querySelectorAll('audio,video'))if(player!==event.target)stop(player);
 };
 root.addEventListener('play',onPlay,true);
 return ()=>{root.removeEventListener('play',onPlay,true);for(const player of root.querySelectorAll('audio,video'))stop(player);};
}

export function mountMediaLibrary(root,{items,blob,size,onNavigate=()=>{}}){
 let category='image',unload=()=>{},usageDialog=null,usageAnchor=null;
 const modes={image:'grid',video:'grid'},selected={image:null,video:null};
 const motion=createLibraryMotion(root),usageMotion=createPanelMotion();
 const sizeLabel=item=>`${(size(item.id)/1_000_000).toFixed(2)} МБ${oversizedMedia(size(item.id))?' · ⚠ Больше 1 МБ — не рекомендуется':''}`;
 const files=()=>items.filter(item=>item.type===category);
 const groups=()=>groupLibraryMedia(files());
 const entries=()=>groups().flatMap(group=>group.items.map(item=>({item,key:JSON.stringify([group.key,item.id])})));
 const active=()=>entries().find(entry=>entry.key===selected[category])||entries()[0];
 const source=item=>`data-library-source="${escapeHTML(item.id)}"`;
 const thumbnail=item=>item.type==='image'
  ?`<img ${source(item)} alt="" decoding="async">`
  :`<video ${source(item)} data-library-poster preload="none" muted playsinline aria-hidden="true"></video><span class="library-video-mark" aria-hidden="true">▷</span><span class="library-poster-status" aria-hidden="true">Превью…</span>`;
 const fileButton=(item,key,strip=false)=>`<button type="button" class="library-file ${strip?'library-thumbnail':''} ${oversizedMedia(size(item.id))?'has-media-warning':''}" data-library-file="${escapeHTML(item.id)}" data-library-key="${escapeHTML(key)}" aria-label="Открыть ${escapeHTML(item.filename)}" ${strip?`aria-pressed="${selected[category]===key}"`:''}><span class="library-thumbnail-image">${thumbnail(item)}</span><strong title="${escapeHTML(item.filename)}">${escapeHTML(item.filename)}</strong>${strip?'':`<small>${sizeLabel(item)}</small>`}</button>`;
 const audioRow=item=>`<article class="library-audio-row ${oversizedMedia(size(item.id))?'has-media-warning':''}" data-library-file="${escapeHTML(item.id)}"><span class="library-audio-icon" aria-hidden="true">♪</span><div class="library-audio-name"><strong title="${escapeHTML(item.filename)}">${escapeHTML(item.filename)}</strong><small>${sizeLabel(item)}</small></div><audio controls preload="none" ${source(item)} aria-label="${escapeHTML(item.filename)}"></audio></article>`;
 function usesHTML(item){return `<header class="library-usage-heading"><h3 id="library-usage-title">Перейти к элементу</h3><button type="button" data-library-close-uses aria-label="Закрыть">×</button></header><ul>${item.locations.flatMap((location,li)=>location.uses.map((use,ui)=>{
  const context=`${location.round} → ${location.theme} → вопрос ${use.questionNumber} → элемент ${use.stepNumber}`;
  return `<li><span class="library-usage-theme" title="${escapeHTML(context)}">${escapeHTML(location.theme)}</span><span>Вопрос ${use.questionNumber} · элемент ${use.stepNumber}</span><button type="button" data-library-use="${li}:${ui}" data-library-id="${escapeHTML(item.id)}" title="${escapeHTML(context)}" aria-label="Перейти: ${escapeHTML(context)}">↗</button></li>`;
 })).join('')}</ul>`;}
 function closeUses(restore=true,immediate=false){
  const popup=usageDialog,anchor=usageAnchor;
  if(!popup)return Promise.resolve();
  const finish=()=>{
   popup.remove();
   if(usageDialog!==popup)return;
   usageDialog=null;usageAnchor=null;
   if(restore&&anchor?.isConnected)anchor.focus({preventScroll:true});
  };
  const closing=usageMotion.close(popup,{immediate});
  if(!popup.open){finish();return Promise.resolve();}
  return closing.then(finish);
 }
 function openUses(item,anchor){
  closeUses(false,true);
  const popup=root.ownerDocument.createElement('dialog');usageDialog=popup;usageAnchor=anchor;
  popup.className='library-usage-dialog';popup.setAttribute('aria-labelledby','library-usage-title');popup.innerHTML=usesHTML(item);
  popup.addEventListener('cancel',event=>{event.preventDefault();event.stopPropagation();closeUses();});
  const outside=event=>{const rect=popup.getBoundingClientRect();return event.target===popup&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom);};
  let startedOutside=false;
  popup.addEventListener('pointerdown',event=>{startedOutside=outside(event);});
  popup.addEventListener('click',event=>{if(startedOutside&&outside(event))closeUses();startedOutside=false;});
  root.append(popup);popup.showModal();
  const rect=anchor.getBoundingClientRect(),width=popup.offsetWidth,height=popup.offsetHeight,edge=12,gap=8;
  const left=Math.max(edge,Math.min(rect.right-width,innerWidth-width-edge)),below=innerHeight-rect.bottom-gap-edge;
  popup.dataset.side=below>=height?'below':'above';
  popup.style.transformOrigin=`${Math.max(16,Math.min(rect.left+rect.width/2-left,width-16))}px ${below>=height?'top':'bottom'}`;
  popup.style.left=`${left}px`;popup.style.top=`${Math.max(edge,Math.min(below>=height?rect.bottom+gap:rect.top-gap-height,innerHeight-height-edge))}px`;
  popup.querySelector('[data-library-close-uses]').focus({preventScroll:true});usageMotion.open(popup);
 }
 function stageHTML({item,key}){return `<div class="library-preview-media" data-library-key="${escapeHTML(key)}" data-library-file="${escapeHTML(item.id)}">${item.type==='image'?`<img ${source(item)} alt="${escapeHTML(item.filename)}">`:`<video controls playsinline data-library-video-preview preload="none" ${source(item)} aria-label="${escapeHTML(item.filename)}"></video>`}</div><div class="library-preview-caption"><strong title="${escapeHTML(item.filename)}">${escapeHTML(item.filename)}</strong><small>${sizeLabel(item)}</small><button type="button" class="library-go" data-library-show-uses="${escapeHTML(item.id)}" aria-haspopup="dialog">Перейти</button></div>`;}
 function groupedHTML(strip=false){
  const rounds=new Map();
  for(const group of groups()){
   if(!rounds.has(group.roundKey))rounds.set(group.roundKey,{name:group.round,themes:[]});
   rounds.get(group.roundKey).themes.push(group);
  }
  return [...rounds.values()].map(round=>`<section class="library-round ${strip?'library-strip-round':''}"><h3 class="library-round-title" title="${escapeHTML(round.name)}">${escapeHTML(round.name)}</h3><div class="library-round-themes">${round.themes.map(group=>{
   const heading=`<h4 class="library-group-title">${escapeHTML(group.theme)} <span>· ${group.items.length}</span></h4>`;
   const content=group.items.map(item=>category==='audio'?audioRow(item):fileButton(item,JSON.stringify([group.key,item.id]),strip)).join('');
   return `<section class="library-group ${strip?'library-strip-group':''}">${heading}<div class="${strip?'library-group-strip':category==='audio'?'':'library-group-grid'}">${content}</div></section>`;
  }).join('')}</div></section>`).join('');
 }
 function render(){
  closeUses(false,true);unload();
  const list=files(),label=categories.find(([type])=>type===category)[1];
  selected[category]=active()?.key;
  root.innerHTML=`<aside class="library-sidebar"><p>Файлы пака</p><nav aria-label="Категории медиатеки">${categories.map(([type,title,symbol])=>`<button type="button" data-library-category="${type}" aria-current="${category===type?'page':'false'}"><span aria-hidden="true">${symbol}</span><span>${title}</span><small>${items.filter(item=>item.type===type).length}</small></button>`).join('')}</nav><p class="library-hint">Добавляйте файлы в шагах вопросов — они появятся здесь.</p></aside><section class="library-content" aria-label="${label}"><header class="library-toolbar"><h3>${label} <span>· ${list.length}</span></h3>${category==='audio'?'':`<div class="library-view-switch studio-binary-switch" data-second="${modes[category]==='gallery'}" role="group" aria-label="Режим просмотра"><span class="studio-binary-thumb" aria-hidden="true"></span>${[['grid','Сетка'],['gallery','Галерея']].map(([mode,title])=>`<button type="button" class="studio-binary-option" data-library-mode="${mode}" aria-pressed="${modes[category]===mode}">${title}</button>`).join('')}</div>`}</header><div class="library-body ${!list.length?'library-is-empty':''} ${category==='audio'?'library-audio-list':modes[category]==='grid'?'library-grid is-grouped':'library-gallery'}">${!list.length?`<div class="library-empty"><span aria-hidden="true">${categories.find(([type])=>type===category)[2]}</span><h3>Здесь пока нет файлов</h3><p>Добавьте ${category==='image'?'фото':category==='video'?'видео':'аудио'} в шаг вопроса.</p></div>`:category==='audio'||modes[category]==='grid'?groupedHTML():`<div class="library-preview">${stageHTML(active())}</div><div class="library-filmstrip" role="group" aria-label="Выбор файла">${groupedHTML(true)}</div>`}</div></section>`;
  unload=installLibraryLoading(root,{blob});
 }
 function selectedButton(){return [...root.querySelectorAll('button[data-library-key]')].find(button=>button.dataset.libraryKey===selected[category]);}
 function reveal(){selectedButton()?.scrollIntoView({block:'nearest',inline:'nearest'});}
 function changeMode(mode,key){
  if(mode===modes[category])return;
  const before=motion.capture({expandingKey:mode==='gallery'?(key||selected[category]):null});if(key)selected[category]=key;
  const previous=modes[category];modes[category]=mode;render();reveal();
  const thumb=root.querySelector('.library-view-switch .studio-binary-thumb');
  if(thumb&&!matchMedia('(prefers-reduced-motion: reduce)').matches)thumb.animate([{transform:previous==='gallery'?'translateX(100%)':'translateX(0)'},{transform:mode==='gallery'?'translateX(100%)':'translateX(0)'}],{duration:250,easing:'cubic-bezier(.2,.8,.2,1)'});
  motion.move(before,{selectedKey:selected[category],toGallery:mode==='gallery'});
 }
 function selectFile(key){
  closeUses(false,true);
  if(!entries().some(entry=>entry.key===key))return;
  if(modes[category]==='grid')changeMode('gallery',key);
  else if(selected[category]!==key){
   const direction=gallerySlideDirection(entries().map(entry=>entry.key),selected[category],key);
   motion.slide(()=>{
    selected[category]=key;root.querySelector('.library-preview').innerHTML=stageHTML(active());
    for(const button of root.querySelectorAll('button[data-library-key]'))button.setAttribute('aria-pressed',String(button.dataset.libraryKey===key));
    unload.refresh();
   },{direction});
  }
  selectedButton()?.focus({preventScroll:true});reveal();
 }
 const onClick=event=>{
  const button=event.target.closest('button');if(!button||!root.contains(button))return;
  if(usageDialog&&usageMotion.isClosing(usageDialog))return;
  if(button.dataset.libraryCloseUses!==undefined){closeUses();return;}
  if(button.dataset.libraryShowUses){const item=items.find(item=>item.id===button.dataset.libraryShowUses);if(item)openUses(item,button);return;}
  if(button.dataset.libraryUse){const item=items.find(item=>item.id===button.dataset.libraryId),[li,ui]=button.dataset.libraryUse.split(':').map(Number),use=item?.locations[li]?.uses[ui];if(use)closeUses(false).then(()=>onNavigate(use));return;}
  if(button.dataset.libraryCategory){
   if(category===button.dataset.libraryCategory)return;
   motion.clear();category=button.dataset.libraryCategory;render();motion.enter();
   root.querySelector(`[data-library-category="${category}"]`).focus({preventScroll:true});reveal();
  }else if(button.dataset.libraryMode){changeMode(button.dataset.libraryMode);root.querySelector(`[data-library-mode="${modes[category]}"]`).focus({preventScroll:true});}
  else if(button.dataset.libraryKey)selectFile(button.dataset.libraryKey);
 };
 const onKey=event=>{
  const button=event.target.closest('.library-thumbnail');if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const list=entries(),index=list.findIndex(entry=>entry.key===selected[category]);
  const next=event.key==='Home'?0:event.key==='End'?list.length-1:Math.max(0,Math.min(list.length-1,index+(event.key==='ArrowRight'?1:-1)));
  selectFile(list[next].key);
 };
 root.addEventListener('click',onClick);root.addEventListener('keydown',onKey);
 const stopPlayback=installExclusivePlayback(root);render();
 return ()=>{closeUses(false,true);motion.clear();stopPlayback();unload();root.removeEventListener('click',onClick);root.removeEventListener('keydown',onKey);};
}
