import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFAQMotion } from '../dist/about.js';

function element() {
  return {
    attributes: {}, inert: false,
    setAttribute(key, value) { this.attributes[key] = value; },
    removeAttribute(key) { delete this.attributes[key]; },
  };
}

function disclosure(open = false) {
  const summary = element(), answer = element();
  const details = {
    open, dataset: {}, style: { height: '', overflow: '' }, motions: [],
    getBoundingClientRect() {
      const effect = this.motions.at(-1);
      return { height: effect && !effect.cancelled ? effect.paintedHeight : this.open ? 160 : 52 };
    },
    querySelector(selector) { return selector === 'summary' ? summary : answer; },
    animate(frames, options) {
      let resolve, reject;
      const effect = {
        frames, options, paintedHeight: Number.parseFloat(frames[0].height),
        finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
        finish() { resolve(); },
        cancel() { this.cancelled = true; reject(new Error('cancelled')); },
      };
      this.motions.push(effect);
      return effect;
    },
  };
  return { details, summary, answer };
}

test('about board has themes on the left and increasing prices to the right, mapped to the right questions', () => {
  const html = readFileSync(new URL('../dist/about/index.html', import.meta.url), 'utf8');
  const grid = html.match(/<div class="board-grid"[^>]*>([\s\S]*?)<\/div>/)[1];
  const cells = [...grid.matchAll(/<span class="board-topic">([^<]+)<\/span>|<button[^>]*data-demo-question="(\d+)"[^>]*aria-label="([^"]+)"[^>]*>(\d+)<\/button>/g)];
  const source = readFileSync(new URL('../dist/about.js', import.meta.url), 'utf8');
  const titles = [...source.matchAll(/\{ title: '([^']+)'/g)].map(match => match[1]);
  assert.equal(cells.length, 12);
  for (const [row, theme] of ['Кино', 'Музыка', 'Наука'].entries()) {
    assert.equal(cells[row * 4][1], theme);
    for (let column = 1; column <= 3; column++) {
      const cell = cells[row * 4 + column];
      assert.equal(Number(cell[4]), column * 100);
      assert.equal(cell[3], `${theme} за ${column * 100}`);
      assert.equal(titles[Number(cell[2])], `${theme} · ${column * 100}`);
    }
  }
});

test('FAQ animates both directions, measures the complete closed row, and restores native semantics', async () => {
  const { details, summary, answer } = disclosure();
  const motion = createFAQMotion({ reduceMotion: () => false });
  motion.toggle(details);
  assert.deepEqual(details.motions[0].frames, [{ height: '52px' }, { height: '160px' }]);
  assert.equal(details.open, true);
  details.motions[0].finish(); await Promise.resolve();
  assert.equal(details.style.overflow, '');
  assert.equal(summary.attributes['aria-expanded'], undefined);
  motion.toggle(details);
  assert.deepEqual(details.motions[1].frames, [{ height: '160px' }, { height: '52px' }]);
  assert.equal(details.open, true, 'native content stays rendered until closing finishes');
  assert.equal(answer.inert, true);
  assert.equal(answer.attributes['aria-hidden'], 'true');
  details.motions[1].finish(); await Promise.resolve();
  assert.equal(details.open, false);
  assert.equal(details.style.overflow, '');
  assert.equal(answer.inert, false);
  assert.equal(answer.attributes['aria-hidden'], undefined);
  assert.equal(details.dataset.faqExpanded, undefined);
});

test('FAQ reversal starts at the painted height and ignores stale completions', async () => {
  const { details } = disclosure();
  const motion = createFAQMotion({ reduceMotion: () => false });
  motion.toggle(details);
  details.motions[0].paintedHeight = 107;
  details.motions[0].finish(); // A completion queued just before the next click.
  motion.toggle(details);
  assert.equal(details.motions[0].cancelled, true);
  assert.deepEqual(details.motions[1].frames, [{ height: '107px' }, { height: '52px' }]);
  await Promise.resolve();
  assert.equal(details.style.overflow, 'hidden');
  motion.stop();
  assert.equal(details.open, false);
  assert.equal(details.style.overflow, '');
});

test('FAQ settles interrupted transitions when reduced motion is enabled', () => {
  const { details } = disclosure();
  let reduced = false;
  const motion = createFAQMotion({ reduceMotion: () => reduced });
  motion.toggle(details);
  reduced = true;
  motion.toggle(details);
  assert.equal(details.open, false);
  assert.equal(details.motions.length, 1);
  assert.equal(details.style.overflow, '');
  motion.toggle(details);
  assert.equal(details.open, true);
  assert.equal(details.motions.length, 1);
});

test('FAQ works without WAAPI and stop settles multiple items independently', () => {
  const simple = disclosure().details;
  simple.animate = undefined;
  const motion = createFAQMotion({ reduceMotion: () => false });
  motion.toggle(simple); assert.equal(simple.open, true);
  motion.toggle(simple); assert.equal(simple.open, false);
  const first = disclosure().details, second = disclosure(true).details;
  motion.toggle(first); motion.toggle(second); motion.stop();
  assert.equal(first.open, true);
  assert.equal(second.open, false);
  assert.equal(first.style.overflow, '');
  assert.equal(second.style.overflow, '');
});

test('Workers is configured to serve the custom 404 and deep paths use root-relative resources', () => {
  const config = JSON.parse(readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.assets.not_found_handling, '404-page');
  const page = readFileSync(new URL('../dist/404.html', import.meta.url), 'utf8');
  assert.match(page, /name="robots" content="noindex"/);
  assert.match(page, /href="\/about\.css"/);
  assert.match(page, /src="\/assets\/logo-horizontal\.png"/);
  assert.match(page, /href="\/"/);
});
