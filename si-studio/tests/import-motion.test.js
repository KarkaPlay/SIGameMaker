import test from 'node:test';
import assert from 'node:assert/strict';
import {createImportMotion} from '../dist/import-motion.js';
function node(top=0,height=100,key=''){
 const classes=new Set(),motions=[];
 return {dataset:{problemKey:key},motions,classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},getBoundingClientRect:()=>({top,height}),animate(frames,options){let resolve,reject;const finished=new Promise((yes,no)=>{resolve=yes;reject=no;});const m={frames,options,finished,cancelled:false,finish:resolve,cancel(){this.cancelled=true;reject(Error('cancelled'));}};motions.push(m);return m;}};
}
function fixture(){
 const panel=node(0,400),body=node(),list=node(40),a=node(50,80,'a'),b=node(140,80,'b'),notice=node(),footer=node();
 let rows=[a,b];panel.querySelector=selector=>selector==='.import-review-body'?body:selector==='.import-problems'?list:null;
 panel.querySelectorAll=selector=>selector==='.import-problems li'?rows:selector==='.import-review-notice,.dialog-footer,.import-ready-description'?[notice,footer]:[];
 const nodes=()=>[panel,body,a,b,notice,footer,...rows];
 return {panel,body,a,b,notice,footer,nodes,rows:set=>{rows=set;}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const finishAll=f=>{for(const n of f.nodes())for(const m of n.motions)m.finish();};
test('review transition animates removed row out before render, resizes and moves surviving rows into place',async()=>{
 const f=fixture(),motion=createImportMotion({reduceMotion:()=>false});let rendered=false;
 const pending=motion.update(f.panel,()=>{rendered=true;f.panel.getBoundingClientRect=()=>({top:0,height:260});const survivor=node(60,80,'b');f.rows([survivor]);},{row:f.a});
 assert.equal(rendered,false);assert.equal(f.a.motions[0].frames[1].height,'0px');assert.equal(f.panel.classList.contains('is-import-transition'),true);
 finishAll(f);await tick();assert.equal(rendered,true);assert.deepEqual(f.panel.motions[0].frames,[{height:'400px'},{height:'260px'}]);
 finishAll(f);await pending;assert.equal(f.panel.classList.contains('is-import-transition'),false);
});
test('cancelling a transition never renders its pending replacement or leaves clipping behind',async()=>{
 const f=fixture(),motion=createImportMotion({reduceMotion:()=>false});let renders=0;
 const pending=motion.update(f.panel,()=>renders++,{row:f.a});motion.stop(f.panel);await pending;
 assert.equal(renders,0);assert.equal(f.panel.classList.contains('is-import-transition'),false);assert.ok(f.body.motions.every(m=>m.cancelled));
});
test('invalidated sessions cannot render after an exit finishes',async()=>{
 const f=fixture(),motion=createImportMotion({reduceMotion:()=>false});let valid=true,renders=0;
 const pending=motion.update(f.panel,()=>renders++,{valid:()=>valid});valid=false;finishAll(f);await pending;assert.equal(renders,0);
});
test('reduced motion renders immediately with no animations, while still obeying cancellation guards',async()=>{
 const f=fixture(),motion=createImportMotion({reduceMotion:()=>true});let renders=0;
 await motion.enter(f.panel);await motion.update(f.panel,()=>renders++,{row:f.a});await motion.revealEditor(f.panel);await motion.update(f.panel,()=>renders++,{valid:()=>false});
 assert.equal(renders,1);assert.ok(f.nodes().every(n=>n.motions.length===0));assert.equal(f.panel.classList.contains('is-import-transition'),false);
});
test('a superseding update cancels the old transition and only renders the latest state',async()=>{
 const f=fixture(),motion=createImportMotion({reduceMotion:()=>false}),renders=[];
 const old=motion.update(f.panel,()=>renders.push('old'));const next=motion.update(f.panel,()=>renders.push('next'));await old;assert.deepEqual(renders,[]);
 finishAll(f);await tick();finishAll(f);await next;assert.deepEqual(renders,['next']);
});
test('initial review and editor arrival fade in, including status and footer, and release motion state',async()=>{
 const f=fixture(),motion=createImportMotion({reduceMotion:()=>false});const enter=motion.enter(f.panel);
 assert.equal(f.body.motions[0].frames[0].opacity,0);assert.ok(f.notice.motions.length);assert.ok(f.footer.motions.length);finishAll(f);await enter;
 const editor=motion.revealEditor(f.panel);assert.equal(f.panel.motions.at(-1).frames[0].opacity,0);finishAll(f);await editor;assert.equal(f.panel.classList.contains('is-import-transition'),false);
});
