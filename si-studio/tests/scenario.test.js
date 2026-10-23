import test from 'node:test';
import assert from 'node:assert/strict';
import {step} from '../dist/model.js';
import {scenarioParts,insertScenarioStep} from '../dist/scenario.js';
import {reorderSteps} from '../dist/step-drag.js';
test('palettes insert full step objects on the selected side of the answer phase',()=>{const before=step('text','Вопрос'),answer=step('answer'),image={...step('image'),mediaId:'img',filename:'img.png',duration:60},audio=step('audio');const steps=[before,answer,image],next=insertScenarioStep(steps,audio,'before');assert.deepEqual(next,[before,audio,answer,image]);assert.equal(next[3],image);assert.deepEqual(steps,[before,answer,image]);assert.deepEqual(insertScenarioStep(steps,audio,'after'),[before,answer,image,audio]);assert.equal(insertScenarioStep(steps,step('answer')),steps);});
test('sections follow reordered markers and preserve empty sides without duplicating steps',()=>{const text=step('text'),marker=step('answer'),image=step('image');const steps=[text,marker,image];assert.deepEqual(scenarioParts(steps),{before:[text],answer:[marker],after:[image]});const moved=reorderSteps(steps,image.id,marker.id);assert.deepEqual(scenarioParts(moved),{before:[text,image],answer:[marker],after:[]});assert.deepEqual(scenarioParts([marker]),{before:[],answer:[marker],after:[]});assert.deepEqual(scenarioParts([text]),{before:[text],answer:[],after:[]});assert.equal(insertScenarioStep([text],image,'after').length,1);assert.deepEqual(insertScenarioStep([text],marker),[text,marker]);});

test('answer event cannot be removed and repairing a legacy draft preserves all content',async()=>{
 const {ensureAnswerStep,removeScenarioStep}=await import('../dist/scenario.js');
 const text=step('text','Вопрос'),answer=step('answer'),image={...step('image'),mediaId:'picture',duration:5};
 const steps=[text,answer,image];assert.equal(removeScenarioStep(steps,answer.id),steps);
 assert.equal(removeScenarioStep(steps,'missing'),steps);
 assert.deepEqual(removeScenarioStep(steps,text.id),[answer,image]);
 assert.equal(ensureAnswerStep(steps),steps);
 const repaired=ensureAnswerStep([text,image]);assert.equal(repaired[0],text);assert.equal(repaired[1],image);
 assert.equal(repaired[2].type,'answer');assert.equal(repaired.filter(st=>st.type==='answer').length,1);
 assert.equal(ensureAnswerStep(repaired),repaired);
});
