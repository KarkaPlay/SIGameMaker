import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateStylesheet} from '../../validate-styles.mjs';

test('every stylesheet linked by the app contains CSS rather than application JavaScript',()=>{
 const html=readFileSync('dist/index.html','utf8');
 const paths=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="\.\/([^"]+)"/g)].map(match=>match[1]);
 assert.ok(paths.length>=3);
 assert.ok(paths.includes('merge.css'));
 for(const path of paths)validateStylesheet(readFileSync('dist/'+path,'utf8'),path);
 const welcome=readFileSync('dist/welcome.css','utf8');
 for(const selector of ['.welcome-page','.welcome-main','.welcome-action-icon svg','.welcome-drop-overlay','.setup-page','.import-review-dialog'])assert.ok(welcome.includes(selector),selector);
});

test('stylesheet guard rejects overwritten or appended JavaScript and empty files before packaging',()=>{
 for(const source of ["import {createPanelMotion} from './panel-motion.js';\nconst app={};",'.welcome-page{display:flex}\nimport {app} from "./app.js";', 'export function start() {}', '/* no rules */'])assert.throws(()=>validateStylesheet(source,'welcome.css'),/welcome.css/);
 assert.doesNotThrow(()=>validateStylesheet('/* import explanation */\n@media(prefers-reduced-motion:reduce){.welcome-page{animation:none}}','welcome.css'));
});
