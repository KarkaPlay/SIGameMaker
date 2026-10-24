import {step} from './model.js';
// Keep a single ordered scenario; sections are only its visual presentation.
export function scenarioParts(steps){
 const marker=steps.findIndex(st=>st.type==='answer');
 return {before:marker<0?steps:steps.slice(0,marker),answer:marker<0?[]:[steps[marker]],after:marker<0?[]:steps.slice(marker+1)};
}
export function insertScenarioStep(steps,st,section='before'){
 const marker=steps.findIndex(item=>item.type==='answer');
 if(st.type==='answer')return marker<0?[...steps,st]:steps;
 if(section==='after')return marker<0?steps:[...steps,st];
 const at=marker<0?steps.length:marker;
 return [...steps.slice(0,at),st,...steps.slice(at)];
}

// Repair only a missing marker in legacy drafts; preserve existing event IDs and content.
export function ensureAnswerStep(steps){return steps.some(st=>st.type==='answer')?steps:[...steps,step('answer')];}
export function removeScenarioStep(steps,id){const st=steps.find(st=>st.id===id);return !st||st.type==='answer'?steps:steps.filter(st=>st.id!==id);}

// Old drafts with reveal content keep their established custom behavior.
export const revealMode=q=>q.revealMode|| (scenarioParts(q.steps).after.length?'custom':'standard');
export function setRevealMode(q,mode){
 if(!['standard','custom'].includes(mode)||revealMode(q)===mode)return false;
 const parts=scenarioParts(q.steps);
 if(mode==='standard'){
  q.customRevealSteps=parts.after;
  q.steps=[...parts.before,...parts.answer];
 }else{
  q.steps=[...q.steps,...(q.customRevealSteps||[])];
  delete q.customRevealSteps;
 }
 q.revealMode=mode;
 return true;
}
export function canReorderScenario(q,next){return revealMode(q)==='custom'||scenarioParts(next).after.length===0;}
// A caption is simultaneous screen content; the pair retains the image's timing and group boundary.
export function expandCaptions(steps){if(steps.some(st=>st.type==='image'&&st.caption?.trim()&&st.duration===1))throw Error('Для изображения с подписью задайте не менее 2 сек или время по настройкам игры');return steps.flatMap(st=>st.type==='image'&&st.caption?.trim()?
 [{...st,wait:false,duration:Math.floor(st.duration/2)},{type:'text',value:st.caption,duration:Math.ceil(st.duration/2),wait:st.wait,placement:st.placement}]:[st]);}
export function captionRecords(q){let index=0;const records=[];for(const st of q.steps){if(st.type==='image'&&st.caption?.trim()){records.push({index,text:st.caption});index++;}index++;}return records;}
export function restoreCaptions(q,records){
 if(!Array.isArray(records))return;
 for(const record of [...records].reverse()){
  const i=record?.index;if(!Number.isInteger(i)||i<0)continue;
  const image=q.steps[i],text=q.steps[i+1];
  if(image?.type!=='image'||image.wait!==false||text?.type!=='text'||text.value!==record.text||typeof record.text!=='string'||!record.text.trim()||image.duration!==Math.floor((image.duration+text.duration)/2)||(image.placement||'screen')!==(text.placement||'screen'))continue;
  q.steps.splice(i,2,{...image,caption:text.value,wait:text.wait,duration:image.duration+text.duration});
 }
}
