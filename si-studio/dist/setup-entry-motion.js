import {setupGeometryFrames} from './setup-motion.js';

// Keep the real home scene: its artwork, layout and draft never become an
// approximation made from unrelated snapshots. It is also the return address.
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const box=el=>{const b=el.getBoundingClientRect();return {left:b.left,top:b.top,width:b.width,height:b.height,borderRadius:parseFloat(getComputedStyle(el).borderTopLeftRadius)||0};};
const scrub=clone=>{for(const el of [clone,...clone.querySelectorAll('*')])for(const key of ['id','for','autofocus','data-action','data-motion-surface','data-motion-round'])el.removeAttribute(key);clone.inert=true;clone.setAttribute('aria-hidden','true');return clone;};
function styledClone(el){const clone=el.cloneNode(true);[el,...el.querySelectorAll('*')].forEach((original,i)=>{const copy=[clone,...clone.querySelectorAll('*')][i],css=getComputedStyle(original);for(const prop of css)copy.style.setProperty(prop,css.getPropertyValue(prop));copy.style.visibility='visible';});return scrub(clone);}
const revealFrames=[{clipPath:'inset(0 0 100% 0)',transform:'translateY(12px)'},{clipPath:'inset(0 0 0% 0)',transform:'translateY(0)'}];

// Each segment has a position on ONE timeline. Closing reverses the entire
// timeline, including the intervals between elements, rather than inventing
// another spring in the opposite direction.
export function setupEntryTiming(start,duration,total,reverse=false){return {duration,delay:reverse?total-start-duration:start,direction:reverse?'reverse':'normal',fill:'both',easing:'cubic-bezier(.2,.75,.25,1)'};}
// Reverse the path, but give closing its own deceleration. Replaying an
// ease-out animation with direction:reverse would instead accelerate at exit.
export function setupClosingFrames(frames,geometry=false){
 if(geometry){const from=frames.at(-1),to=frames[0];return Array.from({length:49},(_,i)=>{const t=i/48,p=1-(1-t)**3,frame={offset:t};for(const key of ['left','top','width','height','borderRadius'])frame[key]=`${parseFloat(from[key])+(parseFloat(to[key])-parseFloat(from[key]))*p}px`;return frame;});}
 return [...frames].reverse().map((frame,i)=>({...frame,offset:frame.offset===undefined?i/(frames.length-1):1-frame.offset}));
}
export function setupLanguageFrames(author,language){const start=author.left+author.width-language.left-language.width,travel=-start,clear=travel>0?Math.min(.99,language.width/travel):1;return [{offset:0,transform:`translateX(${start}px)`,clipPath:'inset(0 0 0 100%)'},{offset:clear,transform:`translateX(${start*(1-clear)}px)`,clipPath:'inset(0 0 0 0%)'},{offset:1,transform:'translateX(0px)',clipPath:'inset(0 0 0 0%)'}];}
function timeline(total,reverse,scale=1){const running=[];return {
 add(el,frames,start,duration,linear=false){if(!el)return;const timing=setupEntryTiming(start,duration,total,reverse);timing.duration*=scale;timing.delay*=scale;const animation=el.animate(reverse?setupClosingFrames(frames,linear):frames,{...timing,direction:'normal',...(linear?{easing:'linear'}:reverse?{easing:'cubic-bezier(.16,1,.3,1)'}:{})});running.push(animation);},
 async finish(){try{await Promise.all(running.map(a=>a.finished.catch(()=>{})));}finally{running.forEach(a=>a.cancel());}}
};}

export function captureSetupHome(home){
 if(!home)return null;
 // Finish the initial welcome entrance, so it cannot restart after reparenting.
 home.getAnimations({subtree:true}).forEach(a=>{try{a.finish();}catch{a.cancel();}});
 home.dataset.setupReturn='';
 const layer=document.createElement('div');layer.className='nu-home-layer at-home';layer.inert=true;layer.setAttribute('aria-hidden','true');
 document.body.append(layer);layer.append(home);
 return {home,layer};
}

