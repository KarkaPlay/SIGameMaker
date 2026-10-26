import test from 'node:test';
import assert from 'node:assert/strict';
import {createSetupMotion} from '../dist/setup-motion.js';
import {captureSetupHome,createSetupEntrance,createSetupDialogMotion,setupEntryTiming,setupEdgeFrames,setupClosingFrames,setupLanguageFrames} from '../dist/setup-entry-motion.js';

// A deterministic DOM/WAAPI double for ownership and cleanup. This deliberately
// does not claim to verify browser rendering, font metrics or perceived motion.
function fixture({manual=false,reduced=false,width=1280,height=720}={}){
 const animations=[];
 class Element{
  constructor(tag='div',classes='',rect={left:30,top:100,width:300,height:70}){this.tagName=tag.toUpperCase();this.className=classes;this.rect=rect;this.children=[];this.attrs=new Map();this.dataset={};this.style={visibility:'',background:'',setProperty(k,v){this[k]=v;}};this.hidden=false;}
  get classList(){return {add:(name)=>{this.className+=' '+name;},remove:name=>{this.className=this.className.split(' ').filter(x=>x!==name).join(' ');},contains:name=>this.className.split(' ').includes(name)};}
  append(...nodes){for(const node of nodes){node.remove();this.children.push(node);node.parentElement=this;}}
  insertBefore(node,before){node.remove();const index=this.children.indexOf(before);if(index<0)this.children.push(node);else this.children.splice(index,0,node);node.parentElement=this;}
  prepend(node){node.remove();this.children.unshift(node);node.parentElement=this;}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}
  setAttribute(k,v){this.attrs.set(k,String(v));}
  removeAttribute(k){this.attrs.delete(k);}
  hasAttribute(k){return this.attrs.has(k);}
  contains(el){return this===el||this.children.some(child=>child.contains(el));}
  getClientRects(){return this.hidden?[]:[this.rect];}
  matches(selector){if(selector.startsWith('['))return this.attrs.has(selector.slice(1,-1));return selector==='*'||(selector.startsWith('.')?this.classList.contains(selector.slice(1)):selector.startsWith('#')?this.attrs.get('id')===selector.slice(1):this.tagName.toLowerCase()===selector);}
  querySelectorAll(selector){if(selector.includes('>')){const [parent,child]=selector.split('>').map(s=>s.trim());return this.querySelectorAll('*').filter(el=>el.matches(child)&&el.parentElement?.matches(parent));}const parts=selector.split(/[ >]+/),last=parts.pop(),all=this.children.flatMap(c=>[c,...c.querySelectorAll('*')]);return all.filter(el=>{if(!el.matches(last))return false;let parent=el.parentElement;for(let i=parts.length-1;i>=0;i--){while(parent&&!parent.matches(parts[i]))parent=parent.parentElement;if(!parent)return false;parent=parent.parentElement;}return true;});}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  cloneNode(deep){const n=new Element(this.tagName,this.className,{...this.rect});n.attrs=new Map(this.attrs);n.style={...this.style};n.value=this.value;n.hidden=this.hidden;if(deep)for(const c of this.children)n.append(c.cloneNode(true));return n;}
  getBoundingClientRect(){return this.rect;}
  getAnimations(){return [];}
  animate(frames,options){let resolve;const finished=new Promise(r=>resolve=r),a={el:this,frames,options,finished,cancelled:false,reverse(){a.reversed=true;if(!manual)a.finish();},finish(){resolve();},cancel(){a.cancelled=true;resolve();}};animations.push(a);if(!manual)a.finish();return a;}
 }
 const node=(tag,classes,parent,rect)=>{const n=new Element(tag,classes,rect);parent?.append(n);return n;};
 const id=(el,value)=>{el.setAttribute('id',value);return el;};
 const body=node('body',''),root=node('div','',body,{left:0,top:0,width,height});
 const home=node('div','welcome-page',body),main=node('main','welcome-main',home),button=node('button','welcome-create',main,{left:50,top:520,width:360,height:120});
 node('h2','',button);node('span','welcome-action-icon',button);node('p','',button);node('span','welcome-action-arrow',button);
 node('img','brand-logo',home);node('span','welcome-header-note',home);node('footer','welcome-footer',home);
 const header=node('header','sf-header',root);node('img','',header);
 node('nav','sf-progress',root);id(node('div','',root),'nu-heading');const footer=node('div','nu-footer',root);id(node('button','nu-menu-anchor',footer),'nu-exit');id(node('footer','',root),'nu-storage-note');
 const card=node('section','nu-about-card',root,{left:180,top:210,width:920,height:390});
 node('label','nu-name-label',card);node('input','nu-name-input',card).value='Сохранённое название';const bottom=node('div','nu-about-bottom',card);const author=node('label','',bottom);node('span','nu-author-label',author);node('input','nu-author-input',author).value='Автор';node('div','nu-language-group',bottom);
 const overlay=node('div','nu-overlay',root),backdrop=node('div','nu-backdrop',overlay),modal=node('div','nu-modal',overlay,{left:160,top:130,width:960,height:460}),heading=node('div','nu-modal-heading',modal);node('h2','',heading);node('button','',heading);const content=node('div','',modal);node('button','',content);
 const owner=node('button','sf-primary',root,{left:1010,top:620,width:230,height:50});
 globalThis.matchMedia=()=>({matches:reduced});globalThis.document={body,createElement:()=>new Element()};
 globalThis.getComputedStyle=el=>{const values={fontSize:'18px',background:'#315cdb',border:'1px solid #89aaf3',borderWidth:'1px',borderColor:'#89aaf3',boxShadow:'none',borderTopLeftRadius:'12px',...el.style};const props=Object.keys(values).filter(k=>typeof values[k]==='string');return {...values,[Symbol.iterator]:function*(){yield*props;},getPropertyValue:p=>values[p]};};
 return {root,home,button,card,overlay,modal,owner,animations,node,id,finish(){animations.forEach(a=>a.finish());}};
}

