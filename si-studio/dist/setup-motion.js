// One material, continuous 2D geometry, and explicit owners for new content.
// All projections are inert, excluded from accessibility, and scoped to this wizard.
export const setupSpring=t=>{const x=Math.max(0,Math.min(1,t));return (1-(1+9*x)*Math.exp(-9*x))/(1-10*Math.exp(-9));};
export function setupGeometryFrames(from,to,{quick=false}={}){return Array.from({length:49},(_,i)=>{const t=i/48,p=quick?1-(1-t)**5:setupSpring(t),frame={offset:t};for(const key of ['left','top','width','height','borderRadius'])frame[key]=`${from[key]+(to[key]-from[key])*p}px`;return frame;});}
const rect=el=>{if(!el||!el.getClientRects().length)return null;const b=el.getBoundingClientRect();return b.width>0&&b.height>0?{left:b.left,top:b.top,width:b.width,height:b.height,borderRadius:Number.parseFloat(getComputedStyle(el).borderTopLeftRadius)||0}:null;};
const edge=(box,side='top')=>({...box,...(side==='left'?{width:1}:side==='right'?{left:box.left+box.width,width:1}:side==='bottom'?{top:box.top+box.height,height:1}:{height:1})});
const point=box=>({...box,left:box.left+box.width/2,top:box.top+box.height/2,width:1,height:1,borderRadius:0});
const styleKeys=['backgroundColor','borderColor','borderWidth','borderStyle','background','border','borderRadius','boxShadow','color','font','padding','display','flexDirection','justifyContent','alignItems','gap','boxSizing','textAlign','lineHeight','fontWeight','letterSpacing','whiteSpace','textOverflow','overflow'];

// Exported semantic correspondence also documents where every stage surface comes from.
export function setupStageSources(before,after){
 const links=[];
 for(const [key,target]of after){
  let source=before.get(key),owner=null;
  if(key==='surface')source=source||before.get('round:'+target.round);
  if(key.startsWith('round:'))source=source||(target.surface?before.get('surface'):null);
  if(!source){
   if(key==='settings')owner=before.get('surface');
   else if(key==='roundbar')owner=before.get('progress');
   else if(key==='summary')owner=after.get('diagram');
   else if(key==='identity')owner=after.get('title');
   else if(key==='help')owner=after.get('surface');
   else if(key==='warning')owner=after.get('summary');
  }
  links.push({key,target,source,owner});
 }
 return links;
}

