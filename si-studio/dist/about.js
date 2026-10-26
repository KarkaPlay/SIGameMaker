// This landing-page example is independent of the editor and its saved draft.
const questions = [
  { title: 'Кино · 100', text: 'Как называется школа волшебства, в которой учился Гарри Поттер?', answer: 'Хогвартс' },
  { title: 'Музыка · 100', text: 'Сколько струн у стандартной шестиструнной гитары?', answer: 'Шесть' },
  { title: 'Наука · 100', text: 'Как называется ближайшая к Солнцу планета?', answer: 'Меркурий' },
  { title: 'Кино · 200', text: 'Как называется город, который защищает Бэтмен?', answer: 'Готэм' },
  { title: 'Музыка · 200', text: 'Как называется музыкальный инструмент с клавишами, струнами и молоточками?', answer: 'Фортепиано' },
  { title: 'Наука · 200', text: 'Какой химический элемент обозначается символом Au?', answer: 'Золото' },
  { title: 'Кино · 300', text: 'Кто снял фильм «Интерстеллар»?', answer: 'Кристофер Нолан' },
  { title: 'Музыка · 300', text: 'Кто написал цикл концертов «Времена года», опубликованный в 1725 году?', answer: 'Антонио Вивальди' },
  { title: 'Наука · 300', text: 'В каких единицах системы СИ измеряется электрическое сопротивление?', answer: 'В омах' },
];

// Measure both native states, including padding and borders. On reversal, start
// from the currently painted height rather than the previous target height.
export function createFAQMotion({ reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches } = {}) {
  const active = new Map();

  function toggle(details) {
    const previous = active.get(details);
    const expanded = previous ? !previous.expanded : !details.open;
    const start = details.getBoundingClientRect().height;
    previous?.finish();

    if (reduceMotion() || typeof details.animate !== 'function') {
      details.open = expanded;
      return;
    }

    const summary = details.querySelector('summary');
    const answer = details.querySelector('p');
    const saved = { height: details.style.height, overflow: details.style.overflow };
    details.open = expanded;
    const end = details.getBoundingClientRect().height;
    details.open = true;
    details.style.overflow = 'hidden';
    details.dataset.faqExpanded = String(expanded);
    summary.setAttribute('aria-expanded', String(expanded));
    // Keep closing content out of focus and the accessibility tree until hidden.
    answer.inert = !expanded;
    if (!expanded) answer.setAttribute('aria-hidden', 'true');

    const state = {
      expanded,
      finish() {
        if (active.get(details) !== state) return;
        active.delete(details);
        details.open = expanded;
        state.animation.cancel();
        Object.assign(details.style, saved);
        delete details.dataset.faqExpanded;
        summary.removeAttribute('aria-expanded');
        answer.inert = false;
        answer.removeAttribute('aria-hidden');
      },
    };
    active.set(details, state);
    state.animation = details.animate([
      { height: `${start}px` },
      { height: `${end}px` },
    ], { duration: 320, easing: 'cubic-bezier(.08,1,.16,1)', fill: 'both' });
    state.animation.finished.then(state.finish).catch(() => {});
  }

  const stop = () => {
    for (const state of [...active.values()]) state.finish();
  };
  return { toggle, stop };
}

const demo = globalThis.document?.querySelector('[data-editor-demo]');
if (demo) {
  const buttons = [...demo.querySelectorAll('[data-demo-question]')];
  const title = demo.querySelector('[data-demo-title]');
  const text = demo.querySelector('[data-demo-text]');
  const answer = demo.querySelector('[data-demo-answer]');
  const scenario = demo.querySelector('[data-demo-scenario]');
  const announcement = document.querySelector('[data-demo-announcement]');
  const hint = document.querySelector('[data-demo-hint]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let selected = 0;
  let animation;

  const stopAnimation = () => {
    animation?.cancel();
    animation = undefined;
  };

  const select = index => {
    if (index === selected || !questions[index]) return;
    selected = index;
    const question = questions[index];
    stopAnimation();
    title.textContent = question.title;
    text.textContent = question.text;
    answer.textContent = question.answer;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.demoQuestion) === index)));
    announcement.textContent = `Выбран вопрос «${question.title}». Сценарий открыт справа.`;

    // The whole scenario enters from its right-hand boundary; the board stays put.
    if (!reducedMotion.matches && typeof scenario.animate === 'function') {
      const current = scenario.animate([
        { transform: 'translateX(22px)', opacity: 0.4 },
        { transform: 'translateX(0)', opacity: 1 },
      ], { duration: 420, easing: 'cubic-bezier(.08,1,.16,1)' });
      animation = current;
      current.finished.then(() => {
        if (animation === current) animation = undefined;
      }).catch(() => {});
    }
  };

  buttons.forEach(button => {
    button.disabled = false;
    button.addEventListener('click', () => select(Number(button.dataset.demoQuestion)));
  });
  hint.hidden = false;
  reducedMotion.addEventListener('change', stopAnimation);
  window.addEventListener('pagehide', stopAnimation);
}

const faqItems = [...(globalThis.document?.querySelectorAll('.faq-list details') || [])];
if (faqItems.length) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motion = createFAQMotion({ reduceMotion: () => reducedMotion.matches });
  for (const details of faqItems) {
    details.querySelector('summary').addEventListener('click', event => {
      event.preventDefault();
      motion.toggle(details);
    });
  }
  reducedMotion.addEventListener('change', motion.stop);
  window.addEventListener('pagehide', motion.stop);
  window.addEventListener('resize', motion.stop);
}
