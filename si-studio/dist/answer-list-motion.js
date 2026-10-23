// Animate the change between two wrapped layouts, including the card's real height.
export function createAnswerListMotion({reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches,duration=240}={}){
 const active=new WeakMap();
 function run(card,items,update){
  const beforeBox=card.getBoundingClientRect(),before=new Map([...items('before')].map(([key,node])=>[key,{node,rect:node.getBoundingClientRect()}]));
  // Read the current painted positions before cancelling an interrupted transition.
  active.get(card)?.cancel();
  update();
  if(reduceMotion())return Promise.resolve();
  const afterBox=card.getBoundingClientRect(),after=items('after'),motions=[],ghosts=[];
  const options={duration,easing:'cubic-bezier(.2,.75,.25,1)',fill:'both'};
  const animate=(node,frames)=>{const animation=node.animate(frames,options);motions.push(animation);};
  const state={cancel(){for(const motion of motions)motion.cancel();for(const ghost of ghosts)ghost.remove();if(active.get(card)===state){active.delete(card);card.classList.remove('is-answer-layout-moving');}}};
  active.set(card,state);card.classList.add('is-answer-layout-moving');
  for(const [key,node]of after){
   const rect=node.getBoundingClientRect(),old=before.get(key);
   if(!old){animate(node,[{opacity:0,transform:'scale(.88)'},{opacity:1,transform:'none'}]);continue;}
   const dx=(old.rect.left-beforeBox.left)-(rect.left-afterBox.left),dy=(old.rect.top-beforeBox.top)-(rect.top-afterBox.top);
   if(Math.abs(dx)>.5||Math.abs(dy)>.5)animate(node,[{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}]);
  }
  for(const [key,old]of before){
   if(after.has(key))continue;
   const ghost=old.node;ghost.inert=true;ghost.setAttribute('aria-hidden','true');ghost.classList.add('studio-answer-motion-ghost');
   Object.assign(ghost.style,{position:'absolute',left:`${old.rect.left-beforeBox.left-(card.clientLeft||0)}px`,top:`${old.rect.top-beforeBox.top-(card.clientTop||0)}px`,width:`${old.rect.width}px`,height:`${old.rect.height}px`,margin:'0',pointerEvents:'none'});
   card.appendChild(ghost);ghosts.push(ghost);animate(ghost,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'translateY(-3px) scale(.88)'}]);
  }
  if(Math.abs(beforeBox.height-afterBox.height)>.5)animate(card,[{height:`${beforeBox.height}px`},{height:`${afterBox.height}px`}]);
  return Promise.all(motions.map(motion=>motion.finished.catch(()=>{}))).finally(()=>state.cancel());
 }
 return {run};
}
