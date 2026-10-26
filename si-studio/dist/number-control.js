const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// The button increment is separate from native validity: authors may type any integer.
export function nudgedNumber(value,delta,{min=0,max=2147483647,increment=100}={}){
 const current=String(value).trim()===''?min:Number(value);
 return Math.max(min,Math.min(max,(Number.isFinite(current)?Math.round(current):min)+delta*increment));
}
export function numberField(label,name,value,{min=0,max=2147483647,increment=100,disabled=false,description='',className='',showLabel=true}={}){
 const id='studio-number-'+name;
 return `<div class="studio-number-field ${className}">${showLabel?`<label for="${id}">${escape(label)}</label>`:''}<div class="studio-number-control" data-increment="${increment}"><button type="button" data-action="nudge-number" data-delta="-1" aria-label="Уменьшить: ${escape(label)}" ${disabled||value<=min?'disabled':''}>−</button><input id="${id}" name="${name}" aria-label="${escape(label)}" type="number" inputmode="numeric" min="${min}" max="${max}" step="1" value="${escape(value)}" required ${disabled?'disabled':''} ${description?`aria-describedby="${description}"`:''}><button type="button" data-action="nudge-number" data-delta="1" aria-label="Увеличить: ${escape(label)}" ${disabled||value>=max?'disabled':''}>+</button></div></div>`;
}
export function syncNumberControls(root){
 for(const control of root.querySelectorAll('.studio-number-control')){
  const input=control.querySelector('input'),value=Number(input.value);
  for(const button of control.querySelectorAll('button')){
   button.disabled=input.matches(':disabled')||(Number(button.dataset.delta)<0?value<=Number(input.min):value>=Number(input.max));
  }
 }
}
export function nudgeNumber(button){
 const control=button.closest('.studio-number-control'),input=control?.querySelector('input');
 if(!input||input.matches(':disabled'))return;
 input.focus({preventScroll:true});
 input.value=String(nudgedNumber(input.value,Number(button.dataset.delta),{min:Number(input.min),max:Number(input.max),increment:Number(control.dataset.increment)}));
 input.dispatchEvent(new Event('input',{bubbles:true}));
 input.dispatchEvent(new Event('change',{bubbles:true}));
}
