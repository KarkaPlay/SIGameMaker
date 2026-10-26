export const uid=()=>crypto.randomUUID();
export const kinds={text:['Текст на экране','T'],replic:['Слово ведущего','❝'],image:['Изображение','▧'],audio:['Аудио','♫'],video:['Видео','▷'],answer:['Игроки отвечают','⌁']};
// Replicas retain the native text placement, including imported SIQ 4 oral/say.
export const stepKind=st=>st.type==='text'&&st.placement==='replic'?'replic':st.type;
export const questionTypes={simple:'Обычный вопрос',stake:'Вопрос-аукцион',stakeAll:'Скрытые ставки всех игроков',bagcat:'Кот в мешке',noRisk:'Без риска'};
export const questionType=q=>q.type===undefined?'simple':q.type;
export const isAuction=q=>['stake','stakeAll'].includes(questionType(q));
export const auctionLabel=q=>questionType(q)==='stakeAll'?'Скрытые ставки':'Аукцион';
export const answerLabel=(q,r)=>r?.type==='final'?'Финалисты отвечают':questionType(q)==='stakeAll'?'Все игроки отвечают письменно':questionType(q)==='stake'?'Победитель аукциона отвечает':questionType(q)==='bagcat'?'Получатель кота отвечает':questionType(q)==='noRisk'?'Выбравший вопрос отвечает':'Игроки отвечают';
export const catSettings=q=>q.cat??{theme:'',selectionMode:'exceptCurrent',price:{minimum:0,maximum:0,step:0}};
export function catSettingsError(cat){
 if(!cat||typeof cat.theme!=='string'||!['any','exceptCurrent'].includes(cat.selectionMode))return 'Проверьте тему и правило передачи кота';
 if(cat.showBeforeTransfer!==undefined&&typeof cat.showBeforeTransfer!=='boolean')return 'Проверьте показ темы и стоимости до передачи';
 const p=cat.price;
 if(!p||!['minimum','maximum','step'].every(k=>Number.isInteger(p[k])&&p[k]>=0&&p[k]<=2147483647)||p.maximum<p.minimum||p.maximum===0&&p.minimum!==0||p.minimum<p.maximum&&p.step>0&&(p.step>p.maximum-p.minimum||(p.maximum-p.minimum)%p.step!==0))return 'Укажите корректную стоимость кота: минимум, максимум и шаг';
 return '';
}
export const customRevealError=q=>q.revealMode==='custom'&&!q.steps.slice(q.steps.findIndex(st=>st.type==='answer')+1).some(st=>st.type!=='answer')?'Добавьте события после ответа игроков или переключитесь на стандартное поведение':'';
export function stepSummary(st){
 if(st.type==='text')return String(st.value||'').trim().replace(/\s+/g,' ')||'Добавьте текст';
 if(st.type==='answer')return st.duration?`${st.duration} сек на ответ`:'Время по настройкам игры';
 return (st.filename||'Файл ещё не выбран')+(st.type==='image'&&st.caption?.trim()?' · '+st.caption.trim().replace(/\s+/g,' '):'');
}
export const validQuestionPrice=value=>Number.isInteger(value)&&value>=0&&value<=2147483647;
export function interludeRoundError(r){
 if(r.type!=='interlude')return '';
 if(!validQuestionPrice(r.questionPrice))return 'Укажите целую стоимость вопросов интерлюдии от 0 до 2147483647.';
 if(r.themes.some(t=>t.questions.some(q=>q.price!==r.questionPrice)))return 'Все вопросы интерлюдии должны стоить одинаково. Сохраните стоимость в настройках раунда.';
 return '';
}
export const canAddQuestion=(r,t)=>r?.type!=='final'||t.questions.length===0;
export function finalRoundError(r){
 if(r.themes.some(t=>t.questions.length!==1))return 'В финале в каждой теме должен быть ровно один вопрос. Сначала измените состав тем или создайте отдельный раунд для финала.';
 if(r.themes.some(t=>questionType(t.questions[0])!=='simple'))return 'В финале используются скрытые ставки всех игроков. Сначала смените тип вопросов на обычный.';
 return '';
}
export const step=(type='text',value='')=>({id:uid(),type:type==='replic'?'text':type,value,duration:0,wait:true,...(type==='replic'?{placement:'replic'}:{})});
export const question=(price=100,text='',answer='')=>({id:uid(),type:'simple',price,answer,alternatives:'',wrong:'',comment:'',source:'',steps:[step('text',text),step('answer')]});
export const theme=(name='Новая тема',base=100)=>({id:uid(),name,questions:Array.from({length:5},(_,i)=>question((i+1)*base))});
export const questions=p=>p.rounds.flatMap(r=>r.themes.flatMap(t=>t.questions));
export function initial(demo=true){const p={id:uid(),name:demo?'Хороший вечер':'Новый пак',author:'',description:'',difficulty:5,language:'ru-RU',rounds:[{id:uid(),name:'Первый раунд',type:'standard',themes:[]}]};if(!demo){p.rounds[0].themes=[theme()];return p;}const samples=[['Вокруг света',[
['В какой стране находится город Киото, который больше тысячи лет был столицей государства?','Япония'],['Какой океан самый большой на Земле?','Тихий океан'],['Как называется столица Исландии?','Рейкьявик'],['В какой стране находится древний город Петра?','Иордания'],['Какой пролив разделяет Европу и Африку?','Гибралтарский пролив']]],
['Большой экран',[['Кто снял фильм «Интерстеллар»?','Кристофер Нолан'],['В каком фильме звучит фраза «Да пребудет с тобой Сила»?','Звёздные войны'],['Как зовут главного героя «Матрицы»?','Нео'],['Как называется город из мультфильма «Зверополис»?','Зверополис'],['Кто исполнил роль Джека в «Титанике»?','Леонардо Ди Каприо']]],
['Наука рядом',[['Какая планета известна как Красная планета?','Марс'],['Какой химический символ у золота?','Au'],['Сколько костей обычно у взрослого человека?','206'],['В каких единицах измеряют электрическое сопротивление?','Ом'],['Кто открыл пенициллин?','Александр Флеминг']]],
['Слова и смыслы',[['Как называется слово, которое читается одинаково в обоих направлениях?','Палиндром'],['Кто написал «Маленького принца»?','Антуан де Сент-Экзюпери'],['Как называют слова с противоположными значениями?','Антонимы'],['Какой язык дал нам слово «алгоритм»?','Арабский'],['Как называется наука о происхождении слов?','Этимология']]],
['Звучит знакомо',[['Сколько струн у стандартной гитары?','Шесть'],['Какой инструмент называют королём инструментов?','Орган'],['Кто написал «Времена года» в 1723 году?','Антонио Вивальди'],['Как называется музыкальный коллектив из четырёх исполнителей?','Квартет'],['Какой композитор написал «Лунную сонату»?','Людвиг ван Бетховен']]]];p.rounds[0].themes=samples.map(([name,qs])=>({id:uid(),name,questions:qs.map(([t,a],i)=>question((i+1)*100,t,a))}));return p;}
// The status, checklist and export validation share these question-level requirements.
export function questionReadiness(q,r,media=new Map()){
 const split=q.steps.findIndex(s=>s.type==='answer'),answers=q.steps.filter(s=>s.type==='answer').length;
 const check=(id,label,errors=[])=>({id,label,passed:errors.length===0,errors});
 const eventErrors=[];
 for(const [i,s]of q.steps.entries()){
  if(!Number.isInteger(s.duration)||s.duration<0||s.duration>35999)eventErrors.push({message:'некорректная длительность шага',stepId:s.id,field:'duration',detail:`Событие ${i+1}: задайте время от 0 до 35999 сек`});
  if(s.type==='image'&&s.caption?.trim()&&s.duration===1)eventErrors.push({message:'для изображения с подписью нужно не менее 2 сек',stepId:s.id,field:'duration',detail:`Событие ${i+1}: задайте от 2 сек или время по настройкам игры`});
  if(s.type==='text'&&!s.value.trim())eventErrors.push({message:stepKind(s)==='replic'?'пустое слово ведущего':'пустой текстовый шаг',stepId:s.id,field:'value',detail:`Событие ${i+1}: ${stepKind(s)==='replic'?'добавьте слово ведущего':'добавьте текст'}`});
  if(['image','audio','video'].includes(s.type)&&!media.has(s.mediaId))eventErrors.push({message:'не загружен медиафайл',stepId:s.id,field:'media',detail:`Событие ${i+1}: загрузите файл`});
 }
 const typeErrors=[];
 if(!Object.hasOwn(questionTypes,questionType(q)))typeErrors.push({message:'неподдерживаемый тип вопроса',detail:'Выберите поддерживаемый тип вопроса'});
 if(r.type==='final'&&questionType(q)!=='simple')typeErrors.push({message:'для финала нужен вопрос со скрытыми ставками, без аукциона и кота',detail:'В финале используются скрытые ставки всех игроков'});
 if(questionType(q)==='bagcat'){const error=catSettingsError(catSettings(q));if(error)typeErrors.push({message:error,detail:error});}
 const answerErrors=answers===0?[{message:'нет шага «Игроки отвечают»',detail:'Добавьте событие ответа игроков'}]:answers>1?[{message:'повторные попытки с подсказками пока не поддерживаются: SIGame раскрывает ответ после первого таймера',detail:'Оставьте одно событие ответа игроков'}]:[];
 return [
  check('content','Есть содержимое вопроса до ответа игроков',q.steps.slice(0,split<0?undefined:split).some(s=>s.type==='text'?s.value.trim():s.mediaId)?[]:[{message:'нет содержимого вопроса',detail:'Добавьте текст или медиа перед ответом игроков'}]),
  check('answer-event','Добавлено одно событие ответа игроков',answerErrors),
  check('answer','Указан правильный ответ',q.answer.trim()?[]:[{message:'нет правильного ответа',detail:'Заполните поле «Правильный ответ»'}]),
  check('events','Все события заполнены, файлы загружены',eventErrors),
  check('reveal','Настроено раскрытие ответа',customRevealError(q)?[{message:customRevealError(q),detail:customRevealError(q)}]:[]),
  check('type','Выбран подходящий тип вопроса',typeErrors),
  ...(r.type==='final'?[]:[check('price','Стоимость — целое неотрицательное число',Number.isInteger(q.price)&&q.price>=0?[]:[{message:'некорректная стоимость',detail:'Укажите целую стоимость от 0'}])])
 ];
}
export function questionChecklist(q,r,media=new Map()){
 return questionReadiness(q,r,media).filter(check=>['content','answer','events'].includes(check.id)||['type','reveal'].includes(check.id)&&!check.passed).flatMap(check=>check.passed?[{label:check.label,passed:true}]:check.errors.map(error=>({label:error.detail,passed:false,target:check.id,stepId:error.stepId,field:error.field})));
}
export function issues(p,media=new Map()){
 const errors=[];
 if(!p.name.trim())errors.push({message:'Укажите название пака'});
 if(!p.rounds.length)errors.push({message:'Добавьте раунд'});
 for(const r of p.rounds){
  if(!r.name.trim())errors.push({message:'Укажите название раунда'});
  const interludeError=interludeRoundError(r);if(interludeError)errors.push({message:`${r.name}: ${interludeError}`,round:r.id});
  if(!r.themes.length)errors.push({message:`${r.name}: добавьте тему`});
  for(const t of r.themes){
   if(!t.name.trim())errors.push({message:'Укажите название темы'});
   if(!t.questions.length)errors.push({message:`${t.name}: добавьте вопрос`,round:r.id,theme:t.id});
   if(r.type==='final'&&t.questions.length>1)errors.push({message:`${t.name}: в финальной теме должен быть ровно один вопрос`,round:r.id,theme:t.id,question:t.questions[0].id});
   for(const q of t.questions)for(const check of questionReadiness(q,r,media))for(const error of check.errors)errors.push({message:`${t.name} · ${q.price}: ${error.message}`,round:r.id,theme:t.id,question:q.id});
  }
 }
 return errors;
}

// Keep the established newline storage used by SIQ while editing one answer at a time.
export const answerEntries=value=>String(value||'').split(/\r?\n/).map(text=>text.trim()).filter(Boolean);
export function updateAnswerEntries(value,{text='',index=null,after=null,remove=false}={}){
 const entries=answerEntries(value);
 if(index!==null&&(!Number.isInteger(index)||index<0||index>=entries.length))throw Error('Ответ больше не существует');
 if(remove){if(index===null)throw Error('Выберите ответ');entries.splice(index,1);}
 else{
  const clean=String(text).trim();if(!clean||/[\r\n]/.test(clean))throw Error('Введите один ответ');
  if(index!==null)entries[index]=clean;
  else{if(after!==null&&(!Number.isInteger(after)||after<0||after>=entries.length))throw Error('Ответ больше не существует');entries.splice(after===null?entries.length:after+1,0,clean);}
 }
 return entries.join('\n');
}
