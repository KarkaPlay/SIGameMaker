import {reorderSteps} from './step-drag.js';

// Keep complete round objects, including all question/media IDs and price settings.
export const reorderRounds=reorderSteps;

// Choose among stable slots, independent of the animated preview's current layout.
export function roundDropIndex(widths,from,center,gap=8){
 const width=widths[from],others=widths.filter((_,i)=>i!==from);
 let left=0;
 for(let i=0;i<others.length;i++){
  const next=left+others[i]+gap;
  if(center<(left+next)/2+width/2)return i;
  left=next;
 }
 return others.length;
}

export function installRoundDrag({onMove,doc=document,win=window}){
 let drag=null,frame=0;
 const motions=new Map(),reduced=()=>win.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const items=list=>Array.from(list.querySelectorAll('.studio-round-item'));
 function arrange(list,order){
  const focus=list.contains(doc.activeElement)?doc.activeElement:null;
  const before=new Map(items(list).map(node=>[node,node.getBoundingClientRect().left]));
  for(const motion of motions.values())motion.cancel();motions.clear();
  const end=list.querySelector('.studio-add-round');
  for(const node of order)list.insertBefore(node,end);
  focus?.focus({preventScroll:true});
  if(reduced())return;
  for(const node of order){
   const dx=before.get(node)-node.getBoundingClientRect().left;
   if(Math.abs(dx)<1)continue;
   const motion=node.animate([{transform:`translateX(${dx}px)`},{transform:'translateX(0)'}],{duration:240,easing:'cubic-bezier(.2,.8,.2,1)'});
   motions.set(node,motion);motion.onfinish=()=>{if(motions.get(node)===motion)motions.delete(node);};
  }
 }
 function finish(commit=false){
  if(!drag)return;
  const d=drag;drag=null;win.cancelAnimationFrame(frame);
  if(d.started){
   const order=items(d.list),at=order.indexOf(d.item),beforeId=order[at+1]?.dataset.roundId||null;
   if(!commit||!d.valid||onMove({id:d.item.dataset.roundId,beforeId})===false)arrange(d.list,d.original);
   d.item.classList.remove('is-round-placeholder');d.list.classList.remove('is-round-sorting');
   doc.body.classList.remove('is-round-dragging');d.line.remove();
   const rect=d.item.getBoundingClientRect();
   if(!reduced()&&d.item.isConnected){
    const motion=d.ghost.animate([{left:d.ghost.style.left,top:d.ghost.style.top,opacity:1},{left:`${rect.left}px`,top:`${rect.top}px`,opacity:0}],{duration:180,easing:'cubic-bezier(.2,.8,.2,1)'});
    motion.onfinish=motion.oncancel=()=>d.ghost.remove();
   }else d.ghost.remove();
  }
  if(d.list.hasPointerCapture(d.pointerId))d.list.releasePointerCapture(d.pointerId);
 }
 function locate(){
  const d=drag;if(!d?.started)return;
  if(!d.list.isConnected){finish();return;}
  const r=d.list.getBoundingClientRect();
  d.valid=d.x>=r.left-12&&d.x<=r.right+12&&d.y>=r.top-24&&d.y<=r.bottom+24;
  d.line.hidden=!d.valid;d.ghost.classList.toggle('is-outside',!d.valid);
  d.ghost.style.left=`${d.x-d.offsetX}px`;d.ghost.style.top=`${d.y-d.offsetY}px`;
  if(!d.valid)return;
  const center=d.x-d.offsetX+d.width/2+d.list.scrollLeft-d.start;
  const index=roundDropIndex(d.widths,d.from,center,d.gap);
  if(index!==d.index){
   const order=d.original.filter(node=>node!==d.item);order.splice(index,0,d.item);
   arrange(d.list,order);d.index=index;
  }
  // Use stable slot geometry so the marker stays at the destination during animation.
  const prior=d.original.filter(node=>node!==d.item).slice(0,d.index);
  const x=r.left+d.inset+prior.reduce((sum,node)=>sum+d.widths[d.original.indexOf(node)]+d.gap,0)-d.list.scrollLeft;
  d.line.style.left=`${Math.max(r.left,Math.min(r.right,x))-4}px`;
  d.line.style.top=`${r.top+3}px`;d.line.style.height=`${r.height-6}px`;
 }
 function tick(time){
  if(!drag?.started)return;
  const d=drag,r=d.list.getBoundingClientRect(),edge=Math.min(56,r.width/4);
  if(d.valid){
   const speed=d.x<r.left+edge?-Math.min(1,(r.left+edge-d.x)/edge):d.x>r.right-edge?Math.min(1,(d.x-r.right+edge)/edge):0;
   const elapsed=Number.isFinite(time)&&d.lastTime?Math.min(32,time-d.lastTime):1000/60;
   d.list.scrollLeft+=speed*720*elapsed/1000;
  }
  d.lastTime=time;locate();if(drag)frame=win.requestAnimationFrame(tick);
 }
 doc.addEventListener('pointerdown',ev=>{
  const handle=ev.target.closest('.studio-round-handle');if(!handle||handle.disabled||ev.button!==0||ev.isPrimary===false)return;
  finish();const item=handle.closest('.studio-round-item'),list=item.closest('.studio-round-tabs'),original=items(list);
  if(original.length<2)return;
  ev.preventDefault();handle.focus({preventScroll:true});
  // Cancel an earlier reorder animation before measuring the stable slots.
  for(const node of original)for(const motion of node.getAnimations())motion.cancel();
  const rect=item.getBoundingClientRect();
  drag={handle,item,list,original,pointerId:ev.pointerId,from:original.indexOf(item),index:original.indexOf(item),widths:original.map(node=>node.getBoundingClientRect().width),gap:parseFloat(win.getComputedStyle(list).gap)||0,start:original[0].getBoundingClientRect().left+list.scrollLeft,inset:original[0].getBoundingClientRect().left-list.getBoundingClientRect().left+list.scrollLeft,width:rect.width,offsetX:ev.clientX-rect.left,offsetY:ev.clientY-rect.top,startX:ev.clientX,startY:ev.clientY,x:ev.clientX,y:ev.clientY,started:false};
  list.setPointerCapture(ev.pointerId);
 });
 doc.addEventListener('pointermove',ev=>{
  const d=drag;if(!d||d.pointerId!==ev.pointerId)return;d.x=ev.clientX;d.y=ev.clientY;
  if(!d.started){
   if(Math.hypot(d.x-d.startX,d.y-d.startY)<5)return;
   d.started=true;const rect=d.item.getBoundingClientRect();
   d.ghost=d.item.cloneNode(true);d.ghost.className='studio-round-item studio-round-ghost';d.ghost.inert=true;d.ghost.setAttribute('aria-hidden','true');
   for(const node of [d.ghost,...d.ghost.querySelectorAll('[id]')])node.removeAttribute('id');
   Object.assign(d.ghost.style,{width:`${rect.width}px`,height:`${rect.height}px`});doc.body.append(d.ghost);
   d.line=doc.createElement('div');d.line.className='studio-round-drop-line';d.line.setAttribute('aria-hidden','true');doc.body.append(d.line);
   d.item.classList.add('is-round-placeholder');d.list.classList.add('is-round-sorting');doc.body.classList.add('is-round-dragging');
   locate();frame=win.requestAnimationFrame(tick);
  }
  ev.preventDefault();locate();
 });
 doc.addEventListener('pointerup',ev=>{if(drag?.pointerId!==ev.pointerId)return;drag.x=ev.clientX;drag.y=ev.clientY;locate();finish(true);});
 doc.addEventListener('pointercancel',ev=>{if(drag?.pointerId===ev.pointerId)finish();});
 doc.addEventListener('lostpointercapture',ev=>{if(drag?.pointerId===ev.pointerId)finish();});
 doc.addEventListener('click',ev=>{if(ev.target.closest('.studio-round-handle')){ev.preventDefault();ev.stopPropagation();}},true);
 doc.addEventListener('dragstart',ev=>{if(ev.target.closest('.studio-round-handle'))ev.preventDefault();});
 doc.addEventListener('keydown',ev=>{
  if(drag&&ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();finish();return;}
  const handle=ev.target.closest('.studio-round-handle');
  if(!handle||!ev.altKey||!['ArrowLeft','ArrowRight'].includes(ev.key))return;
  ev.preventDefault();finish();const item=handle.closest('.studio-round-item'),list=item.closest('.studio-round-tabs'),order=items(list),from=order.indexOf(item),to=from+(ev.key==='ArrowLeft'?-1:1);
  if(to<0||to>=order.length)return;
  order.splice(from,1);order.splice(to,0,item);
  if(onMove({id:item.dataset.roundId,beforeId:order[to+1]?.dataset.roundId||null})===false)return;
  arrange(list,order);handle.focus({preventScroll:true});item.scrollIntoView({block:'nearest',inline:'nearest',behavior:reduced()?'instant':'smooth'});
 },true);
 win.addEventListener('blur',()=>finish());win.addEventListener('resize',()=>finish());
 return {cancel:()=>finish()};
}
