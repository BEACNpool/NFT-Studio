// Pure synthetic fixtures; no provider, signing key, or broadcast.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const temporary = await mkdtemp(join(tmpdir(), 'nft-studio-labs-'));
let count = 0;
const test = async (name, action) => {
  await action();
  count++;
  console.log('PASS', name);
};
try {
  await build({
    absWorkingDir: resolve('.'),
    entryPoints: [
      'lib/studio-intent.ts',
      'lib/studio-payload.ts',
      'lib/asset-inspector.ts',
    ],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: temporary,
    logLevel: 'error',
  });
  const load = (name) => import(pathToFileURL(join(temporary, name + '.js')));
  const packets = await load('studio-intent'),
    payload = await load('studio-payload'),
    assets = await load('asset-inspector');
  const enc = new TextEncoder();
  const bundle = await payload.preparePayloadBundle({
    name: 'Capsule 🦾',
    description: 'Exact Unicode and executable source remain data.',
    coverIndex: 0,
    files: [
      {
        name: 'cover.svg',
        mediaType: 'image/svg+xml',
        bytes: enc.encode(
          '<svg xmlns="http://www.w3.org/2000/svg"><text>Capsule</text></svg>',
        ),
      },
      {
        name: 'app.html',
        mediaType: 'text/html',
        bytes: enc.encode(
          '<script>throw new Error("Never execute on import")</script>',
        ),
      },
      {
        name: 'state.json',
        mediaType: 'application/json',
        bytes: enc.encode('{"name":"雪","boolean":true,"nullable":null}'),
      },
    ],
  });
  await test('Portable requests commit mode, metadata and exact file bytes using independent SHA-256', async () => {
    const intent = await packets.createMintIntent(bundle, 'nft');
    assert.deepEqual(
      await packets.parseMintIntent(JSON.stringify(intent)),
      intent,
    );
    const { intentHash, ...core } = intent;
    assert.equal(
      createHash('sha256').update(JSON.stringify(core)).digest('hex'),
      intentHash,
    );
    assert.ok(
      Object.isFrozen(intent) && Object.isFrozen(intent.bundle.files[0]),
    );
    assert.notEqual(
      (await packets.createMintIntent(bundle, 'data')).intentHash,
      intentHash,
    );
    const reordered = JSON.parse(JSON.stringify(intent));
    reordered.bundle = Object.fromEntries(
      Object.entries(reordered.bundle).reverse(),
    );
    reordered.bundle.files = reordered.bundle.files.map((f) =>
      Object.fromEntries(Object.entries(f).reverse()),
    );
    assert.equal(
      (await packets.verifyMintIntent(reordered)).intentHash,
      intentHash,
    );
    assert.equal(
      Buffer.from(
        payload.decodePayloadURI(intent.bundle.files[1].uri, 'text/html'),
      ).toString(),
      '<script>throw new Error("Never execute on import")</script>',
    );
  });
  await test('Tampering and covert fields at every packet boundary reject', async () => {
    const good = await packets.createMintIntent(bundle, 'nft');
    const mutations = [
      (p) => {
        p.mode = 'data';
      },
      (p) => {
        p.schema = 'nft-studio.intent.v2';
      },
      (p) => {
        p.intentHash = '0'.repeat(64);
      },
      (p) => {
        p.recipient = 'attacker';
      },
      (p) => {
        p.bundle.name = 'Changed';
      },
      (p) => {
        p.bundle.bytes++;
      },
      (p) => {
        p.bundle.cover = 'true';
      },
      (p) => {
        p.bundle.files[0].bytes++;
      },
      (p) => {
        p.bundle.files[0].sha256 = '0'.repeat(64);
      },
      (p) => {
        p.bundle.files[0].uri = 'https://example.com/tracker';
      },
      (p) => {
        p.bundle.files[0].name = '../outside.svg';
      },
      (p) => {
        p.bundle.files[0].mediaType = 'image/png';
      },
      (p) => {
        p.bundle.files[0].execute = true;
      },
      (p) => {
        p.bundle.secretNote = 'invisible';
      },
      (p) => {
        p.bundle.files = Array(9).fill(p.bundle.files[0]);
      },
      (p) => {
        p.bundle.files[0].uri += '%00';
      },
    ];
    for (const mutate of mutations) {
      const candidate = structuredClone(good);
      mutate(candidate);
      await assert.rejects(packets.verifyMintIntent(candidate));
    }
    const extra = JSON.stringify(good).replace(
      '"schema":',
      '"__proto__":{"polluted":true},"schema":',
    );
    await assert.rejects(packets.parseMintIntent(extra));
    assert.equal({}.polluted, undefined);
    for (const invalid of [null, [], {}, 1, 'string'])
      await assert.rejects(packets.verifyMintIntent(invalid));
  });
  await test('Input bounds, invalid JSON and coverless NFT requests reject; data records roundtrip', async () => {
    await assert.rejects(packets.parseMintIntent(' '.repeat(80001)));
    await assert.rejects(packets.parseMintIntent('🦾'.repeat(20001)));
    await assert.rejects(packets.parseMintIntent('{bad}'));
    const data = await payload.preparePayloadBundle({
      name: 'Data',
      files: [
        {
          name: 'data.txt',
          mediaType: 'text/plain',
          bytes: enc.encode('hello'),
        },
      ],
    });
    await assert.rejects(packets.createMintIntent(data, 'nft'));
    const packet = await packets.createMintIntent(data, 'data');
    assert.equal(
      (await packets.parseMintIntent(JSON.stringify(packet))).bundle.sha256,
      data.sha256,
    );
    await assert.rejects(packets.createMintIntent(bundle, 'mainnet'));
  });
  await test('Leading UTF-8 BOM survives both short and percent-encoded exact-file requests', async () => {
    for (const [mediaType, name, content] of [
      ['text/plain', 'bom.txt', '\ufeffHello'],
      [
        'text/plain',
        'long-bom.txt',
        '\ufeff' + 'Long original plain text. '.repeat(20),
      ],
      ['application/json', 'bom.json', '\ufeff{"name":"雪","enabled":true}'],
      [
        'text/html',
        'bom.html',
        '\ufeff<!doctype html><p>Exact bytes survive.</p>',
      ],
    ]) {
      const bytes = enc.encode(content),
        bundle = await payload.preparePayloadBundle({
          name: 'BOM preservation',
          files: [{ name, mediaType, bytes }],
        });
      assert.deepEqual(
        payload.decodePayloadURI(bundle.files[0].uri, mediaType),
        bytes,
      );
      const packet = await packets.createMintIntent(bundle, 'data');
      assert.equal(
        (await packets.parseMintIntent(JSON.stringify(packet))).bundle.sha256,
        bundle.sha256,
      );
    }
  });
  await test('CIP-67 official fixed vectors and every 16-bit label roundtrip', async () => {
    // Cardano Foundation CIP-0067 Test Vectors, source licensed CC-BY-4.0.
    const vectors = {
      0: '00000000',
      1: '00001070',
      23: '00017650',
      99: '000632e0',
      533: '00215410',
      2000: '007d0550',
      4567: '011d7690',
      11111: '02b670b0',
      49328: '0c0b0f40',
      65535: '0ffff240',
      222: '000de140',
      100: '000643b0',
    };
    for (const [label, prefix] of Object.entries(vectors))
      assert.equal(assets.assetLabelPrefix(Number(label)), prefix);
    // Exhaustive CRC generation/recognition exercises byte and nibble boundaries.
    for (let n = 0; n <= 65535; n++) {
      const prefix = assets.assetLabelPrefix(n);
      const inspected = assets.inspectAssetIdentity(
        'ab'.repeat(28),
        prefix + '41',
      );
      assert.equal(inspected.label, n);
      assert.equal(inspected.utf8, 'A');
    }
    for (const invalid of [-1, 65536, 1.5, NaN, Infinity, '222'])
      assert.throws(() => assets.assetLabelPrefix(invalid));
  });
  await test('Asset identity retains binary and empty names, detects invalid labels and derives exact counterparts', async () => {
    const p = 'ab'.repeat(28),
      nft = assets.inspectAssetIdentity(p, '000de14043415053554c45');
    assert.equal(nft.label, 222);
    assert.equal(
      nft.counterpart.referenceAssetNameHex,
      '000643b043415053554c45',
    );
    assert.equal(nft.utf8, 'CAPSULE');
    assert.equal(nft.bytes, 11);
    assert.equal(assets.inspectAssetIdentity(p, 'ff').utf8, null);
    assert.equal(assets.inspectAssetIdentity(p, '').utf8, '');
    assert.notEqual(
      assets.inspectAssetIdentity(p, '').fingerprint,
      assets.inspectAssetIdentity(p, '00').fingerprint,
    );
    assert.equal(
      assets.inspectAssetIdentity(p, '000de150').invalidLabelChecksum,
      true,
    );
    assert.equal(assets.inspectAssetIdentity(p, '100de140').label, null);
    for (const [policy, name] of [
      ['ab', ''],
      [p, 'f'],
      [p, 'ff'.repeat(33)],
      [p, 'zz'],
      [p, '0x12'],
    ])
      assert.throws(() => assets.inspectAssetIdentity(policy, name));
  });
  console.log(`PASS ${count} Labs verification groups`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
