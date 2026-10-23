import test from 'node:test';
import assert from 'node:assert/strict';
import {createLibraryMotion,gallerySlideDirection,fittedMediaRect,motionRasterSize,waitForLibraryFrame} from '../dist/library-motion.js';
const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function node(box=rect(0,0,100,100),key='',id=key){
 const classes=new Set(),motions=[],children=[];
 const result={dataset:{libraryKey:key,libraryFile:id},style:{removeProperty(name){delete this[name];}},motions,children,isConnected:true,
  classList:{add:(...values)=>values.forEach(value=>classes.add(value)),contains:value=>classes.has(value)},
  getBoundingClientRect(){return this.paintedRect||box;},querySelectorAll:()=>[],querySelector:()=>null,setAttribute(){},
  append(child){children.push(child);child.isConnected=true;},remove(){this.removed=true;this.isConnected=false;for(const child of children)child.isConnected=false;},
  animate(frames,options){let finish,reject;const finished=new Promise((yes,no)=>{finish=yes;reject=no;});const animation={frames,options,finished,finish,cancelled:false,cancel(){this.cancelled=true;reject(Error('cancelled'));}};motions.push(animation);return animation;}
 };return result;
}
function file(box,key,{width=3840,height=2160,preview=false}={}){
 const card=node(box,key),visual=node(box),image=node(box);
 image.tagName='IMG';image.naturalWidth=width;image.naturalHeight=height;
 visual.querySelector=selector=>selector==='img,video'?image:null;
 card.querySelector=selector=>selector==='img,video'?image:selector==='.library-thumbnail-image'&&!preview?visual:null;
 card.image=image;return card;
}
function fixture({reduced=false,ready=()=>Promise.resolve()}={}){
 const root=node(rect(100,50,800,600)),body=node(rect(280,150,600,450)),canvases=[],waiters=[];
 let nodes=[],preview=null;
 root.querySelector=selector=>selector==='.library-body'?body:selector==='.library-preview-media'?preview:selector==='.library-preview-media img, .library-preview-media video'?preview?.image:null;
 root.querySelectorAll=selector=>selector.includes('strong')?[]:selector.startsWith('button')?nodes.filter(n=>n!==preview):nodes;
 const doc={createElement(tag){const el=node();if(tag==='canvas'){el.draws=[];el.getContext=()=>({drawImage:(...args)=>el.draws.push(args)});canvases.push(el);}return el;}};
 const motion=createLibraryMotion(root,{document:doc,reduceMotion:()=>reduced,pixelRatio:()=>2,
  waitForFrame:media=>{const waiter={promise:ready(media),cancelled:false,cancel(){this.cancelled=true;}};waiters.push(waiter);return waiter;}});
 return {root,body,motion,canvases,waiters,set(next,large=null){nodes=next;preview=large;}};
}
async function finishFlight(f){
 const layer=f.root.children.at(-1);for(const copy of layer.children)for(const animation of copy.motions)animation.finish();await tick();
 for(const copy of layer.children)for(const animation of copy.motions)animation.finish();await tick();
}

test('the picture bounds exclude letterboxing for landscape, portrait, square and panoramic originals',()=>{
 for(const [width,height] of [[3840,2160],[1000,4000],[2000,2000],[12000,1000]]){
  const box=rect(20,40,540,270),fit=fittedMediaRect(box,width,height);
  assert.ok(Math.abs(fit.width/fit.height-width/height)<1e-10);
  assert.ok(fit.left>=box.left&&fit.top>=box.top);
  assert.ok(fit.width<=box.width+.0001&&fit.height<=box.height+.0001);
 }
 assert.deepEqual(fittedMediaRect(rect(0,0,200,200),400,200),{left:0,top:50,width:200,height:100});
});

test('Retina snapshots match the viewport density without a small fixed raster or artificial upsampling',()=>{
 const large=motionRasterSize(6000,4000,{width:1000,height:700},2);
 assert.equal(large.width,2000);assert.ok(large.height>=1333&&large.height<=1334);
 assert.deepEqual(motionRasterSize(120,80,{width:1000,height:700},3),{width:120,height:80});
 const limited=motionRasterSize(20000,10000,{width:8000,height:4000},3,8_000_000);
 assert.ok(limited.width*limited.height<8_010_000);
});

