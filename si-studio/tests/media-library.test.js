import test from 'node:test';
import assert from 'node:assert/strict';
import {collectLibraryMedia,groupLibraryMedia,installExclusivePlayback,mountMediaLibrary} from '../dist/media-library.js';

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
 const themes=groupLibraryMedia(items);
 assert.deepEqual(themes.map(group=>[group.roundKey,group.round,group.theme]),[['r1','Первый','Общая'],['r1','Первый','Вторая'],['r2','Второй','Общая']]);
 assert.deepEqual(themes.map(group=>group.label),['Общая','Вторая','Общая']);
 assert.deepEqual(themes.map(group=>group.items.map(item=>item.id)),[['shared','a'],['b'],['shared','c']]);
 assert.equal(new Set(themes.map(group=>group.key)).size,3);
});

test('usage details retain every question and step even when a file repeats within a theme',()=>{
 const pack={rounds:[{id:'r',name:'Раунд',themes:[{id:'t',name:'Тема',questions:[{id:'q1',price:100,steps:[{id:'s1',type:'image',mediaId:'x'},{id:'s2',type:'image',mediaId:'x'}]},{id:'q2',price:200,steps:[{id:'s3',type:'image',mediaId:'x'}]}]}]}]};
 const [item]=collectLibraryMedia(pack);assert.equal(item.locations.length,1);
 assert.deepEqual(item.locations[0].uses.map(use=>[use.roundId,use.themeId,use.questionId,use.stepId,use.questionNumber,use.stepNumber,use.price]),[['r','t','q1','s1',1,1,100],['r','t','q1','s2',1,2,100],['r','t','q2','s3',2,1,200]]);
 assert.equal(groupLibraryMedia([item])[0].items.length,1);
});

test('library always renders round/theme hierarchy and the shared grid/gallery switch without grouping controls',async t=>{
 const previousObserver=globalThis.IntersectionObserver,previousMatch=globalThis.matchMedia,previousWidth=globalThis.innerWidth,previousHeight=globalThis.innerHeight;
 globalThis.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
 globalThis.matchMedia=()=>({matches:true});globalThis.innerWidth=1280;globalThis.innerHeight=720;
 t.after(()=>{globalThis.IntersectionObserver=previousObserver;globalThis.matchMedia=previousMatch;globalThis.innerWidth=previousWidth;globalThis.innerHeight=previousHeight;});
 const pack={rounds:[{id:'r1',name:'Первый <раунд>',themes:[{id:'t1',name:'Фото & история',questions:[{steps:[{type:'image',mediaId:'a'}]},{steps:[{type:'image',mediaId:'a'}]}]},{id:'t2',name:'Другая тема',questions:[{steps:[{type:'image',mediaId:'b'}]}]}]},{id:'r2',name:'Второй раунд',themes:[{id:'t3',name:'Фото & история',questions:[{steps:[{type:'image',mediaId:'a'}]}]}]}]};
 const popupHandlers=new Map(),navigated=[];let popup=null,focusRestored=0;
 const ownerDocument={createElement(tag){
  assert.equal(tag,'dialog');
  popup={innerHTML:'',dataset:{},style:{},offsetWidth:420,offsetHeight:180,open:false,removed:false,setAttribute(){},addEventListener:(name,fn)=>popupHandlers.set(name,fn),showModal(){this.open=true;},close(){this.open=false;},remove(){this.removed=true;},getBoundingClientRect:()=>({left:100,top:100,right:520,bottom:280}),querySelector:()=>({focus(){}})};
  return popup;
 }};
 const handlers=new Map(),root={ownerDocument,append(){},innerHTML:'',querySelectorAll:()=>[],querySelector:selector=>selector.includes('data-library-mode')?{focus(){}}:null,contains:()=>true,addEventListener:(name,handler)=>handlers.set(name,handler),removeEventListener(){}};
 const dispose=mountMediaLibrary(root,{items:collectLibraryMedia(pack),blob:()=>null,size:()=>100,onNavigate:use=>navigated.push(use)});
 const assertHierarchy=()=>{
  assert.equal((root.innerHTML.match(/class="library-round-title"/g)||[]).length,2);
  assert.equal((root.innerHTML.match(/class="library-group-title"/g)||[]).length,3);
  assert.match(root.innerHTML,/Первый &lt;раунд&gt;/);assert.match(root.innerHTML,/Фото &amp; история/);
  assert.ok(!root.innerHTML.includes('data-library-group'));assert.ok(!root.innerHTML.includes('<select'));
  assert.match(root.innerHTML,/library-view-switch studio-binary-switch/);
 };
 assertHierarchy();assert.match(root.innerHTML,/library-grid is-grouped/);assert.match(root.innerHTML,/data-second="false"/);
 handlers.get('click')({target:{closest:()=>({dataset:{libraryMode:'gallery'}})}});
 assertHierarchy();assert.match(root.innerHTML,/library-gallery/);assert.match(root.innerHTML,/data-second="true"/);
 assert.match(root.innerHTML,/library-preview-media/);assert.match(root.innerHTML,/library-strip-round/);
 assert.ok(!root.innerHTML.includes('<details'));assert.ok(!root.innerHTML.includes('Где используется'));
 assert.match(root.innerHTML,/<small>[^<]*МБ<\/small><button[^>]*data-library-show-uses="a"/);
 const anchor={dataset:{libraryShowUses:'a'},isConnected:true,focus:()=>focusRestored++,getBoundingClientRect:()=>({left:900,right:980,top:400,bottom:432})};
 handlers.get('click')({target:{closest:()=>anchor}});
 assert.equal(popup.open,true);assert.equal((popup.innerHTML.match(/<li>/g)||[]).length,3);
 assert.match(popup.innerHTML,/Вопрос 1 · элемент 1/);assert.match(popup.innerHTML,/Вопрос 2 · элемент 1/);assert.match(popup.innerHTML,/data-library-use="1:0"/);
 let cancelled=false,stopped=false;
 popupHandlers.get('cancel')({preventDefault(){cancelled=true;},stopPropagation(){stopped=true;}});
 assert.equal(cancelled,true);assert.equal(stopped,true);assert.equal(popup.removed,true);assert.equal(focusRestored,1);assert.equal(navigated.length,0);
 handlers.get('click')({target:{closest:()=>anchor}});
 handlers.get('click')({target:{closest:()=>({dataset:{libraryUse:'1:0',libraryId:'a'}})}});
 await Promise.resolve();
 assert.equal(popup.removed,true);assert.equal(navigated.length,1);
 assert.equal(navigated[0].roundId,'r2');assert.equal(navigated[0].themeId,'t3');assert.equal(navigated[0].stepNumber,1);

 handlers.get('click')({target:{closest:()=>({dataset:{libraryMode:'grid'}})}});
 assertHierarchy();assert.match(root.innerHTML,/library-grid is-grouped/);
 dispose();
});
