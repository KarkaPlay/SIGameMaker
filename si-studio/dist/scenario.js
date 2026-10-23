// Keep a single ordered scenario; sections are only its visual presentation.
export function scenarioParts(steps){
 const marker=steps.findIndex(st=>st.type==='answer');
 return {before:marker<0?steps:steps.slice(0,marker),answer:marker<0?[]:[steps[marker]],after:marker<0?[]:steps.slice(marker+1)};
}
export function insertScenarioStep(steps,st,section='before'){
 const marker=steps.findIndex(item=>item.type==='answer');
 if(st.type==='answer')return marker<0?[...steps,st]:steps;
 if(section==='after')return marker<0?steps:[...steps,st];
 const at=marker<0?steps.length:marker;
 return [...steps.slice(0,at),st,...steps.slice(at)];
}
