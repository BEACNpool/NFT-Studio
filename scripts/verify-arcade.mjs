// Synthetic wallets only. No network, wallet extension, key file or submission.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
const out = process.env.BMKR_VERIFY_DIR || join(tmpdir(), 'bmkr-arcade-check');
await mkdir(out, { recursive: true });
await build({
  entryPoints: ['lib/cardano.ts', 'lib/arcade.ts', 'lib/onchain-art.ts'],
  outdir: out,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['@emurgo/cardano-serialization-lib-browser-inlined'],
  logLevel: 'error',
});
const mod = (n) => import(pathToFileURL(join(out, n + '.mjs')));
const { ARCADE, loadArcade, verifyArcade, arcadeArtwork } = await mod('arcade');
const { buildMint, parseProtocol, mergeAndCheckSignatures, SizeError } =
  await mod('cardano');
const { verifyPreparedImage } = await mod('onchain-art');
globalThis.fetch = async (url) => {
  assert(/^\/arcade\/[a-z]+\/(game\.html|cover\.svg)$/.test(url));
  return new Response(await readFile('public' + url));
};
const bn = (n) => C.BigNum.from_str(String(n)),
  results = [],
  fixtures = {};
const key = C.PrivateKey.generate_ed25519(),
  other = C.PrivateKey.generate_ed25519();
const addr = (k) => {
  const c = C.Credential.from_keyhash(k.to_public().hash());
  return C.BaseAddress.new(1, c, c).to_address();
};
const address = addr(key),
  addr2 = addr(other),
  oldPolicy = C.ScriptHash.from_hex('ab'.repeat(28)),
  oldName = C.AssetName.new(new TextEncoder().encode('KEEPME'));
function input(index, coin, tokens = false, at = address) {
  const value = C.Value.new(bn(coin));
  if (tokens) {
    const a = C.Assets.new(),
      ma = C.MultiAsset.new();
    a.insert(oldName, bn(7));
    ma.insert(oldPolicy, a);
    value.set_multiasset(ma);
  }
  return C.TransactionUnspentOutput.new(
    C.TransactionInput.new(
      C.TransactionHash.from_hex(index.toString(16).padStart(64, '0')),
      0,
    ),
    C.TransactionOutput.new(at, value),
  ).to_hex();
}
const protocol = () =>
  parseProtocol(
    {
      epoch_no: 653,
      abs_slot: 197151000,
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
function sign(p, keys = [key]) {
  const w = C.TransactionWitnessSet.new(),
    v = C.Vkeywitnesses.new();
  for (const k of keys)
    v.add(C.make_vkey_witness(C.TransactionHash.from_hex(p.hash), k));
  w.set_vkeys(v);
  return w.to_hex();
}
for (const id of Object.keys(ARCADE)) {
  const media = await loadArcade(id),
    art = arcadeArtwork(media),
    entry = ARCADE[id];
  assert.equal(media.program.bytes, entry.programBytes);
  await assert.rejects(
    () =>
      verifyArcade({
        ...media,
        program: { ...media.program, html: media.program.html + ' ' },
      }),
    /changed/,
  );
  await assert.rejects(
    () =>
      verifyArcade({
        ...media,
        image: { ...media.image, sha256: '00'.repeat(32) },
      }),
    /changed/,
  );
  await assert.rejects(() => verifyPreparedImage(media.image), /invalid/); // Generic SVG upload remains unavailable.
  for (const [visitor, visitorKey] of [
    ['visitor-a', key],
    ['visitor-b', other],
  ]) {
    const destination = addr(visitorKey);
    for (const tokens of [false, true]) {
      const wallet = {
          changeHex: destination.to_hex(),
          utxos: [input(tokens ? 2 : 1, 20000000, tokens, destination)],
        },
        p = protocol(),
        prepared = await buildMint(C, art, media.image, wallet, p, media),
        signed = mergeAndCheckSignatures(
          C,
          prepared,
          sign(prepared, [visitorKey]),
          p,
        ),
        tx = C.Transaction.from_hex(signed.hex);
      assert.equal(prepared.address, destination.to_bech32());
      assert.deepEqual(prepared.requiredKeys, [
        visitorKey.to_public().hash().to_hex(),
      ]);
      assert(signed.bytes <= 16384);
      assert.equal(signed.bytes, prepared.signedEstimate);
      assert(BigInt(prepared.fee) >= BigInt(44 * signed.bytes + 155381));
      const meta = JSON.parse(
        C.decode_metadatum_to_json_str(
          tx.auxiliary_data().metadata().get(bn(721)),
          C.MetadataJsonSchema.NoConversions,
        ),
      );
      const token = meta[prepared.policyId][prepared.assetName];
      assert.equal(
        decodeURIComponent(
          token.files[0].src.join('').split(',').slice(1).join(','),
        ),
        media.program.html,
      );
      assert.equal(token.image.join(''), media.image.uri);
      assert.equal(token.sha256, media.program.sha256);
      assert.equal(tx.body().outputs().len(), 2);
      for (let i = 0; i < 2; i++)
        assert.equal(
          tx.body().outputs().get(i).address().to_hex(),
          destination.to_hex(),
        );
      assert.equal(
        tx
          .body()
          .mint()
          .get(C.ScriptHash.from_hex(prepared.policyId))
          .get(0)
          .get(C.AssetName.new(new TextEncoder().encode(prepared.assetName)))
          .to_str(),
        '1',
      );
      if (tokens)
        assert.equal(
          tx
            .body()
            .outputs()
            .get(1)
            .amount()
            .multiasset()
            .get(oldPolicy)
            .get(oldName)
            .to_str(),
          '7',
        );
      assert.notEqual(prepared.policyId, entry.original.policy);
      results.push({
        id,
        visitor,
        recipientVerified: true,
        visitorPolicyVerified: true,
        tokensPreserved: tokens ? 7 : 0,
        signedBytes: signed.bytes,
        fee: prepared.fee,
        minimumAda: prepared.minimumAda,
        programSHA256: media.program.sha256,
      });
      if (!tokens && visitor === 'visitor-a')
        fixtures[id] = {
          wallet,
          expectedSignedBytes: signed.bytes,
          fee: prepared.fee,
        };
    }
  }
  await assert.rejects(
    () =>
      buildMint(
        C,
        { ...art, name: 'Wrong game' },
        media.image,
        { changeHex: address.to_hex(), utxos: [input(5, 20000000)] },
        protocol(),
        media,
      ),
    /differ/,
  );
}
const big = await loadArcade('lastember');
await assert.rejects(
  () =>
    buildMint(
      C,
      arcadeArtwork(big),
      big.image,
      {
        changeHex: address.to_hex(),
        utxos: [input(3, 2000000), input(4, 2000000, false, addr2)],
      },
      protocol(),
      big,
    ),
  (e) => e instanceof SizeError,
);
await writeFile(
  join(out, 'result.json'),
  JSON.stringify(
    {
      passed: true,
      liveTransactions: 0,
      results,
      changedPayloadRejected: true,
      wrongArtworkRejected: true,
      genericSvgRejected: true,
      oversizedMultiKeyWalletRejected: true,
    },
    null,
    2,
  ),
);
await writeFile(
  join(out, 'browser-wallet.json'),
  JSON.stringify(
    {
      fixtures,
      params: {
        epoch_no: 653,
        min_fee_a: 44,
        min_fee_b: 155381,
        max_tx_size: 16384,
        max_val_size: 5000,
        coins_per_utxo_size: 4310,
        key_deposit: 2000000,
        pool_deposit: 500000000,
      },
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({ passed: true, liveTransactions: 0, results }, null, 2),
);
