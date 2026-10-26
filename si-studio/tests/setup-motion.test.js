import test from 'node:test';
import assert from 'node:assert/strict';
import {createSetupMotion,setupSpring,setupGeometryFrames,setupStageSources} from '../dist/setup-motion.js';

// Deterministic layout and WAAPI doubles: these exercise ancestry, interruption,
// cleanup and geometry at desktop sizes, without opening a browser.
function fixture({width=1280,height=720,manual=false,reduced=false}={}){
 const animations=[],nodes=[];
 class Element{
  constructor(name='div',box={left:0,top:0,width:100,height:40,borderRadius:12}){this.name=name;this.box=box;this.children=[];this.parentElement=null;this.className='';this.attrs=new Map();this.hidden=false;this.isConnected=true;this.style={visibility:'',height:'',setProperty(k,v){this[k]=v;}};this.lookup=new Map();this.dataset={};nodes.push(this);}
  get classList(){return {contains:n=>this.className.split(' ').includes(n),add:n=>{if(!this.className.split(' ').includes(n))this.className+=' '+n;},remove:n=>{this.className=this.className.split(' ').filter(c=>c!==n).join(' ');}};}
  getClientRects(){return this.hidden?[]:[this.box];}
  getBoundingClientRect(){return this.box;}
  setAttribute(k,v){this.attrs.set(k,String(v));}
  hasAttribute(k){return this.attrs.has(k);}
  removeAttribute(k){this.attrs.delete(k);}
  querySelector(s){return this.lookup.get(s)?.[0]||null;}
  querySelectorAll(s){if(s==='*')return this.children.flatMap(n=>[n,...n.querySelectorAll('*')]);return this.lookup.get(s)||[];}
  cloneNode(deep){const n=new Element(this.name,{...this.box});n.className=this.className;n.attrs=new Map(this.attrs);n.style={...this.style};if(deep)for(const c of this.children)n.append(c.cloneNode(true));return n;}
  append(...els){for(const el of els){el.parentElement?.removeChild(el);this.children.push(el);el.parentElement=this;}}
  removeChild(el){this.children=this.children.filter(n=>n!==el);el.parentElement=null;}
  remove(){this.parentElement?.removeChild(this);this.isConnected=false;}
  contains(el){return this===el||this.children.some(n=>n.contains(el));}
  animate(frames,options){let resolve,reject;const finished=new Promise((a,b)=>{resolve=a;reject=b;});const a={el:this,frames,options,finished,cancelled:false,done:false,finish(){if(!a.done){a.done=true;resolve();}},cancel(){a.cancelled=true;if(!a.done){a.done=true;reject(Error('cancelled'));}}};animations.push(a);if(!manual)a.finish();return a;}
 }
 globalThis.matchMedia=()=>({matches:reduced});
 globalThis.getComputedStyle=el=>({background:'#315dcc',border:'1px solid #89aaf3',borderRadius:'12px',borderTopLeftRadius:'12px',boxShadow:'none',color:'#fff',font:'14px sans-serif',padding:'12px',display:'block',flexDirection:'column',justifyContent:'start',alignItems:'stretch',gap:'0',boxSizing:'border-box',transform:el.transform||'none',opacity:el.opacity??'1',filter:el.filter||'none',width:el.box.width+'px',height:el.box.height+'px'});
 globalThis.document={createElement:()=>new Element()};
 const root=new Element('root',{left:0,top:0,width,height,borderRadius:0});
 const surface=(name,box)=>{const el=new Element(name,box);el.setAttribute('data-motion-surface','');return el;};
 const select=(selector,els)=>root.lookup.set(selector,Array.isArray(els)?els:[els]);
 const projections=()=>root.children.filter(n=>n.className==='nu-motion-projection');
 return {Element,root,animations,nodes,surface,select,projections,motion:createSetupMotion(root),finish(){animations.forEach(a=>a.finish());}};
}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

