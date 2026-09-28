import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
const result = await build({metafile:true,entryPoints:['scripts/showcase-mint-engine.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',define:{'process.env.NEXT_PUBLIC_BASE_PATH':JSON.stringify('/NFT-Studio')},minify:true,legalComments:'linked',outfile:'public/showcase/make-your-own/mint-engine.js'});

const packages = [...new Set(Object.keys(result.metafile.inputs).filter(p => p.startsWith('node_modules/')).map(p => p.split('/').slice(1, p.split('/')[1].startsWith('@') ? 3 : 2).join('/')))];
const notices = [];
for (const name of packages) {
  const license = await readFile(`node_modules/${name}/LICENSE`, 'utf8');
  notices.push(`${name}\n${license}`);
}
await writeFile('public/showcase/make-your-own/mint-engine.LICENSE.txt', notices.join('\n\n---\n\n'));
