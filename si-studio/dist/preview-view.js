import {kinds} from './model.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// The board is deliberately schematic and read-only, never a second question picker.
export const previewBoardSelection=Object.freeze({theme:1,question:2});
export function previewBoardHTML(state){
 const played=state==='return';
 return `<div class="demo-board" role="img" aria-label="Условное игровое поле: ${played?'вопрос темы 2 за 300 сыгран, игра продолжается':'выбор вопроса темы 2 за 300'}">${Array.from({length:4},(_,row)=>`<div class="demo-board-row"><span class="demo-board-theme">Тема ${row+1}</span>${Array.from({length:5},(_,column)=>{const selected=row===previewBoardSelection.theme&&column===previewBoardSelection.question;return `<span class="demo-board-cell ${selected&&played?'is-played':''}" ${selected?'data-demo-selected':''}>${selected&&played?'<span aria-hidden="true">✓</span>':(column+1)*100}</span>`;}).join('')}</div>`).join('')}</div>`;
}
export const previewAvatar='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="6" r="4"/><path d="M3 23v-1a9 9 0 0 1 18 0v1"/></svg>';
export function previewStageSummary(frame){
 const st=frame.step;
 if(st?.type==='text')return String(st.value||'').trim().replace(/\s+/g,' ');
 return ['image','audio','video'].includes(st?.type)?String(st.filename||'').trim().replace(/\s+/g,' '):'';
}
export function truncatePreviewSummaries(root){
 for(const node of root?.querySelectorAll('[data-preview-summary]')||[]){
  if(!node.clientWidth)continue;
  const text=node.dataset.previewSummary,chars=Array.from(text);node.textContent=text;
  if(node.scrollWidth<=node.clientWidth)continue;
  let low=0,high=chars.length;
  while(low<high){const mid=Math.ceil((low+high)/2);node.textContent=chars.slice(0,mid).join('').trimEnd()+'...';if(node.scrollWidth<=node.clientWidth)low=mid;else high=mid-1;}
  node.textContent=chars.slice(0,low).join('').trimEnd()+'...';
 }
}
export function previewStageHTML(frame,index,symbols={}){
 const kind=Object.hasOwn(kinds,frame.kind)||['board','stake','bagcat'].includes(frame.kind)?frame.kind:'answer';
 const summary=previewStageSummary(frame);
 const symbol=frame.symbol?escape(frame.symbol):kinds[kind]?.[1]||({board:symbols.board||'▦',stake:symbols.stake||'⚑',bagcat:'?'})[kind];
 return `<li class="is-upcoming" data-preview-stage="${index}" data-preview-state="upcoming"><span class="demo-stage-position" aria-hidden="true"><span class="studio-step-number">${String(index+1).padStart(2,'0')}</span></span><article class="studio-step studio-timeline-event studio-type-${kind} demo-stage-event"><div class="studio-event-trigger"><span class="studio-step-symbol ${kind}" aria-hidden="true">${symbol}</span><span class="studio-event-copy"><strong class="studio-step-label">${escape(frame.title)}</strong>${summary?`<span class="studio-event-summary" data-preview-summary="${escape(summary)}" title="${escape(summary)}">${escape(summary)}</span>`:''}</span></div></article></li>`;
}
export function createPreviewStageMotion({reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches}={}){
 let motions=[];
 const stop=()=>{for(const motion of motions)motion.cancel();motions=[];};
 function show(rail,index){
  stop();if(!rail)return;
  const previous=rail.querySelector('[aria-current="step"]'),items=Array.from(rail.querySelectorAll('[data-preview-stage]')),current=items.find(item=>Number(item.dataset.previewStage)===index);
  if(!current)return;
  for(const item of items){const active=item===current,complete=Number(item.dataset.previewStage)<index;item.dataset.previewState=active?'current':complete?'complete':'upcoming';item.classList.toggle('is-complete',complete);item.classList.toggle('is-upcoming',!active&&!complete);if(active)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');item.querySelector('.studio-step').classList.toggle('is-editing',active);item.querySelector('.studio-step-number').textContent=complete?'✓':String(Number(item.dataset.previewStage)+1).padStart(2,'0');}
  const reduced=reduceMotion();
  if(!reduced&&previous!==current){
   if(previous)motions.push(previous.querySelector('.studio-step').animate([{opacity:.7},{opacity:1}],{duration:200,easing:'ease-out'}));
   motions.push(current.querySelector('.studio-step').animate([{opacity:.65,transform:'translateX(6px)'},{opacity:1,transform:'translateX(0)'}],{duration:240,easing:'cubic-bezier(.2,.75,.25,1)'}));
  }
  truncatePreviewSummaries(rail);
  const top=current.offsetTop,bottom=top+current.offsetHeight;
  if(top<rail.scrollTop||bottom>rail.scrollTop+rail.clientHeight)rail.scrollTo({top:Math.max(0,top<rail.scrollTop?top:bottom-rail.clientHeight),behavior:reduced?'auto':'smooth'});
 }
 return {show,stop};
}

// A local popup leaves the scene layout intact; disposal owns every animation/listener.
export function mountPreviewShowman(popup,{reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches}={}){
 if(!popup)return ()=>{};
 const button=popup.querySelector('[data-dismiss-showman]');
 let motion=null,disposed=false,closing=false;
 if(!reducedMotion())motion=popup.animate([{opacity:0,transform:'translateX(-24px)'},{opacity:1,transform:'none'}],{duration:320,easing:'cubic-bezier(.12,1,.2,1)'});
 const dismiss=()=>{
  if(disposed||closing)return;closing=true;
  const current=getComputedStyle(popup),start={opacity:current.opacity,transform:current.transform};
  motion?.cancel();
  const finish=()=>{if(disposed)return;popup.hidden=true;popup.closest('.demo-layout')?.querySelector('[data-preview-next]')?.focus({preventScroll:true});};
  if(reducedMotion()){finish();return;}
  motion=popup.animate([start,{opacity:0,transform:'translateX(-18px)'}],{duration:220,easing:'cubic-bezier(.2,.75,.25,1)',fill:'forwards'});
  motion.finished.then(finish,()=>{});
 };
 button?.addEventListener('click',dismiss);
 return ()=>{disposed=true;motion?.cancel();button?.removeEventListener('click',dismiss);};
}
