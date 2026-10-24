import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealMotion} from '../dist/reveal-motion.js';
function node(height=65){return {
 height,style:{height:'',overflow:''},attrs:{id:'old-id'},children:[],motions:[],
 getBoundingClientRect(){return {height:this.height};},
 querySelector(){return this.body;},querySelectorAll(){return this.children;},
 setAttribute(key,value){this.attrs[key]=value;},removeAttribute(key){delete this.attrs[key];},
 cloneNode(){const copy=node(this.height);copy.children=[node()];return copy;},
 append(child){this.children.push(child);child.parent=this;},
 remove(){this.removed=true;if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);},
 animate(frames,options){const motion={frames,options,cancel(){this.cancelled=true;},finish(){this.onfinish?.();}};this.motions.push(motion);return motion;}
};}
function fixture(){const panel=node(),body=node();panel.body=body;return {panel,body};}
test('disclosure change commits immediately and animates old content, new content and height, then cleans up',()=>{
 const {panel}=fixture(),motion=createRevealMotion({reduceMotion:()=>false});let updates=0;
 motion.run(panel,()=>{updates++;panel.body=node(140);panel.height=140;});
 assert.equal(updates,1);assert.equal(panel.style.overflow,'hidden');
 assert.deepEqual(panel.motions[0].frames,[{height:'65px'},{height:'140px'}]);
 assert.equal(panel.body.motions.length,1);const ghost=panel.children[0];
 assert.equal(ghost.inert,true);assert.equal(ghost.attrs['aria-hidden'],'true');
 assert.equal(ghost.attrs.id,undefined);assert.equal(ghost.children[0].attrs.id,undefined);
 panel.motions[0].finish();assert.equal(ghost.removed,true);assert.equal(panel.children.length,0);
 assert.equal(panel.style.height,'');assert.equal(panel.style.overflow,'');
 assert.equal(panel.body.motions[0].cancelled,true);
});
test('rapid toggles cancel earlier motion and stale completion cannot remove the current content',()=>{
 const {panel}=fixture(),motion=createRevealMotion({reduceMotion:()=>false});
 motion.run(panel,()=>{panel.body=node(180);panel.height=180;});
 const oldResize=panel.motions[0],oldGhost=panel.children[0];panel.height=110;
 motion.run(panel,()=>{panel.body=node(65);panel.height=65;});
 assert.equal(oldResize.cancelled,true);assert.equal(oldGhost.removed,true);
 assert.deepEqual(panel.motions[1].frames,[{height:'110px'},{height:'65px'}]);
 oldResize.finish();assert.equal(panel.style.overflow,'hidden');assert.equal(panel.children.length,1);
 panel.motions[1].finish();assert.equal(panel.style.overflow,'');assert.equal(panel.children.length,0);
});
test('reduced motion switches immediately and cancels a previous transition; absent panel still updates',()=>{
 const {panel}=fixture();let reduce=false,updates=0;
 const motion=createRevealMotion({reduceMotion:()=>reduce});
 motion.run(panel,()=>{panel.body=node();});reduce=true;
 motion.run(panel,()=>{updates++;panel.body=node();});
 assert.equal(updates,1);assert.equal(panel.motions.length,1);assert.equal(panel.children.length,0);
 assert.equal(panel.style.overflow,'');assert.equal(panel.body.motions.length,0);
 motion.run(null,()=>updates++);assert.equal(updates,2);
});
