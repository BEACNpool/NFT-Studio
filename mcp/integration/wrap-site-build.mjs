/** Stage a reversible build wrapper. This never edits source, hosting manifests or a deployed site. */
import { cp, mkdir, readFile, rename, writeFile, lstat, readdir } from 'node:fs/promises';
import { resolve, join, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const args=process.argv.slice(2), options={};
for(let i=0;i<args.length;i+=2){if(!['--source-dist','--output-dist','--worker','--public-origin'].includes(args[i])||!args[i+1])throw new Error('Usage: node wrap-site-build.mjs --source-dist /source/dist --output-dist /new/staged-dist --public-origin https://mcp.example.org [--worker /mcp/dist/worker.mjs]');options[args[i]]=args[i+1];}
if(!options['--source-dist']||!options['--output-dist'])throw new Error('Source and new output directories are required.');
const publicOrigin=options['--public-origin'];
if(!publicOrigin)throw new Error('An explicit --public-origin is required.');
const configuredOrigin=new URL(publicOrigin);
if(configuredOrigin.protocol!=='https:'||configuredOrigin.origin!==publicOrigin||configuredOrigin.username||configuredOrigin.password)throw new Error('Public origin must be an exact HTTPS origin without credentials, path or query.');
const source=resolve(options['--source-dist']),output=resolve(options['--output-dist']);
const worker=resolve(options['--worker']||join(dirname(fileURLToPath(import.meta.url)),'../dist/worker.mjs'));
const sub=relative(source,output);if(!sub||(!sub.startsWith('..')&&!isAbsolute(sub)))throw new Error('Staging output must be outside the source build directory.');
async function noLinks(path){const info=await lstat(path);if(info.isSymbolicLink())throw new Error('Build staging rejects symlinks.');if(info.isDirectory())for(const name of await readdir(path))await noLinks(join(path,name));}
await noLinks(source);
const app=await readFile(join(source,'server/index.js'));
await lstat(join(source,'client'));
const mcp=await readFile(worker);
const wasmPath=join(dirname(worker),'cardano_serialization_lib_bg.wasm');
await noLinks(wasmPath);
const wasm=await readFile(wasmPath);
if(createHash('sha256').update(wasm).digest('hex')!=='30f78ee3d0e5fc2f4cd1c87347b330e69fcdd0acb07d4a6e08ff8278d7d9a40b')throw new Error('Expected pinned CSL 17 static WASM next to the Worker module.');
if(app.includes(Buffer.from('NFT_STUDIO_MCP_WRAPPER')))throw new Error('The input build is already wrapped. Rebuild from source first.');
await mkdir(output,{recursive:false});
for(const name of await readdir(source)) await cp(join(source,name),join(output,name),{recursive:true,errorOnExist:true,force:false});
await rename(join(output,'server/index.js'),join(output,'server/studio-app.js'));
await writeFile(join(output,'server/mcp-public.mjs'),mcp,{flag:'wx'});
await writeFile(join(output,'server/cardano_serialization_lib_bg.wasm'),wasm,{flag:'wx'});
const studioUrl='https://beacnpool.github.io/NFT-Studio/';
const wrapper=`// NFT_STUDIO_MCP_WRAPPER: generated release artifact; original app is studio-app.js.\nimport app from './studio-app.js';\nimport { createPublicMcpHandler } from './mcp-public.mjs';\nexport * from './studio-app.js';\nconst mcp = createPublicMcpHandler(${JSON.stringify({publicOrigin,studioUrl,endpointPath:'/api/mcp',allowedOrigins:[publicOrigin,'https://beacnpool.github.io']})});\nexport default {\n  ...app,\n  fetch(request, env, context) {\n    if (new URL(request.url).pathname === '/api/mcp') return mcp.fetch(request);\n    return app.fetch(request, env, context);\n  }\n};\n`;
await writeFile(join(output,'server/index.js'),wrapper,{flag:'wx'});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const receipt={schema:'nft-studio.mcp-wrapper.v1',publicOrigin,studioUrl,route:'/api/mcp',sourceAppSha256:digest(app),copiedAppSha256:digest(await readFile(join(output,'server/studio-app.js'))),mcpSha256:digest(mcp),wasm:{filename:'cardano_serialization_lib_bg.wasm',bytes:wasm.length,sha256:digest(wasm),moduleType:'CompiledWasm'},wrapperSha256:digest(Buffer.from(wrapper)),sourceHostingConfigChanged:false};
await writeFile(join(output,'mcp-wrapper-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,...receipt},null,2));
