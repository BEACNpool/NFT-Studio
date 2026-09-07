import {build} from 'esbuild';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {resolve} from 'node:path';
const root=new URL('../',import.meta.url);await mkdir(new URL('dist/',root),{recursive:true});
const fixedStudio={name:'fixed-studio-snapshot',setup(b){
 b.onResolve({filter:/^@studio\/music-release$/},()=>({path:resolve(root.pathname,'studio/music-release.ts.source.txt')}));
 b.onResolve({filter:/^\.\/studio-payload$/},args=>{if(args.importer===resolve(root.pathname,'studio/music-release.ts.source.txt'))return {path:resolve(root.pathname,'studio/studio-payload.ts.source.txt')};});
 b.onLoad({filter:/\/studio\/(?:music-release|studio-payload)\.ts\.source\.txt$/},async args=>({contents:await readFile(args.path,'utf8'),loader:'ts',resolveDir:resolve(root.pathname,'studio')}));
}};
const result=await build({absWorkingDir:root.pathname,entryPoints:['src/index.mjs'],outfile:'dist/seal.mjs',bundle:true,platform:'browser',format:'esm',target:'es2022',metafile:true,minify:false,legalComments:'inline',plugins:[fixedStudio]});
await writeFile(new URL('dist/seal.d.mts',root),await readFile(new URL('src/index.d.mts',root)));
const files=[];for(const path of Object.keys(result.metafile.inputs).sort()){const b=await readFile(new URL(path,root));files.push({path,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});}
const b=await readFile(new URL('dist/seal.mjs',root));await writeFile(new URL('evidence/build.json',root),JSON.stringify({inputs:files,output:{bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')},noNodeRuntime:true,studioSnapshotsInert:true},null,2)+'\n');console.log('Built pure browser module',b.length,'bytes');