function material(root,source,target,{duration=560,paintStart=100,paintDuration=360}={}){
 const base=box(root),from=box(source),to=box(target),sourceCSS=getComputedStyle(source),targetCSS=getComputedStyle(target);
 const local=b=>({...b,left:b.left-base.left,top:b.top-base.top});
 const layer=document.createElement('div');layer.className='nu-flight-layer';layer.inert=true;layer.setAttribute('aria-hidden','true');root.append(layer);
 const shell=document.createElement('div');shell.className='nu-flight-shell';
 Object.assign(shell.style,{background:sourceCSS.background,border:sourceCSS.border,borderStyle:'solid',boxShadow:sourceCSS.boxShadow});layer.append(shell);
 const paint=document.createElement('div');paint.className='nu-flight-paint';paint.style.background=targetCSS.background;shell.append(paint);
 // Native wizard styles are kept in their original #sm-flow scope. Only the
 // small shared title/icon get inline styles; the form is never stretched.
 const content=scrub(target.cloneNode(true));content.classList.add('nu-flight-content');
 Object.assign(content.style,{position:'absolute',left:-(parseFloat(targetCSS.borderLeftWidth)||0)+'px',top:-(parseFloat(targetCSS.borderTopWidth)||0)+'px',width:to.width+'px',height:to.height+'px',minWidth:'0',maxWidth:'none',minHeight:'0',maxHeight:'none',margin:'0',visibility:'visible',background:'transparent',borderColor:'transparent',boxShadow:'none'});
 const originals=target.querySelectorAll('input'),copies=content.querySelectorAll('input');copies.forEach((input,i)=>{input.value=originals[i].value;input.setAttribute('value',originals[i].value);});
 shell.append(content);
 const visibility=target.style.visibility;target.style.visibility='hidden';
 return {content,layer,shell,
 animate(t){t.add(shell,setupGeometryFrames(local(from),local(to)),0,duration,true);t.add(shell,[{borderWidth:sourceCSS.borderWidth,borderColor:sourceCSS.borderColor,boxShadow:sourceCSS.boxShadow},{borderWidth:targetCSS.borderWidth,borderColor:targetCSS.borderColor,boxShadow:targetCSS.boxShadow}],0,duration);t.add(paint,[{opacity:0},{opacity:1}],paintStart,paintDuration);},
 cleanup(){target.style.visibility=visibility;layer.remove();}
 };
}

// Text changes meaning while retaining a single moving position. Neither
// source label is added to the finished card as another decorative heading.
function labelFlight(root,flight,source,target,selector,t){
 const base=box(root),from=box(source),to=box(target),local=b=>({...b,left:b.left-base.left,top:b.top-base.top});
 const wrapper=document.createElement('div');wrapper.className='nu-label-flight';Object.assign(wrapper.style,{position:'absolute',pointerEvents:'none',zIndex:'3'});flight.layer.append(wrapper);
 const old=styledClone(source),fresh=styledClone(target);
 for(const el of [old,fresh])Object.assign(el.style,{position:'absolute',left:'0',top:'0',margin:'0',width:'100%',minWidth:'0',whiteSpace:'nowrap',transform:'none'});
 wrapper.append(old,fresh);flight.content.querySelector(selector).style.visibility='hidden';
 t.add(wrapper,setupGeometryFrames(local(from),local(to)),0,400,true);
 t.add(old,[{opacity:1},{offset:.25,opacity:.8},{offset:.7,opacity:0},{opacity:0}],0,400);
 t.add(fresh,[{opacity:0},{offset:.2,opacity:0},{offset:.75,opacity:1},{opacity:1}],0,400);
}

