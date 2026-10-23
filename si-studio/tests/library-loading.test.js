import test from 'node:test';
import assert from 'node:assert/strict';
import {installLibraryLoading} from '../dist/library-loading.js';

function element(id,tag='VIDEO',poster=false){
 const listeners=new Map(),attrs=new Map(),classes=new Set(),status={textContent:'Превью…'};
 const tile={classList:{add:key=>classes.add(key),remove:(...keys)=>keys.forEach(key=>classes.delete(key))},querySelector:()=>status};
 return {dataset:{librarySource:id},tagName:tag,classes,status,paused:true,currentTime:0,duration:10,loads:0,pauses:0,attrs,listeners,
  hasAttribute:key=>key==='data-library-poster'&&poster,
  setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key),
  addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);},
  load(){this.loads++;},pause(){this.pauses++;this.paused=true;},closest:()=>poster?tile:null,
  emit(type){listeners.get(type)?.();}};
}
function fixture(elements){
 let observer;const created=[],revoked=[],lookups=[];
 const root={contains:el=>elements.includes(el),querySelectorAll:()=>elements};
 class Observer{
  constructor(callback,options){this.callback=callback;this.options=options;this.observed=[];observer=this;}
  observe(el){this.observed.push(el);}unobserve(el){this.observed=this.observed.filter(node=>node!==el);}disconnect(){this.disconnected=true;}
  visible(el,visible=true){this.callback([{target:el,isIntersecting:visible}]);}
 }
 const objectURL={createObjectURL:file=>{created.push(file);return `blob:${created.length}`;},revokeObjectURL:url=>revoked.push(url)};
 const dispose=installLibraryLoading(root,{blob:id=>{lookups.push(id);return id==='missing'?undefined:{id};},Observer,objectURL});
 return {observer,created,revoked,lookups,dispose};
}

test('offscreen media has no source or object URL; exiting releases decoders and re-entering loads again',()=>{
 const image=element('photo','IMG'),video=element('movie','VIDEO',true),f=fixture([image,video]);
 assert.deepEqual(f.lookups,[]);assert.equal(f.observer.options.rootMargin,'0px');
 f.observer.visible(image);assert.equal(image.attrs.get('src'),'blob:1');assert.equal(video.attrs.has('src'),false);
 f.observer.visible(image,false);assert.equal(image.attrs.has('src'),false);assert.deepEqual(f.revoked,['blob:1']);
 f.observer.visible(video);assert.equal(video.loads,1);assert.equal(video.preload,'auto');
 video.emit('loadedmetadata');assert.equal(video.currentTime,.08);
 video.emit('loadeddata');assert.equal(video.pauses,1);assert.ok(video.classes.has('has-frame'));assert.equal(video.preload,'metadata');
 f.observer.visible(video,false);assert.equal(video.loads,2);assert.equal(video.attrs.has('src'),false);assert.equal(video.listeners.size,0);assert.equal(video.classes.has('has-frame'),false);
 f.observer.visible(video);assert.equal(f.created.length,3);
 f.dispose();assert.equal(f.observer.disconnected,true);assert.equal(video.attrs.has('src'),false);assert.equal(f.revoked.length,3);
});

test('same file in several groups shares a URL until the last visible occurrence leaves',()=>{
 const a=element('shared','IMG'),b=element('shared','IMG'),f=fixture([a,b]);
 f.observer.visible(a);f.observer.visible(b);f.observer.visible(b);
 assert.equal(f.created.length,1);assert.equal(a.attrs.get('src'),b.attrs.get('src'));
 f.observer.visible(a,false);assert.equal(f.revoked.length,0);
 f.observer.visible(b,false);assert.deepEqual(f.revoked,['blob:1']);f.dispose();assert.equal(f.revoked.length,1);
});

test('thumbnail obtains a decoded frame without calling play and handles errors and missing files',()=>{
 const video=element('video','VIDEO',true),missing=element('missing','IMG'),f=fixture([video,missing]);
 f.observer.visible(video);video.emit('loadedmetadata');video.emit('loadeddata');
 assert.equal(video.paused,true);assert.ok(video.classes.has('has-frame'));
 video.emit('error');assert.equal(video.status.textContent,'Нет превью');
 f.observer.visible(missing);assert.equal(missing.attrs.has('src'),false);
 f.dispose();assert.equal(video.listeners.size,0);
 // A stale observer callback cannot revive a detached media node.
 f.observer.visible(video);f.observer.visible(element('detached','IMG'));assert.equal(f.created.length,1);
});

test('audio loads metadata only and is paused and detached when it leaves the viewport',()=>{
 const audio=element('song','AUDIO'),f=fixture([audio]);f.observer.visible(audio);
 assert.equal(audio.preload,'metadata');audio.paused=false;
 f.observer.visible(audio,false);assert.equal(audio.paused,true);assert.equal(audio.attrs.has('src'),false);assert.equal(audio.loads,2);f.dispose();
});


test('changing gallery selection unloads the old preview and keeps the visible filmstrip decoded',()=>{
 const strip=element('movie','VIDEO',true),old=element('old','VIDEO');
 const elements=[strip,old],f=fixture(elements);f.observer.visible(strip);f.observer.visible(old);
 const stripURL=strip.attrs.get('src'),next=element('next','VIDEO');
 elements.splice(1,1,next);f.dispose.refresh();
 assert.equal(old.attrs.has('src'),false);assert.equal(strip.attrs.get('src'),stripURL);assert.equal(strip.loads,1);
 assert.deepEqual(f.revoked,['blob:2']);assert.ok(f.observer.observed.includes(next));assert.ok(!f.observer.observed.includes(old));
 f.observer.visible(old);assert.equal(old.attrs.has('src'),false);
 f.observer.visible(next);assert.equal(next.attrs.has('src'),true);f.dispose();assert.equal(f.revoked.length,3);
});
