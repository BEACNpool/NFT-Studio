/** Explicit read-only source-integrity audit; never modifies data or executes sources. */
import { createHash } from 'node:crypto';
import { loadCatalog } from './node.mjs';
if (process.argv.length !== 3 || process.argv[2] !== '--online') {
  console.error('Usage: node knowledge/audit-sources.mjs --online');
  process.exit(2);
}
const catalog = loadCatalog();
const queue = [...catalog.sources];
const results = [];
const maxBytes = 1_000_000;
async function audit(source) {
  // Fixed reviewed sources only; no user-selected URL, redirect or filesystem writes.
  const url = new URL(source.rawUrl);
  if (url.hostname !== 'raw.githubusercontent.com' || !url.pathname.includes(`/${source.sourceCommit}/`)) throw new Error('Unsupported immutable source URL');
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: 'error' });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  if (Number(response.headers.get('content-length') || 0) > maxBytes) throw new Error('Source exceeds byte limit');
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > maxBytes) { await response.body.cancel().catch(()=>{}); throw new Error('Source exceeds byte limit'); }
    hash.update(chunk);
  }
  const sha256 = hash.digest('hex');
  return { id: source.id, ok: sha256 === source.sha256, bytes, sha256, expectedSha256: source.sha256 };
}
async function worker() {
  while (queue.length) {
    const source = queue.shift();
    try { results.push(await audit(source)); }
    catch (error) { results.push({ id: source.id, ok: false, error: String(error.message ?? error).slice(0,300) }); }
  }
}
await Promise.all(Array.from({length:4},worker));
results.sort((a,b)=>a.id.localeCompare(b.id));
const ok=results.every(r=>r.ok);
console.log(JSON.stringify({schemaVersion:1, checkedAt:new Date().toISOString(), sourceRevision:catalog.sourceRevision, ok, sourceCount:results.length, results},null,2));
if (!ok) process.exitCode=1;