// One [+] surface branches into both real input rectangles. Text is revealed
// inside the expanding fields at its native size, without stretching glyphs.
function inputFlight(root,flight,source,targets,t){
 const base=box(root),from=box(source),local=b=>({...b,left:b.left-base.left,top:b.top-base.top}),originCSS=getComputedStyle(source);
 targets.forEach(([target,selector],index)=>{
  const dest=box(target),css=getComputedStyle(target),shape=document.createElement('div');shape.className='nu-input-flight';
  Object.assign(shape.style,{position:'absolute',zIndex:'1',overflow:'hidden',boxSizing:'border-box',borderStyle:'solid',borderWidth:css.borderWidth});flight.layer.append(shape);
  const input=styledClone(target);Object.assign(input.style,{position:'absolute',left:-(parseFloat(css.borderLeftWidth)||0)+'px',top:-(parseFloat(css.borderTopWidth)||0)+'px',width:dest.width+'px',height:dest.height+'px',margin:'0',minWidth:'0',background:'transparent',borderColor:'transparent',boxShadow:'none',transform:'none'});input.value=target.value;shape.append(input);
  flight.content.querySelector(selector).style.visibility='hidden';
  t.add(shape,setupGeometryFrames(local(from),local(dest)),0,400,true);
  t.add(shape,[{backgroundColor:originCSS.backgroundColor,borderColor:originCSS.borderColor,boxShadow:'none'},{backgroundColor:css.backgroundColor,borderColor:css.borderColor,boxShadow:css.boxShadow}],0,400);
  if(index)t.add(shape,[{opacity:0},{offset:.3,opacity:1},{opacity:1}],0,400);
  t.add(input,[{opacity:0},{offset:.25,opacity:0},{opacity:1}],0,400);
 });
 const plus=styledClone(source);Object.assign(plus.style,{position:'absolute',zIndex:'2',left:from.left-base.left+'px',top:from.top-base.top+'px',width:from.width+'px',height:from.height+'px',background:'transparent',borderColor:'transparent',boxShadow:'none',margin:'0',transform:'none'});flight.layer.append(plus);
 const dest=box(targets[0][0]);t.add(plus,[{transform:'translate(0,0)',opacity:1},{transform:`translate(${(dest.left-from.left)*.55}px,${(dest.top-from.top)*.55}px)`,opacity:0}],0,200);
}

export function setupEdgeFrames(rect,viewport,side){const left=viewport.left||0,top=viewport.top||0,x=side==='left'?left-rect.left-rect.width-16:side==='right'?left+viewport.width-rect.left+16:0,y=side==='top'?top-rect.top-rect.height-16:side==='bottom'?top+viewport.height-rect.top+16:0;return [{transform:`translate(${x}px,${y}px)`},{transform:'translate(0,0)'}];}

