// Offline tests: synthetic wallet, real encoders/signatures, no network or funds.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createCanvas, Image, loadImage } from '@napi-rs/canvas';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
const temp = await mkdtemp(join(tmpdir(), 'bmkr-interactive-'));
try {
  await build({
    entryPoints: [
      'lib/interactive.ts',
      'lib/art.ts',
      'lib/cardano.ts',
      'lib/onchain-art.ts',
      'lib/export.ts',
      'lib/remix.ts',
    ],
    outdir: temp,
    outExtension: { '.js': '.mjs' },
    bundle: true,
    platform: 'node',
    format: 'esm',
    external: ['@emurgo/cardano-serialization-lib-browser-inlined'],
    logLevel: 'error',
  });
  const mod = async (name) => import(pathToFileURL(join(temp, name + '.mjs')));
  const {
    interactiveDefault,
    validateInteractive,
    interactiveHTML,
    interactivePoster,
  } = await mod('interactive');
  const { INITIAL, validateArtwork } = await mod('art');
  const { buildMint, mergeAndCheckSignatures, parseProtocol, SizeError } =
    await mod('cardano');
  const { onchainMetadata, prepareProgram } = await mod('onchain-art');
  const { metadata, packageArtworks } = await mod('export');
  const { remixLink, readRemix } = await mod('remix');
  let count = 0;
  const test = async (name, run) => {
    await run();
    count++;
    console.log('PASS', name);
  };
  const focus = interactiveDefault('focus'),
    decision = interactiveDefault('decision'),
    beats = interactiveDefault('beats');
  await test('Only bounded configuration is accepted, including imported projects', () => {
    for (const spec of [
      { ...focus, version: 2 },
      { ...focus, work: 0 },
      { ...focus, rest: 91 },
      { ...focus, work: 1.5 },
      { ...focus, accent: 'red;display:none' },
      { ...focus, kind: 'script' },
      { ...decision, choices: [] },
      { ...decision, choices: ['same', 'same'] },
      { ...decision, choices: ['a', ' '] },
      { ...decision, choices: ['a', '🐢'.repeat(17)] },
      { ...decision, choices: Array.from({ length: 9 }, (_, i) => String(i)) },
    ]) {
      assert.throws(() => validateInteractive(spec));
      assert.throws(() => validateArtwork({ ...INITIAL, interactive: spec }));
    }
    assert.deepEqual(
      validateArtwork({ ...INITIAL, interactive: focus }).interactive,
      focus,
    );
    assert.deepEqual(
      validateInteractive({ ...focus, sourceCode: 'evil()' }),
      focus,
    );
  });
  await test('Untrusted names/choices remain data and cannot escape script or markup', () => {
    const html = interactiveHTML(
      {
        ...decision,
        choices: [
          '</script><script>alert(1)</script>',
          '<img src=x onerror=alert(1)>',
        ],
      },
      '<svg onload=alert(1)>',
    );
    assert.equal((html.match(/<script>/g) || []).length, 1);
    assert.equal((html.match(/<\/script>/g) || []).length, 1);
    assert.ok(!html.includes('<svg onload='));
    assert.ok(!html.includes('<img src=x'));
    assert.ok(html.includes("connect-src 'none'"));
    assert.ok(!/https?:\/\//.test(html));
    assert.ok(
      !/localStorage|sessionStorage|fetch\(|XMLHttpRequest|window\.parent|window\.top/.test(
        html,
      ),
    );
  });
  const key = C.PrivateKey.generate_ed25519(),
    bn = (n) => C.BigNum.from_str(String(n));
  const address = C.EnterpriseAddress.new(
    1,
    C.Credential.from_keyhash(key.to_public().hash()),
  ).to_address();
  const oldPolicy = C.ScriptHash.from_hex('ac'.repeat(28)),
    oldAsset = C.AssetName.new(new TextEncoder().encode('KEEP'));
  const value = C.Value.new(bn(30000000)),
    ma = C.MultiAsset.new(),
    assets = C.Assets.new();
  assets.insert(oldAsset, bn(3));
  ma.insert(oldPolicy, assets);
  value.set_multiasset(ma);
  const utxo = C.TransactionUnspentOutput.new(
    C.TransactionInput.new(C.TransactionHash.from_hex('bf'.repeat(32)), 0),
    C.TransactionOutput.new(address, value),
  );
  const wallet = { changeHex: address.to_hex(), utxos: [utxo.to_hex()] };
  const live = () =>
    parseProtocol(
      {
        epoch_no: 653,
        abs_slot: 197070000,
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
  for (const spec of [
    focus,
    decision,
    beats,
    {
      ...decision,
      choices: Array.from({ length: 8 }, (_, i) => String(i) + '🐢'.repeat(15)),
    },
  ]) {
    await test(`Full signed ${spec.kind} mint recovers exact program and preserves existing assets (${spec.choices?.length || 0} choices)`, async () => {
      const canvas = createCanvas(320, 320),
        ctx = canvas.getContext('2d');
      const cover = await loadImage(Buffer.from(interactivePoster(spec)));
      ctx.drawImage(cover, 0, 0, 320, 320);
      const bytes = canvas.toBuffer('image/webp', 35),
        image = {
          uri: 'data:image/webp;base64,' + bytes.toString('base64'),
          width: 320,
          quality: 35,
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        };
      const art = {
        ...INITIAL,
        name:
          spec.kind === 'focus'
            ? 'Focus capsule'
            : spec.kind === 'beats'
              ? 'Beat lab'
              : 'Decision deck',
        interactive: spec,
      };
      const prepared = await buildMint(C, art, image, wallet, live());
      const witnesses = C.TransactionWitnessSet.new(),
        keys = C.Vkeywitnesses.new();
      keys.add(
        C.make_vkey_witness(C.TransactionHash.from_hex(prepared.hash), key),
      );
      witnesses.set_vkeys(keys);
      const signed = mergeAndCheckSignatures(
        C,
        prepared,
        witnesses.to_hex(),
        live(),
      );
      assert.ok(signed.bytes <= 16384);
      assert.equal(prepared.signedEstimate, signed.bytes);
      assert.ok(BigInt(prepared.fee) >= BigInt(signed.bytes * 44 + 155381));
      const tx = C.Transaction.from_hex(signed.hex);
      const decoded = JSON.parse(
        C.decode_metadatum_to_json_str(
          tx.auxiliary_data().metadata().get(bn(721)),
          C.MetadataJsonSchema.NoConversions,
        ),
      );
      const nft = decoded[prepared.policyId][prepared.assetName],
        joinText = (s) => (Array.isArray(s) ? s.join('') : s);
      const html = Buffer.from(
        joinText(nft.files[0].src).split(',')[1],
        'base64',
      );
      assert.equal(html.toString('utf8'), interactiveHTML(spec, art.name));
      assert.equal(
        createHash('sha256').update(html).digest('hex'),
        joinText(nft.interactive.sha256),
      );
      assert.equal(html.length, nft.interactive.bytes);
      assert.equal(joinText(nft.image), image.uri);
      let preserved = 0;
      for (let i = 0; i < tx.body().outputs().len(); i++) {
        const o = tx.body().outputs().get(i);
        assert.equal(o.address().to_hex(), address.to_hex());
        preserved += Number(
          o.amount().multiasset()?.get(oldPolicy)?.get(oldAsset)?.to_str() || 0,
        );
      }
      assert.equal(preserved, 3);
      assert.equal(tx.witness_set().native_scripts().len(), 1);
      const changed = { ...art, name: 'Different title' };
      assert.throws(
        () =>
          onchainMetadata(
            changed,
            image,
            prepared.policyId,
            prepared.assetName,
            prepared.program,
          ),
        /does not match/,
      );
      assert.throws(
        () =>
          onchainMetadata(art, image, prepared.policyId, prepared.assetName),
        /does not match/,
      );
      await assert.rejects(
        () =>
          buildMint(
            C,
            { ...art, description: 'wide'.repeat(8000) },
            image,
            wallet,
            live(),
          ),
        SizeError,
      );
      console.log(
        'MEASURE',
        JSON.stringify({
          kind: spec.kind,
          choices: spec.choices?.length,
          program: html.length,
          image: bytes.length,
          signed: signed.bytes,
          fee: prepared.fee,
        }),
      );
    });
  }
  await test('Project, remix and metadata exports preserve the runnable program', async () => {
    for (const template of [
      focus,
      decision,
      { ...beats, bpm: 160, pattern: [255, 0, 32] },
    ]) {
      const art = {
        ...INITIAL,
        source: 'blank',
        name: `My ${template.kind}`,
        interactive: template,
      };
      assert.deepEqual(
        readRemix(new URL(remixLink(art, 'https://example.com', '/BMKR/')).hash)
          .interactive,
        template,
      );
      const exported = metadata(art),
        data =
          exported.cardano['721'].REPLACE_WITH_POLICY_ID
            .REPLACE_WITH_ASSET_NAME;
      assert.equal(data.files[1].mediaType, 'text/html');
      assert.equal(
        Buffer.from(
          exported.opensea.animation_url.split(',')[1],
          'base64',
        ).toString(),
        interactiveHTML(template, art.name),
      );
      globalThis.Image = Image;
      globalThis.document = {
        createElement(tag) {
          assert.equal(tag, 'canvas');
          const c = createCanvas(1, 1);
          c.toBlob = (callback, type = 'image/png', quality) =>
            callback(
              new Blob(
                [
                  c.toBuffer(
                    type,
                    type === 'image/webp'
                      ? Math.round(quality * 100)
                      : undefined,
                  ),
                ],
                { type },
              ),
            );
          return c;
        },
      };
      const { unzipSync, strFromU8 } = await import('fflate');
      const files = unzipSync(
        new Uint8Array(
          await (await packageArtworks([art], 256, () => {})).arrayBuffer(),
        ),
      );
      const get = (suffix) =>
        files[Object.keys(files).find((k) => k.endsWith('/' + suffix))];
      assert.equal(
        strFromU8(get('interactive.html')),
        interactiveHTML(template, art.name),
      );
      assert.deepEqual(
        JSON.parse(strFromU8(get('project.prism.json'))).artwork.interactive,
        template,
      );
      assert.ok(strFromU8(get('HOW-TO-USE.txt')).includes('public, reusable'));
      assert.equal(
        (await prepareProgram(art)).html,
        strFromU8(get('interactive.html')),
      );
    }
  });
  console.log(
    `${count} interactive verification groups passed. Offline; no live mint.`,
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