test('shared spring has exact endpoints, positive sizes, no overshoot or perspective at either desktop size',()=>{
 assert.equal(setupSpring(0),0);assert.equal(setupSpring(1),1);
 for(let i=1;i<=100;i++)assert.ok(setupSpring(i/100)>=setupSpring((i-1)/100));
 for(const width of [1280,1440]){
  const from={left:100,top:200,width:width-200,height:350,borderRadius:22},to={left:500,top:280,width:width-550,height:240,borderRadius:16},frames=setupGeometryFrames(from,to);
  for(const key of ['left','top','width','height','borderRadius']){assert.equal(Number.parseFloat(frames[0][key]),from[key]);assert.equal(Number.parseFloat(frames.at(-1)[key]),to[key]);}
  assert.ok(frames.every(f=>Number.parseFloat(f.width)>0&&Number.parseFloat(f.height)>0));
  assert.ok(frames.every(f=>!('opacity'in f)&&!('clipPath'in f)&&!('transform'in f)));
 }
});

test('review preserves each round identity and gives genuinely new blocks an explicit owner',()=>{
 const board={name:'selected board'},tab={name:'other tab'},progress={name:'step 2'};
 const before=new Map([['surface',board],['round:1',board],['round:2',tab],['progress',progress]]);
 const diagram={name:'diagram'},title={name:'heading'},surface={name:'selected review card',surface:true};
 const after=new Map([['surface',surface],['round:1',surface],['round:2',{}],['diagram',diagram],['title',title],['identity',{}],['summary',{}],['settings',{}]]);
 const links=new Map(setupStageSources(before,after).map(l=>[l.key,l]));
 assert.equal(links.get('surface').source,board);assert.equal(links.get('round:1').source,board);assert.equal(links.get('round:2').source,tab);
 assert.equal(links.get('identity').owner,title);assert.equal(links.get('summary').owner,diagram);assert.equal(links.get('settings').owner,board);
});

test('reduced motion applies stage and local updates immediately without reading layout or cloning',async()=>{
 const {motion}=fixture({reduced:true});let renders=0,changes=0;
 const forbidden=new Proxy({},{get(){throw Error('No geometry should be read');}});
 await motion.stage(forbidden,()=>renders++,1);await motion.update(forbidden,()=>changes++,forbidden);
 await motion.modal(forbidden,forbidden);await motion.dismiss(forbidden);await motion.enter(forbidden);
 await motion.language(forbidden,()=>changes++);
 assert.equal(renders,1);assert.equal(changes,2);
});

for(const [width,height]of [[1280,720],[1440,900]])test(`blue surface survives forward and backward transitions at ${width}×${height}`,async()=>{
 const f=fixture({width,height}),about=f.surface('about',{left:110,top:220,width:width-220,height:350,borderRadius:22}),board=f.surface('board',{left:510,top:280,width:width-550,height:240,borderRadius:16});
 f.select('[data-motion-surface]',about);
 await f.motion.stage(null,()=>f.select('[data-motion-surface]',board),1);
 assert.equal(board.style.visibility,'');assert.equal(f.projections().length,0);
 const geometry=f.animations.find(a=>'left'in a.frames[0]);assert.equal(geometry.frames[0].left,'110px');assert.equal(geometry.frames.at(-1).left,'510px');
 await f.motion.stage(null,()=>f.select('[data-motion-surface]',about),-1);
 assert.equal(about.style.visibility,'');assert.equal(f.projections().length,0);
 assert.ok(f.animations.every(a=>a.frames.every(frame=>!String(frame.transform).includes('rotate')&&!('opacity'in frame))));
});

test('cancelling an in-flight transition removes every inert projection and restores the true surface',async()=>{
 const f=fixture({manual:true}),about=f.surface('about',{left:100,top:200,width:1000,height:350,borderRadius:22}),board=f.surface('board',{left:500,top:300,width:640,height:240,borderRadius:16});
 f.select('[data-motion-surface]',about);
 const pending=f.motion.stage(null,()=>f.select('[data-motion-surface]',board),1);
 assert.equal(board.style.visibility,'hidden');assert.equal(f.projections().length,1);
 assert.ok(f.projections().every(el=>el.inert&&el.attrs.get('aria-hidden')==='true'));
 f.motion.dispose();await pending;
 assert.equal(board.style.visibility,'');assert.equal(f.projections().length,0);
});

test('an old internal label remains retracted until the shared material has finished moving',async()=>{
 const f=fixture({manual:true}),old=f.surface('old',{left:0,top:0,width:900,height:300,borderRadius:20}),next=f.surface('next',{left:400,top:80,width:500,height:200,borderRadius:16});
 f.select('[data-motion-surface]',old);
 const pending=f.motion.stage(null,()=>f.select('[data-motion-surface]',next),1);
 const label=f.animations.find(a=>a.options.duration===240);label.finish();await settle();
 assert.equal(label.cancelled,false,'the exited content must not snap back while its container is still moving');
 f.finish();await pending;assert.equal(f.projections().length,0);
});

