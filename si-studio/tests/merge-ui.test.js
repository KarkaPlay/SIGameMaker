import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {uid,initial} from '../dist/model.js';
import {emptyMergePack,addMergeItem,mergeMedia} from '../dist/merge-model.js';
import {createMergeDisclosureMotion,setMergeMetadataExpanded,mergeMetadataHTML} from '../dist/merge.js';
function disclosure(){return {
 open:false,style:{height:'',overflow:''},motions:[],visibleHeight:null,
 getBoundingClientRect(){return {height:this.visibleHeight??(this.open?240:50)};},
 querySelector(){return {getBoundingClientRect:()=>({height:50})};},
 animate(frames,options){const motion={frames,options,cancel(){this.cancelled=true;},finish(){this.onfinish?.();}};this.motions.push(motion);return motion;}
};}
test('source disclosure opens and closes along the same height path and releases temporary styles',()=>{
 const node=disclosure(),motion=createMergeDisclosureMotion({reduceMotion:()=>false});
 motion.toggle(node);assert.equal(node.open,true);
 assert.deepEqual(node.motions[0].frames,[{height:'50px'},{height:'240px'}]);
 node.motions[0].finish();assert.equal(node.style.overflow,'');assert.equal(node.open,true);
 motion.toggle(node);assert.equal(node.open,true);
 assert.deepEqual(node.motions[1].frames,[{height:'240px'},{height:'50px'}]);
 node.motions[1].finish();assert.equal(node.open,false);assert.equal(node.style.height,'');
});
test('rapid disclosure reversal starts at the painted height and ignores stale callbacks',()=>{
 const node=disclosure(),motion=createMergeDisclosureMotion({reduceMotion:()=>false});
 motion.toggle(node);node.visibleHeight=130;motion.toggle(node);
 assert.equal(node.motions[0].cancelled,true);
 assert.deepEqual(node.motions[1].frames,[{height:'130px'},{height:'50px'}]);
 node.motions[0].finish();assert.equal(node.style.overflow,'hidden');
 motion.stop();assert.equal(node.open,false);assert.equal(node.style.overflow,'');
 node.motions[1].finish();assert.equal(node.open,false);
});
test('reduced motion changes disclosure immediately and cleans up an in-flight opening',()=>{
 const node=disclosure();let reduced=false;const motion=createMergeDisclosureMotion({reduceMotion:()=>reduced});
 motion.toggle(node);reduced=true;motion.toggle(node);
 assert.equal(node.open,false);assert.equal(node.motions.length,1);assert.equal(node.style.overflow,'');
 motion.toggle(node);assert.equal(node.open,true);assert.equal(node.motions.length,1);
});
test('metadata collapses to its title, escapes names, and makes hidden fields inert',()=>{
 const html=mergeMetadataHTML('result','Игра <1> "два"','<label>Авторы<input></label>');
 assert.match(html,/aria-expanded="false"/);assert.match(html,/id="merge-meta-result" inert/);
 assert.match(html,/Игра &lt;1&gt; &quot;два&quot;/);
 assert.ok(html.indexOf('<label>')>html.indexOf('</button>'));
 assert.match(mergeMetadataHTML('result','','',true),/Без названия/);
 assert.doesNotMatch(mergeMetadataHTML('result','Игра','',true),/ inert/);
});
test('collapsing metadata returns focus to its title; reopening restores interactive fields',()=>{
 const previous=globalThis.document,focused={};globalThis.document={activeElement:focused};
 try{
  let name,value,focus=0,open=true;
  const button={setAttribute(n,v){name=n;value=v;},focus(){focus++;}};
  const content={contains:el=>el===focused,inert:false};
  const panel={querySelector:s=>s==='.merge-metadata-reveal'?content:button,classList:{toggle(_,v){open=v;}}};
  setMergeMetadataExpanded(panel,false);
  assert.equal(content.inert,true);assert.equal(open,false);assert.equal(name,'aria-expanded');assert.equal(value,'false');assert.equal(focus,1);
  globalThis.document.activeElement=button;setMergeMetadataExpanded(panel,true);
  assert.equal(content.inert,false);assert.equal(open,true);assert.equal(value,'true');assert.equal(focus,1);
 }finally{globalThis.document=previous;}
});
async function fixture(){
 const handlers=new Map(),root={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[],contains:()=>false,addEventListener:(name,callback)=>handlers.set(name,callback)};
 const source={pack:initial(),media:new Map()},state={pack:emptyMergePack(),media:new Map(),sources:[source,structuredClone(source)],stage:1};
 const context={uid,emptyMergePack,addMergeItem,mergeMedia,structuredClone,Map,Set,document:{activeElement:null},window:{innerWidth:1280,addEventListener(){}},matchMedia:()=>({matches:true}),setTimeout:()=>1,clearTimeout(){},getMergeDraft:async()=>state,saveMergeDraft:async()=>{},createPanelMotion:()=>({}),root};
 vm.createContext(context);
 const code=readFileSync('dist/merge.js','utf8').replace(/^import .*;\n/gm,'').replace(/export function /g,'function ');
 vm.runInContext(code+'\nthis.merger=createMerger({root,onHome(){},toast(){}});',context);
 await context.merger.open();
 const click=async(action,data={},panel=null)=>handlers.get('click')({preventDefault(){},target:{closest:s=>s==='.merge-source summary'?null:{disabled:false,dataset:{merge:action,...data},closest:()=>panel}}});
 return {root,state,handlers,click};
}
test('assembly keeps metadata closed across copying and undo; edited titles survive redraws',async()=>{
 const {root,state,handlers,click}=await fixture();
 assert.match(root.innerHTML,/data-key="result" aria-expanded="false"/);
 assert.match(root.innerHTML,/aria-label="История изменений"/);
 await click('copy',{side:'0',ri:'0'});assert.equal(state.pack.rounds[0].themes.length,state.sources[0].pack.rounds[0].themes.length);
 assert.match(root.innerHTML,/data-key="result" aria-expanded="false"/);
 handlers.get('input')({target:{matches:()=>true,dataset:{mergeName:'pack'},value:'Новая <игра>'}});
 await click('select',{id:state.pack.rounds[0].id});assert.match(root.innerHTML,/Новая &lt;игра&gt;/);
 await click('undo');assert.equal(state.pack.name,'Объединённый пак');
 await click('undo');assert.equal(state.pack.rounds[0].themes[0].questions.length,0);
});
test('metadata expansion persists across actions and is not recorded as a package edit',async()=>{
 const {root,state,click}=await fixture();const before=structuredClone(state.pack);
 const panel={querySelector:s=>s==='.merge-metadata-reveal'?{contains:()=>false,inert:true}:{setAttribute(){},focus(){}},classList:{toggle(){}}};
 await click('metadata',{key:'result'},panel);assert.deepEqual(state.pack,before);
 await click('select',{id:state.pack.rounds[0].id});assert.match(root.innerHTML,/data-key="result" aria-expanded="true"/);
 await click('new-round');await click('undo');assert.deepEqual(state.pack,before);
 assert.match(root.innerHTML,/data-key="result" aria-expanded="true"/);
 await click('metadata',{key:'result'},panel);await click('select',{id:state.pack.rounds[0].id});
 assert.match(root.innerHTML,/data-key="result" aria-expanded="false"/);
});