test('closing mirrors each interval of the opening timeline exactly',()=>{
 for(const [start,duration]of [[0,420],[0,400],[0,320],[0,240],[0,160]]){
  const forward=setupEntryTiming(start,duration,420),reverse=setupEntryTiming(start,duration,420,true);
  assert.equal(forward.delay+forward.duration+reverse.delay,420);
  assert.equal(reverse.duration,forward.duration);assert.equal(reverse.direction,'reverse');assert.equal(reverse.fill,'both');
 }
});

test('home is retained through entry and returned with the same draft DOM on exit',async()=>{
 const f=fixture(),scene=captureSetupHome(f.home),motion=createSetupEntrance(f.root,scene);
 await motion.open();assert.equal(scene.layer.hidden,true);assert.equal(f.card.style.visibility,'');assert.equal(f.root.inert,false);
 const home=await motion.close();assert.equal(home,f.home);assert.equal(scene.layer.hidden,false);assert.equal(f.button.style.visibility,'');
 assert.equal(f.root.querySelector('.nu-flight-layer'),null);assert.equal(f.root.querySelector('.nu-entry-background'),null);
 assert.ok(f.animations.some(a=>a.el.className==='nu-flight-shell'&&'left'in a.frames[0]&&a.frames[0].left==='180px'&&a.frames.at(-1).left==='50px'));
 motion.dispose();assert.equal(scene.layer.parentElement,null);
});

test('entry starts immediately and branches the plus into both inputs',async()=>{
 const f=fixture({manual:true}),scene=captureSetupHome(f.home),motion=createSetupEntrance(f.root,scene),opening=motion.open();
 const fields=f.animations.filter(a=>a.el.className==='nu-input-flight'&&'left'in a.frames[0]);
 assert.equal(fields.length,2);assert.equal(fields[0].frames[0].left,fields[1].frames[0].left);assert.equal(fields[0].frames[0].top,fields[1].frames[0].top);
 assert.equal(f.animations.filter(a=>a.el.className==='nu-label-flight').length,2);
 assert.ok(f.animations.filter(a=>!a.el.classList.contains('nu-language-group')).every(a=>a.options.delay===0));assert.ok(f.animations.every(a=>a.options.duration<=420));
 assert.equal(f.root.querySelector('.nu-about-identity'),null);f.finish();await opening;motion.dispose();
});

