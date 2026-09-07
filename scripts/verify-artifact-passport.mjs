// Synthetic exact-file receipts only; no wallet, network, key generation or submission.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const kit = fileURLToPath(new URL('../', import.meta.url));
const studio = process.env.NFT_STUDIO_TEST_ROOT || kit;
const dependencies = process.env.NFT_STUDIO_MCP_TEST_ROOT || studio;
const require = createRequire(path.join(dependencies, 'package.json'));
const { build } = require('esbuild');
const C = require('@emurgo/cardano-serialization-lib-nodejs');
const result = await build({
  stdin: {
    contents: `export * from ${JSON.stringify(path.join(kit, 'lib/artifact-passport.ts'))}; export * from ${JSON.stringify(path.join(studio, 'lib/studio-payload.ts'))}; export {buildStudioTransaction} from ${JSON.stringify(path.join(studio, 'lib/studio-transaction.ts'))}; export {parseProtocol} from ${JSON.stringify(path.join(studio, 'lib/cardano.ts'))};`,
    resolveDir: kit,
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  alias: { '@': studio },
  nodePaths: [path.join(dependencies, 'node_modules')],
  external: ['@emurgo/cardano-serialization-lib-browser-inlined'],
});
const P = await import(
  'data:text/javascript;base64,' +
    Buffer.from(result.outputFiles[0].text).toString('base64')
);
const bn = (n) => C.BigNum.from_str(String(n));
const address = C.EnterpriseAddress.new(
  1,
  C.Credential.from_keyhash(C.Ed25519KeyHash.from_hex('22'.repeat(28))),
).to_address();
const policy = '33'.repeat(28),
  assetName = 'Passport🙂';
const svg = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg"><title>Original synthetic passport fixture</title></svg>',
);
const originalBytes = Uint8Array.from([239, 187, 191, 65, 13, 10, 66]);
const sourceBytes = new TextEncoder().encode('export const fixture = 42;\n');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const provenance = {
  evidence: 'declaration',
  source: {
    repository: 'https://github.com/BEACNpool/NFT-Studio',
    commit: 'a'.repeat(40),
  },
  files: [
    {
      path: 'src/fixture.js',
      role: 'source',
      bytes: sourceBytes.length,
      sha256: sha(sourceBytes),
    },
    {
      path: 'dist/original.txt',
      role: 'build-output',
      bytes: originalBytes.length,
      sha256: sha(originalBytes),
    },
  ],
  build: {
    tool: 'synthetic-fixture',
    version: '1',
    recipe: 'No build executed; fixture-only declaration.',
    outputPaths: ['dist/original.txt'],
  },
};
function transaction(metadata, mode, quantity = '1') {
  const general = C.GeneralTransactionMetadata.new();
  for (const [label, value] of Object.entries(metadata))
    general.insert(
      bn(label),
      C.encode_json_str_to_metadatum(
        JSON.stringify(value),
        C.MetadataJsonSchema.NoConversions,
      ),
    );
  const aux = C.AuxiliaryData.new();
  aux.set_metadata(general);
  const inputs = C.TransactionInputs.new();
  inputs.add(
    C.TransactionInput.new(C.TransactionHash.from_hex('11'.repeat(32)), 0),
  );
  const outputs = C.TransactionOutputs.new();
  outputs.add(C.TransactionOutput.new(address, C.Value.new(bn(2000000))));
  const body = C.TransactionBody.new_tx_body(inputs, outputs, bn(200000));
  body.set_auxiliary_data_hash(C.hash_auxiliary_data(aux));
  if (mode === 'nft') {
    const assets = C.MintAssets.new();
    assets.insert(
      C.AssetName.new(new TextEncoder().encode(assetName)),
      C.Int.from_str(quantity),
    );
    body.set_mint(C.Mint.new_from_entry(C.ScriptHash.from_hex(policy), assets));
  }
  const tx = C.Transaction.new(body, C.TransactionWitnessSet.new(), aux);
  const fixed = C.FixedTransaction.from_hex(tx.to_hex());
  return {
    schema: 'nft-studio.receipt.v1',
    hash: fixed.transaction_hash().to_hex(),
    kind: mode,
    name: 'Untrusted receipt display title',
    createdAt: 1788753600000,
    state: 'confirmed',
    checkedAt: 1788753600001,
    blocksAfterInclusion: 0,
    bytes: tx.to_bytes().length,
    signedHex: tx.to_hex(),
    metadata,
    prepared: {
      address: address.to_bech32(),
      inputRefs: ['11'.repeat(32) + '#0'],
      requiredKeys: ['22'.repeat(28)],
    },
  };
}
const fixtures = [];
for (const mode of ['data', 'nft']) {
  const bundle = await P.preparePayloadBundle({
    name: 'Passport fixture',
    files: [
      ...(mode === 'nft'
        ? [{ name: 'cover.svg', mediaType: 'image/svg+xml', bytes: svg }]
        : []),
      { name: 'original.txt', mediaType: 'text/plain', bytes: originalBytes },
    ],
    ...(mode === 'nft' ? { coverIndex: 0 } : {}),
  });
  const metadata = P.payloadMetadata(
    bundle,
    mode === 'nft' ? { policyId: policy, assetName } : undefined,
  );
  const receipt = transaction(metadata, mode);
  const passport = await P.createArtifactPassport(C, receipt, { provenance });
  fixtures.push({ mode, receipt, passport });
}
let groups = 0;
async function test(name, action) {
  try {
    await action();
    console.log(`ok ${++groups} - ${name}`);
  } catch (error) {
    console.error(
      `FAIL ${name}: ${String(error?.message ?? error).slice(0, 600)}`,
    );
    process.exit(1);
  }
}
await test('existing exact-payload NFT/data metadata adapts without wallet snapshots or transaction bytes', async () => {
  for (const { mode, receipt, passport } of fixtures) {
    const text = new TextDecoder().decode(P.artifactPassportBytes(passport));
    assert.equal(passport.identity.kind, mode);
    assert.equal(text.includes(receipt.prepared.address), false);
    assert.equal(text.includes(receipt.signedHex), false);
    assert.equal(text.includes('prepared'), false);
    assert.equal(passport.receiptObservation.blocksAfterInclusion, 0);
    assert.equal(passport.bundle.name, 'Passport fixture');
    assert.deepEqual(
      P.parseArtifactPassport(P.artifactPassportBytes(passport)),
      passport,
    );
    const result = await P.verifyArtifactPassport(C, passport);
    assert.equal(result.status, 'verified-local-content');
    assert.equal(
      result.checks.find((x) => x.id === 'transaction-binding').status,
      'not-checked',
    );
    for (const key of [
      'chainInclusionVerified',
      'authorshipVerified',
      'ownershipVerified',
      'buildReproduced',
      'signaturesVerified',
    ])
      assert.equal(result[key], false);
    assert.match(
      result.checks.find((x) => x.id === 'receipt-observation').message,
      /reports confirmed/,
    );
  }
});
await test('exact supplied transaction bytes bind body, auxiliary bytes and selected mint identity locally', async () => {
  for (const { receipt, passport } of fixtures) {
    const result = await P.verifyArtifactPassport(C, passport, {
      transactionCborHex: receipt.signedHex,
    });
    assert.equal(result.status, 'verified-local-content');
    assert.equal(
      result.checks.find((x) => x.id === 'transaction-binding').status,
      'match',
    );
    assert.equal(result.signaturesVerified, false);
  }
  const wrongTx = fixtures[1].receipt.signedHex;
  assert.equal(
    (
      await P.verifyArtifactPassport(C, fixtures[0].passport, {
        transactionCborHex: wrongTx,
      })
    ).status,
    'mismatch',
  );
  for (const qty of ['-1', '2'])
    await assert.rejects(
      P.createArtifactPassport(
        C,
        transaction(fixtures[1].receipt.metadata, 'nft', qty),
      ),
      /quantity-one/,
    );
});
await test('canonical checksums are deterministic and all file BOM/CRLF bytes survive unchanged', async () => {
  for (const { receipt, passport } of fixtures) {
    assert.deepEqual(
      await P.createArtifactPassport(C, structuredClone(receipt), {
        provenance: structuredClone(provenance),
      }),
      passport,
    );
    const { passportHash, ...core } = passport;
    assert.equal(
      sha(new TextEncoder().encode(P.canonicalPassportJson(core))),
      passportHash,
    );
    assert.deepEqual(
      P.decodePayloadURI(passport.bundle.files.at(-1).uri, 'text/plain'),
      originalBytes,
    );
    const backwards = Object.fromEntries(Object.entries(passport).reverse());
    assert.deepEqual(
      P.artifactPassportBytes(backwards),
      P.artifactPassportBytes(passport),
    );
    assert.throws(
      () =>
        P.parseArtifactPassport(
          new TextEncoder().encode(JSON.stringify(passport, null, 2)),
        ),
      /canonical/,
    );
  }
});
await test('byte, metadata, identity, receipt and provenance tampering cannot retain a successful verification', async () => {
  const original = fixtures[1].passport;
  for (const mutate of [
    (p) => (p.passportHash = '0'.repeat(64)),
    (p) => (p.transaction.hash = '0'.repeat(64)),
    (p) => (p.identity.assetNameHex = '61'),
    (p) => (p.bundle.files[0].sha256 = '0'.repeat(64)),
    (p) => (p.receiptObservation.state = 'signed'),
    (p) => (p.provenance.source.commit = 'b'.repeat(40)),
  ]) {
    const bad = structuredClone(original);
    mutate(bad);
    assert.equal((await P.verifyArtifactPassport(C, bad)).status, 'mismatch');
  }
  const changed = structuredClone(original);
  changed.bundle.files.at(-1).uri += 'A';
  const { passportHash: ignored, ...core } = changed;
  changed.passportHash = sha(
    new TextEncoder().encode(P.canonicalPassportJson(core)),
  );
  assert.notEqual(
    (await P.verifyArtifactPassport(C, changed)).status,
    'verified-local-content',
  );
});
await test('source/build bytes are checked separately from unverified repository and build declarations', async () => {
  const p = fixtures[0].passport;
  const result = await P.verifyArtifactPassport(C, p, {
    sourceFiles: [{ path: 'src/fixture.js', bytes: sourceBytes }],
  });
  assert.equal(result.status, 'verified-local-content');
  assert.equal(
    result.checks.find((x) => x.id === 'source-and-build').status,
    'unverified',
  );
  assert.equal(
    result.checks.find((x) => x.id === 'provenance-file:src/fixture.js').status,
    'match',
  );
  assert.equal(
    result.checks.find((x) => x.id === 'provenance-file:dist/original.txt')
      .status,
    'not-checked',
  );
  assert.equal(
    result.checks.find((x) => x.id === 'build-output-content:dist/original.txt')
      .status,
    'match',
  );
  assert.equal(
    (
      await P.verifyArtifactPassport(C, p, {
        sourceFiles: [{ path: 'src/fixture.js', bytes: new Uint8Array(1) }],
      })
    ).status,
    'mismatch',
  );
  assert.equal(
    (
      await P.verifyArtifactPassport(C, p, {
        sourceFiles: [{ path: '../secret', bytes: sourceBytes }],
      })
    ).status,
    'invalid-passport',
  );
});
await test('strict profile bounds and unsupported lanes reject malformed inputs without executing getters', async () => {
  const p = fixtures[0].passport;
  for (const mutate of [
    (p) => (p.extra = true),
    (p) => (p.provenance.source.repository = 'http://127.0.0.1/private'),
    (p) => p.provenance.files.push(p.provenance.files[0]),
    (p) => (p.bundle.bytes = 12001),
    (p) => (p.transaction.auxiliaryDataHex = 'aa'.repeat(16385)),
    (p) => (p.receiptObservation.evidence = 'independent-chain-proof'),
  ]) {
    const bad = structuredClone(p);
    mutate(bad);
    assert.equal(
      (await P.verifyArtifactPassport(C, bad)).status,
      'invalid-passport',
    );
  }
  const unsupported = { ...p, profile: 'full-cip68-universal' };
  assert.equal(
    (await P.verifyArtifactPassport(C, unsupported)).status,
    'unsupported-profile',
  );
  await assert.rejects(
    P.createArtifactPassport(C, { ...fixtures[0].receipt, kind: 'game' }),
    /Only the exact-file/,
  );
  assert.throws(
    () =>
      P.canonicalPassportJson({
        get value() {
          throw new Error('Getter executed');
        },
      }),
    /inert JSON/,
  );
  assert.throws(
    () => P.canonicalPassportJson({ value: 'x'.repeat(240001) }),
    /oversized|limit/,
  );
  assert.throws(() => P.parseArtifactPassport(new Uint8Array(240001)), /limit/);
  const cycle = {};
  cycle.self = cycle;
  assert.throws(() => P.canonicalPassportJson(cycle), /Cyclic/);
  const duplicate = P.canonicalPassportJson(p).replace(
    '"schema":',
    '"schema":"beacn.artifact-passport.v1","schema":',
  );
  assert.throws(
    () => P.parseArtifactPassport(new TextEncoder().encode(duplicate)),
    /canonical/,
  );
});
await test('hostile arrays, typed-array slots and opaque CBOR are rejected before unsafe work', async () => {
  let callbacks = 0;
  const hostileArray = [1];
  Object.defineProperty(hostileArray, 'map', {
    value() {
      callbacks++;
      return ['999'];
    },
  });
  assert.throws(() => P.canonicalPassportJson(hostileArray), /extended/);
  const inherited = [1];
  Object.setPrototypeOf(inherited, {
    map() {
      callbacks++;
    },
  });
  assert.throws(() => P.canonicalPassportJson(inherited), /extended/);
  assert.throws(() => P.canonicalPassportJson(Array(2)), /Sparse/);
  assert.throws(
    () => P.canonicalPassportJson(Array(20000).fill('x'.repeat(200000))),
    /limit/,
  );
  const p = fixtures[0].passport;
  const supplied = [{ path: 'src/fixture.js', bytes: sourceBytes }];
  Object.defineProperty(supplied, Symbol.iterator, {
    value() {
      callbacks++;
      return [][Symbol.iterator]();
    },
  });
  assert.equal(
    (await P.verifyArtifactPassport(C, p, { sourceFiles: supplied })).status,
    'invalid-passport',
  );
  const oversized = new Uint8Array(1048577);
  Object.defineProperty(oversized, 'byteLength', {
    get() {
      callbacks++;
      return 1;
    },
  });
  Object.defineProperty(oversized, 'buffer', {
    get() {
      callbacks++;
      return new ArrayBuffer(1);
    },
  });
  assert.equal(
    (
      await P.verifyArtifactPassport(C, p, {
        sourceFiles: [{ path: 'src/fixture.js', bytes: oversized }],
      })
    ).status,
    'invalid-passport',
  );
  assert.throws(() => P.parseArtifactPassport(oversized), /limit/);
  const validBytes = new Uint8Array(sourceBytes);
  Object.defineProperty(validBytes, 'byteLength', {
    get() {
      callbacks++;
      return 1;
    },
  });
  Object.defineProperty(validBytes, 'buffer', {
    get() {
      callbacks++;
      return new ArrayBuffer(1);
    },
  });
  for (const key of [Symbol.iterator, 'constructor', 'byteOffset', 'slice'])
    Object.defineProperty(validBytes, key, {
      get() {
        callbacks++;
        throw new Error('Caller byte method executed');
      },
    });
  assert.equal(
    (
      await P.verifyArtifactPassport(C, p, {
        sourceFiles: [{ path: 'src/fixture.js', bytes: validBytes }],
      })
    ).status,
    'verified-local-content',
  );
  assert.equal(callbacks, 0);
  const rehash = (value) => {
    const { passportHash: ignored, ...core } = value;
    value.passportHash = sha(
      new TextEncoder().encode(P.canonicalPassportJson(core)),
    );
    return value;
  };
  for (const raw of [
    p.transaction.auxiliaryDataHex + '00',
    'b801' + p.transaction.auxiliaryDataHex.slice(2),
    'a2' +
      p.transaction.auxiliaryDataHex.slice(2) +
      p.transaction.auxiliaryDataHex.slice(2),
  ]) {
    const changed = structuredClone(p);
    changed.transaction.auxiliaryDataHex = raw;
    rehash(changed);
    assert.notEqual(
      (await P.verifyArtifactPassport(C, changed)).status,
      'verified-local-content',
    );
  }
  assert.equal(
    (
      await P.verifyArtifactPassport(C, p, {
        transactionCborHex: fixtures[0].receipt.signedHex + '00',
      })
    ).status,
    'invalid-passport',
  );
  let wasmEntries = 0;
  const trap = {
    ...C,
    AuxiliaryData: {
      from_hex() {
        wasmEntries++;
        throw new Error('WASM entered');
      },
    },
    FixedTransaction: {
      from_hex() {
        wasmEntries++;
        throw new Error('WASM entered');
      },
    },
  };
  for (const raw of [
    'a100' + '81'.repeat(4096) + '00',
    '9bffffffffffffffff',
    'bf00ff',
    '5f4100ff',
    '1c',
    'a10000ff',
  ]) {
    const changed = structuredClone(p);
    changed.transaction.auxiliaryDataHex = raw;
    rehash(changed);
    assert.notEqual(
      (await P.verifyArtifactPassport(trap, changed)).status,
      'verified-local-content',
    );
    await assert.rejects(
      P.createArtifactPassport(trap, {
        ...fixtures[0].receipt,
        signedHex: raw,
        bytes: raw.length / 2,
      }),
    );
  }
  assert.equal(wasmEntries, 0);
  assert.equal(
    (
      await P.verifyArtifactPassport(C, p, {
        transactionCborHex: fixtures[0].receipt.signedHex,
      })
    ).status,
    'verified-local-content',
  );
});
await test('actual shared Studio transaction builder receipts adapt in both modes without network or keys', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('Unexpected network request');
  };
  try {
    const protocol = P.parseProtocol(
      {
        epoch_no: 654,
        abs_slot: 197190784,
        block_time: Math.floor(Date.now() / 1000),
      },
      {
        epoch_no: 654,
        min_fee_a: 44,
        min_fee_b: 155381,
        max_tx_size: 16384,
        max_val_size: 5000,
        coins_per_utxo_size: '4310',
        key_deposit: '2000000',
        pool_deposit: '500000000',
      },
    );
    const input = C.TransactionUnspentOutput.new(
      C.TransactionInput.new(C.TransactionHash.from_hex('44'.repeat(32)), 0),
      C.TransactionOutput.new(address, C.Value.new(bn(20000000))),
    );
    for (const { mode, passport: fixturePassport } of fixtures) {
      const prepared = await P.buildStudioTransaction(
        C,
        fixturePassport.bundle,
        mode,
        { changeHex: address.to_hex(), utxos: [input.to_hex()] },
        protocol,
      );
      const receipt = {
        schema: 'nft-studio.receipt.v1',
        kind: mode,
        hash: prepared.hash,
        name: prepared.name,
        signedHex: prepared.unsignedHex,
        bytes: prepared.unsignedHex.length / 2,
        metadata: prepared.metadata,
        prepared,
        state: 'signed',
        createdAt: 1788753600000,
      };
      const passport = await P.createArtifactPassport(C, receipt);
      const verified = await P.verifyArtifactPassport(C, passport, {
        transactionCborHex: prepared.unsignedHex,
      });
      assert.equal(verified.status, 'verified-local-content');
      assert.equal(verified.signaturesVerified, false);
      assert.deepEqual(passport.bundle, fixturePassport.bundle);
      assert.equal(passport.provenance, undefined);
    }
  } finally {
    globalThis.fetch = previousFetch;
  }
});

const publicFixture = {
  description:
    'Original synthetic exact-payload receipts; no signing keys, wallet calls, network or submission. Deliberately unsigned transactions demonstrate why transaction binding never implies signatures or inclusion.',
  cases: fixtures.map(({ mode, receipt, passport }) => ({
    mode,
    passport,
    transactionCborHex: receipt.signedHex,
    rawBodyHex: C.FixedTransaction.from_hex(receipt.signedHex).body().to_hex(),
  })),
};
const fixturePath = path.join(
  kit,
  'tests/fixtures/artifact-passport/roundtrips.json',
);
if (process.argv[2] === '--write-fixtures') {
  await mkdir(path.dirname(fixturePath), { recursive: true });
  await writeFile(fixturePath, JSON.stringify(publicFixture, null, 2) + '\n');
} else
  assert.deepEqual(
    JSON.parse(await readFile(fixturePath, 'utf8')),
    publicFixture,
  );
console.log(
  `Verified ${groups} artifact-passport groups; two deterministic synthetic fixtures. No inclusion, signatures, authorship, ownership or build reproduction claimed.`,
);
