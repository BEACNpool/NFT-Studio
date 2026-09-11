// Adds the transfer route to a freshly staged Sites build, preserving its app/MCP.
import { build } from 'esbuild';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const directory = process.argv[2];
if (!directory) throw Error('Pass the freshly staged Sites dist directory.');
const server = join(resolve(directory), 'server');
const source = await readFile(join(server, 'index.js'), 'utf8');
if (source.includes('NFT_STUDIO_HANDOFF_WRAPPER'))
  throw Error('Already wrapped. Rebuild first.');
await build({
  entryPoints: ['server/handoff.ts'],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  outfile: join(server, 'handoff-api.mjs'),
  minify: true,
  logLevel: 'error',
});
await rename(join(server, 'index.js'), join(server, 'studio-with-mcp.js'));
await writeFile(
  join(server, 'index.js'),
  `// NFT_STUDIO_HANDOFF_WRAPPER\nimport app from './studio-with-mcp.js';\nimport {handleHandoff} from './handoff-api.mjs';\nexport * from './studio-with-mcp.js';\nexport default {...app, fetch(request, env, context) {\n if (new URL(request.url).pathname.startsWith('/api/handoffs')) return handleHandoff(request, env);\n return app.fetch(request, env, context);\n}};\n`,
  { flag: 'wx' },
);
console.log(
  'Staged encrypted phone transfer API; existing app and MCP preserved.',
);
