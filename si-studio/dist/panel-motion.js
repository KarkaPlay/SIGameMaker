// Keep a closing panel in the top layer until its exit motion finishes.
export function createPanelMotion({reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches,readStyle=panel=>getComputedStyle(panel)}={}){
 const entering=new WeakMap(),leaving=new WeakMap();
 const collapsed=panel=>`translateY(${panel.dataset.side==='above'?4:-4}px) scale(.98)`;
 function stopEntering(panel){entering.get(panel)?.cancel();entering.delete(panel);}
 function open(panel){
  stopEntering(panel);
  if(reduceMotion())return;
  const motion=panel.animate([{opacity:0,transform:collapsed(panel)},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:170,easing:'cubic-bezier(.2,.75,.25,1)'});
  entering.set(panel,motion);motion.onfinish=()=>{if(entering.get(panel)===motion)entering.delete(panel);};
 }
 function close(panel,{immediate=false}={}){
  const pending=leaving.get(panel);
  if(pending){if(immediate)pending.finish();return pending.promise;}
  if(!panel.open)return Promise.resolve();
  if(immediate||reduceMotion()){stopEntering(panel);panel.close();return Promise.resolve();}
  const style=readStyle(panel),start={opacity:style.opacity,transform:style.transform};
  stopEntering(panel);
  let resolve;const promise=new Promise(done=>{resolve=done;});
  const state={promise,finish(){if(leaving.get(panel)!==state)return;leaving.delete(panel);panel.close();state.motion.cancel();delete panel.dataset.closing;resolve();}};
  leaving.set(panel,state);panel.dataset.closing='true';
  state.motion=panel.animate([start,{opacity:0,transform:collapsed(panel)}],{duration:170,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
  state.motion.onfinish=state.finish;
  return promise;
 }
 return {open,close,isClosing:panel=>leaving.has(panel)};
}