test('peripheral blocks travel whole from beyond each viewport edge',()=>{
 const rect={left:100,top:100,width:300,height:80},viewport={left:0,top:0,width:1280,height:720};
 for(const [side,expected]of [['left','translate(-416px,0px)'],['right','translate(1196px,0px)'],['top','translate(0px,-196px)'],['bottom','translate(0px,636px)']]){
  const frames=setupEdgeFrames(rect,viewport,side);assert.equal(frames[0].transform,expected);assert.equal(frames[1].transform,'translate(0,0)');assert.ok(frames.every(f=>!('clipPath'in f)&&!('opacity'in f)));
 }
});

test('closing geometry starts at its highest speed and decelerates along the return path',()=>{
 const frames=setupClosingFrames([{left:'20px',top:'30px',width:'40px',height:'50px',borderRadius:'10px'},{left:'400px',top:'200px',width:'900px',height:'390px',borderRadius:'22px'}],true);
 assert.equal(frames[0].left,'400px');assert.equal(frames.at(-1).left,'20px');
 const speeds=frames.slice(1).map((f,i)=>Math.abs(parseFloat(f.left)-parseFloat(frames[i].left)));
 for(let i=1;i<speeds.length;i++)assert.ok(speeds[i]<=speeds[i-1]+1e-9);
 assert.ok(speeds[0]>speeds.at(-1)*100);
});

test('language starts behind the author field and clears its right edge before settling',()=>{
 const author={left:200,top:400,width:550,height:47},language={left:785,top:369,width:215,height:78},frames=setupLanguageFrames(author,language);
 assert.equal(frames[0].transform,'translateX(-250px)');assert.equal(frames[0].clipPath,'inset(0 0 0 100%)');
 assert.equal(frames[1].offset,215/250);assert.equal(frames.at(-1).transform,'translateX(0px)');assert.equal(frames.at(-1).clipPath,'inset(0 0 0 0%)');
});

test('language follows the animated author field and stays concealed until the field exists',async()=>{
 const f=fixture({manual:true}),scene=captureSetupHome(f.home),motion=createSetupEntrance(f.root,scene),opening=motion.open();
 const language=f.animations.find(a=>a.el.classList.contains('nu-language-group'));
 const anchor=f.animations.find(a=>a.el.className==='nu-language-anchor');
 const fields=f.animations.filter(a=>a.el.className==='nu-input-flight'&&'left'in a.frames[0]),author=fields[1];
 assert.equal(language.el.parentElement,anchor.el);
 assert.deepEqual(anchor.frames,author.frames);assert.equal(anchor.options.duration,author.options.duration);
 assert.ok(language.options.delay>=120);assert.equal(language.frames[0].clipPath,'inset(0 0 0 100%)');
 assert.equal(language.options.delay+language.options.duration,420);
 f.finish();await opening;motion.dispose();
});

test('the actual dialog animates in place with fast-start deceleration in both directions',async()=>{
 const f=fixture(),motion=createSetupDialogMotion(f.root,f.modal,f.overlay,f.owner),parent=f.modal.parentElement;
 await motion.open();assert.equal(f.modal.parentElement,parent);assert.equal(f.modal.style.visibility,'');assert.equal(f.modal.style.position,'');
 await motion.close();
 const surfaces=f.animations.filter(a=>a.el===f.modal&&'left'in a.frames[0]);assert.equal(surfaces.length,2);
 for(const a of surfaces){assert.equal(a.options.delay,0);assert.ok(a.options.duration<=420);const steps=a.frames.slice(1).map((v,i)=>Math.abs(parseFloat(v.width)-parseFloat(a.frames[i].width)));for(let i=1;i<steps.length;i++)assert.ok(steps[i]<=steps[i-1]+1e-8);const distance=Math.abs(parseFloat(a.frames.at(-1).width)-parseFloat(a.frames[0].width));assert.ok(steps[0]/distance>1-(47/48)**3);assert.ok(steps.at(-1)/distance<(1/48)**3);}
 assert.ok(f.animations.every(a=>a.frames.every(frame=>!('backdropFilter'in frame))));
 const blur=f.animations.filter(a=>a.el.className==='nu-backdrop');assert.equal(blur.length,2);assert.deepEqual(blur[0].frames,[{opacity:0},{opacity:1}]);assert.equal(blur[1].frames.at(-1).opacity,0);assert.ok(blur.every(a=>a.options.duration===420));
});

