const intersects=(a,b)=>a.width>0&&a.height>0&&a.bottom>b.top&&a.top<b.bottom&&a.right>b.left&&a.left<b.right;
const easing='cubic-bezier(.22,.78,.18,1)';

export function gallerySlideDirection(keys,from,to){return Math.sign(keys.indexOf(to)-keys.indexOf(from))||1;}

// Animate the actual picture bounds, excluding object-fit's letterboxing.
export function fittedMediaRect(box,width,height){
 const scale=Math.min(box.width/width,box.height/height),w=width*scale,h=height*scale;
 return {left:box.left+(box.width-w)/2,top:box.top+(box.height-h)/2,width:w,height:h};
}
export function motionRasterSize(width,height,box,dpr=1,pixelLimit=8_000_000){
 const scale=Math.min(1,box.width*dpr/width,box.height*dpr/height,Math.sqrt(pixelLimit/(width*height)));
 return {width:Math.max(1,Math.ceil(width*scale)),height:Math.max(1,Math.ceil(height*scale))};
}

// The flight remains over the destination until a decoded original can replace it.
export function waitForLibraryFrame(element,{timeout=1800}={}){
 let done=false,timer,resolve;
 const promise=new Promise(yes=>{resolve=yes;});
 function finish(){if(done)return;done=true;clearTimeout(timer);for(const type of ['load','loadeddata','error'])element.removeEventListener(type,onReady);resolve();}
 async function onReady(event){
  if(done)return;
  if(event?.type!=='error'&&element.tagName==='IMG'&&element.naturalWidth&&element.decode){try{await element.decode();}catch{/* Keep the captured image until the bounded handoff. */}}
  finish();
 }
 for(const type of ['load','loadeddata','error'])element.addEventListener(type,onReady);
 timer=setTimeout(finish,timeout);
 if(element.tagName==='IMG'?element.complete&&element.naturalWidth>0:element.readyState>=2)onReady();
 return {promise,cancel:finish};
}

function snapshot(source,box,doc,dpr,hero){
 const width=source.naturalWidth||source.videoWidth,height=source.naturalHeight||source.videoHeight;
 if(!width||!height)return null;
 const pixels=motionRasterSize(width,height,box,dpr,hero?8_000_000:1_000_000),canvas=doc.createElement('canvas');
 canvas.width=pixels.width;canvas.height=pixels.height;
 const context=canvas.getContext('2d');if(!context)return null;
 context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
 try{context.drawImage(source,0,0,canvas.width,canvas.height);}catch{return null;}
 canvas.className='library-motion-flight';canvas.setAttribute('aria-hidden','true');
 return {copy:canvas,width,height};
}

