import { build } from 'esbuild';
await build({entryPoints:['src/index.mjs'],outfile:'dist/cip26-inspector.mjs',bundle:true,platform:'browser',format:'esm',target:'es2022',minify:false,legalComments:'eof',metafile:true}).then(async result => { const {writeFile}=await import('node:fs/promises'); await writeFile('dist/metafile.json', JSON.stringify(result.metafile,null,2)+'\n'); });
