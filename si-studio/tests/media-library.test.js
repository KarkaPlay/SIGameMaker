import test from 'node:test';
import assert from 'node:assert/strict';
import {collectLibraryMedia,groupLibraryMedia,installExclusivePlayback} from '../dist/media-library.js';

test('library collects referenced media once across rounds, excluding unused and non-media steps',()=>{
 const pack={rounds:[{themes:[{questions:[{steps:[{type:'image',mediaId:'photo',filename:'Фото.png'},{type:'text',mediaId:'ignored'},{type:'audio',mediaId:'song',filename:'Песня.mp3'}]}]}]},{themes:[{questions:[{steps:[{type:'image',mediaId:'photo',filename:'Копия.png'},{type:'video',mediaId:'clip'},{type:'image'}]}]}]}]};
 assert.deepEqual(collectLibraryMedia(pack).map(({locations,...item})=>item),[{id:'photo',type:'image',filename:'Фото.png'},{id:'song',type:'audio',filename:'Песня.mp3'},{id:'clip',type:'video',filename:'Без названия'}]);
});

test('playing another track stops and rewinds previous media; disposal removes listener and stops playback',()=>{
 const players=Array.from({length:3},()=>({readyState:1,currentTime:25,paused:false,pause(){this.paused=true;},matches:selector=>selector==='audio,video'}));
 let handler,removed=false;
 const root={querySelectorAll:()=>players,addEventListener(type,fn,capture){assert.equal(type,'play');assert.equal(capture,true);handler=fn;},removeEventListener(type,fn,capture){assert.equal(fn,handler);assert.equal(capture,true);removed=true;}};
 const dispose=installExclusivePlayback(root);
 handler({target:players[1]});
 assert.equal(players[0].paused,true);assert.equal(players[0].currentTime,0);
 assert.equal(players[1].paused,false);assert.equal(players[1].currentTime,25);
 assert.equal(players[2].paused,true);assert.equal(players[2].currentTime,0);
 players[0].paused=false;handler({target:players[0]});
 assert.equal(players[1].paused,true);assert.equal(players[1].currentTime,0);
 dispose();assert.equal(removed,true);assert.ok(players.every(player=>player.paused&&player.currentTime===0));
});

test('stopping an unloaded media element does not attempt to seek',()=>{
 const unloaded={readyState:0,pause(){},set currentTime(value){throw Error('Cannot seek before metadata');}};
 let handler;
 const root={querySelectorAll:()=>[unloaded],addEventListener(type,fn){handler=fn;},removeEventListener(){}};
 const dispose=installExclusivePlayback(root);
 handler({target:{matches:()=>true}});dispose();
});


test('grouping preserves pack order and every usage without duplicating files within a group',()=>{
 const q=steps=>({steps:steps.map(id=>({type:'image',mediaId:id,filename:id}))});
 const pack={rounds:[{id:'r1',name:'Первый',themes:[{id:'t1',name:'Общая',questions:[q(['shared','a','shared'])]},{id:'t2',name:'Вторая',questions:[q(['b'])]}]},{id:'r2',name:'Второй',themes:[{id:'t3',name:'Общая',questions:[q(['shared','c'])]}]}]};
 const items=collectLibraryMedia(pack);
 assert.equal(items.length,4);assert.equal(items[0].locations.length,2);
 assert.deepEqual(groupLibraryMedia(items).map(group=>group.items.map(item=>item.id)),[['shared','a','b','c']]);
 const rounds=groupLibraryMedia(items,'round');
 assert.deepEqual(rounds.map(group=>group.label),['Первый','Второй']);
 assert.deepEqual(rounds.map(group=>group.items.map(item=>item.id)),[['shared','a','b'],['shared','c']]);
 const themes=groupLibraryMedia(items,'theme');
 assert.deepEqual(themes.map(group=>group.label),['Первый · Общая','Первый · Вторая','Второй · Общая']);
 assert.deepEqual(themes.map(group=>group.items.map(item=>item.id)),[['shared','a'],['b'],['shared','c']]);
 assert.equal(new Set(themes.map(group=>group.key)).size,3);
});

test('usage details retain every question and step even when a file repeats within a theme',()=>{
 const pack={rounds:[{id:'r',name:'Раунд',themes:[{id:'t',name:'Тема',questions:[{id:'q1',price:100,steps:[{id:'s1',type:'image',mediaId:'x'},{id:'s2',type:'image',mediaId:'x'}]},{id:'q2',price:200,steps:[{id:'s3',type:'image',mediaId:'x'}]}]}]}]};
 const [item]=collectLibraryMedia(pack);assert.equal(item.locations.length,1);
 assert.deepEqual(item.locations[0].uses.map(use=>[use.roundId,use.themeId,use.questionId,use.stepId,use.questionNumber,use.stepNumber,use.price]),[['r','t','q1','s1',1,1,100],['r','t','q1','s2',1,2,100],['r','t','q2','s3',2,1,200]]);
 assert.equal(groupLibraryMedia([item],'theme')[0].items.length,1);
});
