import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const kit=import.meta.dirname,root=process.argv[2];if(!root)throw Error('Pass installed repo for dependency resolution only.');
const require=createRequire(resolve(root,'package.json'));
if(require('react/package.json').version!=='19.2.8')throw Error('This recorded fixture requires React 19.2.8.');
const {build}=await import(pathToFileURL(require.resolve('esbuild')).href);
for(const variant of ['before','after']){
 const content=`import React,{StrictMode} from 'react';import{createRoot}from'react-dom/client';import{AgentMintPanel}from'./agent.${variant}.tsx.source.txt';
 import{preparePayloadBundle}from'./shared/studio-payload.ts.source.txt';import{createMintIntent}from'./shared/studio-intent.ts.source.txt';import{createMintReviewUrl}from'./shared/studio-review-link.ts.source.txt';
 let root;window.walletCalls=0;window.downloads=0;Object.defineProperty(window,'cardano',{get(){window.walletCalls++;throw Error('Unexpected wallet access');}});
 const original=crypto.subtle.digest.bind(crypto.subtle);let hold=false,resolvers=[];crypto.subtle.digest=async(...args)=>{if(hold)await new Promise(resolve=>resolvers.push(resolve));return original(...args)};
 window.testHarness={mount(strict=true){root=createRoot(document.getElementById('root'));root.render(strict?<StrictMode><AgentMintPanel/></StrictMode>:<AgentMintPanel/>);},unmount(){root.unmount();},hold(){hold=true;},release(){hold=false;for(const r of resolvers)r();resolvers=[];},async make(name){const b=await preparePayloadBundle({name,coverIndex:0,files:[{name:'spaceship.svg',mediaType:'image/svg+xml',bytes:new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><path d="M5 0 9 9 5 7 1 9Z"/></svg>')}]});const i=await createMintIntent(b,'nft');return{intent:i,url:await createMintReviewUrl(i,'https://beacnpool.github.io/NFT-Studio/')}}};`;
 await build({stdin:{contents:content,resolveDir:kit,loader:'tsx'},outfile:resolve(kit,variant+'.js'),bundle:true,platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},nodePaths:[resolve(root,'node_modules')],plugins:[{name:'test-boundaries',setup(b){b.onLoad({filter:/\.tsx?\.source\.txt$/},async a=>({contents:await readFile(a.path,'utf8'),loader:a.path.endsWith('.tsx.source.txt')?'tsx':'ts'}));b.onResolve({filter:/^\.\/studio-(intent|payload)$/},a=>({path:resolve(kit,'shared',a.path.slice(2)+'.ts.source.txt')}));b.onResolve({filter:/^(lucide-react|\.\/ui\/(button|textarea)|\.\/file-mint-dialog|\.\/file-workbench|@\/lib\/(cardano|export))$/},()=>({path:resolve(kit,'stubs.tsx.source.txt')}));b.onResolve({filter:/^@\/lib\/(studio-intent|studio-review-link)$/},a=>({path:resolve(kit,'shared',a.path.slice('@/lib/'.length)+'.ts.source.txt')}));}}]});
}
console.log('Built both exact component variants with React development mode and real shared codec.');
