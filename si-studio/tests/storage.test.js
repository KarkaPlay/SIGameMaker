import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {initial,step,questions} from '../dist/model.js';
import * as storage from '../dist/storage.js';

// Transaction double: requests run later; a forced abort discards every staged write.
function database(){
 const stores={draft:new Map(),media:new Map()},scopes=[];let abortNext=false;
 const db={transaction(names){
  names=Array.isArray(names)?names:[names];scopes.push(names);
  const staged=Object.fromEntries(names.map(name=>[name,new Map(stores[name])])),queue=[],abort=abortNext;abortNext=false;
  const tx={objectStore(name){assert.ok(names.includes(name));const map=staged[name];
   const request=fn=>{const r={};queue.push(()=>{r.result=fn();r.onsuccess?.();});return r;};
   return {
    put(value,key){queue.push(()=>map.set(key,structuredClone(value)));},
    delete(key){queue.push(()=>map.delete(key));},
    get:key=>request(()=>map.get(key)),getAllKeys:()=>request(()=>[...map.keys()]),getAll:()=>request(()=>[...map.values()]),
    openKeyCursor(){const keys=[...map.keys()],r={};let index=0;const advance=()=>queue.push(()=>{r.result=index<keys.length?{key:keys[index++],continue:advance}:null;r.onsuccess?.();});advance();return r;}
   };
  }};
  setImmediate(()=>{while(queue.length)queue.shift()();if(abort){tx.error=Error('Quota exceeded');tx.onabort?.();}else{for(const name of names)stores[name]=staged[name];tx.oncomplete?.();}});
  return tx;
 }};
 return {stores,scopes,abort(){abortNext=true;},api:{open(){const r={result:db};setImmediate(()=>r.onsuccess());return r;}}};
}
const packWith=id=>{const p=initial();p.rounds[0].themes[0].questions[0].steps.splice(1,0,{...step('image'),mediaId:id});return p;};

test('save removes only unreachable media, retaining undo, redo, hidden reveal and uploads',async()=>{
 const fake=database(),old=globalThis.indexedDB;globalThis.indexedDB=fake.api;
 try{
  await storage.openDB();const p=packWith('current'),undo=packWith('undo'),redo=packWith('redo');
  p.rounds[0].themes[0].questions[0].customRevealSteps=[{...step('image'),mediaId:'hidden'}];
  for(const id of ['current','undo','redo','hidden','pending','orphan'])await storage.putMedia(id,new Blob([id]));
  const assembly={pack:initial(),media:new Map([['assembly',new Blob(['assembly'])]])};await storage.saveMergeDraft(assembly);
  assert.deepEqual(await storage.saveDraft(p,[undo,redo],['pending']),['orphan']);
  assert.deepEqual([...((await storage.getMedia()).keys())],['current','undo','redo','hidden','pending']);
  assert.deepEqual(fake.scopes.find(names=>names.length===2),['draft','media']);
  // Dropped undo/redo entries and completed uploads are collectible on the next save.
  assert.deepEqual(await storage.saveDraft(p),['undo','redo','pending']);
  assert.deepEqual((await storage.getMergeDraft()).media,assembly.media);
  assert.deepEqual(await storage.getDraft(),p);
 }finally{globalThis.indexedDB=old;}
});

test('aborted save keeps the previous draft and all its media; reopening collects old files',async()=>{
 const fake=database(),old=globalThis.indexedDB;globalThis.indexedDB=fake.api;
 try{
  await storage.openDB();const previous=packWith('previous'),next=packWith('next');
  await storage.putMedia('previous',new Blob(['old']));await storage.saveDraft(previous);
  await storage.putMedia('next',new Blob(['new']));fake.abort();
  await assert.rejects(storage.saveDraft(next),/Quota/);
  assert.deepEqual(await storage.getDraft(),previous);assert.deepEqual([...(await storage.getMedia()).keys()],['previous','next']);
  await storage.openDB();assert.deepEqual(await storage.pruneMedia([await storage.getDraft()]),['next']);
  assert.equal(await (await storage.getMedia()).get('previous').text(),'old');
 }finally{globalThis.indexedDB=old;}
});

test('native workspace lock queues a second tab until ownership is released',{skip:!globalThis.navigator?.locks},async()=>{
 const release=await storage.acquireWorkspace();let secondEntered=false,releaseSecond;
 try{
  const second=storage.acquireWorkspace().then(done=>{secondEntered=true;releaseSecond=done;return done;});
  await nextTurn();assert.equal(secondEntered,false);release();await second;assert.equal(secondEntered,true);
 }finally{release();releaseSecond?.();}
});

test('missing or denied lock support fails closed instead of allowing competing editors',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 try{
  Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
  await assert.rejects(storage.acquireWorkspace(),/HTTPS/);
  Object.defineProperty(globalThis,'navigator',{value:{locks:{request:()=>Promise.reject(Error('Denied'))}},configurable:true});
  await assert.rejects(storage.acquireWorkspace(),/Denied/);
 }finally{Object.defineProperty(globalThis,'navigator',descriptor);}
});

test('the app waits for ownership before reading drafts or installing the editor',()=>{
 const source=readFileSync('dist/app.js','utf8'),gate=source.indexOf("document.querySelector('#app').innerHTML="),end=source.indexOf('const previewStageMotion=');
 const nodes={app:{innerHTML:'',querySelector:()=>({})}},context={document:{querySelector:()=>nodes.app},storage:{acquireWorkspace:()=>new Promise(()=>{})},initialized:false};vm.createContext(context);
 vm.runInContext('(async()=>{'+source.slice(gate,end)+'initialized=true;})()',context);
 assert.equal(context.initialized,false);assert.match(nodes.app.innerHTML,/другой вкладке/);
 assert.ok(gate<source.indexOf('await storage.openDB()'));
});

