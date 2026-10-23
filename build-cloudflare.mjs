import { copyFile, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve paths relative to this script, regardless of the terminal's directory.
const root = dirname(fileURLToPath(import.meta.url));
const source = join(root, 'si-studio', 'dist');
const output = join(root, 'cloudflare-upload');

async function collect(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const relative = join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Не поддерживается ссылка: ${relative}`);
    if (entry.isDirectory()) files.push(...await collect(join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

try {
  const files = await collect(source);
  for (const required of ['index.html', 'app.js', 'model.js', 'pricing.js', 'panel-motion.js', 'answer-list-motion.js', 'storage.js', 'siq.js', 'style.css', 'welcome.js', 'welcome.css', 'setup.js', 'editor.css', 'step-drag.js', 'preview-timer.js', 'scenario.js', 'vendor/fflate.js', 'vendor/fflate.LICENSE']) {
    if (!files.includes(join(...required.split('/')))) {
      throw new Error(`В исходниках отсутствует ${required}`);
    }
  }
  const html = await readFile(join(source, 'index.html'), 'utf8');
  if (!html.includes('src="./app.js"') || !html.includes('href="./style.css"') || !html.includes('href="./welcome.css"') || !html.includes('href="./editor.css"')) {
    throw new Error('Проверьте подключения app.js, style.css, welcome.css и editor.css в index.html');
  }

  // Only this generated folder is replaced; the application source is retained.
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const file of files) {
    await mkdir(dirname(join(output, file)), { recursive: true });
    await copyFile(join(source, file), join(output, file));
  }

  console.log(`Готово: ${output}`);
  console.log(`Скопировано файлов: ${files.length}. index.html находится в корне папки.`);
  console.log('Загрузите папку cloudflare-upload через Cloudflare Direct Upload.');
} catch (error) {
  console.error(`Не удалось собрать сайт: ${error.message}`);
  process.exitCode = 1;
}