test('the dialog restores native layout before the user can choose a preset',async()=>{
 const f=fixture(),motion=createSetupDialogMotion(f.root,f.modal,f.overlay,f.owner);
 await motion.open();assert.equal(f.owner.style.visibility,'hidden');assert.equal(f.modal.style.visibility,'');assert.equal(f.root.querySelector('.nu-flight-layer'),null);
 await motion.close();assert.equal(f.owner.style.visibility,'');assert.equal(f.modal.style.visibility,'');assert.equal(f.root.querySelector('.nu-flight-layer'),null);assert.equal(f.modal.style.position,'');assert.equal(f.modal.style.width,'');assert.equal(f.modal.style.overflow,'');
 assert.ok(f.animations.every(a=>a.cancelled));
});

test('Escape during opening reverses the live window without restoring the owner too soon',async()=>{
 const f=fixture({manual:true}),motion=createSetupDialogMotion(f.root,f.modal,f.overlay,f.owner),opening=motion.open();
 assert.equal(f.owner.style.visibility,'hidden');const closing=motion.close();assert.equal(f.owner.style.visibility,'hidden');
 assert.ok(f.animations.some(a=>a.cancelled));assert.ok(f.animations.filter(a=>a.el===f.modal&&'left'in a.frames[0]).length===2);f.finish();await Promise.all([opening,closing]);
 assert.equal(f.owner.style.visibility,'');assert.equal(f.modal.style.visibility,'');assert.equal(f.root.querySelector('.nu-flight-layer'),null);assert.equal(f.modal.style.position,'');assert.equal(f.modal.style.width,'');
});

test('choosing a preset cleans up every projection and returns ownership to the footer',async()=>{
 const f=fixture({manual:true}),motion=createSetupDialogMotion(f.root,f.modal,f.overlay,f.owner),opening=motion.open();
 motion.commit();await opening;assert.equal(f.owner.style.visibility,'');assert.equal(f.modal.style.visibility,'');assert.equal(f.root.querySelector('.nu-flight-layer'),null);assert.ok(f.animations.every(a=>a.cancelled));
});

test('reduced motion still hides the source button while the dialog is open',async()=>{
 const f=fixture({reduced:true}),scene=captureSetupHome(f.home),entry=createSetupEntrance(f.root,scene),dialog=createSetupDialogMotion(f.root,f.modal,f.overlay,f.owner);
 await entry.open();assert.equal(scene.layer.hidden,true);await dialog.open();assert.equal(f.owner.style.visibility,'hidden');await dialog.close();assert.equal(f.owner.style.visibility,'');assert.equal(await entry.close(),f.home);assert.equal(scene.layer.hidden,false);entry.dispose();assert.equal(f.animations.length,0);
});

