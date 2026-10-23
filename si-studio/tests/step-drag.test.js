import test from 'node:test';
import assert from 'node:assert/strict';
import {reorderSteps} from '../dist/step-drag.js';
import {step} from '../dist/model.js';
test('drop moves complete step objects before a target or to the end without mutating input',()=>{const a=step('text','Вопрос'),b={...step('image'),mediaId:'photo',duration:12},c={...step('answer'),duration:20};const original=[a,b,c];assert.deepEqual(reorderSteps(original,c.id,a.id),[c,a,b]);assert.deepEqual(reorderSteps(original,a.id,null),[b,c,a]);assert.deepEqual(original,[a,b,c]);assert.equal(reorderSteps(original,b.id,a.id)[0],b);assert.equal(b.mediaId,'photo');assert.equal(c.duration,20);});
test('same position and invalid drop targets leave ordering and undo history unchanged',()=>{const a=step(),b=step('answer'),steps=[a,b];assert.equal(reorderSteps(steps,a.id,b.id),steps);assert.equal(reorderSteps(steps,b.id,null),steps);assert.equal(reorderSteps(steps,a.id,a.id),steps);assert.equal(reorderSteps(steps,'external',b.id),steps);assert.equal(reorderSteps(steps,a.id,'missing'),steps);});