export function createSetupEntrance(root,scene){
 let disposed=false;
 async function run(reverse,{duration=420,incomingOffset=null}={}){
  if(!scene)return;
  if(reduced()){scene.layer.hidden=!reverse;return;}
  const {home,layer}=scene;layer.hidden=false;
  const button=home.querySelector('.welcome-create'),card=root.querySelector('.nu-about-card');if(!button||!card)return;
  const sourceTitle=button.querySelector('h2'),sourceIcon=button.querySelector('.welcome-action-icon'),sourcePrompt=button.querySelector('p'),sourceLogo=home.querySelector('.brand-logo');
  const flight=material(root,button,card,{duration:420,paintStart:0,paintDuration:320});
  const background=document.createElement('div');background.className='nu-entry-background';background.style.background=getComputedStyle(root).background;root.prepend(background);
  const originalBackground=root.style.background;root.style.background='transparent';root.classList.add('nu-entry-running');root.inert=true;
  const t=timeline(420,reverse,duration/420);flight.animate(t);
  labelFlight(root,flight,sourceTitle,card.querySelector('.nu-name-label'),'.nu-name-label',t);
  labelFlight(root,flight,sourcePrompt,card.querySelector('.nu-author-label'),'.nu-author-label',t);
  inputFlight(root,flight,sourceIcon,[[card.querySelector('.nu-name-input'),'.nu-name-input'],[card.querySelector('.nu-author-input'),'.nu-author-input']],t);
  const base=box(root),language=card.querySelector('.nu-language-group'),languageBox=box(language),languageCopy=styledClone(language),authorBox=box(card.querySelector('.nu-author-input')),origin=box(sourceIcon);
  // The language control belongs to the moving author field, not its future
  // screen coordinates. Keep it concealed until that field has taken shape.
  const anchor=document.createElement('div');anchor.className='nu-language-anchor';Object.assign(anchor.style,{position:'absolute',zIndex:'0',pointerEvents:'none'});flight.layer.append(anchor);
  const local=b=>({...b,left:b.left-base.left,top:b.top-base.top});
  t.add(anchor,setupGeometryFrames(local(origin),local(authorBox)),0,400,true);
  Object.assign(languageCopy.style,{position:'absolute',left:`calc(100% + ${languageBox.left-authorBox.left-authorBox.width}px)`,top:languageBox.top-authorBox.top+'px',width:languageBox.width+'px',height:languageBox.height+'px',margin:'0',transform:'none'});anchor.append(languageCopy);flight.content.querySelector('.nu-language-group').style.visibility='hidden';
  t.add(languageCopy,setupLanguageFrames(authorBox,languageBox),140,280);
  // The peripheral blocks enter whole, with no clipped or staggered labels.
  for(const [selector,side]of [['.sf-progress','top'],['#nu-heading','left'],['.nu-footer','bottom'],['#nu-storage-note','bottom'],...(reverse&&root.querySelector('.nu-fixed-menu')?[['.nu-fixed-menu','bottom']]:[])]){
   const el=root.querySelector(selector),position=box(el);
   // Native peripheral elements still ride the arriving main for the overlap.
   // Their exit endpoint must use the settled main, not its moving offset.
   if(reverse&&incomingOffset&&root.querySelector('.nu-main')?.contains(el)){position.left-=incomingOffset.x;position.top-=incomingOffset.y;}
   t.add(el,setupEdgeFrames(position,base,side),0,420);
  }
  t.add(home.querySelector('.welcome-main'),[{transform:'translateY(0) scale(1)',opacity:1},{transform:'translateY(-16px) scale(.98)',opacity:0}],0,240);
  t.add(home.querySelector('.welcome-header-note'),[{transform:'translateY(0)',opacity:1},{transform:'translateY(-12px)',opacity:0}],0,240);
  t.add(home.querySelector('.welcome-footer'),[{transform:'translateY(0)',opacity:1},{transform:'translateY(16px)',opacity:0}],0,240);
  t.add(background,[{opacity:0},{opacity:1}],0,320);
  const logo=root.querySelector('.sf-header img'),a=box(sourceLogo),b=box(logo);
  t.add(logo,[{transformOrigin:'left top',transform:`translate(${a.left-b.left}px,${a.top-b.top}px) scale(${a.width/b.width},${a.height/b.height})`},{transformOrigin:'left top',transform:'none'}],0,420);
  const arrow=button.querySelector('.welcome-action-arrow'),copy=styledClone(arrow),arrowBox=box(arrow),buttonBox=box(button);Object.assign(copy.style,{position:'absolute',left:arrowBox.left-buttonBox.left+'px',top:arrowBox.top-buttonBox.top+'px',width:arrowBox.width+'px',height:arrowBox.height+'px',margin:'0',transform:'none'});flight.shell.append(copy);t.add(copy,[{opacity:1},{opacity:0,transform:'translateX(12px)'}],0,160);
  const oldButtonVisibility=button.style.visibility,oldLogoVisibility=sourceLogo.style.visibility;button.style.visibility='hidden';sourceLogo.style.visibility='hidden';
  try{await t.finish();}finally{
   flight.cleanup();background.remove();root.style.background=originalBackground;root.classList.remove('nu-entry-running');root.inert=false;
   button.style.visibility=oldButtonVisibility;sourceLogo.style.visibility=oldLogoVisibility;
   if(!reverse)layer.hidden=true;
  }
 }
 return {open:()=>run(false),async close(options){await run(true,options);return scene?.home||null;},dispose(){if(disposed)return;disposed=true;scene?.layer.remove();}};
}

