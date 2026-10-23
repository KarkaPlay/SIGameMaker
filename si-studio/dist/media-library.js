import {installLibraryLoading} from './library-loading.js';
import {createLibraryMotion,gallerySlideDirection} from './library-motion.js';
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories=[['image','Фото','▧'],['video','Видео','▷'],['audio','Аудио','♪']];

export function collectLibraryMedia(pack){
 const used=new Map();
 for(const [ri,round] of pack.rounds.entries())for(const [ti,theme] of round.themes.entries())for(const question of theme.questions)for(const step of question.steps){
  if(!step.mediaId||!categories.some(([type])=>type===step.type))continue;
  if(!used.has(step.mediaId))used.set(step.mediaId,{id:step.mediaId,type:step.type,filename:step.filename||'Без названия',locations:[]});
  const locations=used.get(step.mediaId).locations,roundKey=round.id||`round-${ri}`,themeKey=theme.id||`theme-${ti}`;
  if(!locations.some(location=>location.roundKey===roundKey&&location.themeKey===themeKey))locations.push({roundKey,themeKey,roundOrder:ri,themeOrder:ti,round:round.name||`Раунд ${ri+1}`,theme:theme.name||`Тема ${ti+1}`});
 }
 return [...used.values()];
}

export function groupLibraryMedia(items,grouping='none'){
 if(grouping==='none')return [{key:'all',label:'',items}];
 const groups=new Map();
 for(const item of items)for(const location of item.locations||[]){
  const key=JSON.stringify(grouping==='round'?[location.roundKey]:[location.roundKey,location.themeKey]);
  if(!groups.has(key))groups.set(key,{key,label:grouping==='round'?location.round:`${location.round} · ${location.theme}`,roundOrder:location.roundOrder,themeOrder:grouping==='round'?0:location.themeOrder,items:[]});
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

export function mountMediaLibrary(root,{items,blob,size}){
 let category='image',grouping='none',unload=()=>{};
 const modes={image:'grid',video:'grid'},selected={image:null,video:null};
 const motion=createLibraryMotion(root);
 const sizeLabel=item=>`${(size(item.id)/1024/1024).toFixed(1)} МБ`;
 const files=()=>items.filter(item=>item.type===category);
 const groups=()=>groupLibraryMedia(files(),grouping);
 const entries=()=>groups().flatMap(group=>group.items.map(item=>({item,key:JSON.stringify([group.key,item.id])})));
 const active=()=>entries().find(entry=>entry.key===selected[category])||entries()[0];
 const source=item=>`data-library-source="${escapeHTML(item.id)}"`;
 const thumbnail=item=>item.type==='image'
  ?`<img ${source(item)} alt="" decoding="async">`
  :`<video ${source(item)} data-library-poster preload="none" muted playsinline aria-hidden="true"></video><span class="library-video-mark" aria-hidden="true">▷</span><span class="library-poster-status" aria-hidden="true">Превью…</span>`;
 const fileButton=(item,key,strip=false)=>`<button type="button" class="library-file ${strip?'library-thumbnail':''}" data-library-file="${escapeHTML(item.id)}" data-library-key="${escapeHTML(key)}" aria-label="Открыть ${escapeHTML(item.filename)}" ${strip?`aria-pressed="${selected[category]===key}"`:''}><span class="library-thumbnail-image">${thumbnail(item)}</span><strong title="${escapeHTML(item.filename)}">${escapeHTML(item.filename)}</strong>${strip?'':`<small>${sizeLabel(item)}</small>`}</button>`;
 const audioRow=item=>`<article class="library-audio-row"><span class="library-audio-icon" aria-hidden="true">♪</span><div class="library-audio-name"><strong title="${escapeHTML(item.filename)}">${escapeHTML(item.filename)}</strong><small>${sizeLabel(item)}</small></div><audio controls preload="none" ${source(item)} aria-label="${escapeHTML(item.filename)}"></audio></article>`;
 function stageHTML({item,key}){return `<div class="library-preview-media" data-library-key="${escapeHTML(key)}" data-library-file="${escapeHTML(item.id)}">${item.type==='image'?`<img ${source(item)} alt="${escapeHTML(item.filename)}">`:`<video controls playsinline data-library-video-preview preload="none" ${source(item)} aria-label="${escapeHTML(item.filename)}"></video>`}</div><div class="library-preview-caption"><strong title="${escapeHTML(item.filename)}">${escapeHTML(item.filename)}</strong><small>${sizeLabel(item)}</small></div>`;}
 function groupedHTML(strip=false){return groups().map(group=>{
  const heading=group.label?`<h4 class="library-group-title" title="${escapeHTML(group.label)}">${escapeHTML(group.label)} <span>· ${group.items.length}</span></h4>`:'';
  const content=group.items.map(item=>category==='audio'?audioRow(item):fileButton(item,JSON.stringify([group.key,item.id]),strip)).join('');
  if(!group.label)return content;
  return `<section class="library-group ${strip?'library-strip-group':''}">${heading}<div class="${strip?'library-group-strip':category==='audio'?'':'library-group-grid'}">${content}</div></section>`;
 }).join('');}
 function render(){
  unload();
  const list=files(),label=categories.find(([type])=>type===category)[1];
  selected[category]=active()?.key;
  root.innerHTML=`<aside class="library-sidebar"><p>Файлы пака</p><nav aria-label="Категории медиатеки">${categories.map(([type,title,symbol])=>`<button type="button" data-library-category="${type}" aria-current="${category===type?'page':'false'}"><span aria-hidden="true">${symbol}</span><span>${title}</span><small>${items.filter(item=>item.type===type).length}</small></button>`).join('')}</nav><p class="library-hint">Добавляйте файлы в шагах вопросов — они появятся здесь.</p></aside><section class="library-content" aria-label="${label}"><header class="library-toolbar"><h3>${label} <span>· ${list.length}</span></h3><label class="library-group-control"><span>Группировка</span><select data-library-group aria-label="Группировка файлов">${[['none','Без группировки'],['round','По раундам'],['theme','По темам']].map(([value,title])=>`<option value="${value}" ${grouping===value?'selected':''}>${title}</option>`).join('')}</select></label>${category==='audio'?'':`<div class="library-view-switch" role="group" aria-label="Режим просмотра">${[['grid','Сетка'],['gallery','Галерея']].map(([mode,title])=>`<button type="button" data-library-mode="${mode}" aria-pressed="${modes[category]===mode}">${title}</button>`).join('')}</div>`}</header><div class="library-body ${category==='audio'?'library-audio-list':modes[category]==='grid'?`library-grid ${grouping!=='none'?'is-grouped':''}`:'library-gallery'}">${!list.length?`<div class="library-empty"><span aria-hidden="true">${categories.find(([type])=>type===category)[2]}</span><h3>Здесь пока нет файлов</h3><p>Добавьте ${category==='image'?'фото':category==='video'?'видео':'аудио'} в шаг вопроса.</p></div>`:category==='audio'||modes[category]==='grid'?groupedHTML():`<div class="library-preview">${stageHTML(active())}</div><div class="library-filmstrip" role="group" aria-label="Выбор файла">${groupedHTML(true)}</div>`}</div></section>`;
  unload=installLibraryLoading(root,{blob});
 }
 function selectedButton(){return [...root.querySelectorAll('button[data-library-key]')].find(button=>button.dataset.libraryKey===selected[category]);}
 function reveal(){selectedButton()?.scrollIntoView({block:'nearest',inline:'nearest'});}
 function changeMode(mode,key){
  if(mode===modes[category])return;
  const before=motion.capture({expandingKey:mode==='gallery'?(key||selected[category]):null});if(key)selected[category]=key;
  modes[category]=mode;render();reveal();
  motion.move(before,{selectedKey:selected[category],toGallery:mode==='gallery'});
 }
 function selectFile(key){
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
  if(button.dataset.libraryCategory){
   if(category===button.dataset.libraryCategory)return;
   motion.clear();category=button.dataset.libraryCategory;render();motion.enter();
   root.querySelector(`[data-library-category="${category}"]`).focus({preventScroll:true});reveal();
  }else if(button.dataset.libraryMode){changeMode(button.dataset.libraryMode);root.querySelector(`[data-library-mode="${modes[category]}"]`).focus({preventScroll:true});}
  else if(button.dataset.libraryKey)selectFile(button.dataset.libraryKey);
 };
 const onChange=event=>{
  if(!event.target.matches('[data-library-group]'))return;
  const id=active()?.item.id;motion.clear();grouping=event.target.value;
  selected[category]=entries().find(entry=>entry.item.id===id)?.key;render();reveal();motion.enter();root.querySelector('[data-library-group]').focus({preventScroll:true});
 };
 const onKey=event=>{
  const button=event.target.closest('.library-thumbnail');if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const list=entries(),index=list.findIndex(entry=>entry.key===selected[category]);
  const next=event.key==='Home'?0:event.key==='End'?list.length-1:Math.max(0,Math.min(list.length-1,index+(event.key==='ArrowRight'?1:-1)));
  selectFile(list[next].key);
 };
 root.addEventListener('click',onClick);root.addEventListener('keydown',onKey);root.addEventListener('change',onChange);
 const stopPlayback=installExclusivePlayback(root);render();
 return ()=>{motion.clear();stopPlayback();unload();root.removeEventListener('click',onClick);root.removeEventListener('keydown',onKey);root.removeEventListener('change',onChange);};
}
