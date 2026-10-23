import test from 'node:test';
import assert from 'node:assert/strict';
import {answerEntries,updateAnswerEntries,initial} from '../dist/model.js';
import {contentXML} from '../dist/siq.js';

test('individual answers append, insert, edit and remove without losing their order',()=>{
 let value='Первый\nВторой';
 value=updateAnswerEntries(value,{text:'  Третий  '});assert.deepEqual(answerEntries(value),['Первый','Второй','Третий']);
 value=updateAnswerEntries(value,{text:'Между',after:0});assert.equal(value,'Первый\nМежду\nВторой\nТретий');
 value=updateAnswerEntries(value,{text:'Исправлен',index:1});assert.equal(value,'Первый\nИсправлен\nВторой\nТретий');
 value=updateAnswerEntries(value,{remove:true,index:1});assert.equal(value,'Первый\nВторой\nТретий');
 assert.equal(updateAnswerEntries('Единственный',{remove:true,index:0}),'');
});

test('empty, multiline and stale-index submissions fail instead of altering the list',()=>{
 const value='Первый\nВторой';
 for(const change of [{text:' '},{text:'Два\nответа'},{text:'Текст',index:3},{text:'Текст',after:3},{remove:true},{remove:true,index:-1}])assert.throws(()=>updateAnswerEntries(value,change));
 assert.deepEqual(answerEntries('  Первый\r\n\n Второй  '),['Первый','Второй']);
 assert.deepEqual(answerEntries(''),[]);
});

test('answer list editing preserves the main answer and SIQ right/wrong groups',()=>{
 const p=initial(),q=p.rounds[0].themes[0].questions[0],main=q.answer;
 q.alternatives=updateAnswerEntries('',{text:'A&B'});q.alternatives=updateAnswerEntries(q.alternatives,{text:'Верная формулировка'});
 q.wrong=updateAnswerEntries('',{text:'Неверный <ответ>'});
 const xml=contentXML(p);assert.equal(q.answer,main);
 assert.ok(xml.includes(`<right><answer>${main}</answer><answer>A&amp;B</answer><answer>Верная формулировка</answer></right>`));
 assert.ok(xml.includes('<wrong><answer>Неверный &lt;ответ&gt;</answer></wrong>'));
});
