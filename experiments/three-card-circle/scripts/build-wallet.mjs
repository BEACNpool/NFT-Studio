// Browser packaging for the same Lucid/CML builders used by the signed rehearsals.
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createRequire} from 'node:module';
const repo=resolve(import.meta.dirname,'../../..');
const rootRequire=createRequire(resolve(repo,'package.json'));
const output=resolve(repo,'public/showcase/three-card-circle/wallet');
await build({entryPoints:[resolve(import.meta.dirname,'wallet-transfer.mjs')],outfile:output+'/transfer.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'linked',loader:{'.wasm':'file'},assetNames:'[name]-[hash]',alias:{buffer:rootRequire.resolve('buffer/'),events:rootRequire.resolve('events/')},plugins:[{
 name:'wasm-bindgen-browser',setup(build){
  build.onLoad({filter:/(cardano_multiplatform_lib|cardano_message_signing|uplc_tx)\.js$/},({path})=>{
   if(!path.includes('browser'))return;
   const source=readFileSync(path,'utf8');
   const match=source.match(/import \* as wasm from ["'](.+\.wasm)["']/);
   if(!match)return;
   const bg=match[1].replace('.wasm','.js');
   return {resolveDir:dirname(path),loader:'js',contents:`import * as bg from '${bg}';\nimport url from '${match[1]}';\nconst response=await fetch(new URL(url,import.meta.url));if(!response.ok)throw Error('Wallet engine could not load.');\nconst {instance}=await WebAssembly.instantiate(await response.arrayBuffer(),{${JSON.stringify(bg)}:bg});\nbg.__wbg_set_wasm(instance.exports);instance.exports.__wbindgen_start?.();\nexport * from '${bg}';`};
  });
 }}]});
console.log('Built lazy browser transfer engine.');
