import test from 'node:test';
import assert from 'node:assert/strict';
import {mountPreviewShowman} from '../dist/preview-view.js';
function fixture(){
 const calls=[],listeners=new Map();let focused=0;
 const popup={hidden:false,querySelector:()=>({addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)}),closest:()=>({querySelector:()=>({focus:()=>focused++})}),animate:(frames,options)=>{let resolve,reject;const motion={frames,options,cancelled:false,finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),cancel(){this.cancelled=true;reject();},finish:()=>resolve()};motion.finished.catch(()=>{});calls.push(motion);return motion;}};
 return {popup,calls,listeners,focused:()=>focused};
}
globalThis.getComputedStyle=()=>({opacity:'.6',transform:'matrix(1,0,0,1,-8,0)'});
test('showman popup enters from left, closes from its current position and returns keyboard focus',async()=>{
 const f=fixture(),dispose=mountPreviewShowman(f.popup,{reducedMotion:()=>false});
 assert.match(f.calls[0].frames[0].transform,/translateX\(-/);assert.equal(f.calls[0].frames[1].opacity,1);
 f.listeners.get('click')();assert.equal(f.calls[0].cancelled,true);assert.equal(f.calls[1].frames[0].opacity,'.6');assert.equal(f.popup.hidden,false);
 f.calls[1].finish();await Promise.resolve();assert.equal(f.popup.hidden,true);assert.equal(f.focused(),1);
 dispose();assert.equal(f.listeners.size,0);
});
test('navigation cancels popup animations and prevents stale close callbacks changing focus',async()=>{
 const f=fixture(),dispose=mountPreviewShowman(f.popup,{reducedMotion:()=>false});f.listeners.get('click')();dispose();
 f.calls[1].finish();await Promise.resolve();assert.equal(f.popup.hidden,false);assert.equal(f.focused(),0);assert.ok(f.calls.every(m=>m.cancelled));assert.equal(f.listeners.size,0);
});
test('reduced motion displays and dismisses immediately without animations',()=>{
 const f=fixture(),dispose=mountPreviewShowman(f.popup,{reducedMotion:()=>true});assert.equal(f.calls.length,0);assert.equal(f.popup.hidden,false);
 f.listeners.get('click')();assert.equal(f.popup.hidden,true);assert.equal(f.calls.length,0);dispose();
 assert.doesNotThrow(()=>mountPreviewShowman(null)());
});
