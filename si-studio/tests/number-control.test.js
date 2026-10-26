import test from 'node:test';
import assert from 'node:assert/strict';
import {nudgedNumber,nudgeNumber} from '../dist/number-control.js';

test('price buttons add 100 to arbitrary integers and stop at price boundaries',()=>{
 assert.equal(nudgedNumber('325',1),425);
 assert.equal(nudgedNumber('325',-1),225);
 assert.equal(nudgedNumber('25',-1),0);
 assert.equal(nudgedNumber('2147483600',1),2147483647);
 assert.equal(nudgedNumber('',1),100);
 assert.equal(nudgedNumber('7',1,{min:1,max:1000,increment:1}),8);
 assert.equal(nudgedNumber('1',-1,{min:1,max:1000,increment:1}),1);
});
test('buttons use the normal input and change events so automatic saving receives the new price',()=>{
 const events=[];
 const input={value:'325',min:'0',max:'2147483647',matches:()=>false,focus:()=>events.push('focus'),dispatchEvent:event=>events.push([event.type,event.bubbles,input.value])};
 const control={dataset:{increment:'100'},querySelector:()=>input};
 const button={dataset:{delta:'1'},closest:()=>control};
 nudgeNumber(button);
 assert.equal(input.value,'425');
 assert.deepEqual(events,['focus',['input',true,'425'],['change',true,'425']]);
 input.matches=()=>true;events.length=0;
 nudgeNumber(button);
 assert.equal(input.value,'425');assert.deepEqual(events,[]);
});