export function createLibraryMotion(root,{
 document:doc=globalThis.document,reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches,
 pixelRatio=()=>globalThis.devicePixelRatio||1,waitForFrame=waitForLibraryFrame
}={}){
 let animations=[],overlay=null,hidden=[],waiters=[],flying=[],sliding=null,revision=0;
 function clear(){
  revision++;for(const animation of animations)animation.cancel();animations=[];
  for(const waiter of waiters)waiter.cancel();waiters=[];
  overlay?.remove();overlay=null;flying=[];sliding=null;
  for(const node of hidden)node.style.removeProperty('visibility');hidden=[];
 }
 function track(node,frames,options){const animation=node.animate(frames,options);animations.push(animation);return animation;}
 function capture({expandingKey}={}){
  const viewport=root.querySelector('.library-body')?.getBoundingClientRect();
  // Read the currently painted positions before cancelling an interrupted transition.
  const interrupted=viewport?flying.filter(shot=>shot.copy.isConnected&&intersects(shot.copy.getBoundingClientRect(),viewport)).map(shot=>({...shot,rect:shot.copy.getBoundingClientRect()})):[];
  clear();if(reduceMotion()||!viewport)return [];
  const preview=root.querySelector('.library-preview-media'),bounds=root.getBoundingClientRect(),result=interrupted;
  const captured=new Set(result.map(shot=>shot.key));
  for(const node of root.querySelectorAll('[data-library-key]')){
   if(captured.has(node.dataset.libraryKey))continue;
   if(preview&&node!==preview&&node.dataset.libraryKey===preview.dataset.libraryKey)continue;
   const visual=node.querySelector('.library-thumbnail-image')||node,source=visual.querySelector('img,video');
   if(!source||!intersects(visual.getBoundingClientRect(),viewport))continue;
   const hero=node===preview||node.dataset.libraryKey===expandingKey;
   const rasterBox=hero?bounds:{width:Math.max(320,visual.getBoundingClientRect().width),height:Math.max(240,visual.getBoundingClientRect().height)};
   const shot=snapshot(source,rasterBox,doc,pixelRatio(),hero);if(!shot)continue;
   const box=source.getBoundingClientRect(),rect=fittedMediaRect(box,shot.width,shot.height);
   const corner=Math.abs(rect.width-box.width)<.5&&Math.abs(rect.height-box.height)<.5?(node===preview?10:6):0;
   result.push({...shot,key:node.dataset.libraryKey,id:node.dataset.libraryFile,hero,rect,corner});
  }
  return result;
 }
 function enter(){
  clear();if(reduceMotion())return;
  const body=root.querySelector('.library-body');if(!body)return;
  const animation=track(body,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:240,easing});
  const current=revision;animation.finished.then(()=>{if(revision===current)clear();},()=>{});
 }
 function move(before,{selectedKey,toGallery=false}={}){
  if(!before.length||reduceMotion()){enter();return;}
  const base=root.getBoundingClientRect(),targets=[...root.querySelectorAll('button[data-library-key]')];
  const preview=root.querySelector('.library-preview-media'),current=revision;
  overlay=doc.createElement('div');overlay.className='library-motion-overlay';overlay.setAttribute('aria-hidden','true');root.append(overlay);
  for(const old of before){
   const card=targets.find(node=>node.dataset.libraryKey===old.key)||targets.find(node=>node.dataset.libraryFile===old.id);
   const target=toGallery&&old.key===selectedKey?preview:card;
   const media=target?.querySelector('img,video');if(!media)continue;
   const box=media.getBoundingClientRect();if(!box.width||!box.height)continue;
   const destination=fittedMediaRect(box,old.width,old.height),copy=old.copy;
   // One uniform scale throughout: no separate X/Y scale, no changing aspect ratio.
   Object.assign(copy.style,{width:`${destination.width}px`,height:`${destination.height}px`});
   if(old.hero)copy.classList.add('library-motion-hero');
   overlay.append(copy);flying.push({...old,copy});media.style.visibility='hidden';hidden.push(media);
   const from=`translate3d(${old.rect.left-base.left}px,${old.rect.top-base.top}px,0) scale(${old.rect.width/destination.width})`;
   const to=`translate3d(${destination.left-base.left}px,${destination.top-base.top}px,0) scale(1)`;
   const corner=Math.abs(destination.width-box.width)<.5&&Math.abs(destination.height-box.height)<.5?(target===preview?10:6):0;
   const flight=track(copy,[{transform:from,borderRadius:`${(old.corner||0)/(old.rect.width/destination.width)}px`},{transform:to,borderRadius:`${corner}px`}],{duration:old.hero?540:460,easing,fill:'both'});
   // Do not decode offscreen destinations solely for an animation.
   const visible=intersects(box,root.querySelector('.library-body').getBoundingClientRect());
   const waiter=visible?waitForFrame(media):null;if(waiter)waiters.push(waiter);
   Promise.allSettled([flight.finished,waiter?.promise]).then(async()=>{
    if(current!==revision)return;
    media.style.removeProperty('visibility');
    // Both layers show exactly the same fitted bounds; a short dissolve hides decode/rounding differences.
    const dissolve=track(copy,[{opacity:1},{opacity:0}],{duration:120,easing:'ease-out',fill:'both'});
    await Promise.allSettled([dissolve.finished]);if(current===revision)copy.remove();
   });
  }
  if(!animations.length){enter();return;}
  // Text and surfaces fade in at their final size; they are never scaled with the picture.
  const viewport=root.querySelector('.library-body').getBoundingClientRect();
  for(const node of root.querySelectorAll('.library-file strong,.library-file small,.library-preview-caption,.library-group-title')){
   if(intersects(node.getBoundingClientRect(),viewport))track(node,[{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:200,delay:150,easing,fill:'backwards'});
  }
  const strip=root.querySelector('.library-filmstrip');if(strip)track(strip,[{opacity:0},{opacity:1}],{duration:260,delay:100,easing,fill:'backwards'});
  const flights=[...animations];
  Promise.allSettled([...flights.map(animation=>animation.finished),...waiters.map(waiter=>waiter.promise)]).then(async()=>{
   // Per-image handoffs register their dissolves before this continuation.
   if(current!==revision)return;
   await Promise.allSettled(animations.map(animation=>animation.finished));if(current===revision)clear();
  });
 }
 // A slide uses two sharp, fixed-size pages. Actual media remains in its visible
 // layout position so IntersectionObserver never unloads it halfway through a slide.
 function slide(update,{direction=1}={}){
  const oldMedia=root.querySelector('.library-preview-media'),base=root.getBoundingClientRect();
  const box=oldMedia?.getBoundingClientRect();
  if(!box||reduceMotion()){clear();update();return;}
  let outgoing=null;
  if(sliding){
   // Preserve both partially visible pages when another selection interrupts the gesture.
   const canvas=doc.createElement('canvas');
   // This is a composited viewport, so its backing store must retain screen density.
   const density=Math.min(pixelRatio(),Math.sqrt(8_000_000/(box.width*box.height)));
   canvas.width=Math.ceil(box.width*density);canvas.height=Math.ceil(box.height*density);
   const context=canvas.getContext('2d');
   if(context){
    const sx=canvas.width/box.width,sy=canvas.height/box.height;
    for(const page of sliding.pages){const r=page.picture.getBoundingClientRect();context.drawImage(page.picture,(r.left-box.left)*sx,(r.top-box.top)*sy,r.width*sx,r.height*sy);}
    outgoing={copy:canvas,width:box.width,height:box.height,rect:{left:box.left,top:box.top,width:box.width,height:box.height}};
   }
  }else{
   const source=oldMedia.querySelector('img,video'),shot=source&&snapshot(source,box,doc,pixelRatio(),true);
   if(shot)outgoing={...shot,rect:fittedMediaRect(source.getBoundingClientRect(),shot.width,shot.height)};
   else{const flight=flying.find(entry=>entry.hero&&entry.copy.isConnected);if(flight)outgoing={...flight,rect:flight.copy.getBoundingClientRect()};}
  }
  clear();const current=revision;
  overlay=doc.createElement('div');overlay.className='library-motion-overlay library-slide-overlay';overlay.setAttribute('aria-hidden','true');
  Object.assign(overlay.style,{left:`${box.left-base.left}px`,top:`${box.top-base.top}px`,width:`${box.width}px`,height:`${box.height}px`,right:'auto',bottom:'auto'});
  const pages=[];
  function page(shot){
   const layer=doc.createElement('div');layer.className='library-slide-page';
   const fit=shot.rect||fittedMediaRect(box,shot.width,shot.height),picture=shot.copy;picture.className='library-slide-picture';
   Object.assign(picture.style,{left:`${fit.left-box.left}px`,top:`${fit.top-box.top}px`,width:`${fit.width}px`,height:`${fit.height}px`});
   layer.append(picture);overlay.append(layer);const entry={layer,picture};pages.push(entry);return entry;
  }
  const oldPage=outgoing?page(outgoing):null;
  update();root.append(overlay);sliding={pages};
  const target=root.querySelector('.library-preview-media img, .library-preview-media video');
  const caption=root.querySelector('.library-preview-caption');
  if(!target){clear();return;}
  target.style.visibility='hidden';hidden.push(target);
  if(caption){caption.style.visibility='hidden';hidden.push(caption);}
  const waiter=waitForFrame(target);waiters.push(waiter);
  waiter.promise.then(async()=>{
   if(current!==revision)return;
   const shot=snapshot(target,box,doc,pixelRatio(),true),nextPage=shot?page(shot):null;
   const distance=(box.width+24)*(direction<0?-1:1),options={duration:380,easing,fill:'both'};
   const runs=[];
   if(oldPage)runs.push(track(oldPage.layer,[{transform:'translate3d(0,0,0)'},{transform:`translate3d(${-distance}px,0,0)`}],options));
   if(nextPage)runs.push(track(nextPage.layer,[{transform:`translate3d(${distance}px,0,0)`},{transform:'translate3d(0,0,0)'}],options));
   else{target.style.removeProperty('visibility');runs.push(track(target,[{opacity:0},{opacity:1}],options));}
   if(caption){caption.style.removeProperty('visibility');runs.push(track(caption,[{opacity:0,transform:`translateX(${direction<0?-10:10}px)`},{opacity:1,transform:'none'}],{duration:240,delay:80,easing,fill:'backwards'}));}
   await Promise.allSettled(runs.map(animation=>animation.finished));if(current!==revision)return;
   target.style.removeProperty('visibility');
   if(nextPage){const dissolve=track(nextPage.picture,[{opacity:1},{opacity:0}],{duration:80,fill:'both'});await Promise.allSettled([dissolve.finished]);}
   if(current===revision)clear();
  });
 }
 return {capture,enter,move,slide,clear};
}
