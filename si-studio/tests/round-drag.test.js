import test from 'node:test';
import assert from 'node:assert/strict';
import {installRoundDrag,reorderRounds,roundDropIndex} from '../dist/round-drag.js';
import {initial,step} from '../dist/model.js';
import {exportSIQ,importSIQ} from '../dist/siq.js';
import {FixtureDOMParser} from './helpers/xml-parser.js';

test('reordered rounds survive draft cloning, undo/redo snapshots and SIQ round-trip with media',async()=>{
 const p=initial(),first=p.rounds[0],second=structuredClone(first);
 first.name='Первый';second.id='second';second.name='Второй';second.priceMultiplier=7;p.rounds.push(second);
 const image={...step('image'),mediaId:'photo',filename:'фото.png',duration:12};second.themes[0].questions[0].steps.splice(1,0,image);
 const media=new Map([['photo',new Blob([new Uint8Array([0,128,255])])]]),undo=structuredClone(p);
 p.rounds=reorderRounds(p.rounds,second.id,first.id);const saved=structuredClone(p),redo=structuredClone(saved);
 assert.deepEqual(undo.rounds.map(r=>r.name),['Первый','Второй']);assert.deepEqual(redo.rounds.map(r=>r.name),['Второй','Первый']);
 assert.deepEqual(saved.rounds[0],second);
 const parser=globalThis.DOMParser;globalThis.DOMParser=FixtureDOMParser;
 try{
  const imported=importSIQ(await exportSIQ(saved,media));
  assert.deepEqual(imported.pack.rounds.map(r=>r.name),['Второй','Первый']);assert.equal(imported.pack.rounds[0].priceMultiplier,7);
  const q=imported.pack.rounds[0].themes[0].questions[0],photo=q.steps.find(s=>s.type==='image');
  assert.equal(q.price,second.themes[0].questions[0].price);assert.equal(photo.duration,12);
  assert.deepEqual([...new Uint8Array(await imported.media.get(photo.mediaId).arrayBuffer())],[0,128,255]);
 }finally{globalThis.DOMParser=parser;}
});

test('rounds move as complete objects without changing questions, media, prices or input',()=>{
 const a={id:'a',type:'standard',priceMultiplier:3,themes:[{questions:[{id:'q',price:300,steps:[{mediaId:'photo'}]}]}]},b={id:'b'},final={id:'f',type:'final'},rounds=[a,b,final];
 const before=structuredClone(rounds),next=reorderRounds(rounds,'a',null);
 assert.deepEqual(next,[b,final,a]);assert.equal(next[2],a);assert.deepEqual(rounds,before);
 assert.deepEqual(reorderRounds(rounds,'f','a'),[final,a,b]);
 for(const [id,target] of [['a','b'],['f',null],['b','b'],['unknown','a'],['a','missing']])assert.equal(reorderRounds(rounds,id,target),rounds);
});
test('stable insertion slots handle mixed widths, both directions, and outlying coordinates',()=>{
 assert.equal(roundDropIndex([100,200,80],0,50),0);
 assert.equal(roundDropIndex([100,200,80],0,155),1);
 assert.equal(roundDropIndex([100,200,80],0,310),2);
 assert.equal(roundDropIndex([100,200,80],2,20),0);
 assert.equal(roundDropIndex([100,200,80],2,180),1);
 assert.equal(roundDropIndex([100,200,80],2,360),2);
 assert.equal(roundDropIndex([100,200,80],1,-100),0);
 assert.equal(roundDropIndex([100,200,80],1,9999),2);
});