test('grid to gallery animates sharp picture layers with a uniform scale and no stretched card labels',async()=>{
 const f=fixture(),chosen=file(rect(300,180,180,160),'a'),other=file(rect(500,180,180,160),'b'),offscreen=file(rect(300,900,180,160),'c');
 f.set([chosen,other,offscreen]);const before=f.motion.capture({expandingKey:'a'});assert.equal(before.length,2);
 assert.equal(before[0].copy.width,1600);assert.equal(before[0].copy.height,900);
 assert.equal(before[0].copy.draws[0][0],chosen.image);
 const large=file(rect(300,160,540,270),'a',{preview:true}),thumbA=file(rect(300,480,128,100),'a'),thumbB=file(rect(438,480,128,100),'b');
 f.set([large,thumbA,thumbB],large);f.motion.move(before,{selectedKey:'a',toGallery:true});
 const overlay=f.root.children[0];assert.equal(overlay.children.length,2);
 assert.equal(large.image.style.visibility,'hidden');assert.equal(thumbB.image.style.visibility,'hidden');
 assert.equal(large.style.visibility,undefined); // Background, text and controls are not part of the scaled bitmap.
 assert.ok(overlay.children[0].classList.contains('library-motion-hero'));
 for(const copy of overlay.children){
  const [from,to]=copy.motions[0].frames;
  assert.match(from.transform,/scale\([0-9.]+\)$/);assert.match(to.transform,/scale\(1\)$/);
  assert.ok(Math.abs(parseFloat(copy.style.width)/parseFloat(copy.style.height)-16/9)<1e-10);
 }
 await finishFlight(f);assert.equal(overlay.removed,true);assert.equal(large.image.style.visibility,undefined);assert.equal(thumbB.image.style.visibility,undefined);
});

test('gallery to grid captures the large file once and releases every hidden destination on cancellation',()=>{
 const f=fixture(),large=file(rect(300,160,540,270),'a',{preview:true}),thumbA=file(rect(300,480,128,100),'a'),thumbB=file(rect(438,480,128,100),'b');
 f.set([large,thumbA,thumbB],large);const before=f.motion.capture();assert.deepEqual(before.map(value=>value.key),['a','b']);
 const a=file(rect(300,180,180,160),'a'),b=file(rect(500,180,180,160),'b');f.set([a,b]);f.motion.move(before);
 f.motion.clear();assert.equal(a.image.style.visibility,undefined);assert.equal(b.image.style.visibility,undefined);assert.equal(f.root.children[0].removed,true);
 assert.ok(f.root.children[0].children.every(copy=>copy.motions.every(animation=>animation.cancelled)));
 assert.ok(f.waiters.every(waiter=>waiter.cancelled));
});

test('the sharp moving layer stays in place until the destination is decoded, then dissolves',async()=>{
 let decode;const ready=new Promise(resolve=>{decode=resolve;});const f=fixture({ready:()=>ready});
 f.set([file(rect(300,180,180,160),'a')]);const before=f.motion.capture({expandingKey:'a'});
 const large=file(rect(300,160,540,270),'a',{preview:true});f.set([large],large);f.motion.move(before,{selectedKey:'a',toGallery:true});
 const copy=f.root.children[0].children[0];copy.motions[0].finish();await tick();
 assert.equal(copy.removed,undefined);assert.equal(large.image.style.visibility,'hidden');
 decode();await tick();assert.equal(large.image.style.visibility,undefined);assert.equal(copy.motions[1].options.duration,120);
 copy.motions[1].finish();await tick();assert.equal(copy.removed,true);
});

test('reversing midflight starts at the currently painted position and reuses the sharp layer',()=>{
 const f=fixture();f.set([file(rect(300,180,180,160),'a')]);const before=f.motion.capture({expandingKey:'a'});
 const large=file(rect(300,160,540,270),'a',{preview:true});f.set([large],large);f.motion.move(before,{selectedKey:'a',toGallery:true});
 const copy=f.root.children[0].children[0];copy.paintedRect=rect(310,190,300,168.75);
 const interrupted=f.motion.capture();assert.equal(interrupted.length,1);assert.equal(interrupted[0].copy,copy);assert.deepEqual(interrupted[0].rect,copy.paintedRect);
 f.set([file(rect(300,180,180,160),'a')]);f.motion.move(interrupted);
 assert.match(copy.motions.at(-1).frames[0].transform,/translate3d\(210px,140px,0\)/);f.motion.clear();
});

test('an old completed or cancelled animation cannot erase a new category transition',async()=>{
 const f=fixture();f.motion.enter();const old=f.body.motions[0];old.finish();
 f.motion.enter();const next=f.body.motions[1];await tick();assert.equal(next.cancelled,false);
 next.finish();await tick();assert.equal(next.cancelled,true);
});

test('reduced motion applies layouts without snapshots or transitions',()=>{
 const f=fixture({reduced:true});f.set([file(rect(300,180,180,160),'a')]);
 assert.deepEqual(f.motion.capture(),[]);f.motion.move([]);f.motion.enter();assert.equal(f.body.motions.length,0);assert.equal(f.root.children.length,0);
});

test('destination readiness waits for image decode and cancellation removes every event listener',async()=>{
 const el=new EventTarget();Object.assign(el,{tagName:'IMG',complete:false,naturalWidth:0});
 let decoded;el.decode=()=>new Promise(resolve=>{decoded=resolve;});
 const waiter=waitForLibraryFrame(el);let ready=false;waiter.promise.then(()=>{ready=true;});
 el.naturalWidth=1000;el.dispatchEvent(new Event('load'));await tick();assert.equal(ready,false);
 decoded();await waiter.promise;assert.equal(ready,true);
 const cancelled=waitForLibraryFrame(el);cancelled.cancel();await cancelled.promise;
});


