export const uid=()=>crypto.randomUUID();
export const kinds={text:['Текст на экране','T'],image:['Изображение','▧'],audio:['Аудио','♫'],video:['Видео','▷'],answer:['Игроки отвечают','⌁']};
export const questionTypes={simple:'Обычный вопрос',stake:'Вопрос-аукцион'};
export const questionType=q=>q.type===undefined?'simple':q.type;
export const answerLabel=(q,r)=>r?.type==='final'?'Финалисты отвечают':questionType(q)==='stake'?'Победитель аукциона отвечает':'Игроки отвечают';
export const canAddQuestion=(r,t)=>r?.type!=='final'||t.questions.length===0;
export function finalRoundError(r){
 if(r.themes.some(t=>t.questions.length!==1))return 'В финале в каждой теме должен быть ровно один вопрос. Сначала измените состав тем или создайте отдельный раунд для финала.';
 if(r.themes.some(t=>questionType(t.questions[0])!=='simple'))return 'В финале используются скрытые ставки всех игроков. Сначала смените тип вопросов на обычный.';
 return '';
}
export const step=(type='text',value='')=>({id:uid(),type,value,duration:0,wait:true});
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
  if(s.type==='text'&&!s.value.trim())eventErrors.push({message:'пустой текстовый шаг',stepId:s.id,field:'value',detail:`Событие ${i+1}: добавьте текст`});
  if(['image','audio','video'].includes(s.type)&&!media.has(s.mediaId))eventErrors.push({message:'не загружен медиафайл',stepId:s.id,field:'media',detail:`Событие ${i+1}: загрузите файл`});
 }
 const typeErrors=[];
 if(!Object.hasOwn(questionTypes,questionType(q)))typeErrors.push({message:'неподдерживаемый тип вопроса',detail:'Выберите поддерживаемый тип вопроса'});
 if(r.type==='final'&&questionType(q)!=='simple')typeErrors.push({message:'для финала нужен вопрос со скрытыми ставками, без аукциона',detail:'В финале используются скрытые ставки всех игроков'});
 const answerErrors=answers===0?[{message:'нет шага «Игроки отвечают»',detail:'Добавьте событие ответа игроков'}]:answers>1?[{message:'повторные попытки с подсказками пока не поддерживаются: SIGame раскрывает ответ после первого таймера',detail:'Оставьте одно событие ответа игроков'}]:[];
 return [
  check('content','Есть содержимое вопроса до ответа игроков',q.steps.slice(0,split<0?undefined:split).some(s=>s.type==='text'?s.value.trim():s.mediaId)?[]:[{message:'нет содержимого вопроса',detail:'Добавьте текст или медиа перед ответом игроков'}]),
  check('answer-event','Добавлено одно событие ответа игроков',answerErrors),
  check('answer','Указан правильный ответ',q.answer.trim()?[]:[{message:'нет правильного ответа',detail:'Заполните поле «Правильный ответ»'}]),
  check('events','Все события заполнены, файлы загружены',eventErrors),
  check('type','Выбран подходящий тип вопроса',typeErrors),
  ...(r.type==='final'?[]:[check('price','Стоимость — целое неотрицательное число',Number.isInteger(q.price)&&q.price>=0?[]:[{message:'некорректная стоимость',detail:'Укажите целую стоимость от 0'}])])
 ];
}
export function questionChecklist(q,r,media=new Map()){
 return questionReadiness(q,r,media).filter(check=>['content','answer','events'].includes(check.id)).flatMap(check=>check.passed?[{label:check.label,passed:true}]:check.errors.map(error=>({label:error.detail,passed:false,target:check.id,stepId:error.stepId,field:error.field})));
}
export function issues(p,media=new Map()){
 const errors=[];
 if(!p.name.trim())errors.push({message:'Укажите название пака'});
 if(!p.rounds.length)errors.push({message:'Добавьте раунд'});
 for(const r of p.rounds){
  if(!r.name.trim())errors.push({message:'Укажите название раунда'});
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
