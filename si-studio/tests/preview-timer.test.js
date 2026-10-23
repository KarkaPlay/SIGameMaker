import test from 'node:test';
import assert from 'node:assert/strict';
import {countdown} from '../dist/preview-timer.js';
function clock(){let time=0,tick;const cancelled=[];return {options:{now:()=>time,schedule:f=>{tick=f;return 7;},cancel:id=>cancelled.push(id)},advance:ms=>{time+=ms;tick();},cancelled};}
test('countdown uses elapsed seconds, catches up after throttling and expires exactly once',()=>{const c=clock(),ticks=[];let ended=0;countdown(3,n=>ticks.push(n),()=>ended++,c.options);assert.equal(ticks.at(-1),3);c.advance(1100);assert.equal(ticks.at(-1),2);c.advance(9000);assert.equal(ticks.at(-1),0);c.advance(1000);assert.equal(ended,1);assert.deepEqual(c.cancelled,[7]);});
test('leaving the timer cancels expiry; a new run gets the full duration',()=>{const c=clock();let ended=0,left;const stop=countdown(2,n=>left=n,()=>ended++,c.options);c.advance(1000);assert.equal(left,1);stop();c.advance(3000);assert.equal(ended,0);countdown(2,n=>left=n,()=>ended++,c.options);assert.equal(left,2);c.advance(2000);assert.equal(ended,1);});
