import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = new URL('../',import.meta.url);
export async function buildWorkbench({publish=false}={}) {
  const output=await build({entryPoints:[fileURLToPath(new URL('ui/app.mjs',import.meta.url))],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',minify:true,
    alias:{'@/lib':fileURLToPath(new URL('lib',root))},define:{'process.env.NEXT_PUBLIC_BASE_PATH':'""'}});
  const template=await readFile(new URL('ui/index.html',import.meta.url),'utf8');
  const brand=(await readFile(new URL('ui/beacn.png',import.meta.url))).toString('base64');
  const css=await readFile(new URL('ui/style.css',import.meta.url),'utf8');
  const html=template.replaceAll('BEACN_BRAND_DATA','data:image/png;base64,'+brand).replace('/* WORKBENCH_STYLE */',css).replace('/* WORKBENCH_APP */',output.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
  await mkdir(new URL('dist/',import.meta.url),{recursive:true});
  await writeFile(new URL('dist/workbench.html',import.meta.url),html);
  await writeFile(new URL('dist/workbench-ui.mjs',import.meta.url),'export default '+JSON.stringify(html)+';\n');
  if(publish){await mkdir(new URL('public/workbench/',root),{recursive:true});await writeFile(new URL('public/workbench/index.html',root),html);}
}
if(process.argv[1]===fileURLToPath(import.meta.url))await buildWorkbench({publish:process.argv.includes('--public')});
