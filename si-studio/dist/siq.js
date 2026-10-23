import {pricingMetadata,restorePricing} from './pricing.js';
import {zipSync,unzipSync,strToU8,strFromU8} from './vendor/fflate.js';
import {uid,step,question,questionTypes,questionType,finalRoundError,catSettings,catSettingsError} from './model.js';
const ns='https://github.com/VladimirKhil/SI/blob/master/assets/siq_5.xsd';
export const escapeXML=v=>String(v??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c])).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
const tag=(n,v)=>`<${n}>${escapeXML(v)}</${n}>`;
const folder={image:'Images',audio:'Audio',video:'Video'};
const filename=s=>`${s.mediaId}.${(s.filename?.split('.').pop()||'bin').replace(/[^a-zA-Z0-9]/g,'')||'bin'}`;
const duration=n=>[Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(v=>String(v).padStart(2,'0')).join(':');
function item(s){return `<item type="${s.type}"${s.mediaId?' isRef="True"':''}${s.placement?` placement="${escapeXML(s.placement)}"`:''}${s.duration?` duration="${duration(s.duration)}"`:''} waitForFinish="${s.wait===false?'False':'True'}">${escapeXML(s.mediaId?filename(s):s.value)}</item>`;}
function catParams(q){if(questionType(q)!=='bagcat')return '';const cat=catSettings(q),error=catSettingsError(cat);if(error)throw Error(error);const p=cat.price;return `<param name="theme">${escapeXML(cat.theme)}</param><param name="selectionMode">${cat.selectionMode}</param><param name="price" type="numberSet"><numberSet minimum="${p.minimum}" maximum="${p.maximum}" step="${p.step}"/></param>`;}
export function contentXML(p){for(const r of p.rounds)if(r.type==='final'){const error=finalRoundError(r);if(error)throw Error(error);}return `<?xml version="1.0" encoding="utf-8"?><package xmlns="${ns}" name="${escapeXML(p.name)}" version="5" id="${escapeXML(p.id)}" date="${new Date().toLocaleDateString('ru-RU',{timeZone:'Asia/Yerevan'})}" difficulty="${p.difficulty}" language="${escapeXML(p.language)}" generator="SIGameMaker"><info><authors>${p.author?tag('author',p.author):''}</authors>${tag('comments',p.description)}</info><rounds>${p.rounds.map(r=>`<round name="${escapeXML(r.name)}" type="${r.type}"><themes>${r.themes.map(t=>`<theme name="${escapeXML(t.name)}"><questions>${t.questions.map(q=>{const type=questionType(q);if(!Object.hasOwn(questionTypes,type))throw Error('Неподдерживаемый тип вопроса: '+type);if(q.steps.filter(s=>s.type==='answer').length>1)throw Error('Повторные попытки с подсказками пока не поддерживаются: SIGame раскрывает ответ после первого таймера');const marker=q.steps.findIndex(s=>s.type==='answer');const before=q.steps.slice(0,marker<0?undefined:marker).filter(s=>s.type!=='answer');const after=marker<0?[]:q.steps.slice(marker+1).filter(s=>s.type!=='answer');return `<question price="${r.type==='final'?0:q.price}"${r.type==='final'?'':` type="${type==='bagcat'?(catSettings(q).showBeforeTransfer?'secretPublicPrice':'secret'):type}"`}><info><sources>${q.source?tag('source',q.source):''}</sources>${tag('showmanComments',q.comment)}</info><params>${catParams(q)}<param name="question" type="content">${before.map(item).join('')}</param>${q.steps.find(s=>s.type==='answer')?.duration?`<param name="answerDuration">${q.steps.find(s=>s.type==='answer').duration}</param>`:''}${after.length?`<param name="answer" type="content">${after.map(item).join('')}</param>`:''}</params><right>${[q.answer,...q.alternatives.split('\n')].filter(a=>a.trim()).map(a=>tag('answer',a.trim())).join('')}</right>${q.wrong?`<wrong>${q.wrong.split('\n').filter(a=>a.trim()).map(a=>tag('answer',a.trim())).join('')}</wrong>`:''}</question>`;}).join('')}</questions></theme>`).join('')}</themes></round>`).join('')}</rounds></package>`;}
export async function exportSIQ(p,media){const files={'content.xml':strToU8(contentXML(p))};if(p.pricing||p.rounds.some(r=>Object.hasOwn(r,'priceMultiplier')))files['SIGameMaker.json']=strToU8(JSON.stringify(pricingMetadata(p)));for(const r of p.rounds)for(const t of r.themes)for(const q of t.questions)for(const s of q.steps)if(folder[s.type]&&s.mediaId){const blob=media.get(s.mediaId);if(!blob)throw Error('Не найден файл '+s.filename);files[`${folder[s.type]}/${filename(s)}`]=new Uint8Array(await blob.arrayBuffer());}return zipSync(files,{level:0});}
const children=(el,name)=>Array.from(el?.children||[]).filter(x=>x.localName===name);
const child=(el,name)=>children(el,name)[0];const txt=el=>el?.textContent||'';
function readCatParams(params){
 const cat={theme:'',selectionMode:'exceptCurrent',price:{minimum:0,maximum:0,step:0}};
 for(const p of params.filter(p=>['theme','price','selectionMode'].includes(p.getAttribute('name')))){
  const name=p.getAttribute('name');
  if(p.getAttribute('isRef')?.toLowerCase()==='true')throw Error('Ссылочные параметры кота пока не поддерживаются');
  if(name==='price'){
   const sets=children(p,'numberSet'),set=sets[0];
   if(p.getAttribute('type')!=='numberSet'||sets.length!==1||p.children.length!==1||txt(p).trim()||Array.from(set.attributes).some(a=>!['minimum','maximum','step'].includes(a.name)))throw Error('Неподдерживаемая стоимость кота');
   for(const k of ['minimum','maximum','step']){const value=set.getAttribute(k)??'0';if(!/^\d+$/.test(value))throw Error('Некорректная стоимость кота');cat.price[k]=Number(value);}
  }else{if(p.children.length||!['simple',null,''].includes(p.getAttribute('type')))throw Error('Неподдерживаемые параметры кота');cat[name]=txt(p);}
 }
 const error=catSettingsError(cat);if(error)throw Error(error);return cat;
}
export class SIQImportError extends Error{
 constructor(issues){super(issues.map(i=>`${i.location}: ${i.message}`).join('\n'));this.name='SIQImportError';this.issues=issues;}
}
function fail(message,code='invalid-package'){throw new SIQImportError([{location:'Пак',code,message}]);}
// ZIP names in older OPC packages may be URI-escaped, decomposed Unicode or use backslashes.
function archiveKey(path){return path.replace(/\\/g,'/').replace(/^\.\//,'').split('/').map(part=>{try{return decodeURIComponent(part).normalize('NFC').toLowerCase();}catch{return part.normalize('NFC').toLowerCase();}}).join('/');}
function xmlText(bytes){
 let encoding='utf-8';
 if(bytes[0]===0xff&&bytes[1]===0xfe||bytes[0]===0x3c&&bytes[1]===0)encoding='utf-16le';
 else if(bytes[0]===0xfe&&bytes[1]===0xff||bytes[0]===0&&bytes[1]===0x3c)encoding='utf-16be';
 else{const declaration=new TextDecoder().decode(bytes.subarray(0,200)).match(/^\s*<\?xml[^>]*encoding\s*=\s*["']([^"']+)/i);if(declaration)encoding=declaration[1];}
 try{return new TextDecoder(encoding,{fatal:true}).decode(bytes);}catch{fail(`Не удалось прочитать content.xml: повреждён текст или не поддерживается кодировка «${encoding}».`,'xml-encoding');}
}
// Repair only the literal placeholder found in otherwise ordinary SIQ 5 final questions.
function isPlainFinalOther(qe,roundType,version,type){
 if(version!==5||roundType!=='final'||type!=='Другой'||qe.getAttribute('type')!=='Другой')return false;
 if(Array.from(qe.children).some(el=>!['info','params','right','wrong'].includes(el.localName)))return false;
 const params=child(qe,'params'),values=children(params,'param');
 if(!params||values.filter(p=>p.getAttribute('name')==='question').length!==1)return false;
 return Array.from(params.children).every(el=>el.localName==='param')&&values.every(p=>
  ['question','answer','answerDuration'].includes(p.getAttribute('name'))&&
  Array.from(p.attributes).every(a=>['name','type'].includes(a.name)));
}
export function importSIQ(bytes,decisions={}){
 if(bytes.length>250*1024*1024)fail('Пак больше 250 МБ. Разделите его на несколько паков.','archive-size');
 let files,expanded=0;
 try{files=unzipSync(bytes,{filter:f=>{expanded+=f.originalSize;if(expanded>500*1024*1024)fail('Распакованный пак превышает 500 МБ.','expanded-size');return true;}});}catch(err){if(err instanceof SIQImportError)throw err;fail('Не удалось распаковать файл: архив ZIP повреждён, зашифрован или имеет неподдерживаемое сжатие.','archive');}
 const names=new Map();for(const path of Object.keys(files)){const key=archiveKey(path);if(!names.has(key))names.set(key,[]);names.get(key).push(path);}
 function resolve(path){if(Object.hasOwn(files,path))return path;const matches=names.get(archiveKey(path))||[];if(matches.length>1)throw Error(`Неоднозначное имя файла «${path}»: ${matches.join(', ')}. Переименуйте дубликаты в исходном паке.`);return matches[0];}
 let content;try{content=resolve('content.xml');}catch(err){fail(err.message,'ambiguous-file');}if(!content)fail('В корне архива не найден content.xml — файл с описанием пака.','missing-content');
 const source=xmlText(files[content]);if(/<!DOCTYPE/i.test(source))fail('content.xml содержит DTD (DOCTYPE). Такой XML пока не поддерживается.','xml-doctype');
 const doc=new DOMParser().parseFromString(source,'application/xml');const parseError=doc.querySelector('parsererror');if(parseError)fail(`Повреждён content.xml: ${txt(parseError).trim()||'ошибка синтаксиса XML'}`,'xml');
 const root=doc.documentElement;if(root.localName!=='package')fail(`Корневой элемент XML — «${root.localName}», ожидался package.`,'root');
 const version=Number(root.getAttribute('version'));if(version!==4&&version!==5)fail(`Версия SIQ «${root.getAttribute('version')||'не указана'}» не поддерживается. Поддерживаются SIQ 4 и 5.`,'version');
 const media=new Map(),refs=new Map(),problems=[],repairs=[];
 let target=null;
 const report=(location,message,code='unsupported',details={})=>problems.push({location,message,code,target:target?{...target}:null,...details});
 const emptyQuestion=(qe,final)=>question(final?0:Math.max(0,Math.trunc(Number(qe?.getAttribute('price'))||0)));
 function clearRound(re,r){
  const themes=children(child(re,'themes'),'theme');
  r.type=['standard','final'].includes(r.type)?r.type:'standard';
  r.themes=(themes.length?themes:[null]).map(te=>{const qs=children(child(te,'questions'),'question');return {id:uid(),name:te?.getAttribute('name')||'Новая тема',questions:r.type==='final'?[emptyQuestion(qs[0],true)]:(qs.length?qs:[null]).map(qe=>emptyQuestion(qe,false))};});
 }
 const attempt=(location,fn)=>{try{return fn();}catch(err){report(location,err.message);return null;}};
 function readItem(el,legacy=false){
  const rawType=el.getAttribute('type')||'text';if(legacy&&rawType==='marker')return step('answer');
  const type=rawType==='voice'?'audio':['say','oral'].includes(rawType)?'text':rawType;
  if(!['text','image','audio','video'].includes(type))throw Error(`Тип содержимого «${rawType}» не поддерживается${rawType==='html'?' — HTML нельзя перенести в текст без потери оформления и поведения':''}.`);
  if(el.children.length)throw Error('Содержимое шага содержит вложенные XML-элементы, которые редактор пока не поддерживает.');
  const value=txt(el),s=step(type,value),wait=el.getAttribute('waitForFinish');
  if(wait&&!/^(true|false|0|1)$/i.test(wait))throw Error(`Некорректное ожидание завершения waitForFinish="${wait}".`);
  s.wait=!/^(false|0)$/i.test(wait||'true');
  s.placement=el.getAttribute('placement')||(['say','oral'].includes(rawType)?'replic':legacy&&rawType==='voice'?'background':undefined);
  if(s.placement&&!['screen','replic','background'].includes(s.placement))throw Error(`Размещение «${s.placement}» не поддерживается.`);
  const d=el.getAttribute('duration'),time=el.getAttribute('time');
  if(d){if(!/^\d+:\d{2}:\d{2}(\.\d+)?$/.test(d)||d.split(':').slice(1).some(v=>Number(v)>=60))throw Error(`Некорректная длительность «${d}». Ожидалось ЧЧ:ММ:СС.`);s.duration=d.split(':').reduce((a,n)=>a*60+Number(n),0);}
  else if(time!==null&&time!==''){if(!/^-?\d+$/.test(time)||Number(time)<-1)throw Error(`Некорректная длительность time="${time}".`);if(Number(time)===-1){s.wait=false;s.duration=0;}else s.duration=Number(time);}
  const ref=el.getAttribute('isRef');if(ref&&!/^(true|false|0|1)$/i.test(ref))throw Error(`Некорректная ссылка isRef="${ref}".`);
  const isRef=/^(true|1)$/i.test(ref||'')||legacy&&value.startsWith('@');
  if(isRef&&!folder[type])throw Error('Ссылочное текстовое содержимое пока не поддерживается.');
  if(folder[type]){
   if(!isRef)throw Error(`Внешнее медиа «${value}» не поддерживается. Встройте файл в исходном редакторе.`);
   const name=legacy?value.replace(/^@/,''):value,path=resolve(`${folder[type]}/${name}`);
   if(!path)throw Error(`Не найден медиафайл «${folder[type]}/${name}» внутри архива.`);
   let displayName=path.replace(/\\/g,'/').split('/').pop();try{displayName=decodeURIComponent(displayName);}catch{}
   let id=refs.get(path);if(!id){id=uid();refs.set(path,id);const ext=displayName.split('.').pop().toLowerCase();const mime=({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',mp4:'video/mp4',webm:'video/webm'})[ext]||`${type}/${ext}`;media.set(id,new Blob([files[path]],{type:mime}));}
   s.mediaId=id;s.filename=displayName;s.value='';
  }
  return s;
 }
 const info=child(root,'info'),p={id:root.getAttribute('id')||uid(),name:root.getAttribute('name')||'Импортированный пак',author:children(child(info,'authors'),'author').map(txt).join(', '),description:txt(child(info,'comments')),difficulty:Number(root.getAttribute('difficulty'))||5,language:root.getAttribute('language')||'ru-RU',rounds:[]};
 for(const [ri,re]of children(child(root,'rounds'),'round').entries()){
  const r={id:uid(),name:re.getAttribute('name')||'Раунд',type:re.getAttribute('type')||'standard',themes:[]},rl=`Раунд ${ri+1} «${r.name}»`;
  target={kind:'round',key:`r:${ri}`,round:ri};
  if(decisions.clearRounds?.has(target.key)){clearRound(re,r);p.rounds.push(r);continue;}
  const roundProblemStart=problems.length;
  if(!['standard','final'].includes(r.type))report(rl,`Тип раунда «${r.type}» не поддерживается.`,'round-type');
  for(const [ti,te]of children(child(re,'themes'),'theme').entries()){
   const t={id:uid(),name:te.getAttribute('name')||'Тема',questions:[]},tl=`${rl} → тема ${ti+1} «${t.name}»`;
   for(const [qi,qe]of children(child(te,'questions'),'question').entries()){
    const location=`${tl} → вопрос ${qi+1} (${qe.getAttribute('price')||0})`,legacyType=child(qe,'type'),qt=qe.getAttribute('type')||legacyType?.getAttribute('name')||'simple';
    target={kind:'question',key:`r:${ri}/t:${ti}/q:${qi}`,round:ri,theme:ti,question:qi};
    if(decisions.clearQuestions?.has(target.key)){t.questions.push(emptyQuestion(qe,r.type==='final'));continue;}
    const canRepair=isPlainFinalOther(qe,r.type,version,qt);
    const repairFinalOther=canRepair&&decisions.repairQuestions?.has(target.key);
    const type=repairFinalOther?'simple':version===5&&qt==='stakeAll'?(r.type==='final'?'simple':'stakeAll'):version===5&&['secret','secretPublicPrice'].includes(qt)?'bagcat':qt==='stake'||qt==='auction'&&(version===4||legacyType&&!qe.getAttribute('type'))?'stake':(r.type==='final'&&qt==='stakeAll'||['simple','default','withButton',''].includes(qt))?'simple':null;
    if(!type)report(location,`Тип вопроса «${qt}» (SIQ ${version}) пока не поддерживается. Доступны обычные вопросы, аукционы, скрытые ставки всех игроков SIQ 5 и коты SIQ 5 «secret» и «secretPublicPrice».`,'question-type',{canRepair});
    if(child(qe,'script'))report(location,'Собственный сценарий <script> нельзя перенести без потери игровой логики.','script');
    for(const param of children(legacyType,'param'))report(location,`Старый параметр типа «${param.getAttribute('name')||'без имени'}» со значением «${txt(param)}» пока не поддерживается.`,'legacy-param');
    const questionInfo=child(qe,'info'),answers=children(child(qe,'right'),'answer').map(txt);
    const q={id:uid(),type,price:Number(qe.getAttribute('price'))||0,answer:answers[0]||'',alternatives:answers.slice(1).join('\n'),wrong:children(child(qe,'wrong'),'answer').map(txt).join('\n'),comment:txt(child(questionInfo,'showmanComments'))||txt(child(questionInfo,'comments')),source:children(child(questionInfo,'sources'),'source').map(txt).join('\n'),steps:[]};
    const params=children(child(qe,'params'),'param'),seen=new Set();
    for(const param of params){const name=param.getAttribute('name');if(seen.has(name))report(location,`Параметр «${name}» задан несколько раз.`,'duplicate-param');seen.add(name);if(!['question','answer','answerDuration',...(type==='bagcat'?['theme','price','selectionMode']:[])].includes(name))report(location,`Параметр вопроса «${name||'без имени'}» (тип «${param.getAttribute('type')||'simple'}») пока не поддерживается.`,'question-param');}
    if(type==='bagcat'){q.cat=attempt(location,()=>readCatParams(params));if(q.cat&&qt==='secretPublicPrice')q.cat.showBeforeTransfer=true;}
    const qp=params.find(x=>x.getAttribute('name')==='question'),ap=params.find(x=>x.getAttribute('name')==='answer'),scenario=child(qe,'scenario');
    const readContent=(param,label)=>{
     if(!param)return [];
     const pt=param.getAttribute('type');if(pt&&pt!=='content')report(location,`Параметр «${label}» имеет тип «${pt}», ожидался content.`);
     if(param.getAttribute('isRef')&&param.getAttribute('isRef').toLowerCase()!=='false')report(location,`Ссылочный параметр «${label}» пока не поддерживается.`);
     for(const nested of Array.from(param.children))if(nested.localName!=='item')report(location,`В параметре «${label}» не поддерживается элемент <${nested.localName}>.`);
     return children(param,'item').map((el,i)=>attempt(`${location} → ${label==='question'?'содержимое вопроса':'раскрытие ответа'}, шаг ${i+1}`,()=>readItem(el))).filter(Boolean);
    };
    if(qp){q.steps=readContent(qp,'question');q.steps.push(step('answer'));q.steps.push(...readContent(ap,'answer'));if(scenario)report(location,'Одновременно заданы params/question и старый scenario. Нельзя выбрать сценарий без потери данных.');}
    else{
     if(params.length)report(location,'Не найден обязательный параметр «question», при этом заданы другие параметры вопроса.');
     q.steps=children(scenario,'atom').map((el,i)=>attempt(`${location} → шаг ${i+1}`,()=>readItem(el,true))).filter(Boolean);
     // Inspect answer content even when its question parameter is absent.
     if(ap)readContent(ap,'answer');
     if(!q.steps.some(s=>s.type==='answer'))q.steps.push(step('answer'));
    }
    if(q.steps.filter(s=>s.type==='answer').length>1)report(location,'В сценарии несколько маркеров ответа. Повторные окна ответа пока не поддерживаются.','answer-markers');
    const timer=params.find(x=>x.getAttribute('name')==='answerDuration');if(timer){const value=txt(timer).trim();if(timer.children.length||!['simple',null,''].includes(timer.getAttribute('type'))||!/^\d+$/.test(value)||Number(value)>35999)report(location,`Некорректное время на ответ «${value}»: нужно целое число секунд от 0 до 35999.`,'answer-duration');else q.steps.find(s=>s.type==='answer').duration=Number(value);}
    if(repairFinalOther)repairs.push({location,fromType:qt,toType:'simple',reason:'Применены обычные правила финального раунда: нет собственного сценария или особых параметров.'});
    t.questions.push(q);
   }
   r.themes.push(t);
  }
  target={kind:'round',key:`r:${ri}`,round:ri};
  if(r.type==='final'){const error=finalRoundError(r),badShape=r.themes.some(t=>t.questions.length!==1),unknownType=problems.slice(roundProblemStart).some(i=>i.code==='question-type');if(error&&(badShape||!unknownType))report(rl,error,'final-structure');}
  p.rounds.push(r);
 }
 target=null;
 if(!p.rounds.length)report('Пак','В паке нет раундов.','empty-package');
 if(problems.length)throw new SIQImportError(problems);
 if(files['SIGameMaker.json']?.length<128*1024){try{restorePricing(p,JSON.parse(strFromU8(files['SIGameMaker.json'])));}catch{ /* Optional editor settings must not prevent opening the questions. */ }}return {pack:p,media,repairs};
}
