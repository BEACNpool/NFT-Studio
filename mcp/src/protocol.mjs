import { PROTOCOL_URL, parseProtocol } from '@studio/cardano.ts';
/** Fixed public read-only endpoint, no caller URLs, redirects, credentials or unbounded body reads. */
async function read(path) {
  const response = await fetch(PROTOCOL_URL + path, {
    signal:AbortSignal.timeout(10000), redirect:'error', headers:{accept:'application/json'},
  });
  if (!response.ok || !response.body) throw new Error('The public Cardano protocol feed is unavailable.');
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65536) throw new Error('The public protocol feed exceeded its response bound.');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(()=>{}); }
  const rows = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!Array.isArray(rows) || !rows[0] || typeof rows[0] !== 'object') throw new Error('Malformed public protocol feed.');
  return rows[0];
}
export async function liveProtocol() {
  const [tip,params] = await Promise.all([read('/tip'),read('/epoch_params?order=epoch_no.desc&limit=1')]);
  return parseProtocol(tip,params);
}
