// Animate review updates without allowing a finished exit to reopen a cancelled import.
export function createImportMotion({reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches}={}){
 const active=new WeakMap();
 const nodes=(panel,selector)=>Array.from(panel.querySelectorAll(selector));
 function stop(panel){const state=active.get(panel);if(!state)return;active.delete(panel);state.cancelled=true;for(const motion of state.motions)motion.cancel();panel.classList.remove('is-import-transition');}
 function begin(panel){stop(panel);const state={motions:[],cancelled:false};active.set(panel,state);return state;}
 function animate(state,node,frames,options={}){if(!node)return;const motion=node.animate(frames,{duration:220,easing:'cubic-bezier(.2,.75,.25,1)',...options});state.motions.push(motion);return motion;}
 const wait=state=>Promise.allSettled(state.motions.map(motion=>motion.finished));
 function finish(panel,state){if(active.get(panel)!==state)return;active.delete(panel);for(const motion of state.motions)motion.cancel();panel.classList.remove('is-import-transition');}
 function arrivals(panel,state,oldRows=new Map()){
  nodes(panel,'.import-problems li').forEach((row,i)=>{
   const before=oldRows.get(row.dataset.problemKey),after=row.getBoundingClientRect();
   if(before!==undefined){const list=panel.querySelector('.import-problems');const delta=before-(after.top-list.getBoundingClientRect().top);if(Math.abs(delta)>1)animate(state,row,[{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}]);}
   else animate(state,row,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{delay:Math.min(i,5)*25});
  });
  for(const node of nodes(panel,'.import-review-notice,.dialog-footer,.import-ready-description'))animate(state,node,[{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}]);
 }
 async function enter(panel){
  const state=begin(panel);if(reduceMotion()){finish(panel,state);return;}
  animate(state,panel.querySelector('.import-review-body'),[{opacity:0},{opacity:1}]);arrivals(panel,state);
  await wait(state);finish(panel,state);
 }
 async function update(panel,render,{row=null,valid=()=>true}={}){
  const state=begin(panel),reduced=reduceMotion(),before=panel.getBoundingClientRect(),oldRows=new Map(),list=panel.querySelector('.import-problems');
  if(list)for(const item of nodes(panel,'.import-problems li'))oldRows.set(item.dataset.problemKey,item.getBoundingClientRect().top-list.getBoundingClientRect().top);
  try{
   if(!reduced){
    panel.classList.add('is-import-transition');
    if(row){const height=row.getBoundingClientRect().height;animate(state,row,[{opacity:1,height:`${height}px`,paddingTop:'10px',paddingBottom:'10px',transform:'translateX(0)'},{opacity:0,height:'0px',paddingTop:'0px',paddingBottom:'0px',transform:'translateX(-8px)'}],{duration:160,fill:'forwards'});}
    animate(state,panel.querySelector('.import-review-body'),[{opacity:1},{opacity:.15}],{duration:160,fill:'forwards'});
    await wait(state);
   }
   if(state.cancelled||!valid())return;
   render();
   if(reduced)return;
   // Re-rendering resets dialog classes; keep clipping during the resize only.
   panel.classList.add('is-import-transition');const after=panel.getBoundingClientRect();
   if(Math.abs(before.height-after.height)>1)animate(state,panel,[{height:`${before.height}px`},{height:`${after.height}px`}],{duration:240});
   animate(state,panel.querySelector('.import-review-body'),[{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}]);
   arrivals(panel,state,oldRows);await wait(state);
  }finally{finish(panel,state);}
 }
 async function revealEditor(root){
  if(!root)return;const state=begin(root);
  if(!reduceMotion()){animate(state,root,[{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}]);await wait(state);}
  finish(root,state);
 }
 return {enter,update,stop,revealEditor};
}