test('a rapid round update cannot restore hidden visibility from an older transition',async()=>{
 const f=fixture({manual:true}),board=f.surface('board',{left:400,top:200,width:640,height:250,borderRadius:16});
 f.select('[data-motion-surface]',board);f.select('.nu-gameboard',board);
 const first=f.motion.update(null,()=>{},null),firstAnimations=[...f.animations];
 const second=f.motion.update(null,()=>{},null);
 assert.equal(board.style.visibility,'hidden');
 firstAnimations.forEach(a=>a.finish());await first;
 assert.equal(board.style.visibility,'hidden','the newer transition still owns concealment');
 f.finish();await second;assert.equal(board.style.visibility,'');assert.equal(f.projections().length,0);
});

test('dialog entry and exit use the same trigger and do not leave a transform after finishing',async()=>{
 const f=fixture(),button=new f.Element('button',{left:1040,top:620,width:180,height:50,borderRadius:12}),modal=new f.Element('modal',{left:160,top:140,width:960,height:440,borderRadius:22});
 await f.motion.modal(modal,button);await f.motion.dismiss(modal);
 const [open,close]=f.animations;assert.ok(open.frames[0].transform.includes('880px'));
 assert.ok(close.frames.at(-1).transform.includes('880px'));assert.ok(open.cancelled&&close.cancelled);
});

test('the selected board becomes its own review card while another card comes from its round tab',async()=>{
 const f=fixture();
 const board=f.surface('board',{left:500,top:280,width:640,height:240,borderRadius:16});board.dataset.motionRound='1';
 const tab1=new f.Element('tab1',{left:34,top:196,width:150,height:38,borderRadius:9}),tab2=new f.Element('tab2',{left:191,top:196,width:150,height:38,borderRadius:9});
 tab1.dataset={round:'1',motionRound:'1'};tab2.dataset={round:'2',motionRound:'2'};
 f.select('[data-motion-surface]',board);f.select('[data-motion-round]',[tab1,tab2,board]);f.select('[data-round]',[tab1,tab2]);
 const card1=f.surface('card1',{left:200,top:300,width:300,height:210,borderRadius:14}),card2=new f.Element('card2',{left:516,top:300,width:300,height:210,borderRadius:14});card1.dataset.motionRound='1';card2.dataset.motionRound='2';
 await f.motion.stage(null,()=>{f.select('[data-motion-surface]',card1);f.select('[data-motion-round]',[card1,card2]);f.select('[data-round]',[]);},1);
 const geometry=f.animations.filter(a=>'left'in a.frames[0]);
 assert.ok(geometry.some(a=>a.frames[0].left==='500px'&&a.frames.at(-1).left==='200px'));
 assert.ok(geometry.some(a=>a.frames[0].left==='191px'&&a.frames.at(-1).left==='516px'));
 assert.equal(card1.style.visibility,'');assert.equal(card2.style.visibility,'');assert.equal(f.projections().length,0);
});

test('changing a selected round does not mistakenly animate its old board rectangle onto the tab',async()=>{
 const f=fixture(),board=f.surface('board',{left:500,top:280,width:640,height:240,borderRadius:16});board.dataset.motionRound='1';
 const tab1=new f.Element('tab1',{left:34,top:196,width:150,height:38,borderRadius:9}),tab2=new f.Element('tab2',{left:191,top:196,width:150,height:38,borderRadius:9});
 tab1.dataset={round:'1',motionRound:'1'};tab2.dataset={round:'2',motionRound:'2'};
 f.select('[data-motion-surface]',board);f.select('[data-motion-round]',[tab1,tab2,board]);f.select('[data-round]',[tab1,tab2]);f.select('.nu-gameboard',board);
 await f.motion.update(null,()=>{board.dataset.motionRound='2';},tab2);
 assert.equal(f.animations.filter(a=>a.el===tab1||a.el===tab2).length,0);
 assert.equal(board.style.visibility,'');assert.equal(f.projections().length,0);
});

