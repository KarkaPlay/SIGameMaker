import test from 'node:test';
import assert from 'node:assert/strict';
import {previewBoardHTML,previewBoardSelection,previewStageHTML,createPreviewStageMotion,previewStageSummary,truncatePreviewSummaries} from '../dist/preview-view.js';
test('the schematic board is read-only and retires exactly the selected cell when returning',()=>{
 const start=previewBoardHTML('select'),end=previewBoardHTML('return');
 assert.deepEqual(previewBoardSelection,{theme:1,question:2});
 for(const html of [start,end]){
  assert.equal((html.match(/class="demo-board-row"/g)||[]).length,4);
  assert.equal((html.match(/class="demo-board-cell /g)||[]).length,20);
  assert.equal((html.match(/data-demo-selected/g)||[]).length,1);
  assert.doesNotMatch(html,/<button|data-action|tabindex|board-question/);
 }
 assert.match(start,/data-demo-selected>300</);assert.match(end,/is-played" data-demo-selected><span/);
 assert.equal((end.match(/is-played/g)||[]).length,1);
});
test('stage cards share editor event classes and keep user text escaped',()=>{
 const html=previewStageHTML({kind:'image',title:'Изображение',step:{type:'image',filename:'Фото <script> & «подпись»'}},3);
 assert.match(html,/studio-step studio-timeline-event studio-type-image/);
 assert.match(html,/studio-step-number">04</);assert.match(html,/studio-step-symbol image/);
 assert.match(html,/Фото &lt;script&gt; &amp;/);assert.doesNotMatch(html,/<script>|<button|data-action/);
});
function fixture(){
 const classes=()=>{const items=new Set();return {toggle(key,on){on?items.add(key):items.delete(key);},contains:key=>items.has(key)};};
 const nodes=Array.from({length:5},(_,index)=>{
  const marker={textContent:String(index+1).padStart(2,'0')};
  const card={classList:classes(),motions:[],animate(frames,options){const m={frames,options,cancel(){this.cancelled=true;}};this.motions.push(m);return m;}};
  return {dataset:{previewStage:String(index)},attrs:{},classList:classes(),offsetTop:index*73,offsetHeight:65,card,marker,querySelector(selector){return selector==='.studio-step-number'?marker:card;},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}};
 });
 const rail={scrollTop:0,clientHeight:140,scrolls:[],querySelector(){return nodes.find(n=>n.attrs['aria-current']==='step');},querySelectorAll(selector){return selector==='[data-preview-summary]'?[]:nodes;},scrollTo(options){this.scrolls.push(options);this.scrollTop=options.top;}};
 return {nodes,rail};
}
test('stage transitions preserve nodes, animate the active card and scroll only the stage list',()=>{
 const {nodes,rail}=fixture(),motion=createPreviewStageMotion({reduceMotion:()=>false});
 motion.show(rail,0);assert.equal(nodes[0].attrs['aria-current'],'step');assert.equal(nodes[0].card.motions.length,1);
 const first=nodes[0].card.motions[0];motion.show(rail,3);assert.equal(first.cancelled,true);
 assert.equal(nodes[0].attrs['aria-current'],undefined);assert.equal(nodes[3].attrs['aria-current'],'step');
 assert.equal(nodes[3].card.classList.contains('is-editing'),true);assert.equal(nodes[0].classList.contains('is-complete'),true);
 assert.equal(nodes[4].classList.contains('is-complete'),false);assert.equal(nodes[3].card.motions.length,1);
 assert.deepEqual(rail.scrolls.at(-1),{top:144,behavior:'smooth'});
 motion.show(rail,0);assert.equal(nodes[0].classList.contains('is-complete'),false);assert.equal(nodes[3].card.classList.contains('is-editing'),false);
 assert.deepEqual(rail.scrolls.at(-1),{top:0,behavior:'smooth'});motion.stop();assert.ok(nodes[0].card.motions.at(-1).cancelled);
});
test('reduced motion updates stage state without animations and uses immediate scrolling',()=>{
 const {nodes,rail}=fixture(),motion=createPreviewStageMotion({reduceMotion:()=>true});
 motion.show(rail,4);assert.equal(nodes[4].attrs['aria-current'],'step');
 assert.ok(nodes.every(n=>!n.card.motions.length));assert.equal(rail.scrolls[0].behavior,'auto');
 motion.show(rail,100);assert.equal(nodes[4].attrs['aria-current'],'step');motion.show(null,0);motion.stop();
});

test('current, completed and upcoming stages use number markers without state words after forward, back and restart transitions',()=>{
 const {nodes,rail}=fixture(),motion=createPreviewStageMotion({reduceMotion:()=>true});
 motion.show(rail,2);
 assert.deepEqual(nodes.map(n=>n.dataset.previewState),['complete','complete','current','upcoming','upcoming']);
 assert.deepEqual(nodes.map(n=>n.marker.textContent),['✓','✓','03','04','05']);
 assert.equal(nodes.filter(n=>n.attrs['aria-current']==='step').length,1);
 motion.show(rail,1);
 assert.equal(nodes[2].marker.textContent,'03');assert.equal(nodes[2].classList.contains('is-upcoming'),true);
 assert.equal(nodes[2].classList.contains('is-complete'),false);
 motion.show(rail,4);assert.ok(nodes.slice(0,4).every(n=>n.marker.textContent==='✓'));
 motion.show(rail,0);assert.equal(nodes[0].marker.textContent,'01');
 assert.ok(nodes.slice(1).every(n=>n.dataset.previewState==='upcoming'&&n.marker.textContent!=='✓'));
});

test('secondary text is limited to actual text content and media filenames',()=>{
 for(const frame of [{kind:'board',summary:'Тема 2 · 300'},{kind:'board',summary:'Игра продолжается'},{kind:'answer',summary:'Ответ'},{step:{type:'answer',duration:0},summary:'Время по настройкам'}]){
  assert.equal(previewStageSummary(frame),'');
  const html=previewStageHTML({...frame,title:'Этап'},0);assert.doesNotMatch(html,/studio-event-summary|demo-stage-status|Сейчас|Пройден|Впереди/);
 }
 assert.equal(previewStageSummary({step:{type:'text',value:'Один\nдва  три'}}),'Один два три');
 assert.equal(previewStageSummary({step:{type:'image',filename:'photo.png',caption:'Лишняя подпись'}}),'photo.png');
});
test('overflow summaries get three literal dots and restore full text when width increases',()=>{
 const node={dataset:{previewSummary:'Очень длинный текст вопроса'},textContent:'',clientWidth:12,get scrollWidth(){return Array.from(this.textContent).length;}};
 const root={querySelectorAll:()=>[node]};truncatePreviewSummaries(root);
 assert.equal(node.textContent,'Очень дли...');assert.ok(node.scrollWidth<=node.clientWidth);
 node.clientWidth=100;truncatePreviewSummaries(root);assert.equal(node.textContent,node.dataset.previewSummary);
 node.dataset.previewSummary='😀😀😀😀😀😀';node.clientWidth=5;truncatePreviewSummaries(root);assert.equal(node.textContent,'😀😀...');
});
