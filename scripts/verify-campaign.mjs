// Curated-image integrity and destination guards. Synthetic keys only; no network or wallet.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
import { runInNewContext } from 'node:vm';
const temp = await mkdtemp(join(tmpdir(), 'bmkr-campaign-'));
const originalFetch = globalThis.fetch;
try {
  await build({
    entryPoints: ['lib/onchain-art.ts', 'lib/cardano.ts', 'lib/handle.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: temp,
    outExtension: { '.js': '.mjs' },
    external: ['@emurgo/cardano-serialization-lib-browser-inlined'],
    logLevel: 'error',
  });
  const { verifyPreparedImage, digestHex } = await import(
    pathToFileURL(join(temp, 'onchain-art.mjs'))
  );
  const { buildMint, parseProtocol, mergeAndCheckSignatures } = await import(
    pathToFileURL(join(temp, 'cardano.mjs'))
  );
  const { verifyHandleDestination } = await import(
    pathToFileURL(join(temp, 'handle.mjs'))
  );
  const campaign = JSON.parse(
    await readFile('lib/creation-engine.json', 'utf8'),
  );
  const links = await build({
    entryPoints: ['lib/asset-link.ts'],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'AssetLinks',
    write: false,
    logLevel: 'error',
  });
  const browser = { TextEncoder, Uint8Array, WebAssembly };
  runInNewContext(links.outputFiles[0].text, browser);
  assert.equal(
    browser.AssetLinks.poolAssetUrl(
      '1e349c9bdea19fd6c147626a5260bc44b71635f398b67c59881df209',
      'PATATE',
    ),
    'https://pool.pm/asset1hv4p5tv2a837mzqrst04d0dcptdjmluqvdx9k3',
  );
  assert.equal(
    browser.AssetLinks.poolAssetUrl(
      '333427e94971f530653bb945f34f914252ad570c0b84dfd8c8e8c97b',
      'ExtraHate067',
    ),
    'https://pool.pm/asset1yjj6l5ude4gf274ya0exk4vymaaj0464yxmnvm',
  );
  assert.throws(() => browser.AssetLinks.poolAssetUrl('invalid', 'x'));
  assert.throws(() =>
    browser.AssetLinks.poolAssetUrl('ab'.repeat(28), 'x'.repeat(33)),
  );
  console.log(
    'PASS browser CIP-14 links match official and live fixtures without Node Buffer',
  );
  const bn = (x) => C.BigNum.from_str(String(x));
  const key = C.PrivateKey.generate_ed25519();
  const credential = C.Credential.from_keyhash(key.to_public().hash());
  const address = C.BaseAddress.new(1, credential, credential).to_address();
  const wallet = {
    changeHex: address.to_hex(),
    utxos: [
      C.TransactionUnspentOutput.new(
        C.TransactionInput.new(C.TransactionHash.from_hex('14'.repeat(32)), 0),
        C.TransactionOutput.new(address, C.Value.new(bn(10000000))),
      ).to_hex(),
    ],
  };
  const protocol = parseProtocol(
    {
      epoch_no: 653,
      abs_slot: 197042621,
      block_time: Math.floor(Date.now() / 1000),
    },
    {
      epoch_no: 653,
      min_fee_a: 44,
      min_fee_b: 155381,
      max_tx_size: 16384,
      max_val_size: 5000,
      coins_per_utxo_size: '4310',
      key_deposit: '2000000',
      pool_deposit: '500000000',
    },
  );
  const joinText = (value) => (Array.isArray(value) ? value.join('') : value);
  for (const profile of campaign.profiles) {
    const image = profile.image;
    assert.equal(await verifyPreparedImage(image), image);
    const bytes = Buffer.from(image.uri.split(',')[1], 'base64');
    assert.equal(bytes.length, image.bytes);
    assert.equal(await digestHex(bytes), image.sha256);
    const filename =
      profile.id === 'detail' ? 'v02-640-crf45.avif' : 'v02-448-q19-10264.webp';
    assert.deepEqual(
      bytes,
      await readFile('public/art/creation-engine/' + filename),
    );
    for (const patch of [
      { bytes: image.bytes + 1 },
      { sha256: '0'.repeat(64) },
      { width: 0 },
      { width: 640.5 },
      { uri: image.uri + '?' },
      { mediaType: 'image/png' },
    ])
      await assert.rejects(verifyPreparedImage({ ...image, ...patch }));
    const wrongType =
      image.mediaType === 'image/avif' ? 'image/webp' : 'image/avif';
    await assert.rejects(
      verifyPreparedImage({
        ...image,
        mediaType: wrongType,
        uri: image.uri.replace(image.mediaType, wrongType),
      }),
      /encoding/,
    );
    const artwork = { ...campaign.artwork, customImage: image.uri };
    const prepared = await buildMint(C, artwork, image, wallet, protocol);
    const witnesses = C.TransactionWitnessSet.new(),
      signatures = C.Vkeywitnesses.new();
    signatures.add(
      C.make_vkey_witness(C.TransactionHash.from_hex(prepared.hash), key),
    );
    witnesses.set_vkeys(signatures);
    const signed = mergeAndCheckSignatures(
      C,
      prepared,
      witnesses.to_hex(),
      protocol,
    );
    assert.equal(signed.bytes, prepared.signedEstimate);
    assert.ok(signed.bytes < 16384);
    const transaction = C.Transaction.from_hex(signed.hex);
    const metadata = JSON.parse(
      C.decode_metadatum_to_json_str(
        transaction.auxiliary_data().metadata().get(bn(721)),
        C.MetadataJsonSchema.NoConversions,
      ),
    );
    const item = metadata[prepared.policyId][prepared.assetName];
    assert.equal(joinText(item.image), image.uri);
    assert.equal(joinText(item.mediaType), image.mediaType);
    assert.equal(joinText(item.description), campaign.artwork.description);
    assert.ok(joinText(item.description).includes(campaign.remixUrl));
    for (let i = 0; i < transaction.body().outputs().len(); i++)
      assert.equal(
        transaction.body().outputs().get(i).address().to_hex(),
        address.to_hex(),
      );
    console.log(
      'PASS',
      profile.id,
      'exact image, rejection guards, signed CBOR + remix roundtrip;',
      signed.bytes,
      'bytes',
    );
  }
  const check = async (body, status = 200) => {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.handle.me/handles/beacnleaks');
      assert.equal(options.cache, 'no-store');
      return new Response(JSON.stringify(body), { status });
    };
    return verifyHandleDestination(campaign.handle, campaign.recipient);
  };
  await check({
    name: campaign.handle,
    resolved_addresses: { ada: campaign.recipient },
  });
  for (const body of [
    null,
    {},
    { name: 'other', resolved_addresses: { ada: campaign.recipient } },
    { name: campaign.handle, resolved_addresses: { ada: 'changed' } },
  ])
    await assert.rejects(check(body));
  await assert.rejects(check({}, 503), /cannot be checked/);
  globalThis.fetch = async () => {
    throw new Error('offline');
  };
  await assert.rejects(
    verifyHandleDestination(campaign.handle, campaign.recipient),
    /offline/,
  );
  console.log(
    'PASS destination resolution fails closed on changed, invalid, unavailable and offline results',
  );
} finally {
  globalThis.fetch = originalFetch;
  await rm(temp, { recursive: true, force: true });
}
