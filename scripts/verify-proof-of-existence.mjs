import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(
  path.join(process.env.NFT_STUDIO_TEST_ROOT || root, 'package.json'),
);
const { build } = require('esbuild'),
  C = require('@emurgo/cardano-serialization-lib-nodejs');
const built = await build({
  entryPoints: [path.join(root, 'lib/proof-of-existence.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  nodePaths: [
    path.join(process.env.NFT_STUDIO_TEST_ROOT || root, 'node_modules'),
  ],
});
const p = await import(
  'data:text/javascript;base64,' +
    Buffer.from(built.outputFiles[0].text).toString('base64')
);
const fixture = (name) =>
  JSON.parse(
    readFileSync(
      path.join(root, 'tests/fixtures/proof-of-existence', name),
      'utf8',
    ),
  );
const fromHex = (value) => new Uint8Array(Buffer.from(value, 'hex'));
const utf8 = (value) => new TextEncoder().encode(value);
let groups = 0,
  vectorCount = 0;
async function test(name, fn) {
  await fn();
  groups++;
  console.log(`ok ${groups} - ${name}`);
}
await test('110 upstream primitive vectors agree with both hash implementations', () => {
  for (const [name, algorithm] of [
    ['sha256-kat.json', 'sha2-256'],
    ['blake2b256-kat.json', 'blake2b-256'],
  ]) {
    for (const vector of fixture(name).vectors) {
      assert.equal(
        p.hashProofBytes(fromHex(vector.input_hex), [algorithm])[algorithm],
        vector.expected_hex,
        vector.name,
      );
      vectorCount++;
    }
  }
  for (const vector of fixture('dual-hash-equivalence.json').vectors) {
    const hashes = p.hashProofBytes(fromHex(vector.input_hex));
    assert.equal(hashes['sha2-256'], vector.expected_sha256_hex);
    assert.equal(hashes['blake2b-256'], vector.expected_blake2b256_hex);
    vectorCount++;
  }
});
await test('36 independent hashlib+cbor2 record, transport and metadata fixtures agree byte-for-byte', () => {
  const oracle = fixture('independent-oracle.json');
  assert.equal(oracle.primary_hash_vectors_independently_verified, 110);
  for (const vector of oracle.vectors) {
    const a = p.buildProofOfExistenceBytes(
      [{ name: 'local-only.bin', bytes: fromHex(vector.input_hex) }],
      vector.algorithms,
    );
    assert.equal(a.recordCborHex, vector.record_cbor_hex);
    assert.equal(a.labelValueCborHex, vector.label_value_cbor_hex);
    assert.equal(a.metadataCborHex, vector.metadata_cbor_hex);
    assert.equal(a.recordSha256, vector.record_sha256);
    vectorCount++;
  }
});
await test('all 14 upstream carriage vectors have the prescribed result', () => {
  for (const vector of fixture('chunk-array-positive.json').vectors) {
    assert.equal(
      p.decodeProofOfExistenceCarriage(vector.label_309_value_cbor_hex)
        .recordCborHex,
      vector.expected_record_body_hex,
      vector.name,
    );
    vectorCount++;
  }
  for (const vector of fixture('chunk-array-negative.json').vectors) {
    assert.throws(
      () => p.decodeProofOfExistenceCarriage(vector.label_309_value_cbor_hex),
      (error) => error.code === vector.expected_error_code,
      vector.name,
    );
    vectorCount++;
  }
});
await test('18 upstream canonical CBOR rejection vectors fail before schema interpretation', () => {
  for (const vector of fixture('canonical-decode-negative.json').vectors) {
    assert.throws(
      () => p.decodeProofOfExistenceBody(vector.cbor_hex),
      (error) => error.code === vector.expected_error_code,
      vector.name,
    );
    vectorCount++;
  }
});
await test('unsupported CIP-190 features do not receive a successful narrow-profile verdict', () => {
  const vectors = fixture('validator-positive.json').vectors;
  assert.equal(
    p.decodeProofOfExistenceBody(vectors[0].cbor_hex).items.length,
    1,
  );
  for (const vector of vectors.slice(1)) {
    assert.throws(
      () => p.decodeProofOfExistenceBody(vector.cbor_hex),
      (error) => error.code === 'UNSUPPORTED_PROFILE',
      vector.name,
    );
    assert.equal(
      p.verifyProofOfExistenceBytes(vector.cbor_hex, new Uint8Array()).status,
      'unsupported-profile',
    );
  }
});
await test('only digests enter actual CSL metadata; names and timestamps are local', () => {
  const a = p.buildProofOfExistenceBytes([
    {
      name: 'DO-NOT-PUBLISH-name-and-path.txt',
      bytes: utf8('hello private exact file'),
    },
  ]);
  const metadata = C.GeneralTransactionMetadata.from_hex(a.metadataCborHex),
    value = metadata.get(C.BigNum.from_str('309'));
  assert.equal(value.to_hex(), a.labelValueCborHex);
  assert.equal(metadata.len(), 1);
  assert.equal(
    p.decodeProofOfExistenceCarriage(value.to_hex()).recordCborHex,
    a.recordCborHex,
  );
  const auxiliary = C.AuxiliaryData.new();
  auxiliary.set_metadata(metadata);
  assert.equal(
    C.AuxiliaryData.from_hex(auxiliary.to_hex())
      .metadata()
      .get(C.BigNum.from_str('309'))
      .to_hex(),
    a.labelValueCborHex,
  );
  const raw = Buffer.from(a.metadataCborHex, 'hex').toString('utf8');
  assert.ok(!raw.includes(a.files[0].name));
  assert.ok(!raw.includes('hello private exact file'));
  assert.deepEqual(Object.keys(a.record).sort(), ['items', 'v']);
  assert.deepEqual(Object.keys(a.record.items[0]), ['hashes']);
});
await test('exact byte identity differs for text normalization, line endings and even one byte', () => {
  for (const [left, right] of [
    ['line\n', 'line\r\n'],
    ['é', 'e\u0301'],
    ['abc', 'abd'],
    ['abc', 'abc\u0000'],
  ]) {
    const a = p.buildProofOfExistenceBytes([
      { name: 'same-name.txt', bytes: utf8(left) },
    ]);
    assert.equal(
      p.verifyProofOfExistenceBytes(a.recordCborHex, utf8(left)).status,
      'match',
    );
    assert.equal(
      p.verifyProofOfExistenceBytes(a.recordCborHex, utf8(right)).status,
      'mismatch',
    );
  }
  const bytes = utf8('unchanged');
  const a = p.buildProofOfExistenceBytes([{ name: 'one.txt', bytes }]);
  const b = p.buildProofOfExistenceBytes([{ name: 'two.txt', bytes }]);
  assert.equal(a.metadataCborHex, b.metadataCborHex);
  const changed = a.recordCborHex.replace(
    a.files[0].hashes['blake2b-256'],
    '00'.repeat(32),
  );
  assert.equal(
    p.verifyProofOfExistenceBytes(changed, bytes).status,
    'mismatch',
  );
});
await test('streaming multi-file hashes agree with exact byte construction and cancellation works', async () => {
  const bytes = new Uint8Array(p.POE_HASH_CHUNK_BYTES * 2 + 17);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
  const files = [new File([bytes], 'large.bin'), new File([], 'empty.bin')],
    progress = [];
  const streamed = await p.buildProofOfExistenceFiles(files, {
    onProgress: (v) => progress.push(v),
  });
  const direct = p.buildProofOfExistenceBytes([
    { name: 'large.bin', bytes },
    { name: 'empty.bin', bytes: new Uint8Array() },
  ]);
  assert.equal(streamed.metadataCborHex, direct.metadataCborHex);
  assert.equal(progress.at(-1).bytesHashed, bytes.length);
  assert.ok(progress.length >= 3);
  assert.ok(
    progress.every(
      (x, i) => i === 0 || x.bytesHashed >= progress[i - 1].bytesHashed,
    ),
  );
  assert.equal(
    (await p.verifyProofOfExistenceFile(streamed.recordCborHex, files[0]))
      .status,
    'match',
  );
  const controller = new AbortController();
  await assert.rejects(
    () =>
      p.buildProofOfExistenceFiles(files, {
        signal: controller.signal,
        onProgress: () => controller.abort(),
      }),
    (error) => error.code === 'ABORTED',
  );
  await assert.rejects(
    () => p.buildProofOfExistenceFiles(files, { signal: controller.signal }),
    (error) => error.code === 'ABORTED',
  );
});
await test('resource bounds, malformed hashes and hostile CBOR fail without fetching or executing', () => {
  assert.throws(
    () => p.buildProofOfExistenceBytes([]),
    (error) => error.code === 'RESOURCE_LIMIT',
  );
  assert.throws(
    () =>
      p.buildProofOfExistenceBytes(
        Array.from({ length: 17 }, () => ({
          name: 'x',
          bytes: new Uint8Array(),
        })),
      ),
    (error) => error.code === 'RESOURCE_LIMIT',
  );
  assert.throws(
    () => p.hashProofBytes(new Uint8Array(), ['sha256']),
    (error) => error.code === 'UNSUPPORTED_HASH_ALG',
  );
  assert.throws(
    () => p.hashProofBytes(new Uint8Array(), ['sha2-256', 'sha2-256']),
    (error) => error.code === 'UNSUPPORTED_HASH_ALG',
  );
  assert.throws(
    () =>
      p.buildProofOfExistenceBytes([
        { name: 'bad\u0000name', bytes: new Uint8Array() },
      ]),
    (error) => error.code === 'INVALID_INPUT',
  );
  if (typeof SharedArrayBuffer !== 'undefined')
    assert.throws(
      () => p.hashProofBytes(new Uint8Array(new SharedArrayBuffer(8))),
      (error) => error.code === 'INVALID_INPUT',
    );
  const a = p.buildProofOfExistenceBytes([{ name: 'x', bytes: utf8('x') }]);
  for (const cb of [
    a.recordCborHex + '00',
    'a261761801656974656d7380',
    'a2617602656974656d7380',
    'a2617601656974656d7380',
    '7a7fffffff',
    'a2617601656974656d739affffffff',
    '63efbbbf',
    '61ff',
  ])
    assert.throws(() => p.decodeProofOfExistenceBody(cb));
  assert.equal(
    p.verifyProofOfExistenceBytes(a.recordCborHex, utf8('x'), 99).matches,
    false,
  );
});
await test('genuine File backing is used even when a subclass spoofs slice/size methods', async () => {
  class Spoof extends File {
    get size() {
      return 1;
    }
    slice() {
      throw new Error('overridden slice called');
    }
  }
  const file = new Spoof([utf8('actual immutable bytes')], 'test.bin');
  const a = await p.buildProofOfExistenceFiles([file]);
  assert.equal(a.files[0].bytes, 22);
  assert.equal(
    a.files[0].hashes['sha2-256'],
    p.hashProofBytes(utf8('actual immutable bytes'))['sha2-256'],
  );
});
console.log(
  `Verified ${groups} groups and ${vectorCount} pinned or independent vectors; no wallet, network, signature or chain inclusion tested.`,
);