test('language retargeting cancels previous motion and preserves the CSS end position',async()=>{
 const f=fixture({manual:true}),thumb=new f.Element('thumb',{left:900,top:460,width:100,height:38,borderRadius:20}),toggle=new f.Element('toggle');toggle.lookup.set('.nu-language-thumb',[thumb]);
 const first=f.motion.language(toggle,()=>{thumb.box.left=1000;thumb.transform='matrix(1,0,0,1,100,0)';});
 assert.ok(f.animations[0].frames.at(-1).transform.endsWith('matrix(1,0,0,1,100,0)'));
 const second=f.motion.language(toggle,()=>{thumb.box.left=900;thumb.transform='matrix(1,0,0,1,0,0)';});
 assert.equal(f.animations[0].cancelled,true);f.finish();await Promise.all([first,second]);
 assert.ok(f.animations.at(-1).frames.at(-1).transform.endsWith('matrix(1,0,0,1,0,0)'));
});


function reviewFixture(options={}){
 const f=fixture(options),make=(name,box)=>new f.Element(name,box);
 const deck=[1,2,3].map((id,i)=>{const el=make('board'+id,{left:560+i*20,top:280+i*72,width:i?563:640,height:i?220:250,borderRadius:16});el.dataset.boardRound=String(id);el.opacity=i===0?'1':i===1?'.32':'0';el.filter=i?'brightness(1.65) saturate(.4) blur(2px)':'none';if(!i)el.setAttribute('data-motion-surface','');return el;});
 const cards=[1,2,3].map((id,i)=>{const el=make('card'+id,{left:200+i*220,top:310,width:200,height:210,borderRadius:14});el.dataset.editRound=String(id);if(!i)el.setAttribute('data-motion-surface','');return el;});
 const title=make('editor title',{left:34,top:120,width:500,height:36}),subtitle=make('editor subtitle',{left:34,top:164,width:650,height:24});
 const readyTitle=make('ready title',{left:290,top:150,width:700,height:40}),readyName=make('pack name',{left:400,top:200,width:400,height:28});
 const settings=make('settings',{left:34,top:240,width:390,height:340}),bar=make('roundbar',{left:34,top:190,width:1212,height:42});
 const summary=make('stats',{left:460,top:550,width:360,height:65});
 const show=ready=>{
  for(const [sel,el]of Object.entries({'[data-board-round]':ready?[]:deck,'[data-edit-round]':ready?cards:[],'.nu-canvas':ready?[]:make('canvas',{left:450,top:230,width:780,height:320}),'.nu-round-diagram':ready?make('diagram',{left:180,top:280,width:1000,height:250}):[],'#nu-title':ready?[]:title,'#nu-subtitle':ready?[]:subtitle,'.nu-celebration h1':ready?readyTitle:[],'.nu-ready-name':ready?readyName:[],'.nu-settings':ready?[]:settings,'.nu-roundbar':ready?[]:bar,'.nu-ready-summary':ready?summary:[]}))f.select(sel,el);
 };
 return {...f,deck,cards,show};
}

for(const [width,height]of [[1280,720],[1440,900]])for(const direction of [1,-1])test(`all visible and rear boards share their review cards, direction ${direction}, ${width}px`,async()=>{
 const f=reviewFixture({width,height,manual:true});f.show(direction<0);
 const pending=f.motion.review(()=>f.show(direction>0),direction);
 assert.equal(f.root.inert,true);
 const bridges=f.root.children.filter(el=>el.hasAttribute('data-review-round'));
 assert.equal(bridges.length,3,'every stable round has its own flight');
 assert.deepEqual(bridges.map(el=>el.attrs.get('data-review-round')),['1','2','3']);
 const hidden=bridges[2],hiddenFlight=f.animations.find(a=>a.el===hidden&&'transform'in a.frames[0]);
 assert.equal(direction>0?hiddenFlight.frames[0].opacity:hiddenFlight.frames.at(-1).opacity,0,'the distant card emerges from or returns to the rear');
 assert.ok(hiddenFlight.frames[1].opacity>0,'the rear card becomes visible during its shared flight');
 assert.equal(hiddenFlight.frames.at(-1).transform,'none');
 for(const [sourceName,targetName]of direction>0?[['editor title','ready title'],['editor subtitle','pack name']]:[['ready title','editor title'],['pack name','editor subtitle']]){
  const bridge=f.root.children.find(el=>el.children[0]?.name===sourceName&&el.children[1]?.name===targetName);
  assert.ok(bridge,`${sourceName} keeps a shared path to ${targetName}`);
  assert.ok(f.animations.some(a=>a.el===bridge&&a.frames.at(-1).transform==='none'));
 }
 const panelSlides=f.animations.filter(a=>a.frames.some(frame=>String(frame.transform).includes('translateX(-464px)')));
 assert.equal(panelSlides.length,1,'the settings panel leaves beyond the left edge as a whole');
 assert.equal(panelSlides[0].frames[direction>0?1:0].transform,'translateX(-464px)');
 const target=direction>0?f.cards:f.deck;assert.ok(target.every(el=>el.style.visibility===''),'real card destinations stay mounted throughout');
 for(const el of target){const flight=f.animations.find(a=>a.el===el&&'transform'in a.frames[0]);assert.ok(flight);assert.equal(flight.frames.at(-1).transform,el.transform||'none');}
 assert.ok(f.root.classList.contains('nu-review-settling'));
 f.finish();await pending;
 assert.ok(target.every(el=>el.style.visibility===''));assert.equal(f.root.inert,false);assert.equal(f.root.children.length,0);assert.ok(f.animations.every(a=>a.cancelled));
});

