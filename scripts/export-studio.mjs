// Static subdirectory export for pinned Vinext beta.5.
// Its prerenderer requests '/' even when the production handler requires basePath.
// Render the correctly prefixed URL through Vinext's own local production server,
// then package only HTML/RSC, public assets and the matching client chunks.
import { startProdServer } from '../node_modules/vinext/dist/server/prod-server.js';
import { extractRscPayloadFromPrerenderedHtml } from '../node_modules/vinext/dist/build/prerender.js';
import {
  mkdir,
  writeFile,
  cp,
  readdir,
  readFile,
  access,
} from 'node:fs/promises';
import { resolve, join } from 'node:path';
const prefix = '/NFT-Studio',
  out = resolve('dist/github-pages');
const nested = resolve('dist/client' + prefix);
await access(join(nested, '_next'));
const server = await startProdServer({
  port: 0,
  host: '127.0.0.1',
  outDir: resolve('dist'),
  noCompression: true,
  purpose: 'prerender',
});
try {
  const response = await fetch(`http://127.0.0.1:${server.port}${prefix}/`, {
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw Error('Prefixed page render failed: ' + response.status);
  const html = await response.text();
  if (!html.includes('NFT-Studio') || !html.includes('id="studio-main"') || !html.includes(prefix + '/_next/'))
    throw Error('Public prefix or page content missing');
  const rsc = extractRscPayloadFromPrerenderedHtml(html);
  if (!rsc?.length) throw Error('The static React payload is missing');
  await mkdir(out, { recursive: true });
  await cp(nested, out, { recursive: true });
  await cp(resolve('public'), out, { recursive: true });
  await writeFile(join(out, 'index.html'), html);
  await writeFile(join(out, 'index.rsc'), rsc);
  await writeFile(join(out, '.nojekyll'), '');
  const urls = [...html.matchAll(/(?:src|href)="(\/[^"#]+)"/g)].map((m) =>
    m[1].replaceAll('&amp;', '&'),
  );
  for (const url of new Set(urls)) {
    if (!url.startsWith(prefix + '/'))
      throw Error('Unprefixed public URL: ' + url);
    await access(
      join(
        out,
        new URL(url, 'https://example.com').pathname.slice(prefix.length + 1),
      ),
    );
  }
  const walk = async (dir) => {
    let all = [];
    for (const f of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      all.push(...(f.isDirectory() ? await walk(p) : [p]));
    }
    return all;
  };
  const files = await walk(out);
  for (const file of files) {
    if (/\.map$|\.env|\.openai/.test(file))
      throw Error('Private or development output in public export');
    if (/\.(html|js|css|rsc|json|txt|md)$/.test(file)) {
      const text = await readFile(file, 'utf8');
      // Reject the same private patterns without quadratic scans of embedded base64.
      const lower = text.toLowerCase();
      if (
        /\/home\/[^/\s]+|10\.30\.\d+\.\d+|192\.168\.\d+\.\d+|appgprj_|BEGIN [A-Z ]*PRIVATE KEY/i.test(text) ||
        (lower.includes('@sites.test') && /[A-Za-z0-9._%+-]+@sites\.test/i.test(text)) ||
        (lower.includes('.chatgpt.site') && /[a-z0-9-]+\.[a-z0-9-]+\.chatgpt\.site/i.test(text))
      )
        throw Error('Public output privacy check failed: ' + file);
    }
  }
  console.log(
    `Validated ${files.length} static files for https://beacnpool.github.io${prefix}/`,
  );
} finally {
  await new Promise((resolve, reject) =>
    server.server.close((error) => (error ? reject(error) : resolve())),
  );
}
