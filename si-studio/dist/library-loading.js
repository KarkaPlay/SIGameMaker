// Sources exist only while a media element intersects the library's clipped viewport.
export function installLibraryLoading(root,{blob,Observer=globalThis.IntersectionObserver,objectURL=URL}){
 const leases=new Map(),loaded=new Map(),observed=new Set();let disposed=false;
 function acquire(id){
  let lease=leases.get(id);
  if(!lease){const file=blob(id);if(!file)return '';lease={url:objectURL.createObjectURL(file),count:0};leases.set(id,lease);}
  lease.count++;return lease.url;
 }
 function release(id){const lease=leases.get(id);if(lease&&!--lease.count){objectURL.revokeObjectURL(lease.url);leases.delete(id);}}
 function unload(element){
  const state=loaded.get(element);if(!state)return;
  element.removeEventListener('loadedmetadata',state.metadata);element.removeEventListener('loadeddata',state.frame);
  element.removeEventListener('error',state.error);
  if(element.tagName!=='IMG')element.pause();
  element.removeAttribute('src');if(element.tagName!=='IMG')element.load();
  element.closest('.library-thumbnail-image')?.classList.remove('has-frame','has-error');
  loaded.delete(element);release(state.id);
 }
 function load(element){
  if(loaded.has(element)||!root.contains(element))return;
  const id=element.dataset.librarySource,src=acquire(id);if(!src)return;
  const thumbnail=element.hasAttribute('data-library-poster'),decode=thumbnail||element.hasAttribute('data-library-video-preview');
  const metadata=()=>{
   // Seeking decodes a frame even on browsers that do not paint metadata-only video.
   if(decode&&element.paused&&Number.isFinite(element.duration)&&element.duration>0)element.currentTime=Math.min(.08,element.duration/2);
  };
  const frame=()=>{if(decode){if(thumbnail)element.pause();element.preload='metadata';element.closest('.library-thumbnail-image')?.classList.add('has-frame');}};
  const error=()=>{const tile=element.closest('.library-thumbnail-image');tile?.classList.add('has-error');const status=tile?.querySelector('.library-poster-status');if(status)status.textContent='Нет превью';};
  loaded.set(element,{id,metadata,frame,error});
  element.addEventListener('loadedmetadata',metadata);element.addEventListener('loadeddata',frame);element.addEventListener('error',error);
  if(element.tagName!=='IMG')element.preload=decode?'auto':'metadata';
  element.setAttribute('src',src);if(element.tagName!=='IMG')element.load();
 }
 const observer=new Observer(entries=>{if(disposed)return;for(const entry of entries)if(observed.has(entry.target)){if(entry.isIntersecting)load(entry.target);else unload(entry.target);}},{root,rootMargin:'0px',threshold:0});
 function refresh(){
  if(disposed)return;
  const current=new Set(root.querySelectorAll('[data-library-source]'));
  for(const element of observed)if(!current.has(element)){observer.unobserve(element);unload(element);observed.delete(element);}
  for(const element of current)if(!observed.has(element)){observed.add(element);observer.observe(element);}
 }
 refresh();
 const dispose=()=>{disposed=true;observer.disconnect();for(const element of [...loaded.keys()])unload(element);observed.clear();};
 dispose.refresh=refresh;return dispose;
}