test('review interruption releases all round targets, temporary layers and input ownership',async()=>{
 const f=reviewFixture({manual:true});f.show(false);const pending=f.motion.review(()=>f.show(true),1);
 f.motion.dispose();await pending;
 assert.ok(f.cards.every(el=>el.style.visibility===''));assert.equal(f.root.inert,false);assert.equal(f.root.children.length,0);assert.ok(f.animations.every(a=>a.cancelled));
});

test('reduced motion applies review without capturing a board or starting animations',async()=>{
 const f=fixture({reduced:true});let renders=0;
 f.root.getBoundingClientRect=()=>{throw Error('No layout expected');};
 await f.motion.review(()=>renders++,1);
 assert.equal(renders,1);assert.equal(f.animations.length,0);
});

test('review measures a crisp active destination and lands on the exact native matrix',async()=>{
 const f=reviewFixture({manual:true});f.show(true);
 const readStyle=globalThis.getComputedStyle;
 globalThis.getComputedStyle=el=>{
  const css=readStyle(el);
  if(el.nativeWidth)css.width=el.nativeWidth+'px';
  if(el.nativeHeight)css.height=el.nativeHeight+'px';
  if(el===f.deck[0]){const settled=f.root.classList.contains('nu-review-settling');css.opacity=settled?'1':'.32';css.filter=settled?'brightness(1) saturate(1) blur(0px)':'blur(2px)';}
  return css;
 };
 const rear=f.deck[1];rear.nativeWidth=640;rear.nativeHeight=250;rear.box.width=640*.88;rear.box.height=250*.88;rear.transform='matrix(0.88,0,0,0.88,0,72)';
 const pending=f.motion.review(()=>f.show(false),-1);
 const activeFlight=f.animations.find(a=>a.el===f.deck[0]&&'transform'in a.frames[0]),activeReveal=f.animations.find(a=>a.el===f.deck[0]&&'opacity'in a.frames[0]);
 assert.equal(activeFlight.frames[0].filter,'none','selected return card is crisp from the start');
 assert.equal(activeFlight.frames.at(-1).filter,'brightness(1) saturate(1) blur(0px)');
 assert.equal(activeReveal.frames.at(-1).opacity,1,'fresh active card was not captured at its blurred .32 opacity');
 const flight=f.animations.find(a=>a.el===rear&&'transform'in a.frames[0]);
 assert.equal(flight.frames.at(-1).transform,rear.transform,'the native CSS transform is the actual last frame');
 const [,tx,ty,sx,sy]=flight.frames[0].transform.match(/translate\(([-\d.e]+)px,([-\d.e]+)px\) scale\(([-\d.e]+),([-\d.e]+)\)/).map((v,i)=>i?Number(v):v);
 const ox=320,oy=125,layoutLeft=rear.box.left-(1-.88)*ox,layoutTop=rear.box.top-(1-.88)*oy-72;
 assert.ok(Math.abs(layoutLeft+ox+tx+sx*(-.88*ox)-f.cards[1].box.left)<1e-8);
 assert.ok(Math.abs(layoutTop+oy+ty+sy*(72-.88*oy)-f.cards[1].box.top)<1e-8);
 f.finish();await pending;assert.equal(f.root.classList.contains('nu-review-settling'),false);
});
