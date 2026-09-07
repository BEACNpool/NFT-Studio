import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, sep } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.env.NFT_STUDIO_ROOT || resolve(here, '..'));
const knowledge = resolve(process.env.NFT_STUDIO_KNOWLEDGE || resolve(root, 'knowledge'));
const nestedModules = resolve(here, 'node_modules');
await readFile(resolve(root, 'lib/studio-intent.ts'));
await readFile(resolve(knowledge, 'catalog.json'));
await mkdir(resolve(here, 'dist'), { recursive: true });
await build({
  absWorkingDir: here,
  entryPoints: ['src/cli.mjs', 'src/server.mjs', 'src/http.mjs'],
  outdir: 'dist', outExtension: {'.js':'.mjs'},
  bundle: true, platform: 'node', format: 'esm', target: 'node22',
  packages: 'external', sourcemap: false, logLevel: 'warning',
  plugins: [{ name: 'shared-studio-source', setup(b) {
    b.onResolve({filter:/^@studio\//}, args => ({path:resolve(root, 'lib', args.path.slice(8))}));
    b.onResolve({filter:/^@knowledge\//}, args => ({path:resolve(knowledge, args.path.slice(11))}));
  }}],
});
console.error('Built MCP with the shared Studio builder and pinned knowledge catalogue.');

// Standalone artifact for a Worker route; includes SDK, knowledge and shared validation only.
await build({
  absWorkingDir:here,entryPoints:['src/worker.mjs'],outfile:'dist/worker.mjs',
  bundle:true,platform:'browser',format:'esm',target:'es2022',conditions:['workerd','worker','browser'],
  nodePaths:[nestedModules],
  sourcemap:false,minify:false,logLevel:'warning',
  plugins:[{name:'shared-studio-source',setup(b){
    b.onResolve({filter:/^@studio\//},args=>({path:resolve(root,'lib',args.path.slice(8))}));
    b.onResolve({filter:/^@knowledge\//},args=>({path:resolve(knowledge,args.path.slice(11))}));
    // Shared TS lives outside mcp/. Resolve its npm imports against this package's
    // pinned install, even when the browser app has a different root install.
    b.onResolve({filter:/^[^./]/},args=>{
      if(!args.importer.startsWith(resolve(root,'lib')+sep)) return;
      // Omit importer on the delegated call so this callback does not recurse.
      return b.resolve(args.path,{resolveDir:here,kind:args.kind});
    });
  }}],
});