// Event/geometry fixture exercises the actual controller without opening a browser.
function fixture({reduce=false,count=3,viewport=360}={}){
 const listeners=new Map(),windowListeners=new Map(),frames=new Map();let serial=0;
 const win={matchMedia:()=>({matches:reduce}),getComputedStyle:()=>({gap:'8px'}),requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id),addEventListener:(type,fn)=>windowListeners.set(type,fn)};
 const doc={activeElement:null,addEventListener(type,fn){const entries=listeners.get(type)||[];entries.push(fn);listeners.set(type,entries);},createElement:()=>node('line')};
 function node(kind,id,width=100){
  const classes=new Set();return {kind,dataset:{roundId:id},style:{},attrs:{},children:[],width,isConnected:true,motions:[],
   classList:{add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),toggle(n,on){on?classes.add(n):classes.delete(n);},contains:n=>classes.has(n)},
   setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},
   querySelectorAll(selector){if(selector==='[id]')return [];if(selector==='.studio-round-item')return this.children.filter(n=>n.kind==='item');return [];},
   querySelector(selector){if(selector==='.studio-add-round')return this.children.find(n=>n.kind==='add');},
   closest(selector){if(selector==='.studio-round-handle')return this.kind==='handle'?this:null;if(selector==='.studio-round-item')return this.kind==='item'?this:this.parent?.closest(selector);if(selector==='.studio-round-tabs')return this.kind==='list'?this:this.parent?.closest(selector);},
   contains(child){return child===this||this.children.some(n=>n.contains(child));},
   append(child){this.children.push(child);child.parent=this;},
   insertBefore(child,end){this.children=this.children.filter(n=>n!==child);this.children.splice(this.children.indexOf(end),0,child);child.parent=this;},
   cloneNode(){return node('ghost',id,width);},
   remove(){this.removed=true;this.isConnected=false;},
   focus(){doc.activeElement=this;},scrollIntoView(){this.scrolled=true;},
   setPointerCapture(id){this.capture=id;},hasPointerCapture(id){return this.capture===id;},releasePointerCapture(){this.capture=null;},
   getAnimations(){return this.motions.filter(m=>!m.cancelled);},
   animate(keyframes,options){const motion={keyframes,options,cancel(){this.cancelled=true;this.oncancel?.();}};this.motions.push(motion);return motion;},
   getBoundingClientRect(){if(kind==='list')return {left:20,right:20+viewport,top:80,bottom:124,width:viewport,height:44};const list=this.parent;const index=list?.children.indexOf(this)||0;const left=23+(list?.children.slice(0,index).reduce((sum,n)=>sum+n.width+8,0)||0)-(list?.scrollLeft||0);return {left,right:left+width,top:83,bottom:121,width,height:38};}
  };
 }
 doc.body=node('body');const list=node('list');list.scrollLeft=0;
 const rounds=Array.from({length:count},(_,i)=>({id:String(i)}));
 for(const r of rounds){const item=node('item',r.id);item.append(node('handle',r.id));list.append(item);}
 list.append(node('add',null,35));doc.body.append(list);
 let state=rounds,commits=0;
 const control=installRoundDrag({doc,win,onMove:({id,beforeId})=>{const next=reorderRounds(state,id,beforeId);if(next===state)return false;state=next;commits++;return true;}});
 const handle=list.children[0].children[0];
 function emit(type,values={}){const event={target:handle,button:0,pointerId:1,isPrimary:true,clientX:35,clientY:100,preventDefault(){this.prevented=true;},stopPropagation(){},stopImmediatePropagation(){},...values};for(const fn of listeners.get(type)||[])fn(event);return event;}
 return {doc,win,list,handle,control,emit,frames,windowListeners,get commits(){return commits;},get state(){return state;},order:()=>list.querySelectorAll('.studio-round-item').map(n=>n.dataset.roundId),tick(){const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn());}};
}
test('drag previews animated neighbors, commits once on release and retains focus',()=>{
 const f=fixture();f.emit('pointerdown');assert.equal(f.list.capture,1);
 f.emit('pointermove',{clientX:260});assert.deepEqual(f.order(),['1','2','0']);assert.equal(f.commits,0);
 assert.ok(f.list.children[0].motions.length);assert.equal(f.doc.activeElement,f.handle);
 assert.equal(f.doc.body.children.find(n=>n.kind==='ghost').inert,true);
 f.emit('pointerup',{clientX:260});assert.deepEqual(f.state.map(r=>r.id),['1','2','0']);assert.equal(f.commits,1);assert.equal(f.list.capture,null);
 assert.equal(f.doc.body.classList.contains('is-round-dragging'),false);
});
test('a click, a sub-threshold motion or a drop in the original slot creates no history',()=>{
 for(const move of [null,37,44]){const f=fixture();f.emit('pointerdown');if(move)f.emit('pointermove',{clientX:move});f.emit('pointerup',{clientX:move||35});assert.equal(f.commits,0);assert.deepEqual(f.order(),['0','1','2']);}
});
test('Escape, outside drop, pointer cancellation, blur, resize and redraw restore order',()=>{
 for(const reason of ['escape','outside','cancel','capture','blur','resize','redraw']){
  const f=fixture();f.emit('pointerdown');f.emit('pointermove',{clientX:260});
  if(reason==='escape')f.emit('keydown',{key:'Escape'});
  if(reason==='outside')f.emit('pointerup',{clientX:260,clientY:300});
  if(reason==='cancel')f.emit('pointercancel');
  if(reason==='capture')f.emit('lostpointercapture');
  if(reason==='blur'||reason==='resize')f.windowListeners.get(reason)();
  if(reason==='redraw')f.control.cancel();
  assert.deepEqual(f.order(),['0','1','2'],reason);assert.equal(f.commits,0,reason);assert.equal(f.frames.size,0,reason);
 }
});
test('edge scrolling works in both directions and stops outside the strip',()=>{
 const f=fixture({count:10,viewport:260});f.emit('pointerdown');f.emit('pointermove',{clientX:275});f.tick();assert.ok(f.list.scrollLeft>0);
 const old=f.list.scrollLeft;f.emit('pointermove',{clientX:24});f.tick();assert.ok(f.list.scrollLeft<old);
 const stopped=f.list.scrollLeft;f.emit('pointermove',{clientX:280,clientY:300});f.tick();assert.equal(f.list.scrollLeft,stopped);f.control.cancel();
});
test('keyboard moves preserve focus, respect boundaries and reduced motion',()=>{
 const f=fixture({reduce:true});f.emit('keydown',{altKey:true,key:'ArrowLeft'});assert.equal(f.commits,0);
 f.emit('keydown',{altKey:true,key:'ArrowRight'});assert.deepEqual(f.order(),['1','0','2']);assert.equal(f.commits,1);assert.equal(f.doc.activeElement,f.handle);assert.equal(f.handle.parent.scrolled,true);
 assert.ok(f.list.children.every(n=>n.motions.length===0));
 f.emit('keydown',{altKey:true,key:'ArrowLeft'});assert.deepEqual(f.order(),['0','1','2']);assert.equal(f.commits,2);
 f.emit('keydown',{key:'ArrowRight'});assert.equal(f.commits,2);
});
test('reduced motion drag uses the same preview and cancellation with no animations',()=>{
 const f=fixture({reduce:true});f.emit('pointerdown');f.emit('pointermove',{clientX:260});assert.deepEqual(f.order(),['1','2','0']);f.control.cancel();
 assert.ok(f.list.children.every(n=>n.motions.length===0));assert.equal(f.doc.body.children.find(n=>n.kind==='ghost').removed,true);
});
