import {importSIQ,SIQImportError} from './siq.js';
// All decisions address positions in the original archive: clearing never shifts them.
// Nothing in a review writes to the current draft or modifies the input archive.
export function createImportReview(bytes){
 const decisions={repairQuestions:new Set(),clearQuestions:new Set(),clearRounds:new Set()};
 let state,revision=0;
 const scan=(notice,outcome='')=>{
  revision++;
  const summary={repairedQuestions:decisions.repairQuestions.size,clearedQuestions:decisions.clearQuestions.size,clearedRounds:decisions.clearRounds.size};
  try{state={revision,result:importSIQ(bytes,decisions),issues:[],notice,outcome,summary};}
  catch(error){if(!(error instanceof SIQImportError))throw error;state={revision,error,issues:error.issues,notice,outcome,summary};}
  return state;
 };
 return {
  scan(){return scan('');},
  apply(index,action,expectedRevision){
   if(!state||state.result||expectedRevision!==revision)return state;
   const issue=state.issues[index];if(!issue||!['repair','clear'].includes(action))return state;
   if(action==='repair'){
    if(!issue.canRepair||issue.target?.kind!=='question')return scan('Не удалось исправить автоматически: безопасного способа для этой проблемы нет. Можно очистить проблемный вопрос или раунд.','failure');
    decisions.repairQuestions.add(issue.target.key);
    return scan('Удалось исправить тип вопроса. Применены обычные правила финала.','success');
   }
   if(!issue.target)return scan('Очистка недоступна: не удалось определить вопрос или раунд. Проверьте исходный файл.','failure');
   const {kind,key}=issue.target;
   if(kind==='question')decisions.clearQuestions.add(key);
   else if(kind==='round')decisions.clearRounds.add(key);
   else return state;
   return scan(kind==='question'?'Вопрос очищен в импортируемой копии. Его место на поле сохранено.':'Раунд очищен в импортируемой копии. Темы и места вопросов сохранены.','success');
  }
 };
}