// Animate the REAL dialog surface. There is no visibility handoff from a
// temporary window to another node at completion (which can leave stale square
// paint under WebKit's blurred backdrop until the next hover repaint).
export function setupDialogFrames(from,to){return Array.from({length:49},(_,i)=>{const t=i/48,p=1-(1-t)**5,frame={offset:t};for(const key of ['left','top','width','height','borderRadius'])frame[key]=`${from[key]+(to[key]-from[key])*p}px`;return frame;});}
export function createSetupDialogMotion(root,modal,overlay,owner){
 const duration=420,ease='cubic-bezier(.1,1,.2,1)',backdrop=overlay.querySelector('.nu-backdrop');let session=null;
 function remember(el,keys){const previous=Object.fromEntries(keys.map(key=>[key,el.style[key]||'']));return ()=>Object.assign(el.style,previous);}
 function release(){const own=session;if(!own)return;session=null;own.runs.forEach(a=>a.cancel());own.backdrop?.cancel();own.label?.remove();[...own.restore].reverse().forEach(fn=>fn());owner.style.visibility=own.visibility;overlay.classList.remove('nu-owned-overlay');}
 function add(own,el,frames,start,time,linear=false){const a=el.animate(frames,{duration:time,delay:start,fill:'both',easing:linear?'linear':ease});own.runs.push(a);return a;}
 function local(rect){const base=box(overlay);return {...rect,left:rect.left-base.left,top:rect.top-base.top};}
 return {
  async open(){
   release();const visibility=owner.style.visibility;owner.style.visibility='hidden';
   const own={visibility,runs:[],restore:[]};session=own;if(reduced())return;
   const target=box(modal),origin=box(owner),css=getComputedStyle(modal),heading=modal.querySelector('.nu-modal-heading'),body=modal.children[1];own.parts=[heading,body];
   own.restore.push(remember(modal,['position','left','top','width','height','maxHeight','minWidth','margin','overflow']));
   const innerWidth=target.width-(parseFloat(css.paddingLeft)||0)-(parseFloat(css.paddingRight)||0)-(parseFloat(css.borderLeftWidth)||0)-(parseFloat(css.borderRightWidth)||0);
   for(const el of own.parts){own.restore.push(remember(el,['width','maxWidth']));Object.assign(el.style,{width:innerWidth+'px',maxWidth:'none'});}
   Object.assign(modal.style,{position:'absolute',left:local(target).left+'px',top:local(target).top+'px',width:target.width+'px',height:target.height+'px',maxHeight:'none',minWidth:'0',margin:'0',overflow:'hidden'});
   overlay.classList.add('nu-owned-overlay');
   const label=styledClone(owner);Object.assign(label.style,{position:'absolute',left:'0',top:'0',width:origin.width+'px',height:origin.height+'px',margin:'0',background:'transparent',borderColor:'transparent',boxShadow:'none',visibility:'visible',transform:'none'});modal.append(label);own.label=label;
   add(own,modal,setupDialogFrames(local(origin),local(target)),0,420,true);
   const sourceCSS=getComputedStyle(owner);
   add(own,modal,[{backgroundColor:sourceCSS.backgroundColor,borderColor:sourceCSS.borderColor,boxShadow:sourceCSS.boxShadow,paddingTop:sourceCSS.paddingTop,paddingRight:sourceCSS.paddingRight,paddingBottom:sourceCSS.paddingBottom,paddingLeft:sourceCSS.paddingLeft},{backgroundColor:css.backgroundColor,borderColor:css.borderColor,boxShadow:css.boxShadow,paddingTop:css.paddingTop,paddingRight:css.paddingRight,paddingBottom:css.paddingBottom,paddingLeft:css.paddingLeft}],0,420);
   add(own,label,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-8px)'}],0,140);
   add(own,heading,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],60,260);
   add(own,body,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],100,320);
   // Fade a separate blurred layer over the sharp scene. Blur and dimming
   // appear together, while the actual window stays fully opaque and crisp.
   own.backdrop=backdrop.animate([{opacity:0},{opacity:1}],{duration:420,fill:'both',easing:'cubic-bezier(.2,0,.2,1)'});
   await Promise.all(own.runs.map(a=>a.finished.catch(()=>{})));
   if(session!==own||own.closing)return;
   own.runs.forEach(a=>a.cancel());own.runs=[];own.label.remove();own.label=null;own.restore.forEach(fn=>fn());own.restore=[];
  },
  async close(){
   const own=session;if(!own)return;own.closing=true;if(reduced()||!own.parts){release();return;}
   // Measure before cancelling: Escape during opening continues from the
   // current real surface, with the same fast-start deceleration as a full exit.
   const current=box(modal),destination=box(owner),parts=own.parts.map(el=>({el,opacity:getComputedStyle(el).opacity,transform:getComputedStyle(el).transform,width:getComputedStyle(el).width}));
   const appearance=getComputedStyle(modal),paint=Object.fromEntries(['backgroundColor','borderColor','boxShadow','paddingTop','paddingRight','paddingBottom','paddingLeft'].map(key=>[key,appearance[key]])),scrim=getComputedStyle(backdrop).opacity||'1',labelOpacity=own.label?getComputedStyle(own.label).opacity:0;
   const oldRuns=own.runs;own.runs=[];oldRuns.forEach(a=>a.cancel());
   own.restore.push(remember(modal,['position','left','top','width','height','maxHeight','margin','overflow']));
   Object.assign(modal.style,{position:'absolute',left:local(current).left+'px',top:local(current).top+'px',width:current.width+'px',height:current.height+'px',maxHeight:'none',margin:'0',overflow:'hidden'});
   const css=getComputedStyle(modal),contentWidth=current.width-(parseFloat(css.paddingLeft)||0)-(parseFloat(css.paddingRight)||0)-(parseFloat(css.borderLeftWidth)||0)-(parseFloat(css.borderRightWidth)||0);
   for(const {el,width}of parts){own.restore.push(remember(el,['width','maxWidth']));Object.assign(el.style,{width:width||contentWidth+'px',maxWidth:'none'});}
   add(own,modal,setupDialogFrames(local(current),local(destination)),0,duration,true);
   const sourceCSS=getComputedStyle(owner);add(own,modal,[paint,{backgroundColor:sourceCSS.backgroundColor,borderColor:sourceCSS.borderColor,boxShadow:sourceCSS.boxShadow,paddingTop:sourceCSS.paddingTop,paddingRight:sourceCSS.paddingRight,paddingBottom:sourceCSS.paddingBottom,paddingLeft:sourceCSS.paddingLeft}],0,duration);
   for(const {el,opacity,transform}of parts)add(own,el,[{opacity,transform},{opacity:0,transform:'translateY(8px)'}],0,180);
   if(!own.label){own.label=styledClone(owner);Object.assign(own.label.style,{position:'absolute',left:'0',top:'0',width:destination.width+'px',height:destination.height+'px',margin:'0',background:'transparent',borderColor:'transparent',boxShadow:'none',visibility:'visible',transform:'none'});modal.append(own.label);}
   add(own,own.label,[{opacity:labelOpacity},{offset:.55,opacity:labelOpacity},{opacity:1}],0,duration);
   own.backdrop?.cancel();own.backdrop=backdrop.animate([{opacity:scrim},{opacity:0}],{duration,fill:'both',easing:'cubic-bezier(.2,0,.2,1)'});
   await Promise.all(own.runs.map(a=>a.finished.catch(()=>{})));if(session===own)release();
  },
  commit:release
 };
}