export function createSetupMotion(root){
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const ease='cubic-bezier(.16,1,.3,1)';
 const active=new Map(),projections=new Set(),modalOwners=new WeakMap(),priceTokens=new WeakMap(),priceValues=new WeakMap(),priceHeights=new WeakMap(),hidden=new WeakMap();
 let transaction=0;
 const style=el=>getComputedStyle(el);
 function play(el,frames,{duration=380,delay=0,channel='layout',fill='both',retain=false,onAnimation=null,...rest}={}){
  if(!el||reduced()||!el.animate)return Promise.resolve();
  let channels=active.get(el);if(!channels){channels=new Map();active.set(el,channels);}
  channels.get(channel)?.cancel();
  const animation=el.animate(frames,{duration,delay,easing:ease,fill,...rest});channels.set(channel,animation);onAnimation?.(animation);
  return animation.finished.catch(()=>{}).finally(()=>{if(channels.get(channel)===animation){channels.delete(channel);if(!retain)animation.cancel();if(!channels.size)active.delete(el);}});
 }
 function dispose(){for(const channels of active.values())for(const a of channels.values())a.cancel();active.clear();for(const p of projections)p.remove();projections.clear();}
 function conceal(el){let lease=hidden.get(el);if(!lease){lease={count:0,visibility:el.style.visibility};hidden.set(el,lease);}lease.count++;el.style.visibility='hidden';return ()=>{if(--lease.count===0){el.style.visibility=lease.visibility;hidden.delete(el);}};}
 function snapshot(el,extra={},deep=true){
  const box=rect(el);if(!box)return null;
  const computed=style(el),styles=Object.fromEntries(styleKeys.map(key=>[key,computed[key]]));
  const clone=el.cloneNode(deep);const originals=deep?[...el.querySelectorAll('*')]:[],copies=[...clone.querySelectorAll('*')];originals.forEach((original,i)=>{if(active.has(original))copies[i].style.transform=style(original).transform;});for(const n of [clone,...clone.querySelectorAll('*')])for(const attr of ['id','data-motion-surface','data-motion-round','data-round','data-edit-round'])n.removeAttribute(attr);
  clone.querySelectorAll('input').forEach((n,i)=>{const original=el.querySelectorAll('input')[i];n.value=original.value;n.setAttribute('value',original.value);});
  const scroll=[el,...originals].map((node,index)=>({index,top:node.scrollTop||0,left:node.scrollLeft||0})).filter(p=>p.top||p.left);
  return {box,clone,styles,scroll,...extra};
 }
 function content(snap){
  const el=snap.clone.cloneNode(true);el.inert=true;el.setAttribute('aria-hidden','true');
  Object.assign(el.style,snap.styles,{position:'absolute',inset:'auto',left:'0',top:'0',margin:'0',width:`${snap.box.width}px`,minWidth:'0',maxWidth:'none',height:`${snap.box.height}px`,minHeight:'0',maxHeight:'none',boxSizing:'border-box',background:'transparent',border:'0',boxShadow:'none',transform:'none',visibility:'visible',pointerEvents:'none'});
  el._setupScroll=snap.scroll||[];return el;
 }
 function restoreScroll(el){const nodes=[el,...el.querySelectorAll('*')];for(const p of el._setupScroll||[]){if(nodes[p.index]){nodes[p.index].scrollTop=p.top;nodes[p.index].scrollLeft=p.left;}}}
 function project(snap,base=root.getBoundingClientRect()){
  const el=document.createElement('div');
  el.className='nu-motion-projection';el.inert=true;el.setAttribute('aria-hidden','true');
  Object.assign(el.style,{position:'absolute',left:`${snap.box.left-base.left}px`,top:`${snap.box.top-base.top}px`,width:`${snap.box.width}px`,height:`${snap.box.height}px`,borderRadius:`${snap.box.borderRadius}px`,background:snap.styles.background,border:snap.styles.border,boxShadow:snap.styles.boxShadow,color:snap.styles.color,overflow:'hidden',pointerEvents:'none',zIndex:snap.layer|| (snap.clone.classList.contains('nu-toast')?'45':'25'),boxSizing:'border-box'});
  root.append(el);projections.add(el);return el;
 }
 const local=box=>{const base=root.getBoundingClientRect();return {left:box.left-base.left,top:box.top-base.top,width:box.width,height:box.height,borderRadius:box.borderRadius??0};};
 async function morph(source,target,{duration=520,delay=0,fromBox=null,reverse=false,hold=null,omit=[],quick=false,paintTarget=false}={}){
  if(reduced()||!source)return;const dest=snapshot(target);if(!dest)return;for(const selector of omit)dest.clone.querySelectorAll(selector).forEach(el=>el.style.visibility='hidden');
  const bridge=project({...source,styles:{...source.styles,background:source.styles.backgroundColor||source.styles.background}}),old=content(source),fresh=content(dest),reveal=conceal(target);
  let paint=null;if(paintTarget){paint=document.createElement('div');Object.assign(paint.style,{position:'absolute',inset:'0',background:dest.styles.background,borderRadius:'inherit',pointerEvents:'none'});bridge.append(paint);}bridge.append(old,fresh);restoreScroll(old);restoreScroll(fresh);
  // New labels unfold inside the same material instead of arriving on the page.
  const direction=reverse?-1:1;
  try{await Promise.all([
   ...(paint?[play(paint,[{opacity:0},{opacity:1}],{duration,delay,retain:true})]:[]),
   play(bridge,setupGeometryFrames(local(fromBox||source.box),local(dest.box),{quick}),{duration,delay,easing:'linear',retain:!!hold}),
   play(bridge,[{backgroundColor:source.styles.backgroundColor||source.styles.background,borderColor:source.styles.borderColor,borderWidth:source.styles.borderWidth},{backgroundColor:dest.styles.backgroundColor||dest.styles.background,borderColor:dest.styles.borderColor,borderWidth:dest.styles.borderWidth}],{duration,delay,channel:'color',retain:true}),
   play(old,[{transform:'translateY(0)'},{transform:`translateY(${-direction*source.box.height}px)`}],{duration:Math.min(duration,240),delay,retain:true}),
   play(fresh,[{transform:`translateY(${direction*dest.box.height}px)`},{transform:'translateY(0)'}],{duration:Math.max(180,duration-100),delay:delay+80,retain:true}),
  ]);}finally{const cleanup=()=>{bridge.remove();projections.delete(bridge);reveal();};if(hold)hold(cleanup);else cleanup();}
 }
 async function unfold(target,owner,side='top',duration=360,{delay=0,hold=null,layer=null}={}){
  if(reduced())return;const dest=snapshot(target);if(!dest)return;
  const sourceBox=owner?.box||(Number.isFinite(owner?.left)?owner:dest.box);
  // A new panel opens at an existing edge; its contents keep their real size.
  const start=side==='left'||side==='right'?{...dest.box,left:side==='left'?sourceBox.left:sourceBox.left+sourceBox.width,width:1}:{...dest.box,top:side==='top'?sourceBox.top:sourceBox.top+sourceBox.height,height:1};
  const empty={...dest,box:start,...(layer?{layer}:{})},bridge=project(empty),fresh=content(dest),reveal=conceal(target);
  bridge.append(fresh);restoreScroll(fresh);
  try{await play(bridge,setupGeometryFrames(local(start),local(dest.box),{quick:!!hold}),{duration,delay,easing:'linear',retain:!!hold});}finally{const cleanup=()=>{bridge.remove();projections.delete(bridge);reveal();};if(hold)hold(cleanup);else cleanup();}
 }
 async function retire(snap,owner,side='top',duration=240){
  if(!snap||reduced())return;
  const bridge=project(snap),view=content(snap);bridge.append(view);restoreScroll(view);const target=owner?.box||(Number.isFinite(owner?.left)?owner:snap.box);
  const end=side==='point'?point(target):edge({...snap.box,...(side==='left'?{left:target.left}:side==='right'?{left:target.left+target.width}:side==='bottom'?{top:target.top+target.height}:{top:target.top})},side);
  try{await play(bridge,setupGeometryFrames(local(snap.box),local(end)),{duration,easing:'linear'});}finally{bridge.remove();projections.delete(bridge);}
 }
 function flip(el,before,duration=340){
  if(!el||reduced())return Promise.resolve();active.get(el)?.get('layout')?.cancel();
  const after=rect(el);if(!before||!after||reduced())return Promise.resolve();
  const dx=before.left-after.left,dy=before.top-after.top,sx=before.width/after.width,sy=before.height/after.height;
  if(Math.abs(dx)+Math.abs(dy)+Math.abs(sx-1)+Math.abs(sy-1)<.02)return Promise.resolve();
  const base=style(el).transform==='none'?'':style(el).transform;
  const frames=Array.from({length:40},(_,i)=>{const p=1-setupSpring(i/39);return {offset:i/39,transformOrigin:'left top',transform:`translate(${dx*p}px,${dy*p}px) scale(${1+(sx-1)*p},${1+(sy-1)*p}) ${base}`};});
  return play(el,frames,{duration,easing:'linear'});
 }
 function capture(){
  const map=new Map();
  const add=(key,el,extra)=>{const s=snapshot(el,extra);if(s)map.set(key,s);};
  add('surface',root.querySelector('[data-motion-surface]'),{surface:true});
  add('title',root.querySelector('#nu-heading:not([hidden]) h1, .nu-celebration h1'));
  add('identity',root.querySelector('#nu-pack-name, .nu-ready-name'));
  add('star',root.querySelector('.nu-board-signature>b, .nu-ready-mark'));
  add('settings',root.querySelector('.nu-settings'));add('roundbar',root.querySelector('.nu-roundbar'));
  add('progress',root.querySelector('[data-step="1"]'));add('summary',root.querySelector('.nu-ready-summary'));
  add('diagram',root.querySelector('.nu-round-diagram'));add('warning',root.querySelector('.nu-replace-note'));add('help',root.querySelector('.nu-help'));
  root.querySelectorAll('[data-motion-round]').forEach(el=>add('round:'+el.dataset.motionRound,el,{round:el.dataset.motionRound,surface:el.hasAttribute('data-motion-surface'),label:snapshot(el.querySelector('.nu-diagram-name'))}));
  root.querySelectorAll('[data-round]').forEach(el=>add('tab:'+el.dataset.round,el));
  return map;
 }
 function targets(){
  const result=new Map();
  const add=(key,el,extra={})=>{if(rect(el))result.set(key,{el,...extra});};
  add('surface',root.querySelector('[data-motion-surface]'),{surface:true});
  add('title',root.querySelector('#nu-heading:not([hidden]) h1, .nu-celebration h1'));
  add('identity',root.querySelector('#nu-pack-name, .nu-ready-name'));
  add('star',root.querySelector('.nu-board-signature>b, .nu-ready-mark'));
  for(const [key,selector]of Object.entries({settings:'.nu-settings',roundbar:'.nu-roundbar',summary:'.nu-ready-summary',diagram:'.nu-round-diagram',warning:'.nu-replace-note',help:'.nu-help'}))add(key,root.querySelector(selector));
  root.querySelectorAll('[data-motion-round]').forEach(el=>add('round:'+el.dataset.motionRound,el,{round:el.dataset.motionRound,surface:el.hasAttribute('data-motion-surface')}));
  root.querySelectorAll('[data-round]').forEach(el=>add('tab:'+el.dataset.round,el));
  return result;
 }
 async function stage(stage,render,direction,origin=null){
  dispose();if(reduced()){transaction++;try{render();}finally{transaction--;}return;}
  const before=capture(),action=root.querySelector('#nu-next'),actionBox=rect(action),backBox=rect(root.querySelector('#nu-back'));
  transaction++;try{render();}finally{transaction--;}
  const after=targets(),tasks=[],handled=new Set(),toSummary=!!root.querySelector('.nu-celebration');
  const surface=after.get('surface');
  if(surface&&before.get('surface')){const old=before.get('surface');if(after.get('star')&&!surface.el.contains(after.get('star').el))old.clone.querySelector('.nu-board-signature>b')?.style.setProperty('visibility','hidden');if(after.get('identity')&&!surface.el.contains(after.get('identity').el))old.clone.querySelector('[data-key="name"]')?.style.setProperty('visibility','hidden');tasks.push(morph(before.get('surface'),surface.el,{reverse:direction<0}));handled.add(surface.el);}
  // On the review each round has its own ancestry: the selected board or its tab.
  for(const link of setupStageSources(before,after)){
   const {key,target,source}=link;if(handled.has(target.el)||[...handled].some(el=>el.contains(target.el))||['surface','diagram','progress'].includes(key))continue;
   if(key.startsWith('round:')||key.startsWith('tab:')){
    const roundSource=key.startsWith('tab:')?before.get(key.replace('tab:','round:')):null;
    const ancestry=source||roundSource?.label||roundSource||(origin?{...snapshot(target.el),box:{left:origin.left,top:origin.top,width:origin.width,height:origin.height,borderRadius:origin.borderRadius??15}}:before.get('progress')||before.get('surface'));
    if(ancestry){tasks.push(morph(ancestry,target.el,{duration:toSummary?500:440,reverse:direction<0}));handled.add(target.el);}
   }else if(key==='settings'){
    tasks.push(unfold(target.el,before.get('surface')||{box:rect(target.el)},'left',460));handled.add(target.el);
   }else if(key==='roundbar'){
    const bar=target.el,plus=bar.querySelector('[data-add-menu]');if(plus)tasks.push(unfold(plus,before.get('progress'),'bottom',340));
   }else if(source){
    tasks.push(morph(source,target.el,{duration:key==='star'?480:360,reverse:direction<0}));handled.add(target.el);
   }else{
    const owner=link.owner?.el?{box:rect(link.owner.el)}:link.owner;
    tasks.push(unfold(target.el,owner||after.get('surface')?.el&&{box:rect(after.get('surface').el)}||before.get('title'),'bottom',360));handled.add(target.el);
   }
  }
  for(const key of ['settings','roundbar','help','summary','warning'])if(before.has(key)&&!after.has(key)){const snap=before.get(key);if(key==='roundbar')snap.clone.querySelectorAll('.nu-round-tabs>button').forEach(el=>el.style.visibility='hidden');tasks.push(retire(snap,after.get('surface')?.el?rect(after.get('surface').el):before.get('surface'),'top'));}
  tasks.push(flip(action,actionBox,480));
  if(backBox)tasks.push(flip(root.querySelector('#nu-back'),backBox));
  await Promise.all(tasks);
 }
 // Every board has the same stable round ID on the structure and review.
 // Measure both scenes first, then animate whole cards rather than cells.
 async function review(render,direction){
  dispose();if(reduced()){transaction++;try{render();}finally{transaction--;}return;}
  const forward=direction>0,base=root.getBoundingClientRect(),savedInert=root.inert||false,cleanup=[],tasks=[],runs=[];
  const take=el=>{const snap=snapshot(el);if(!snap)return null;const css=style(el),opacity=Number.parseFloat(css.opacity);return {...snap,el,opacity:Number.isFinite(opacity)?opacity:1,filter:css.filter||'none',transform:css.transform||'none',nativeWidth:Number.parseFloat(css.width)||snap.box.width,nativeHeight:Number.parseFloat(css.height)||snap.box.height};};
  const read=summary=>{
   const cards=new Map([...root.querySelectorAll(summary?'[data-edit-round]':'[data-board-round]')].map(el=>[String(summary?el.dataset.editRound:el.dataset.boardRound),take(el)]).filter(([,s])=>s));
   return {cards,clip:rect(root.querySelector(summary?'.nu-round-diagram':'.nu-canvas')),title:take(root.querySelector(summary?'.nu-celebration h1':'#nu-title')),subtitle:take(root.querySelector(summary?'.nu-ready-name':'#nu-subtitle')),panels:['.nu-settings','.nu-roundbar','.nu-help'].map(sel=>take(root.querySelector(sel))).filter(Boolean),extras:['.nu-ready-summary','.nu-replace-note'].map(sel=>take(root.querySelector(sel))).filter(Boolean),next:take(root.querySelector('#nu-next')),back:take(root.querySelector('#nu-back'))};
  };
  const before=read(!forward);
  root.inert=true;
  try{
   root.classList.add('nu-review-settling');
   transaction++;try{render();}finally{transaction--;}
   const after=read(forward);
   const clip=(box,bounds)=>{if(!bounds)return 'inset(0px 0px 0px 0px)';return `inset(${Math.max(0,bounds.top-box.top)}px ${Math.max(0,box.left+box.width-bounds.left-bounds.width)}px ${Math.max(0,box.top+box.height-bounds.top-bounds.height)}px ${Math.max(0,bounds.left-box.left)}px)`;};
   const options={duration:560,easing:'cubic-bezier(.12,1,.2,1)',retain:true,onAnimation:a=>runs.push(a)};
   const hold=el=>cleanup.push(conceal(el));
   const mount=(snap,layer)=>{const bridge=project({...snap,layer:String(layer)},base);cleanup.push(()=>{bridge.remove();projections.delete(bridge);});return bridge;};
   const pair=(source,dest,{card=false,fromClip=null,toClip=null,index=0,id=null}={})=>{
    if(!source||!dest)return;
    const bridge=mount(dest,card?40-index:60);bridge.className+=' nu-review-projection'+(card?' nu-board-deck':'');if(card)bridge.setAttribute('data-review-round',id);
    Object.assign(bridge.style,{transformOrigin:'0 0',background:source.styles.background});
    const old=content({...source,box:{...source.box,width:source.nativeWidth,height:source.nativeHeight}}),fresh=card?null:content({...dest,box:{...dest.box,width:dest.nativeWidth,height:dest.nativeHeight}});
    Object.assign(old.style,{transformOrigin:'0 0',transform:`scale(${dest.box.width/source.nativeWidth},${dest.box.height/source.nativeHeight})`,opacity:'1',filter:'none'});
    if(card){
     // Animate the REAL destination. Its native border, padding, grid and scroll
     // are the final image, so there is no clone-to-DOM handoff at the endpoint.
     bridge.append(old);bridge.style.border='0';bridge.style.boxShadow=source.styles.boxShadow;old.style.border=source.styles.border;
    }else{
     Object.assign(fresh.style,{transformOrigin:'0 0',transform:`scale(${dest.box.width/dest.nativeWidth},${dest.box.height/dest.nativeHeight})`,opacity:'1',filter:'none'});bridge.append(old,fresh);restoreScroll(fresh);hold(dest.el);
    }
    restoreScroll(old);
    const from={...source.box};
    if(card&&source.opacity<.02&&forward){
     const owner=[...before.cards.values()].find(s=>s.el.hasAttribute('data-motion-surface'))||source;
     from.width=owner.box.width*.82;from.height=owner.box.height*.82;from.left=owner.box.left+(owner.box.width-from.width)/2;from.top=owner.box.top+(owner.box.height-from.height)/2+24;
    }
    const transform=`translate(${from.left-dest.box.left}px,${from.top-dest.box.top}px) scale(${from.width/dest.box.width},${from.height/dest.box.height})`;
    tasks.push(play(bridge,[{transform,opacity:card?source.opacity:1,filter:card?source.filter:'none'},{offset:.2,opacity:card?Math.max(source.opacity,.65):1},{transform:'none',opacity:card?0:1,filter:card?dest.filter:'none'}],options));
    if(card){
     // Keep the element's original transform origin and final CSS matrix.
     // Compensate the matrix translation when applying the outer FLIP scale.
     const matrix=dest.transform.match(/^matrix(3d)?\((.*)\)$/),values=matrix?matrix[2].split(',').map(Number):[],mx=values[matrix?.[1]?12:4]||0,my=values[matrix?.[1]?13:5]||0;
     const sx=from.width/dest.box.width,sy=from.height/dest.box.height;
     const dx=from.left+from.width/2-dest.box.left-dest.box.width/2-(sx-1)*mx,dy=from.top+from.height/2-dest.box.top-dest.box.height/2-(sy-1)*my;
     const start=`translate(${dx}px,${dy}px) scale(${sx},${sy}) ${dest.transform==='none'?'':dest.transform}`.trim();
     tasks.push(play(dest.el,[{transform:start,filter:source.filter},{transform:dest.transform,filter:dest.filter}],{...options,channel:'review-position'}));
     tasks.push(play(dest.el,[{opacity:0},{offset:.18,opacity:0},{offset:.66,opacity:dest.opacity},{opacity:dest.opacity}],{...options,channel:'review-reveal'}));
    }
    tasks.push(play(bridge,[{background:source.styles.background,borderColor:source.styles.borderColor,borderRadius:`${source.box.borderRadius*dest.box.width/source.nativeWidth}px`},{background:dest.styles.background,borderColor:dest.styles.borderColor,borderRadius:`${dest.box.borderRadius*dest.box.width/dest.nativeWidth}px`}],{...options,channel:'paint'}));
    // Scale each clipping inset into the destination-sized projection. This
    // preserves the old canvas crop and the review's horizontal scroll crop.
    const scaled={left:0,top:0,width:dest.box.width,height:dest.box.height},sourceBounds=fromClip?{left:(fromClip.left-from.left)*dest.box.width/from.width,top:(fromClip.top-from.top)*dest.box.height/from.height,width:fromClip.width*dest.box.width/from.width,height:fromClip.height*dest.box.height/from.height}:null;
    if(card)tasks.push(play(bridge,[{clipPath:clip(scaled,sourceBounds)},{clipPath:clip(dest.box,toClip)}],{...options,channel:'crop'}));
    tasks.push(play(old,[{opacity:1},{offset:.18,opacity:1},{offset:.66,opacity:0},{opacity:0}],{...options,channel:'old'}));
    if(fresh)tasks.push(play(fresh,[{opacity:0},{offset:.18,opacity:0},{offset:.66,opacity:1},{opacity:1}],{...options,channel:'fresh'}));
   };
   // Put the active board above the rear cards throughout the shared flight.
   const ordered=[...after.cards.entries()].sort(([,a],[,b])=>Number(b.el.hasAttribute('data-motion-surface'))-Number(a.el.hasAttribute('data-motion-surface')));
   ordered.forEach(([id,dest],index)=>pair(before.cards.get(id),dest,{card:true,fromClip:before.clip,toClip:after.clip,index,id}));
   pair(before.title,after.title);pair(before.subtitle,after.subtitle);pair(before.next,after.next);pair(before.back,after.back);
   for(const snap of forward?before.panels:after.panels){
    const bridge=mount(snap,25),view=content(snap);bridge.append(view);restoreScroll(view);
    const outside=`translateX(${base.left-snap.box.left-snap.box.width-40}px)`;
    if(!forward)hold(snap.el);
    tasks.push(play(bridge,forward?[{transform:'translateX(0)'},{transform:outside}]:[{transform:outside},{transform:'translateX(0)'}],options));
   }
   for(const snap of forward?after.extras:before.extras){
    const bridge=mount(snap,30),view=content(snap);bridge.append(view);restoreScroll(view);if(forward)hold(snap.el);
    tasks.push(play(bridge,forward?[{transform:'translateY(-24px)',opacity:0},{transform:'none',opacity:1}]:[{transform:'none',opacity:1},{transform:'translateY(-24px)',opacity:0}],options));
   }
   await Promise.all(tasks);
  }finally{for(const a of runs)a.cancel();cleanup.reverse().forEach(fn=>fn());root.classList.remove('nu-review-settling');root.inert=savedInert;}
 }
 // About/structure use two whole pages, with no shared-element morphs.
 async function page(stage,render,direction,{includeOverlay=false,finish=()=>{},duration=480,easing='cubic-bezier(.08,1,.16,1)',continueWith=null,overlap=0}={}){
  dispose();
  if(reduced()){transaction++;try{render();}finally{transaction--;finish();}return continueWith?.();}
  const main=root.querySelector('.nu-main')||stage,base=root.getBoundingClientRect(),before=snapshot(main),menu=root.querySelector('#nu-exit'),menuBox=rect(menu);
  const overlay=includeOverlay?root.querySelector('.nu-overlay'):null,dialog=overlay&&!overlay.hidden?snapshot(overlay):null;
  // Snapshot IDs are removed. Small class aliases preserve the few ID-based
  // layout rules without introducing duplicate IDs or interactive controls.
  if(before){const originals=[main,...main.querySelectorAll('*')],copies=[before.clone,...before.clone.querySelectorAll('*')];originals.forEach((el,i)=>{for(const id of ['nu-stage','nu-next','nu-note','nu-back','nu-heading'])if(el.matches('#'+id))copies[i].classList.add('nu-page-'+id);});}
  const savedInert=root.inert||false;let scene=null,settled=false,restoreMenu=()=>{},continuationStarted=false,continuationResult,clockCancelled=false;
  const complete=()=>{if(!settled){settled=true;finish();}};
  root.inert=true;
  try{
   transaction++;try{render();}finally{transaction--;}
   // Transfer modal ownership before playback, while its inert snapshot remains
   // on the departing page. The real destination is animated as one element.
   complete();
   if(!before)return;
   scene=document.createElement('div');scene.className='nu-motion-projection nu-page-scene';scene.inert=true;scene.setAttribute('aria-hidden','true');
   Object.assign(scene.style,{position:'absolute',inset:'0',zIndex:'45',pointerEvents:'none',willChange:'transform'});
   const add=snap=>{const view=content(snap);Object.assign(view.style,{left:`${snap.box.left-base.left}px`,top:`${snap.box.top-base.top}px`});scene.append(view);restoreScroll(view);return view;};
   before.clone.querySelector('.nu-menu-anchor')?.style.setProperty('visibility','hidden');
   const oldMain=add(before);
   let fixedMenu=null;
   if(menu&&menuBox&&main.contains(menu)){
    const parent=menu.parentElement,placeholder=document.createElement('span');
    placeholder.setAttribute('aria-hidden','true');Object.assign(placeholder.style,{display:'block',width:menuBox.width+'px',height:menuBox.height+'px',flexShrink:'0'});
    parent.insertBefore(placeholder,menu);fixedMenu=document.createElement('div');fixedMenu.className='nu-footer-start nu-fixed-menu';
    Object.assign(fixedMenu.style,{position:'absolute',left:menuBox.left-base.left+'px',top:menuBox.top-base.top+'px',width:menuBox.width+'px',height:menuBox.height+'px',zIndex:'70'});
    fixedMenu.append(menu);root.append(fixedMenu);
    restoreMenu=()=>{parent.insertBefore(menu,placeholder);placeholder.remove();fixedMenu.remove();};
   }
   if(dialog){
    // Freeze the old page's blur instead of sampling moving pages every frame.
    oldMain.style.filter='blur(6px)';
    const oldOverlay=add(dialog),backdrop=oldOverlay.querySelector('.nu-backdrop');
    if(backdrop)Object.assign(backdrop.style,{backdropFilter:'none',webkitBackdropFilter:'none'});
   }
   root.append(scene);projections.add(scene);
   const distance=base.width*(direction<0?-1:1),options={duration,easing},mainRest=rect(main);
   // The outgoing page must remain outside after its own animation ends,
   // while the overlapping home flight is still completing.
   scene.style.transform=`translateX(${-distance}px)`;
   const begin=()=>{
    if(clockCancelled)return;
    continuationStarted=true;const current=rect(main),offset=current&&mainRest?{x:current.left-mainRest.left,y:current.top-mainRest.top}:{x:0,y:0};
    return Promise.resolve(continueWith({offset})).then(value=>{continuationResult=value;return value;});
   };
   const handoff=continueWith&&overlap>0?play(scene,[{opacity:1},{opacity:1}],{duration:Math.max(0,duration-Math.min(overlap,duration)),easing:'linear',channel:'handoff-clock',onAnimation:a=>{a.finished.then(()=>{clockCancelled=a.playState==='idle'||a.cancelled===true;},()=>{clockCancelled=true;});}}).then(begin):null;
   await Promise.all([
    play(scene,[{transform:'translateX(0)'},{transform:`translateX(${-distance}px)`}],options),
    play(main,[{transform:`translateX(${distance}px)`},{transform:'translateX(0)'}],options),
    ...(fixedMenu&&dialog?[play(fixedMenu,[{filter:'blur(6px)'},{filter:'blur(0px)'}],options)]:[]),
    ...(handoff?[handoff]:[]),
   ]);
  }finally{if(scene){scene.remove();projections.delete(scene);}restoreMenu();try{complete();}finally{root.inert=savedInert;}}
  // With overlap, both legs have already completed. Otherwise continue now.
  if(continuationStarted)return continuationResult;
  return clockCancelled?undefined:continueWith?.();
 }
 function fromPreset(source,render,finish){return page(root.querySelector('.nu-main'),render,1,{includeOverlay:true,finish});}
 function rollPrice(cell,text){
  const old=priceValues.get(cell)??cell.textContent;if(old===text)return;priceValues.set(cell,text);
  const token={};priceTokens.set(cell,token);
  if(reduced()||transaction){cell.textContent=text;return;}
  const height=cell.getBoundingClientRect().height;if(!priceHeights.has(cell))priceHeights.set(cell,cell.style.height);
  cell.style.height=height+'px';cell.style.position='relative';cell.style.overflow='hidden';cell.textContent='';
  const oldText=document.createElement('span'),newText=document.createElement('span');oldText.textContent=old;newText.textContent=text;
  for(const el of [oldText,newText])Object.assign(el.style,{position:'absolute',inset:'0',display:'grid',placeItems:'center'});
  oldText.setAttribute('aria-hidden','true');cell.append(oldText,newText);
  Promise.all([play(oldText,[{transform:'translateY(0)'},{transform:'translateY(-100%)'}],{duration:200,retain:true}),play(newText,[{transform:'translateY(100%)'},{transform:'none'}],{duration:260,retain:true})]).finally(()=>{if(priceTokens.get(cell)===token){cell.textContent=text;cell.style.height=priceHeights.get(cell)||'';priceHeights.delete(cell);}});
 }
 function tabs(nav,html){
  const template=document.createElement('div');template.innerHTML=html;
  const tabKey=el=>el.dataset.roundId??el.dataset.round??'add';
  const existing=new Map([...nav.children].map(el=>[tabKey(el),el])),positions=new Map([...nav.children].map(el=>[el,rect(el)]));
  const wanted=[...template.children],keep=new Set(wanted.map(tabKey));
  for(const [key,el]of existing)if(!keep.has(key)){const snap=snapshot(el);el.remove();if(!transaction)retire(snap,rect(root.querySelector('[data-add-menu]')),'point');}
  wanted.forEach((fresh,index)=>{const key=tabKey(fresh),el=existing.get(key)||fresh;
   if(existing.has(key)){el.innerHTML=fresh.innerHTML;if(fresh.hasAttribute('data-current'))el.setAttribute('data-current','true');else el.removeAttribute('data-current');if(fresh.hasAttribute('aria-expanded'))el.setAttribute('aria-expanded',fresh.getAttribute('aria-expanded'));if(fresh.hasAttribute('aria-current'))el.setAttribute('aria-current','true');else el.removeAttribute('aria-current');}
   if(nav.children[index]!==el)nav.insertBefore(el,nav.children[index]||null);
   if(!transaction){if(positions.has(el))flip(el,positions.get(el));else unfold(el,{box:rect(root.querySelector('[data-add-menu]'))||rect(el)},'right',320);}
  });
 }
 function board(rows,html){
  const template=document.createElement('div');template.innerHTML=html;
  const container=rows.closest('.nu-gameboard'),containerBefore=rect(container);if(!transaction)active.get(container)?.get('layout')?.cancel();
  const fresh=[...template.children],old=[...rows.children],arriving=[];
  const before=new Map(old.flatMap(row=>[row,...row.lastElementChild.children]).map(el=>[el,rect(el)]));
  for(let i=0;i<Math.max(fresh.length,old.length);i++){
   const source=fresh[i],row=old[i];
   if(!source){const snap=snapshot(row);row.remove();if(!transaction)retire(snap,before.get(row),'top',200);continue;}
   if(!row){rows.append(source);arriving.push([source,'Y']);continue;}
   const grid=row.lastElementChild,newGrid=source.lastElementChild,cells=[...grid.children],wanted=[...newGrid.children];
   grid.style.cssText=newGrid.style.cssText;
   cells.slice(wanted.length).forEach(cell=>{const snap=snapshot(cell);cell.remove();if(!transaction)retire(snap,before.get(cell),'left',200);});
   wanted.forEach((target,j)=>{const cell=cells[j];if(!cell){grid.append(target);arriving.push([target,'X']);}else rollPrice(cell,target.textContent);});
  }
  if(transaction||reduced())return;
  const containerAfter=rect(container),resizing=containerBefore&&containerAfter&&Math.abs(containerAfter.height-containerBefore.height)>.5;
  if(resizing)play(container,[{height:`${containerBefore.height}px`},{height:`${containerAfter.height}px`}],{duration:360});
  const dx=resizing?containerAfter.left-containerBefore.left:0,dy=resizing?containerAfter.top-containerBefore.top:0;
  for(const [el,box]of before)if(el.isConnected&&box)flip(el,{...box,left:box.left+dx,top:box.top+dy},320);
  for(const [el,axis]of arriving)play(el,[{transformOrigin:'left top',transform:`scale${axis}(.01)`},{transformOrigin:'left top',transform:'none'}],{duration:320});
 }
 async function update(stage,mutate,owner){
  if(reduced()){transaction++;try{mutate();}finally{transaction--;}return;}
  const before=capture(),ownerBox=rect(owner);dispose();transaction++;try{mutate();}finally{transaction--;}
  const tasks=[],newSettings=root.querySelector('.nu-settings'),newBoard=root.querySelector('.nu-gameboard[data-motion-surface]')||root.querySelector('.nu-gameboard');
  if(before.get('surface')&&newBoard)tasks.push(morph(before.get('surface'),newBoard,{duration:300}));
  if(before.get('settings')&&newSettings)tasks.push(morph(before.get('settings'),newSettings,{duration:280}));
  const after=targets();for(const [key,target]of after)if(key.startsWith('tab:')){
   const old=before.get(key);if(old)tasks.push(flip(target.el,old.box,340));else tasks.push(unfold(target.el,{box:ownerBox||rect(root.querySelector('[data-add-menu]'))||rect(target.el)},'right',340));
  }
  for(const [key,snap]of before)if(key.startsWith('tab:')&&!after.has(key))tasks.push(retire(snap,rect(root.querySelector('[data-add-menu]')),'point'));
  await Promise.all(tasks);
  if(root.isConnected&&owner&&!owner.isConnected&&document.activeElement===document.body)root.querySelector('.nu-round-tabs [aria-current]')?.focus({preventScroll:true});
 }
 return {
  stage,page,review,fromPreset,tabs,board,update,dispose,
  settingsSlide(el){return play(el,[{transform:'translateX(12px)'},{transform:'translateX(0)'}],{duration:260});},
  anchor:el=>rect(el),
  hide(el,owner){if(reduced()){el.hidden=true;return Promise.resolve();}const snap=snapshot(el);el.hidden=true;return retire(snap,owner?.width?owner:rect(owner),'point',180);},
  enter(stage,origin){if(reduced())return Promise.resolve();const card=stage.querySelector('.nu-about-card'),box=rect(card);if(box)return flip(card,origin||{...box,height:1},480);},
  modal(el,owner){if(reduced())return Promise.resolve();const box=rect(el),origin=rect(owner)||box;modalOwners.set(el,{origin,destination:box,trigger:owner});if(!box||!origin)return Promise.resolve();return flip(el,origin,420);},
  dismiss(el){if(reduced())return Promise.resolve();const stored=modalOwners.get(el),box=active.get(el)?.has('layout')?stored?.destination:rect(el),owner=rect(stored?.trigger)||stored?.origin;if(!box||!owner)return Promise.resolve();return play(el,[{transformOrigin:'left top',transform:style(el).transform},{transformOrigin:'left top',transform:`translate(${owner.left-box.left}px,${owner.top-box.top}px) scale(${owner.width/box.width},${owner.height/box.height})`}],{duration:220});},
  menu(el,owner,show){if(reduced()){el.hidden=!show;return Promise.resolve();}if(show){el.hidden=false;return unfold(el,{box:rect(owner)},'top',250);}const snap=snapshot(el);el.hidden=true;return retire(snap,rect(owner),'point',180);},
  toast(el,owner){if(reduced())return Promise.resolve();return unfold(el,{box:owner?.width?owner:rect(owner)||rect(el)},'bottom',260);},
  language(el,mutate){if(reduced()){mutate();return Promise.resolve();}const thumb=el.querySelector('.nu-language-thumb'),before=rect(thumb);mutate();return flip(thumb,before,340);}
 };
}