function presetFixture(kind,options={}){
 const f=fixture(options),{node,id,root}=f,n=kind==='classic'?6:kind==='short'?4:1,q=kind==='blank'?1:5;
 const main=node('main','nu-main',root,{left:34,top:108,width:(options.width||1280)-68,height:550});
 for(const el of [root.querySelector('#nu-heading'),f.card,root.querySelector('.nu-footer'),f.owner])main.append(el);
 id(f.owner,'nu-next');const footer=root.querySelector('.nu-footer');id(node('button','',footer),'nu-back');id(node('span','',footer),'nu-note');
 const source=node('button','nu-preset',f.modal.children[1],{left:kind==='classic'?170:kind==='short'?480:790,top:210,width:288,height:244,borderRadius:16});
 const art=node('span','nu-preset-art',source),minis=[];
 for(let i=0;i<(kind==='classic'?3:1);i++){
  const mini=node('span',kind==='blank'?'nu-mini-blank':'nu-mini-board',art,{left:source.rect.left+24+i*60,top:235,width:53,height:58,borderRadius:7});minis.push(mini);
  if(kind!=='blank'){const grid=node('span','nu-diagram-board',mini);for(let r=0;r<(i===2?7:n);r++){const row=node('span','nu-diagram-theme',grid);for(let c=0;c<(i===2?1:q);c++)node('i','',row,{left:mini.rect.left+5+c*8,top:mini.rect.top+5+r*7,width:6,height:4,borderRadius:1});}}
 }
 node('strong','',source);node('span','nu-preset-description',source);
 let board,cells=[],tabs=[];
 const render=()=>{
  f.card.remove();board=node('section','nu-gameboard',main,{left:(options.width||1280)-660,top:280,width:600,height:260,borderRadius:16});board.setAttribute('data-motion-surface','');
  const heading=node('div','nu-board-heading',board);node('h2','',heading);node('span','',heading);
  const rows=node('div','nu-board-rows',board,{left:board.rect.left+18,top:330,width:564,height:150,borderRadius:0});
  for(let r=0;r<n;r++){const row=node('div','nu-board-row',rows);node('span','',row);const grid=node('div','nu-board-cells',row);for(let c=0;c<q;c++)cells.push(node('b','',grid,{left:board.rect.left+90+c*85,top:330+r*24,width:80,height:20,borderRadius:5}));}
  node('div','nu-board-signature',board);node('section','nu-settings',main,{left:34,top:240,width:390,height:320,borderRadius:16});node('button','nu-help',main);
  const bar=node('div','nu-roundbar',main),nav=node('nav','nu-round-tabs',bar);for(let i=0;i<minis.length;i++)tabs.push(node('button','',nav,{left:34+i*170,top:190,width:160,height:38,borderRadius:9}));node('button','',bar).setAttribute('data-add-menu','');
 };
 return {...f,main,source,minis,render,motion:createSetupMotion(root),get board(){return board;},get cells(){return cells;},get tabs(){return tabs;}};
}

for(const kind of ['classic','short','blank'])for(const width of [1280,1440])test(`preset ${kind} leaves with the whole about page at ${width}px`,async()=>{
 const f=presetFixture(kind,{manual:true,width,height:width===1440?900:720});let closed=0;
 const pending=f.motion.fromPreset(f.source,f.render,()=>{closed++;f.overlay.hidden=true;});
 assert.equal(f.root.inert,true);assert.equal(closed,1);assert.equal(f.overlay.hidden,true);
 const scene=f.root.querySelector('.nu-page-scene');assert.ok(scene);
 assert.ok(scene.querySelector('.nu-about-card'),'the old form travels as part of the page');
 assert.ok(scene.querySelector('.nu-modal'),'the entire preset dialog travels with it');
 assert.equal(scene.querySelector('.nu-backdrop').style.backdropFilter,'none','blur does not resample moving pages');
 assert.equal(scene.querySelectorAll('[id]').length,0,'snapshot never duplicates live IDs');
 assert.equal(f.animations.filter(a=>'transform'in a.frames[0]).length,2,'only two pages move; the menu only loses its backdrop blur');
 const fixed=f.root.querySelector('.nu-fixed-menu');assert.ok(fixed);assert.equal(fixed.querySelector('#nu-exit'),f.root.querySelector('#nu-exit'));assert.equal(scene.querySelector('.nu-menu-anchor').style.visibility,'hidden');assert.ok(!f.animations.some(a=>a.el===fixed&&'transform'in a.frames[0]));
 const outgoing=f.animations.find(a=>a.el===scene),incoming=f.animations.find(a=>a.el===f.main);
 assert.deepEqual(outgoing.frames,[{transform:'translateX(0)'},{transform:`translateX(${-width}px)`}]);
 assert.deepEqual(incoming.frames,[{transform:`translateX(${width}px)`},{transform:'translateX(0)'}]);
 outgoing.finish();await Promise.resolve();assert.ok(f.root.querySelector('.nu-page-scene'));
 f.finish();await pending;assert.equal(f.root.inert,false);assert.equal(f.root.querySelector('.nu-page-scene'),null);assert.ok(f.animations.every(a=>a.cancelled));
});

