import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
const out =
  process.env.BMKR_VERIFY_DIR || join(tmpdir(), 'bmkr-kayfabe-open-check');
await mkdir(out, { recursive: true });
await build({
  entryPoints: [
    'lib/cardano.ts',
    'lib/art.ts',
    'lib/interactive.ts',
    'lib/onchain-art.ts',
    'lib/export.ts',
  ],
  outdir: out,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['@emurgo/cardano-serialization-lib-browser-inlined'],
  logLevel: 'error',
});
const mod = (n) => import(pathToFileURL(out + '/' + n + '.mjs'));
const { buildMint, parseProtocol, mergeAndCheckSignatures } =
  await mod('cardano');
const { validateArtwork } = await mod('art');
const { interactiveHTML, validateInteractive } = await mod('interactive');
const { verifyPreparedImage } = await mod('onchain-art');
const campaign = JSON.parse(await readFile('lib/kayfabe.json', 'utf8')),
  art = validateArtwork({
    ...campaign.artwork,
    customImage: campaign.image.uri,
  }),
  image = await verifyPreparedImage(campaign.image);
assert.equal(art.traits.length, 15);
assert.equal(art.traits.find((t) => t.trait_type === 'Grill').value, 'Gold');
assert.equal(
  createHash('sha256')
    .update(await readFile('public/art/kayfabe/onchain-512.avif'))
    .digest('hex'),
  image.sha256,
);
const spec = art.interactive;
for (const bad of [
  { ...spec, bpm: 59 },
  { ...spec, bpm: 161 },
  { ...spec, bpm: 60.5 },
  { ...spec, pattern: [1, 2] },
  { ...spec, pattern: [-1, 0, 0] },
  { ...spec, pattern: [0, 256, 0] },
  { ...spec, pattern: [1.5, 0, 0] },
  { ...spec, accent: 'red' },
])
  assert.throws(() => validateInteractive(bad));
const html = interactiveHTML(spec, art.name);
assert.equal(html, interactiveHTML(spec, art.name));
assert(Buffer.byteLength(html) < 6000);
await writeFile('public/art/kayfabe/beat-lab.html', html);
const hostile = interactiveHTML(spec, '</script><img src=x onerror=alert(1)>');
const unpack = (x) =>
  gunzipSync(Buffer.from(x.match(/atob\('([^']+)'\)/)[1], 'base64')).toString();
assert(!unpack(hostile).includes('<img src=x'));
assert(!hostile.includes('<img src=x'));
assert(!unpack(html).includes('__PATTERN__'));
assert(unpack(html).includes('value="92"'));
assert.equal(validateInteractive({ ...spec, evil: 'x' }).evil, undefined);
for (const title of [
  '🐢'.repeat(16),
  '&'.repeat(64),
  '__ACCENT__',
  '__PATTERN__',
]) {
  const program = interactiveHTML(
    { ...spec, bpm: 160, pattern: [255, 0, 128] },
    title,
  );
  assert(Buffer.byteLength(program) <= 6000);
  assert(unpack(program).includes(title.replaceAll('&', '&amp;')));
}
const bn = (n) => C.BigNum.from_str(String(n)),
  results = [];
for (let n = 0; n < 2; n++) {
  const key = C.PrivateKey.generate_ed25519(),
    cred = C.Credential.from_keyhash(key.to_public().hash()),
    address = C.BaseAddress.new(1, cred, cred).to_address();
  const input = C.TransactionUnspentOutput.new(
    C.TransactionInput.new(
      C.TransactionHash.from_hex((n ? 'ab' : 'bc').repeat(32)),
      0,
    ),
    C.TransactionOutput.new(address, C.Value.new(bn(10000000))),
  );
  const wallet = { changeHex: address.to_hex(), utxos: [input.to_hex()] };
  const protocol = parseProtocol(
    {
      epoch_no: 653,
      abs_slot: 197075000,
      block_time: Math.floor(Date.now() / 1000),
    },
    {
      epoch_no: 653,
      min_fee_a: 44,
      min_fee_b: 155381,
      max_tx_size: 16384,
      max_val_size: 5000,
      coins_per_utxo_size: 4310,
      key_deposit: 2000000,
      pool_deposit: 500000000,
    },
  );
  const prepared = await buildMint(C, art, image, wallet, protocol),
    ws = C.TransactionWitnessSet.new(),
    keys = C.Vkeywitnesses.new();
  keys.add(C.make_vkey_witness(C.TransactionHash.from_hex(prepared.hash), key));
  ws.set_vkeys(keys);
  const signed = mergeAndCheckSignatures(C, prepared, ws.to_hex(), protocol),
    tx = C.Transaction.from_hex(signed.hex);
  assert.equal(tx.body().outputs().len(), 2);
  for (let i = 0; i < 2; i++)
    assert.equal(
      tx.body().outputs().get(i).address().to_hex(),
      address.to_hex(),
    );
  const token = prepared.metadata['721'][prepared.policyId][prepared.assetName];
  const join = (v) => (Array.isArray(v) ? v.join('') : v);
  assert.equal(join(token.image), image.uri);
  assert.equal(join(token.files[0].src), prepared.program.uri);
  assert.equal(prepared.program.html, html);
  assert.equal(
    token.attributes.filter((t) =>
      art.traits.some((v) => v.trait_type === join(t.trait_type)),
    ).length,
    15,
  );
  assert.equal(
    tx.body().outputs().get(0).amount().coin().to_str(),
    prepared.minimumAda,
  );
  results.push({
    wallet: n,
    signedBytes: signed.bytes,
    fee: prepared.fee,
    minimumAda: prepared.minimumAda,
    policy: prepared.policyId,
    assetName: prepared.assetName,
    zeroPlatformFee: true,
  });
}
assert.notEqual(results[0].policy, results[1].policy);
assert.notEqual(results[0].assetName, results[1].assetName);
await writeFile(
  out + '/result.json',
  JSON.stringify(
    {
      status: 'synthetic-pass-no-live-mint',
      imageBytes: image.bytes,
      programBytes: Buffer.byteLength(html),
      programSha256: createHash('sha256').update(html).digest('hex'),
      results,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    { passed: true, programBytes: Buffer.byteLength(html), results },
    null,
    2,
  ),
);
