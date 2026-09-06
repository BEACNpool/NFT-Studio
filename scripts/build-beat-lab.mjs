// Rebuild the audited program template from readable, dependency-free source.
import { readFile, writeFile } from 'node:fs/promises';
import { transform } from 'esbuild';
const source = await readFile('scripts/beat-lab/source.html', 'utf8');
const css = source.match(/<style>([\s\S]*?)<\/style>/)[1];
const js = source.match(/<script>([\s\S]*?)<\/script>/)[1];
const compactCSS = (
  await transform(css, { loader: 'css', minify: true })
).code.trim();
const compactJS = (
  await transform(js, { loader: 'js', minify: true })
).code.trim();
const template = source
  .replace(css, compactCSS)
  .replace(js, compactJS)
  .replace(/>\s+</g, '><')
  .trim();
await writeFile('lib/beat-lab-template.json', JSON.stringify(template) + '\n');
console.log(`Beat Lab template: ${Buffer.byteLength(template)} bytes`);
