const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={plus:'<path d="M12 5v14M5 12h14"/>',folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10H3z"/><path d="M12 16v-5m-2 2 2-2 2 2"/>',merge:'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><path d="M6 12v3h12v-3M12 15v6m-3-3 3 3 3-3"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',diagonal:'<path d="M7 17 17 7M7 7h10v10"/>',storage:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 14h18m-4 2h1"/>'};
const icon=type=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[type]}</svg>`;
const plural=(n,one,few,many)=>n%10===1&&n%100!==11?one:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?few:many;

export function welcomeHTML(pack,hasDraft,storageOK){
 const rounds=pack?.rounds||[],count=rounds.reduce((n,r)=>n+r.themes.reduce((m,t)=>m+t.questions.length,0),0);
 const name=escape(pack?.name)||'Без названия';
 return `<div class="welcome-page">
 <div class="welcome-drop-overlay" aria-hidden="true"><div><strong>Отпустите .siq, чтобы открыть пак</strong><span>Он откроется сразу в редакторе</span></div></div>
 <header class="welcome-header"><a class="brand" href="./" aria-label="SIGameMaker"><img class="brand-logo" src="./assets/logo-horizontal.png" alt="SIGameMaker"></a><span class="welcome-header-note">Для ваших хороших вечеров</span></header>
 <main class="welcome-main">
  <section class="welcome-hero" aria-labelledby="welcome-title"><div class="welcome-copy"><p class="welcome-eyebrow">ВАША КОМПАНИЯ. ВАШИ ВОПРОСЫ.</p><h1 id="welcome-title">Соберите свою игру<span>.</span></h1><p class="welcome-intro">Любимые темы, неожиданные вопросы<br>и вечер, который захочется повторить.</p></div>
   <div class="welcome-art" aria-hidden="true"><div class="welcome-glow"></div><div class="welcome-board"><div class="welcome-board-heading">ВАША СЛЕДУЮЩАЯ ИГРА</div><div class="welcome-board-grid"><span>КИНО</span><span>МУЗЫКА</span><span>ОБО ВСЁМ</span>${[100,200,300].map(price=>`<b>${price}</b><b>${price}</b><b>${price}</b>`).join('')}</div></div><div class="welcome-gold">500</div><div class="welcome-chip">✦ &nbsp; Для своих</div></div>
  </section>
  ${hasDraft?`<button type="button" class="welcome-recent" data-action="resume-pack" aria-label="Продолжить черновик «${name}»"><span class="draft-thumbnail" aria-hidden="true"><span>ВАША ИГРА</span><b>300</b><i>✦</i></span><span class="draft-description"><span class="draft-label"><span></span> ВАШ ЧЕРНОВИК</span><strong title="${name}">${name}</strong><small>${rounds.length} ${plural(rounds.length,'раунд','раунда','раундов')} · ${count} ${plural(count,'вопрос','вопроса','вопросов')}</small><span class="draft-local">${icon('storage')} На этом устройстве</span></span><span class="draft-continue">Продолжить <span class="draft-continue-circle">${icon('arrow')}</span></span></button>`:''}
  <div class="welcome-actions">
   <button class="welcome-action welcome-create" data-action="create-pack"><span class="welcome-action-icon">${icon('plus')}</span><h2>Создать новый пак</h2><p>Начните с собственной идеи</p><span class="welcome-action-arrow">${icon('diagonal')}</span></button>
   <button class="welcome-action welcome-open" data-action="import"><span class="welcome-action-icon">${icon('folder')}</span><h2>Открыть .siq</h2><p>Выберите или перетащите файл</p><span class="welcome-action-arrow">${icon('diagonal')}</span></button>
   <button class="welcome-action welcome-merge" data-action="merge-packs"><span class="welcome-action-icon">${icon('merge')}</span><h2>Объединить два пака</h2><p>Соберите лучшее в одной игре</p><span class="welcome-action-arrow">${icon('diagonal')}</span></button>
  </div>
  <div class="welcome-explore"><span>Впервые здесь?</span><button data-action="open-demo">Посмотреть пример <span>↗</span></button><i>·</i><button data-action="help">Как это работает</button></div>
 </main>
 <footer class="welcome-footer"><span class="welcome-privacy">${icon('storage')}${storageOK?'Без регистрации. Черновик сохраняется в этом браузере.':'Автосохранение недоступно. Скачивайте .siq, чтобы сохранить работу.'}</span><span>Сделано для «Своей игры»</span></footer></div>`;
}

// Accept file drops across the home screen, including its buttons and empty space.
export function installWelcomeDrop({target=document,enabled,onFile,onError}){
 let depth=0;
 const clear=()=>{depth=0;target.querySelector('.welcome-page')?.classList.remove('is-file-drag');};
 const fileDrag=ev=>Array.from(ev.dataTransfer?.types||[]).includes('Files');
 target.addEventListener('dragenter',ev=>{if(!enabled()||!fileDrag(ev))return;ev.preventDefault();depth++;target.querySelector('.welcome-page')?.classList.add('is-file-drag');});
 target.addEventListener('dragover',ev=>{if(!enabled()||!fileDrag(ev))return;ev.preventDefault();ev.dataTransfer.dropEffect='copy';});
 target.addEventListener('dragleave',ev=>{if(!fileDrag(ev))return;if(--depth<=0||!ev.relatedTarget)clear();});
 target.addEventListener('dragend',clear);
 target.addEventListener('drop',ev=>{
  const accept=enabled()&&fileDrag(ev);clear();if(!accept)return;ev.preventDefault();
  const files=Array.from(ev.dataTransfer.files);
  if(files.length!==1){onError('Перетащите один файл .siq');return;}
  if(!/\.siq$/i.test(files[0].name)){onError('Выберите файл пака в формате .siq');return;}
  onFile(files[0]);
 });
}
