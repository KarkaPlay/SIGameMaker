// Replace only disclosure content so focus, scroll and the rest of the editor stay in place.
export function createRevealMotion({reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches}={}){
 const active=new WeakMap();
 function stop(panel){if(panel)active.get(panel)?.finish();}
 function run(panel,update){
  if(!panel){update();return;}
  const height=panel.getBoundingClientRect().height;
  stop(panel);
  if(reduceMotion()){update();return;}
  const outgoing=panel.querySelector('[data-reveal-body]')?.cloneNode(true);
  if(outgoing){
   outgoing.inert=true;outgoing.setAttribute('aria-hidden','true');
   for(const node of [outgoing,...outgoing.querySelectorAll('[id]')])node.removeAttribute('id');
   Object.assign(outgoing.style,{position:'absolute',inset:'0 0 auto',width:'100%',pointerEvents:'none'});
  }
  update();
  const body=panel.querySelector('[data-reveal-body]');if(!body)return;
  const target=panel.getBoundingClientRect().height,previous={height:panel.style.height,overflow:panel.style.overflow};
  const state={motions:[],finish(){
   if(active.get(panel)!==state)return;
   active.delete(panel);for(const motion of state.motions)motion.cancel();outgoing?.remove();
   panel.style.height=previous.height;panel.style.overflow=previous.overflow;
  }};
  active.set(panel,state);panel.style.overflow='hidden';
  if(outgoing){panel.append(outgoing);state.motions.push(outgoing.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-5px)'}],{duration:150,easing:'ease-out',fill:'forwards'}));}
  state.motions.push(body.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'ease-out'}));
  const resize=panel.animate([{height:`${height}px`},{height:`${target}px`}],{duration:240,easing:'cubic-bezier(.2,.75,.25,1)'});
  state.motions.push(resize);resize.onfinish=state.finish;
 }
 return {run,stop};
}
