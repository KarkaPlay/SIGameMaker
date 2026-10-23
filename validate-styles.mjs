// Catch accidental JavaScript writes before tests or packaging accept a CSS asset.
// This is a file-type guard, not a replacement for a full CSS validator.
export function validateStylesheet(source, filename) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  if (/^\s*(?:import\s|export\s|(?:const|let|var)\s|(?:async\s+)?function\s)/m.test(css)) {
    throw new Error(`${filename}: вместо CSS найден JavaScript. Восстановите файл стилей.`);
  }
  if (!/[^{}]+\{[^{}]*\}/.test(css)) {
    throw new Error(`${filename}: файл не содержит правил CSS.`);
  }
}
