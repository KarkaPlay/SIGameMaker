// Reordering is based on stable step IDs; all content and settings travel together.
export function reorderSteps(steps,stepId,beforeId=null){
 const from=steps.findIndex(s=>s.id===stepId);
 if(from<0||beforeId===stepId||beforeId!==null&&!steps.some(s=>s.id===beforeId))return steps;
 const next=steps.filter(s=>s.id!==stepId),at=beforeId===null?next.length:next.findIndex(s=>s.id===beforeId);
 next.splice(at,0,steps[from]);
 return next.every((s,i)=>s===steps[i])?steps:next;
}
export function installStepDrag({getQuestion,onMove}){
 let drag=null,frame=0;
 const clear=()=>{if(!drag)return;cancelAnimationFrame(frame);drag.card?.classList.remove('is-dragging');drag.list?.classList.remove('is-sorting');drag.line?.remove();drag.ghost?.remove();drag=null;};
 function locate(){
  if(!drag)return;
  const pane=document.querySelector('.studio-question-content'),list=document.querySelector('.studio-steps');
  if(!pane||!list||getQuestion()?.id!==drag.questionId){clear();return;}
  const rect=pane.getBoundingClientRect(),inside=drag.x>=rect.left&&drag.x<=rect.right&&drag.y>=rect.top&&drag.y<=rect.bottom;
  drag.valid=inside;
  drag.line.hidden=!inside;
  if(!inside)return;
  const cards=Array.from(list.querySelectorAll('.studio-step')).filter(el=>el.dataset.step!==drag.id);
  const target=cards.find(el=>{const r=el.getBoundingClientRect();return drag.y<r.top+r.height/2;});
  drag.beforeId=target?.dataset.step||null;
  const y=target?target.getBoundingClientRect().top:cards.length?cards.at(-1).getBoundingClientRect().bottom:list.getBoundingClientRect().top;
  drag.line.style.top=`${y-list.getBoundingClientRect().top}px`;
 }
 function tick(){
  if(!drag)return;
  const pane=document.querySelector('.studio-question-content');
  if(pane){const r=pane.getBoundingClientRect();if(drag.x>=r.left&&drag.x<=r.right&&drag.y>=r.top&&drag.y<=r.bottom){const edge=48;const speed=drag.y<r.top+edge?-Math.ceil((r.top+edge-drag.y)/edge*12):drag.y>r.bottom-edge?Math.ceil((drag.y-r.bottom+edge)/edge*12):0;if(speed){pane.scrollTop+=speed;locate();}}}
  frame=requestAnimationFrame(tick);
 }
 document.addEventListener('click',ev=>{if(ev.target.closest('.studio-step-handle')){ev.preventDefault();ev.stopPropagation();}},true);
 document.addEventListener('dragstart',ev=>{
  const handle=ev.target.closest('.studio-step-handle');if(!handle)return;
  const card=handle.closest('.studio-step'),question=getQuestion(),step=question?.steps.find(s=>s.id===card?.dataset.step);if(!step)return;
  clear();const list=card.closest('.studio-steps'),line=document.createElement('div'),ghost=document.createElement('div');
  line.className='studio-drop-indicator';line.innerHTML='<span>Вставить здесь</span>';line.setAttribute('aria-hidden','true');line.hidden=true;list.append(line);
  ghost.className='studio-drag-ghost';ghost.textContent=card.querySelector('.studio-step-label').textContent;document.body.append(ghost);
  drag={id:step.id,questionId:question.id,card,list,line,ghost,x:ev.clientX,y:ev.clientY,valid:false,beforeId:null};
  ev.dataTransfer.effectAllowed='move';ev.dataTransfer.setData('text/plain',step.id);ev.dataTransfer.setDragImage(ghost,20,20);
  card.classList.add('is-dragging');list.classList.add('is-sorting');frame=requestAnimationFrame(tick);
 });
 document.addEventListener('dragover',ev=>{if(!drag)return;drag.x=ev.clientX;drag.y=ev.clientY;locate();if(drag?.valid){ev.preventDefault();ev.dataTransfer.dropEffect='move';}});
 document.addEventListener('drop',ev=>{if(!drag)return;drag.x=ev.clientX;drag.y=ev.clientY;locate();if(!drag)return;const result=drag.valid?{id:drag.id,beforeId:drag.beforeId,questionId:drag.questionId}:null;if(result){ev.preventDefault();ev.stopPropagation();}clear();if(result)onMove(result);});
 document.addEventListener('dragend',clear);
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape')clear();});
}