for(const direction of [-1,1])test(`about/structure page swipe follows direction ${direction}`,async()=>{
 const f=presetFixture('classic',{manual:true});f.overlay.hidden=true;let renders=0;
 const pending=f.motion.page(f.main,()=>{renders++;f.render();},direction);
 assert.equal(renders,1);assert.equal(f.animations.length,2);
 const menu=f.root.querySelector('#nu-exit');assert.equal(menu.parentElement.className,'nu-footer-start nu-fixed-menu');
 const scene=f.root.querySelector('.nu-page-scene');assert.equal(scene.querySelector('.nu-modal'),null);
 assert.equal(f.animations[0].frames.at(-1).transform,`translateX(${-1280*direction}px)`);
 assert.equal(f.animations[1].frames[0].transform,`translateX(${1280*direction}px)`);
 f.finish();await pending;assert.equal(f.root.inert,false);assert.equal(f.root.querySelector('.nu-page-scene'),null);assert.equal(f.root.querySelector('.nu-fixed-menu'),null);
});

test('interruption frees the departing page and restores interaction',async()=>{
 const f=presetFixture('classic',{manual:true});let closed=0;const pending=f.motion.fromPreset(f.source,f.render,()=>closed++);
 f.motion.dispose();await pending;assert.equal(closed,1);assert.equal(f.root.inert,false);assert.equal(f.root.querySelector('.nu-motion-projection'),null);assert.equal(f.root.querySelector('.nu-fixed-menu'),null);assert.ok(f.animations.every(a=>a.cancelled));
});

test('reduced motion selects the preset immediately without inspecting its geometry',async()=>{
 const f=fixture({reduced:true}),motion=createSetupMotion(f.root),forbidden=new Proxy({},{get(){throw Error('No source geometry');}});let renders=0,closed=0;
 await motion.fromPreset(forbidden,()=>renders++,()=>closed++);assert.equal(renders,1);assert.equal(closed,1);assert.equal(f.animations.length,0);
});

test('fast menu exit joins a constant-speed page turn directly to the scaled home return',async()=>{
 const f=presetFixture('classic',{manual:true});f.render();f.overlay.hidden=true;
 const homeScene=captureSetupHome(f.home),entrance=createSetupEntrance(f.root,homeScene);let continued=0;
 const pending=f.motion.page(f.main,()=>{for(const selector of ['.nu-gameboard','.nu-settings','.nu-roundbar','.nu-help'])f.main.querySelector(selector)?.remove();f.main.append(f.card);},-1,{duration:220,easing:'linear',continueWith:()=>{continued++;assert.equal(f.root.querySelector('.nu-page-scene'),null);assert.equal(f.root.querySelector('.nu-fixed-menu'),null);return entrance.close({duration:300});}});
 assert.equal(continued,0);assert.equal(f.animations.length,2);
 for(const animation of f.animations){assert.equal(animation.options.duration,220);assert.equal(animation.options.easing,'linear');}
 f.finish();for(let i=0;i<20;i++)await Promise.resolve();
 assert.equal(continued,1,'no timer or next user turn is required for the second leg');
 assert.ok(f.root.querySelector('.nu-flight-shell'),'the home morph is already running');
 assert.equal(f.card.style.visibility,'hidden','there is no resting first-step card between the legs');
 const closing=f.animations.slice(2);assert.ok(closing.length>0);
 assert.ok(closing.every(a=>a.options.duration+a.options.delay<=300+1e-8));
 assert.ok(closing.some(a=>Math.abs(a.options.duration+a.options.delay-300)<1e-8));
 f.finish();assert.equal(await pending,f.home);assert.equal(f.root.inert,false);assert.equal(f.card.style.visibility,'');
 entrance.dispose();
});

