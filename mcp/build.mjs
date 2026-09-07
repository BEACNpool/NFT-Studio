import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.env.NFT_STUDIO_ROOT || resolve(here, '..'));
const knowledge = resolve(process.env.NFT_STUDIO_KNOWLEDGE || resolve(root, 'knowledge'));
const nestedModules = resolve(here, 'node_modules');
const corpusRawPlugin={name:'fixed-cip-corpus-raw-text',setup(b){
  b.onLoad({filter:/\/(?:standards\/index\.json|standards\/sources\/CIP-[0-9]{4}\.README\.source\.txt)$/},async args=>{
    if(args.suffix!=='?raw')return;
    const text=await readFile(args.path,'utf8');
    if(Buffer.byteLength(text)>524288)throw Error('Corpus source byte cap exceeded.');
    return {contents:text,loader:'text'};
  });
}};
const capsule=resolve(root,'experiments/capsule-parameterizer');
await readFile(resolve(root, 'lib/studio-intent.ts'));
const catalogBytes=await readFile(resolve(knowledge,'catalog.json'));
const {parseImplementations}=await import(pathToFileURL(resolve(knowledge,'implementations.mjs')));
const register=parseImplementations(await readFile(resolve(knowledge,'implementations.json'),'utf8'),JSON.parse(catalogBytes).entries.map(entry=>entry.id));
if(register.sourceCatalog.sha256!==createHash('sha256').update(catalogBytes).digest('hex'))throw new Error('Implementation register source catalog SHA-256 does not match the bundled catalog.');
await mkdir(resolve(here, 'dist'), { recursive: true });
await build({
  absWorkingDir: here,
  entryPoints: ['src/cli.mjs', 'src/server.mjs', 'src/http.mjs', 'src/public-unsigned.mjs'],
  outdir: 'dist', outExtension: {'.js':'.mjs'},
  bundle: true, platform: 'node', format: 'esm', target: 'node22',
  packages: 'external', sourcemap: false, logLevel: 'warning',
  plugins: [corpusRawPlugin,{ name: 'shared-studio-source', setup(b) {
    b.onResolve({filter:/^@capsule\//},args=>({path:resolve(capsule,'src',args.path.slice(9))}));
    b.onResolve({filter:/^@studio\//}, args => ({path:resolve(root, 'lib', args.path.slice(8))}));
    b.onResolve({filter:/^@\/lib\//}, args => ({path:resolve(root, 'lib', args.path.slice(6)+'.ts')}));
    b.onResolve({filter:/^@knowledge\//}, args => ({path:resolve(knowledge, args.path.slice(11))}));
  }}],
});
console.error('Built MCP with the shared Studio builder and pinned knowledge catalogue.');

// Statically compiled CSL WASM accompanies the Worker module; no dynamic compilation.
const require=createRequire(import.meta.url);
const browserEntry=require.resolve('@emurgo/cardano-serialization-lib-browser-inlined');
const inlined=await readFile(browserEntry,'utf8');
const encoded=inlined.match(/const __CARDANO_WASM_BASE64__ = ['"]([^'"]+)['"];/);
if(!encoded)throw new Error('Pinned CSL browser loader shape changed.');
const wasm=Buffer.from(encoded[1],'base64');
if(createHash('sha256').update(wasm).digest('hex')!=='30f78ee3d0e5fc2f4cd1c87347b330e69fcdd0acb07d4a6e08ff8278d7d9a40b')throw new Error('Pinned CSL 17 WASM changed.');
await writeFile(resolve(here,'dist/cardano_serialization_lib_bg.wasm'),wasm);
const cslLicense=await readFile(resolve(here,'CSL-LICENSE'),'utf8');
const capsuleNotices=(await Promise.all(['LICENSE','THIRD_PARTY.md',...(await readdir(resolve(capsule,'licenses'))).sort().map(name=>'licenses/'+name)].map(name=>readFile(resolve(capsule,name),'utf8')))).join('\n\n');
await build({
  absWorkingDir:here,entryPoints:['src/worker.mjs'],outfile:'dist/worker.mjs',
  bundle:true,platform:'browser',format:'esm',target:'es2022',conditions:['workerd','worker','browser'],
  nodePaths:[nestedModules],external:['*.wasm'],define:{'process.env.NEXT_PUBLIC_BASE_PATH':'""'},
  banner:{js:'/*! CSL 17 browser WASM and glue: '+cslLicense.replaceAll('*/','* /')+' */\n/*! Fixed capsule adapter dependencies and notices: '+capsuleNotices.replaceAll('*/','* /')+' */'},
  sourcemap:false,minify:false,logLevel:'warning',
  plugins:[corpusRawPlugin,{name:'shared-studio-source',setup(b){
    b.onResolve({filter:/^@capsule\//},args=>({path:resolve(capsule,'src',args.path.slice(9))}));
    b.onResolve({filter:/^@studio\//},args=>({path:resolve(root,'lib',args.path.slice(8))}));
    b.onResolve({filter:/^@\/lib\//},args=>({path:resolve(root,'lib',args.path.slice(6)+'.ts')}));
    b.onResolve({filter:/^@knowledge\//},args=>({path:resolve(knowledge,args.path.slice(11))}));
    // Shared TS lives outside mcp/. Resolve its npm imports against this package's
    // pinned install, even when the browser app has a different root install.
    b.onResolve({filter:/^[^./]/},args=>{
      if(!args.importer.startsWith(resolve(root,'lib')+sep)&&!args.importer.startsWith(resolve(capsule,'src')+sep)) return;
      // Omit importer on the delegated call so this callback does not recurse.
      return b.resolve(args.path,{resolveDir:here,kind:args.kind});
    });
  }}],
});
