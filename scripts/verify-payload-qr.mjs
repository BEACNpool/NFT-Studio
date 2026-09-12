import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateSync } from 'fflate';
import { randomBytes } from 'node:crypto';
const dir = await mkdtemp(join(tmpdir(), 'payload-qr-check-'));
await build({
  entryPoints: [
    'lib/studio-payload-qr.ts',
    'lib/studio-intent.ts',
    'lib/studio-payload.ts',
    'lib/studio-mint-options.ts',
  ],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: dir,
  outExtension: { '.js': '.mjs' },
  logLevel: 'error',
});
const load = async (name) => import(pathToFileURL(join(dir, name + '.mjs')));
const qr = await load('studio-payload-qr'),
  { createMintIntent } = await load('studio-intent'),
  { preparePayloadBundle } = await load('studio-payload');
const bundle = await preparePayloadBundle({
    name: 'Exact BOM 🦾',
    files: [
      {
        name: 'note.txt',
        mediaType: 'text/plain',
        bytes: new TextEncoder().encode('\ufeffExact bytes 🦾'),
      },
    ],
  }),
  intent = await createMintIntent(bundle, 'data'),
  made = await qr.createPayloadQr(intent);
assert.deepEqual(
  await qr.parsePayloadQrFragment(new URL(made.url).hash),
  intent,
);
const pack = (bytes) =>
  '#payload=v1.' +
  Buffer.from(deflateSync(bytes, { level: 9 })).toString('base64url');
for (const value of [
  pack(new Uint8Array(80001)),
  pack(new Uint8Array(1000000)),
  pack(Uint8Array.of(255)),
  pack(
    new TextEncoder().encode(
      JSON.stringify({ ...intent, intentHash: '0'.repeat(64) }),
    ),
  ),
  new URL(made.url).hash + 'AA',
  '#payload=v1.%%%%',
  '#payload=v1.' + 'A'.repeat(2400),
])
  await assert.rejects(qr.parsePayloadQrFragment(value));
const large = await preparePayloadBundle({
  name: 'Preserve original',
  files: [
    {
      name: 'random.bin',
      mediaType: 'application/octet-stream',
      bytes: randomBytes(11000),
    },
  ],
});
await assert.rejects(
  qr.createPayloadQr(await createMintIntent(large, 'data')),
  /printable payload QR holds/,
);
assert.equal(large.bytes, 11000);
console.log(
  'PASS exact BOM/Unicode, canonical intent, tamper/UTF8/trailing/bounds, bounded expansion, oversize preservation',
);

const { verifyMintOptions, DEFAULT_MINT_OPTIONS } = await load(
  'studio-mint-options',
);
assert.throws(() =>
  verifyMintOptions({
    ...DEFAULT_MINT_OPTIONS,
    traits: JSON.parse('{"__proto__":"bad"}'),
  }),
);