test('reduced motion runs the menu continuation immediately after rendering step one',async()=>{
 const f=fixture({reduced:true}),motion=createSetupMotion(f.root),events=[];
 f.root.getBoundingClientRect=()=>{throw Error('No layout expected');};
 const home=await motion.page(null,()=>events.push('first step'),-1,{duration:220,easing:'linear',continueWith:()=>{events.push('home');return 'home';}});
 assert.deepEqual(events,['first step','home']);assert.equal(home,'home');assert.equal(f.animations.length,0);
});

for(const width of [1280,1440])test(`home collapse overlaps the arriving page and captures its moving position at ${width}px`,async()=>{
 const f=presetFixture('classic',{manual:true,width});f.render();f.overlay.hidden=true;
 const homeScene=captureSetupHome(f.home),entrance=createSetupEntrance(f.root,homeScene);let continued=0;
 const heading=f.root.querySelector('#nu-heading'),headingRest={...heading.rect};
 const pending=f.motion.page(f.main,()=>{for(const selector of ['.nu-gameboard','.nu-settings','.nu-roundbar','.nu-help'])f.main.querySelector(selector)?.remove();f.main.append(f.card);},-1,{duration:220,easing:'linear',overlap:80,continueWith:({offset})=>{continued++;return entrance.close({duration:300,incomingOffset:offset});}});
 const clock=f.animations.find(a=>a.options.duration===140),pages=f.animations.filter(a=>a.options.duration===220);
 assert.ok(clock);assert.equal(pages.length,2);assert.equal(continued,0);
 const offset=-width*80/220;f.main.rect.left+=offset;for(const el of f.main.querySelectorAll('*'))el.rect.left+=offset;
 clock.finish();for(let i=0;i<20;i++)await Promise.resolve();
 assert.equal(continued,1);assert.ok(pages.every(a=>!a.cancelled),'the page is still travelling when the home flight begins');
 const shell=f.animations.find(a=>a.el.className==='nu-flight-shell'&&'left'in a.frames[0]);
 assert.equal(shell.frames[0].left,f.card.rect.left+'px','collapse starts at the actual moving card, not its future resting position');
 const fixed=f.root.querySelector('.nu-fixed-menu');assert.ok(f.animations.some(a=>a.el===fixed),'the stationary menu joins the downward exit without reparenting midway');
 const headingFlight=f.animations.find(a=>a.el===heading);
 assert.equal(headingFlight.frames.at(-1).transform,`translate(${-headingRest.left-headingRest.width-16}px,0px)`,'exit endpoint compensates the remaining parent movement');
 for(const a of pages)a.finish();for(let i=0;i<20;i++)await Promise.resolve();
 assert.ok(f.root.querySelector('.nu-fixed-menu'),'menu ownership stays stable until the overlapping flight finishes');
 assert.equal(f.root.querySelector('.nu-page-scene').style.transform,`translateX(${width}px)`,'the completed outgoing page cannot reappear while waiting for the home flight');
 f.finish();assert.equal(await pending,f.home);assert.equal(f.root.querySelector('.nu-fixed-menu'),null);assert.equal(f.root.querySelector('.nu-flight-layer'),null);assert.equal(f.root.inert,false);
 entrance.dispose();
});

test('cancelling before the overlap marker never starts a delayed home flight',async()=>{
 const f=presetFixture('classic',{manual:true});f.overlay.hidden=true;let continued=0;
 const pending=f.motion.page(f.main,f.render,-1,{duration:220,easing:'linear',overlap:80,continueWith:()=>{continued++;}});
 f.motion.dispose();await pending;
 assert.equal(continued,0);assert.equal(f.root.querySelector('.nu-fixed-menu'),null);assert.equal(f.root.querySelector('.nu-page-scene'),null);assert.equal(f.root.inert,false);
});