test('gallery direction follows file order including skipped files and group boundaries',()=>{
 const keys=['round1:a','round1:b','round2:c','round2:d'];
 assert.equal(gallerySlideDirection(keys,'round1:a','round2:d'),1);
 assert.equal(gallerySlideDirection(keys,'round2:d','round1:a'),-1);
 assert.equal(gallerySlideDirection(keys,'round1:b','round2:c'),1);
});

async function finishSlide(f){
 const layer=f.root.children.at(-1);
 for(const page of layer.children)for(const animation of page.motions)animation.finish();await tick();
 for(const page of layer.children)for(const picture of page.children)for(const animation of picture.motions)animation.finish();await tick();
}

test('gallery slides old and new pictures left when a file to the right is selected',async()=>{
 const f=fixture(),old=file(rect(300,160,540,270),'a',{preview:true}),next=file(rect(300,160,540,270),'b',{preview:true});
 f.set([old],old);f.motion.slide(()=>f.set([next],next),{direction:1});await tick();
 const layer=f.root.children.at(-1);assert.equal(layer.children.length,2);
 assert.equal(layer.style.left,'200px');assert.equal(layer.style.width,'540px');assert.equal(next.image.style.visibility,'hidden');
 const [outgoing,incoming]=layer.children;
 assert.deepEqual(outgoing.motions[0].frames,[{transform:'translate3d(0,0,0)'},{transform:'translate3d(-564px,0,0)'}]);
 assert.deepEqual(incoming.motions[0].frames,[{transform:'translate3d(564px,0,0)'},{transform:'translate3d(0,0,0)'}]);
 assert.equal(outgoing.children[0].width,960);assert.equal(incoming.children[0].width,960);
 await finishSlide(f);assert.equal(layer.removed,true);assert.equal(next.image.style.visibility,undefined);
});

test('selecting a file to the left reverses both page trajectories without scaling',async()=>{
 const f=fixture(),old=file(rect(300,160,540,270),'b',{preview:true}),next=file(rect(300,160,540,270),'a',{preview:true,width:1200,height:2400});
 f.set([old],old);f.motion.slide(()=>f.set([next],next),{direction:-1});await tick();
 const layer=f.root.children.at(-1),[outgoing,incoming]=layer.children;
 assert.equal(outgoing.motions[0].frames[1].transform,'translate3d(564px,0,0)');
 assert.equal(incoming.motions[0].frames[0].transform,'translate3d(-564px,0,0)');
 const picture=incoming.children[0];assert.equal(picture.style.width,'135px');assert.equal(picture.style.height,'270px');
 assert.ok(incoming.motions[0].frames.every(frame=>!frame.transform.includes('scale')));
 await finishSlide(f);
});

test('gallery keeps the outgoing picture until the new frame is ready and cancels pending slides safely',async()=>{
 let decode;const ready=new Promise(resolve=>{decode=resolve;}),f=fixture({ready:()=>ready});
 const old=file(rect(300,160,540,270),'a',{preview:true}),next=file(rect(300,160,540,270),'b',{preview:true});
 f.set([old],old);f.motion.slide(()=>f.set([next],next),{direction:1});
 const layer=f.root.children.at(-1);assert.equal(layer.children.length,1);assert.equal(layer.children[0].motions.length,0);
 f.motion.clear();decode();await tick();assert.equal(layer.children.length,1);assert.equal(layer.removed,true);assert.equal(next.image.style.visibility,undefined);
 assert.ok(f.waiters.every(waiter=>waiter.cancelled));
});

test('rapid gallery selections compose currently visible pages instead of jumping to a finished frame',async()=>{
 const f=fixture(),a=file(rect(300,160,540,270),'a',{preview:true}),b=file(rect(300,160,540,270),'b',{preview:true}),c=file(rect(300,160,540,270),'c',{preview:true});
 f.set([a],a);f.motion.slide(()=>f.set([b],b),{direction:1});await tick();
 const oldLayer=f.root.children.at(-1),left=oldLayer.children[0].children[0],right=oldLayer.children[1].children[0];
 left.paintedRect=rect(120,160,480,270);right.paintedRect=rect(680,160,480,270);
 f.motion.slide(()=>f.set([c],c),{direction:1});await tick();
 const layer=f.root.children.at(-1),composite=layer.children[0].children[0];
 assert.equal(composite.draws.length,2);assert.equal(composite.draws[0][0],left);assert.equal(composite.draws[1][0],right);
 assert.equal(oldLayer.removed,true);await finishSlide(f);
});

test('reduced motion changes the gallery file immediately with no extra raster or waiting',()=>{
 const f=fixture({reduced:true}),a=file(rect(300,160,540,270),'a',{preview:true});let updates=0;
 f.set([a],a);f.motion.slide(()=>updates++,{direction:1});assert.equal(updates,1);assert.equal(f.canvases.length,0);assert.equal(f.waiters.length,0);
});
