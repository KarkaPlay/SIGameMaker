import {usedMediaIds} from './model.js';
let db;
export async function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('si-studio',1);req.onupgradeneeded=()=>{req.result.createObjectStore('draft');req.result.createObjectStore('media');};req.onsuccess=()=>{db=req.result;resolve(db);};req.onerror=()=>reject(req.error);});}
export function getDraft(){return new Promise((resolve,reject)=>{const r=db.transaction('draft').objectStore('draft').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
// Saving and removing unreachable files commit together, so a failed write keeps the old draft's media.
export function saveDraft(pack,retained=[],pending=[]){return new Promise((resolve,reject)=>{
 const tx=db.transaction(['draft','media'],'readwrite'),keep=usedMediaIds([pack,...retained]);
 for(const id of pending)keep.add(id);
 tx.objectStore('draft').put(pack,'current');const removed=pruneStore(tx,keep);
 tx.oncomplete=()=>resolve(removed);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Сохранение прервано'));
});}
function pruneStore(tx,keep){const removed=[],request=tx.objectStore('media').openKeyCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;if(!keep.has(cursor.key)){tx.objectStore('media').delete(cursor.key);removed.push(cursor.key);}cursor.continue();};return removed;}
export function pruneMedia(packs){return new Promise((resolve,reject)=>{
 const tx=db.transaction('media','readwrite'),removed=pruneStore(tx,usedMediaIds(packs));
 tx.oncomplete=()=>resolve(removed);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Очистка прервана'));
});}
// The browser releases this lock when the owning page closes; queued pages load the fresh draft afterward.
export function acquireWorkspace(){return new Promise((resolve,reject)=>{
 if(!globalThis.navigator?.locks){reject(Error('Для безопасной работы откройте редактор в современном браузере по HTTPS или на localhost.'));return;}
 navigator.locks.request('si-studio-workspace',()=>new Promise(release=>resolve(release))).catch(reject);
});}
export function putMedia(id,blob){return new Promise((resolve,reject)=>{const tx=db.transaction('media','readwrite');tx.objectStore('media').put(blob,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
export function getMedia(){return new Promise((resolve,reject)=>{const tx=db.transaction('media');const s=tx.objectStore('media');const keys=s.getAllKeys(),values=s.getAll();tx.oncomplete=()=>resolve(new Map(keys.result.map((k,i)=>[k,values.result[i]])));tx.onerror=()=>reject(tx.error);});}
// Independent workspace: merging must never replace the current editor draft.
export function getMergeDraft(){return new Promise((resolve,reject)=>{const r=db.transaction('draft').objectStore('draft').get('merge');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export function saveMergeDraft(value){return new Promise((resolve,reject)=>{const tx=db.transaction('draft','readwrite');tx.objectStore('draft').put(value,'merge');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
