import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnswerListMotion} from '../dist/answer-list-motion.js';
const rect=(left,top,width,height)=>({left,top,width,height});
function node(box){
 const classes=new Set();
 return {box,style:{},motions:[],children:[],clientTop:1,clientLeft:1,inert:false,attributes:{},
  classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v)},
  getBoundingClientRect(){return this.box;},setAttribute(key,value){this.attributes[key]=value;},
  appendChild(child){child.remove();this.children.push(child);child.parent=this;},
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}},
  animate(frames,options){let resolve;const motion={frames,options,finished:new Promise(done=>{resolve=done;}),cancelled:false,finish(){resolve();},cancel(){this.cancelled=true;resolve();}};this.motions.push(motion);return motion;}
 };
}
function finish(...nodes){for(const node of nodes)for(const motion of node.motions)motion.finish();}

test('wrapped survivors and the plus move on both axes while card height and entering chip animate together',async()=>{
 const card=node(rect(100,100,500,140)),chip=node(rect(300,120,90,30)),plus=node(rect(400,120,29,29)),comment=node(rect(110,160,470,40)),added=node(rect(400,120,90,30));
 const before=new Map([['chip',chip],['plus',plus],['comment',comment]]),after=new Map([...before,['added',added]]);
 const done=createAnswerListMotion({reduceMotion:()=>false}).run(card,phase=>phase==='before'?before:after,()=>{plus.box=rect(110,158,29,29);comment.box=rect(110,198,470,40);card.box=rect(100,100,500,178);});
 assert.equal(plus.motions[0].frames[0].transform,'translate(290px,-38px)');
 assert.equal(comment.motions[0].frames[0].transform,'translate(0px,-38px)');
 assert.deepEqual(card.motions[0].frames,[{height:'140px'},{height:'178px'}]);
 assert.equal(added.motions[0].frames[0].opacity,0);assert.equal(chip.motions.length,0);
 assert.equal(card.classList.contains('is-answer-layout-moving'),true);
 finish(card,plus,comment,added);await done;
 assert.equal(card.classList.contains('is-answer-layout-moving'),false);assert.equal(card.motions[0].cancelled,true);
});

test('deletion takes the retiring chip out of flow and cleans it up after surviving chips move up a row',async()=>{
 const card=node(rect(100,100,500,178)),deleted=node(rect(300,120,90,30)),survivor=node(rect(110,158,90,30));card.appendChild(deleted);
 const before=new Map([['deleted',deleted],['survivor',survivor]]),after=new Map([['survivor',survivor]]);
 const done=createAnswerListMotion({reduceMotion:()=>false}).run(card,phase=>phase==='before'?before:after,()=>{deleted.remove();survivor.box=rect(300,120,90,30);card.box=rect(100,100,500,140);});
 assert.equal(survivor.motions[0].frames[0].transform,'translate(-190px,38px)');
 assert.equal(deleted.style.position,'absolute');assert.equal(deleted.inert,true);assert.equal(deleted.attributes['aria-hidden'],'true');
 assert.equal(deleted.style.left,'199px');assert.equal(deleted.style.top,'19px');assert.equal(deleted.parent,card);
 assert.equal(deleted.motions[0].frames.at(-1).opacity,0);
 finish(card,deleted,survivor);await done;assert.equal(deleted.parent,null);
});

test('an interrupted layout starts at the currently painted geometry and older cleanup cannot cancel the new state',async()=>{
 const card=node(rect(100,100,500,140)),plus=node(rect(400,120,29,29)),items=()=>new Map([['plus',plus]]),motion=createAnswerListMotion({reduceMotion:()=>false});
 const first=motion.run(card,items,()=>{plus.box=rect(110,158,29,29);card.box=rect(100,100,500,178);});
 // Simulate the rendered intermediate position of the interrupted first transition.
 plus.box=rect(250,140,29,29);card.box=rect(100,100,500,160);
 const second=motion.run(card,items,()=>{plus.box=rect(410,120,29,29);card.box=rect(100,100,500,140);});
 await first;
 assert.equal(plus.motions[1].frames[0].transform,'translate(-160px,20px)');
 assert.equal(card.motions[1].frames[0].height,'160px');assert.equal(card.classList.contains('is-answer-layout-moving'),true);
 assert.equal(plus.motions[1].cancelled,false);finish(card,plus);await second;
 assert.equal(card.classList.contains('is-answer-layout-moving'),false);
});

test('reduced motion applies the new layout immediately without a ghost, animation or fixed height',async()=>{
 const card=node(rect(0,0,500,140)),chip=node(rect(0,0,80,30));let updated=false;
 await createAnswerListMotion({reduceMotion:()=>true}).run(card,()=>new Map([['chip',chip]]),()=>{updated=true;});
 assert.equal(updated,true);assert.equal(card.motions.length,0);assert.equal(chip.motions.length,0);assert.equal(card.children.length,0);
});