test('upload pins its new file until it has attached it to the question, including on failure',async()=>{
 const source=readFileSync('dist/app.js','utf8'),start=source.indexOf("$('#media-file').addEventListener('change'");let handler,complete,fail,saves=0;
 const p=initial(),q=p.rounds[0].themes[0].questions[0],image={...step('image')};q.steps.splice(1,0,image);
 const context={pack:p,questions,uploadTarget:{q,id:image.id},pendingMedia:new Set(),media:new Map(),uid:()=> 'upload',snapshot(){},changed(){saves++;assert.equal(image.mediaId,'upload');assert.ok(context.pendingMedia.has('upload'));},toast(){},storage:{putMedia:()=>new Promise((resolve,reject)=>{complete=resolve;fail=reject;})},$:()=>({addEventListener(_,fn){handler=fn;}})};
 vm.createContext(context);vm.runInContext(source.slice(start,source.indexOf('let importingPack=',start)),context);
 const event=()=>({target:{files:[{name:'photo.png',size:10}],value:'photo.png'}});
 const upload=handler(event());assert.ok(context.pendingMedia.has('upload'));assert.equal(image.mediaId,undefined);complete();await upload;assert.equal(context.pendingMedia.size,0);assert.equal(saves,1);
 const failed=handler(event());assert.ok(context.pendingMedia.has('upload'));fail(Error('Quota'));await failed;assert.equal(context.pendingMedia.size,0);assert.equal(saves,1);
});

test('merger persistence collects unused files while keeping undo and redo media',async()=>{
 const {mergeMedia}=await import('../dist/merge-model.js'),source=readFileSync('dist/merge.js','utf8');let saved;
 const state={pack:packWith('current'),media:new Map(['current','undo','redo','orphan'].map(id=>[id,new Blob([id])]))};
 const context={state,history:[{pack:packWith('undo')}],future:[{pack:packWith('redo')}],mergeMedia,structuredClone,pending:0,saveQueue:Promise.resolve(),saveStatus(){},saveMergeDraft:async value=>{saved=value;},toast:message=>assert.fail(message)};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf(' const persistState='),source.indexOf(' const save='))+'\npersistState();',context);await context.saveQueue;
 assert.deepEqual([...saved.media.keys()],['current','undo','redo']);assert.equal(context.pending,0);
 context.history=[];context.future=[];vm.runInContext('persistState();',context);await context.saveQueue;
 assert.deepEqual([...saved.media.keys()],['current']);
});

test('uploads are cancelled after undo, question replacement or step removal during the write',async()=>{
 const source=readFileSync('dist/app.js','utf8'),start=source.indexOf("$('#media-file').addEventListener('change'");
 for(const change of ['undo','replace','remove-step','hidden-step']){
  const p=initial(),q=p.rounds[0].themes[0].questions[0],image={...step('image')};q.steps.splice(1,0,image);let handler,complete,saves=0,snapshots=0;const messages=[];
  const context={pack:p,questions,uploadTarget:{q,id:image.id},pendingMedia:new Set(),media:new Map(),uid:()=> 'upload',snapshot(){snapshots++;},changed(){saves++;},toast:message=>messages.push(message),storage:{putMedia:()=>new Promise(resolve=>{complete=resolve;})},$:()=>({addEventListener(_,fn){handler=fn;}})};
  vm.createContext(context);vm.runInContext(source.slice(start,source.indexOf('let importingPack=',start)),context);
  const task=handler({target:{files:[{name:'photo.png',size:10}],value:'photo.png'}});
  if(change==='undo')context.pack=structuredClone(p);
  if(change==='replace')context.pack=initial();
  if(change==='remove-step')q.steps=q.steps.filter(s=>s!==image);
  if(change==='hidden-step'){q.steps=q.steps.filter(s=>s!==image);q.customRevealSteps=[image];}
  complete();await task;
  assert.equal(image.mediaId,undefined,change);assert.equal(context.media.size,0,change);assert.equal(context.pendingMedia.size,0,change);assert.equal(saves,0,change);assert.equal(snapshots,0,change);assert.deepEqual(messages,['Загрузка отменена: вопрос или шаг изменён.'],change);
 }
});

test('a stale file picker is cancelled before writing, while moving the same step keeps its upload',async()=>{
 const source=readFileSync('dist/app.js','utf8'),start=source.indexOf("$('#media-file').addEventListener('change'");
 for(const stale of [true,false]){
  const p=initial(),q=p.rounds[0].themes[0].questions[0],image={...step('image')};q.steps.splice(1,0,image);let handler,complete,writes=0,saves=0;
  const context={pack:stale?structuredClone(p):p,questions,uploadTarget:{q,id:image.id},pendingMedia:new Set(),media:new Map(),uid:()=> 'upload',snapshot(){},changed(){saves++;},toast(){},storage:{putMedia:()=>{writes++;return new Promise(resolve=>{complete=resolve;});}},$:()=>({addEventListener(_,fn){handler=fn;}})};
  vm.createContext(context);vm.runInContext(source.slice(start,source.indexOf('let importingPack=',start)),context);
  const task=handler({target:{files:[{name:'photo.png',size:10}],value:'photo.png'}});
  if(!stale){q.steps.splice(q.steps.indexOf(image),1);q.steps.unshift(image);complete();}
  await task;assert.equal(writes,stale?0:1);assert.equal(saves,stale?0:1);assert.equal(image.mediaId,stale?undefined:'upload');
 }
});
