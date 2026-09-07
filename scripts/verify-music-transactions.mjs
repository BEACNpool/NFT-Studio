// Local synthetic fixtures only. Ephemeral test keys never leave this process.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const kit = fileURLToPath(new URL('../', import.meta.url));
const studio = process.env.NFT_STUDIO_TEST_ROOT || kit;
const musicRoot = process.env.NFT_STUDIO_MUSIC_ROOT || studio;
const require = createRequire(path.join(studio, 'package.json'));
const C = require('@emurgo/cardano-serialization-lib-nodejs');
const B = await import(
  pathToFileURL(
    require.resolve('@emurgo/cardano-serialization-lib-browser-inlined'),
  )
);
const { build } = require('esbuild');
const ts = require('typescript');
const baseline = JSON.parse(
  await readFile(
    path.join(kit, 'docs/MUSIC_TRANSACTION_BASELINE.json'),
    'utf8',
  ),
);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const clone = (v) => JSON.parse(JSON.stringify(v));
const enc = new TextEncoder();
const fixtureRoot = path.join(kit, 'tests/fixtures/music-transactions');
const musicFixtures = path.join(musicRoot, 'tests/fixtures/music-release');
const resolveShared = (name) => {
  if (name === './music-release')
    return path.join(musicRoot, 'lib/music-release.ts');
  if (name === './studio-payload')
    return path.join(studio, 'lib/studio-payload.ts');
  if (name === './cardano') return path.join(studio, 'lib/cardano.ts');
};
const options = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  resolveJsonModule: true,
  esModuleInterop: true,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  types: ['node'],
  typeRoots: [path.join(studio, 'node_modules/@types')],
  baseUrl: studio,
  paths: { '@/*': ['*'] },
};
const host = ts.createCompilerHost(options);
host.resolveModuleNames = (names, containing) =>
  names.map((name) => {
    const override = resolveShared(name);
    if (override)
      return { resolvedFileName: override, extension: ts.Extension.Ts };
    return (
      ts.resolveModuleName(name, containing, options, host).resolvedModule ||
      ts.resolveModuleName(
        name,
        path.join(studio, 'lib/studio-transaction.ts'),
        options,
        host,
      ).resolvedModule
    );
  });
const diagnostics = ts.getPreEmitDiagnostics(
  ts.createProgram(
    [path.join(kit, 'lib/studio-transaction.ts')],
    options,
    host,
  ),
);
assert.equal(
  diagnostics.length,
  0,
  ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => kit,
    getNewLine: () => '\n',
  }),
);
console.log('PASS strict TypeScript over candidate builder and shared modules');
async function compile(transactionFile) {
  const built = await build({
    stdin: {
      contents: `export * from ${JSON.stringify(transactionFile)}; export * from ${JSON.stringify(path.join(musicRoot, 'lib/music-release.ts'))}; export * from ${JSON.stringify(path.join(studio, 'lib/studio-payload.ts'))}; export {parseProtocol, assertFreshReview, assertWalletUnchanged, mergeAndCheckSignatures, STUDIO_TX_CAP} from ${JSON.stringify(path.join(studio, 'lib/cardano.ts'))}; export {verifyMintIntent, createMintIntent} from ${JSON.stringify(path.join(studio, 'lib/studio-intent.ts'))};`,
      resolveDir: studio,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    alias: { '@': studio },
    nodePaths: [path.join(studio, 'node_modules')],
    external: ['@emurgo/cardano-serialization-lib-browser-inlined'],
    plugins: [
      {
        name: 'shared-modules',
        setup(b) {
          b.onResolve(
            { filter: /^\.\/(?:music-release|studio-payload|cardano)$/ },
            (args) => ({ path: resolveShared(args.path) }),
          );
        },
      },
    ],
  });
  return import(
    'data:text/javascript;base64,' +
      Buffer.from(built.outputFiles[0].text).toString('base64')
  );
}
const M = await compile(path.join(kit, 'lib/studio-transaction.ts'));
const normalDateNow = Date.now;
const timestamp = Date.UTC(2026, 8, 7, 7, 0, 0);
Date.now = () => timestamp;
const bn = (n) => C.BigNum.from_str(String(n));
const addressForHash = (hex, network = 1) =>
  C.EnterpriseAddress.new(
    network,
    C.Credential.from_keyhash(C.Ed25519KeyHash.from_hex(hex)),
  ).to_address();
const fixedAddress = addressForHash('22'.repeat(28));
const fixedSecondAddress = addressForHash('33'.repeat(28));
const oldPolicy = C.ScriptHash.from_hex('ab'.repeat(28));
const otherPolicy = C.ScriptHash.from_hex('cd'.repeat(28));
const oldNames = [
  C.AssetName.new(enc.encode('KEEPME')),
  C.AssetName.new(new Uint8Array()),
  C.AssetName.new(Uint8Array.of(0, 255, 1)),
];
const parameters = {
  epoch_no: 653,
  min_fee_a: 44,
  min_fee_b: 155381,
  max_tx_size: 16384,
  max_val_size: 5000,
  coins_per_utxo_size: '4310',
  key_deposit: '2000000',
  pool_deposit: '500000000',
};
const live = () =>
  M.parseProtocol(
    {
      epoch_no: 653,
      abs_slot: 197151000,
      block_time: Math.floor(timestamp / 1000) - 15,
    },
    parameters,
  );
function utxo(
  n,
  coin = 20000000,
  at = fixedAddress,
  tokens = false,
  special = '',
) {
  const value = C.Value.new(bn(coin));
  if (tokens) {
    const multi = C.MultiAsset.new(),
      first = C.Assets.new(),
      second = C.Assets.new();
    first.insert(oldNames[0], bn(7));
    first.insert(oldNames[1], bn(2));
    second.insert(oldNames[2], bn(13));
    multi.insert(oldPolicy, first);
    multi.insert(otherPolicy, second);
    value.set_multiasset(multi);
  }
  const output = C.TransactionOutput.new(at, value);
  if (special === 'datum')
    output.set_data_hash(C.DataHash.from_hex('55'.repeat(32)));
  if (special === 'inline')
    output.set_plutus_data(C.PlutusData.new_integer(C.BigInt.from_str('1')));
  if (special === 'ref')
    output.set_script_ref(
      C.ScriptRef.new_native_script(
        C.NativeScript.new_timelock_expiry(
          C.TimelockExpiry.new_timelockexpiry(bn(197159999)),
        ),
      ),
    );
  return C.TransactionUnspentOutput.new(
    C.TransactionInput.new(
      C.TransactionHash.from_hex(n.toString(16).padStart(64, '0')),
      n,
    ),
    output,
  ).to_hex();
}
function readMetadata(hex) {
  const general = C.Transaction.from_hex(hex).auxiliary_data().metadata();
  const out = {};
  const labels = general.keys();
  for (let i = 0; i < labels.len(); i++) {
    const label = labels.get(i);
    out[label.to_str()] = JSON.parse(
      C.decode_metadatum_to_json_str(
        general.get(label),
        C.MetadataJsonSchema.NoConversions,
      ),
    );
  }
  return out;
}
function assertConservation(prepared, wallet) {
  const tx = C.Transaction.from_hex(prepared.unsignedHex),
    outputs = tx.body().outputs();
  const chosen = new Set(prepared.inputRefs);
  let inputCoin = 0n,
    outputCoin = 0n;
  const inputAssets = new Map(),
    outputAssets = new Map();
  const sumAssets = (value, map) => {
    const multi = value.multiasset();
    if (!multi) return;
    const policies = multi.keys();
    for (let i = 0; i < policies.len(); i++) {
      const p = policies.get(i),
        assets = multi.get(p),
        names = assets.keys();
      for (let j = 0; j < names.len(); j++) {
        const n = names.get(j),
          key = p.to_hex() + ':' + Buffer.from(n.name()).toString('hex');
        map.set(key, (map.get(key) || 0n) + BigInt(assets.get(n).to_str()));
      }
    }
  };
  for (const hex of wallet.utxos) {
    const u = C.TransactionUnspentOutput.from_hex(hex),
      input = u.input();
    if (!chosen.has(input.transaction_id().to_hex() + '#' + input.index()))
      continue;
    inputCoin += BigInt(u.output().amount().coin().to_str());
    sumAssets(u.output().amount(), inputAssets);
  }
  for (let i = 0; i < outputs.len(); i++) {
    const output = outputs.get(i);
    assert.equal(output.address().to_hex(), wallet.changeHex);
    assert.ok(
      BigInt(output.amount().coin().to_str()) >=
        BigInt(
          C.min_ada_for_output(
            output,
            C.DataCost.new_coins_per_byte(bn(parameters.coins_per_utxo_size)),
          ).to_str(),
        ),
    );
    outputCoin += BigInt(output.amount().coin().to_str());
    sumAssets(output.amount(), outputAssets);
  }
  if (prepared.mode === 'nft') {
    const unit =
      prepared.policyId + ':' + Buffer.from(prepared.assetName).toString('hex');
    assert.equal(outputAssets.get(unit), 1n);
    outputAssets.delete(unit);
    const mint = tx.body().mint();
    assert.equal(mint.len(), 1);
    assert.equal(
      mint
        .get(C.ScriptHash.from_hex(prepared.policyId))
        .get(0)
        .get(C.AssetName.new(enc.encode(prepared.assetName)))
        .to_str(),
      '1',
    );
  } else assert.ok(!tx.body().mint());
  assert.deepEqual(outputAssets, inputAssets);
  assert.equal(outputCoin + BigInt(prepared.fee), inputCoin);
  assert.equal(
    C.hash_auxiliary_data(tx.auxiliary_data()).to_hex(),
    tx.body().auxiliary_data_hash().to_hex(),
  );
}
let groups = 0;
const test = async (name, fn) => {
  await fn();
  groups++;
  console.log('PASS', name);
};
try {
  const music = await M.parseMusicRelease(
    await readFile(
      path.join(musicFixtures, 'single.music-release.json'),
      'utf8',
    ),
  );
  const bundle = music.bundle;
  const cases = [
    {
      id: 'nft-one-input',
      mode: 'nft',
      wallet: { changeHex: fixedAddress.to_hex(), utxos: [utxo(1)] },
    },
    {
      id: 'data-one-input',
      mode: 'data',
      wallet: { changeHex: fixedAddress.to_hex(), utxos: [utxo(2)] },
    },
    {
      id: 'nft-three-existing-assets',
      mode: 'nft',
      wallet: {
        changeHex: fixedAddress.to_hex(),
        utxos: [utxo(3, 20000000, fixedAddress, true)],
      },
    },
    {
      id: 'data-three-existing-assets',
      mode: 'data',
      wallet: {
        changeHex: fixedAddress.to_hex(),
        utxos: [utxo(4, 20000000, fixedAddress, true)],
      },
    },
    {
      id: 'nft-two-input-keys',
      mode: 'nft',
      wallet: {
        changeHex: fixedAddress.to_hex(),
        utxos: [utxo(5, 1400000), utxo(6, 1400000, fixedSecondAddress)],
      },
    },
    {
      id: 'data-two-input-keys',
      mode: 'data',
      wallet: {
        changeHex: fixedAddress.to_hex(),
        utxos: [utxo(7, 1000000), utxo(8, 1000000, fixedSecondAddress)],
      },
    },
  ];
  const baselineFile = path.join(fixtureRoot, 'ordinary-baselines.json');
  if (process.argv.includes('--write-baselines')) {
    assert.equal(
      sha(await readFile(path.join(studio, 'lib/studio-transaction.ts'))),
      baseline.files[0].sha256,
      'Baseline generation requires the exact original reviewed builder.',
    );
    const legacy = await compile(
      path.join(studio, 'lib/studio-transaction.ts'),
    );
    const generated = [];
    for (const c of cases) {
      const prepared = await legacy.buildStudioTransaction(
        C,
        bundle,
        c.mode,
        c.wallet,
        live(),
      );
      generated.push({
        ...c,
        prepared,
        preparedOwnKeys: Object.keys(prepared).sort(),
      });
    }
    await writeFile(
      baselineFile,
      JSON.stringify(
        {
          schema: 'beacn.music-builder.ordinary-baselines.v1',
          synthetic: true,
          timestamp,
          baselineSource: baseline.files[0],
          cases: generated,
        },
        null,
        2,
      ) + '\n',
    );
  }
  await test('Six ordinary NFT/data outputs stay byte-identical to the original builder', async () => {
    const expected = JSON.parse(await readFile(baselineFile, 'utf8'));
    assert.equal(expected.baselineSource.sha256, baseline.files[0].sha256);
    assert.equal(expected.timestamp, timestamp);
    for (const c of cases) {
      const result = await M.buildStudioTransaction(
        C,
        bundle,
        c.mode,
        c.wallet,
        live(),
      );
      const before = expected.cases.find((x) => x.id === c.id);
      assert.deepEqual(clone(result), before.prepared);
      assert.deepEqual(Object.keys(result).sort(), before.preparedOwnKeys);
      assertConservation(result, c.wallet);
      assert.ok(
        !Object.hasOwn(result, 'musicRelease') &&
          !Object.hasOwn(result, 'metadataProfile'),
      );
    }
  });
  const privateA = C.PrivateKey.generate_ed25519(),
    privateB = C.PrivateKey.generate_ed25519();
  const addressA = addressForHash(privateA.to_public().hash().to_hex());
  const addressB = addressForHash(privateB.to_public().hash().to_hex());
  const wallet = {
    changeHex: addressA.to_hex(),
    utxos: [utxo(21, 20000000, addressA, true)],
  };
  function witnesses(prepared, keys = [privateA], hash = prepared.hash) {
    const set = C.TransactionWitnessSet.new(),
      vkeys = C.Vkeywitnesses.new();
    for (const key of keys)
      vkeys.add(C.make_vkey_witness(C.TransactionHash.from_hex(hash), key));
    set.set_vkeys(vkeys);
    return set.to_hex();
  }
  let prepared, signed, secondPrepared;
  await test('Music uses shared conservation/signature checks and recovers exact bytes plus credits', async () => {
    prepared = await M.buildMusicReleaseTransaction(C, music, wallet, live());
    assert.equal(prepared.mode, 'nft');
    assert.equal(prepared.musicRelease.packageHash, music.packageHash);
    assert.ok(
      Object.isFrozen(prepared.musicRelease) &&
        Object.isFrozen(prepared.metadata),
    );
    assertConservation(prepared, wallet);
    await M.assertMusicReleaseUnchanged(prepared, music);
    M.assertWalletUnchanged(C, prepared, wallet);
    M.assertFreshReview(prepared, live());
    signed = M.mergeAndCheckSignatures(
      C,
      prepared,
      witnesses(prepared),
      live(),
    );
    assert.equal(signed.bytes, prepared.signedEstimate);
    assert.equal(
      M.mergeAndCheckSignatures(B, prepared, witnesses(prepared), live()).hex,
      signed.hex,
    );
    const expected = await M.musicReleaseMetadata(music, {
      policyId: prepared.policyId,
      assetName: prepared.assetName,
    });
    assert.deepEqual(readMetadata(signed.hex), expected.metadata);
    assert.equal(
      C.Transaction.from_hex(signed.hex).auxiliary_data().metadata().to_hex(),
      expected.metadataCborHex,
    );
    const recovered = await M.recoverMusicRelease(readMetadata(signed.hex), {
      policyId: prepared.policyId,
      assetName: prepared.assetName,
    });
    assert.deepEqual(recovered, music);
    const ordinary = await M.recoverPayloadMetadata(readMetadata(signed.hex), {
      policyId: prepared.policyId,
      assetName: prepared.assetName,
    });
    assert.equal(ordinary.bundle.sha256, bundle.sha256);
    for (let i = 0; i < bundle.files.length; i++)
      assert.equal(sha(ordinary.files[i].bytes), bundle.files[i].sha256);
    assert.equal(
      C.Transaction.from_hex(signed.hex).body().to_hex(),
      C.Transaction.from_hex(prepared.unsignedHex).body().to_hex(),
    );
  });
  await test('Browser and Node CSL produce the same music preparation', async () => {
    const browser = await M.buildMusicReleaseTransaction(
      B,
      music,
      wallet,
      live(),
    );
    assert.deepEqual(browser, prepared);
  });
  await test('Credit-only edits change asset identity, committed auxiliary data, fee and transaction hash', async () => {
    const changed = {
      release: clone(music.release),
      tracks: clone(music.tracks),
    };
    changed.tracks[0].song.artists[0].name =
      'A visibly revised artist declaration';
    const revision = await M.createMusicRelease(bundle, changed);
    assert.equal(revision.bundle.sha256, music.bundle.sha256);
    secondPrepared = await M.buildMusicReleaseTransaction(
      C,
      revision,
      wallet,
      live(),
    );
    assert.notEqual(
      secondPrepared.musicRelease.packageHash,
      prepared.musicRelease.packageHash,
    );
    assert.notEqual(secondPrepared.assetName, prepared.assetName);
    assert.notEqual(secondPrepared.hash, prepared.hash);
    assert.notEqual(secondPrepared.fee, prepared.fee);
    assert.notEqual(
      C.Transaction.from_hex(secondPrepared.unsignedHex)
        .body()
        .auxiliary_data_hash()
        .to_hex(),
      C.Transaction.from_hex(prepared.unsignedHex)
        .body()
        .auxiliary_data_hash()
        .to_hex(),
    );
    await assert.rejects(
      M.assertMusicReleaseUnchanged(prepared, revision),
      /credits changed/,
    );
    await M.assertMusicReleaseUnchanged(secondPrepared, revision);
    assert.throws(
      () =>
        M.mergeAndCheckSignatures(
          C,
          secondPrepared,
          witnesses(prepared),
          live(),
        ),
      /invalid signature/,
    );
    const changedSidecar = { ...prepared, metadata: clone(prepared.metadata) };
    changedSidecar.metadata['721'][prepared.policyId][
      prepared.assetName
    ].release.release_title = 'Changed sidecar';
    await assert.rejects(
      M.assertMusicReleaseUnchanged(changedSidecar, music),
      /metadata changed/,
    );
    const changedReviewedPackage = {
      ...prepared,
      musicRelease: clone(prepared.musicRelease),
    };
    changedReviewedPackage.musicRelease.tracks[0].song.artists[0].name =
      'Changed cached review';
    await assert.rejects(
      M.assertMusicReleaseUnchanged(changedReviewedPackage, music),
      /hash/,
    );
  });
  await test('Multiple selected payment keys remain mandatory and every existing asset is preserved', async () => {
    const multiWallet = {
      changeHex: addressA.to_hex(),
      utxos: [utxo(31, 1400000, addressA), utxo(32, 1400000, addressB)],
    };
    const multi = await M.buildMusicReleaseTransaction(
      C,
      music,
      multiWallet,
      live(),
    );
    assert.equal(multi.inputRefs.length, 2);
    assert.equal(multi.requiredKeys.length, 2);
    assertConservation(multi, multiWallet);
    assert.throws(
      () => M.mergeAndCheckSignatures(C, multi, witnesses(multi), live()),
      /all input/,
    );
    const final = M.mergeAndCheckSignatures(
      C,
      multi,
      witnesses(multi, [privateA, privateB]),
      live(),
    );
    assert.equal(final.bytes, multi.signedEstimate);
  });
  await test('Existing freshness, wallet-account, selected-input, signature and auxiliary checks apply', async () => {
    assert.throws(
      () =>
        M.assertWalletUnchanged(C, prepared, {
          ...wallet,
          changeHex: addressB.to_hex(),
        }),
      /account changed/,
    );
    assert.throws(
      () =>
        M.assertWalletUnchanged(C, prepared, {
          ...wallet,
          utxos: [utxo(999, 20000000, addressA)],
        }),
      /spent|changed/,
    );
    assert.throws(
      () =>
        M.assertFreshReview(
          { ...prepared, createdAt: timestamp - 240001 },
          live(),
        ),
      /expired/,
    );
    assert.throws(
      () => M.assertFreshReview(prepared, { ...live(), feeA: 45 }),
      /parameters changed/,
    );
    assert.throws(
      () =>
        M.mergeAndCheckSignatures(
          C,
          prepared,
          witnesses(prepared, [privateB]),
          live(),
        ),
      /all input/,
    );
    assert.throws(
      () =>
        M.mergeAndCheckSignatures(
          C,
          prepared,
          witnesses(prepared, [privateA, privateB]),
          live(),
        ),
      /fee/,
    );
    assert.throws(
      () =>
        M.mergeAndCheckSignatures(
          C,
          prepared,
          witnesses(prepared, [privateA], '12'.repeat(32)),
          live(),
        ),
      /invalid signature/,
    );
    const original = C.Transaction.from_hex(prepared.unsignedHex),
      tampered = C.GeneralTransactionMetadata.new();
    tampered.insert(
      bn(721),
      C.TransactionMetadatum.new_text('credits removed'),
    );
    const auxiliary = C.AuxiliaryData.new();
    auxiliary.set_metadata(tampered);
    const replacement = C.Transaction.new(
      original.body(),
      original.witness_set(),
      auxiliary,
    );
    assert.throws(
      () =>
        M.mergeAndCheckSignatures(
          C,
          { ...prepared, unsignedHex: replacement.to_hex() },
          witnesses(prepared),
          live(),
        ),
      /metadata integrity/,
    );
  });
  let largeMeasurements;
  await test('Metadata cap and full signed size remain separate; fragmented wallets can exceed the latter', async () => {
    const lowLimit = prepared.signedEstimate - 1;
    assert.ok(prepared.metadataBytes < lowLimit);
    await assert.rejects(
      M.buildMusicReleaseTransaction(C, music, wallet, {
        ...live(),
        maxTx: lowLimit,
      }),
      /bytes|limit/,
    );
    await assert.rejects(
      M.buildMusicReleaseTransaction(C, music, wallet, {
        ...live(),
        maxTx: prepared.metadataBytes,
      }),
      /bytes|limit/,
    );
    const cover = await readFile(path.join(musicFixtures, 'cover.svg'));
    const originalWav = await readFile(
      path.join(musicFixtures, 'one-second.wav'),
    );
    const longWav = Buffer.alloc(9100, 128);
    originalWav.copy(longWav, 0, 0, 44);
    longWav.writeUInt32LE(longWav.length - 8, 4);
    longWav.writeUInt32LE(longWav.length - 44, 40);
    const longBundle = await M.preparePayloadBundle({
      name: bundle.name,
      coverIndex: 0,
      files: [
        { name: 'cover.svg', mediaType: 'image/svg+xml', bytes: cover },
        { name: 'one-second.wav', mediaType: 'audio/wav', bytes: longWav },
      ],
    });
    const longMusic = await M.createMusicRelease(longBundle, {
      release: music.release,
      tracks: music.tracks,
    });
    const compact = await M.buildMusicReleaseTransaction(
      C,
      longMusic,
      wallet,
      live(),
    );
    assert.ok(compact.metadataBytes <= M.MUSIC_LIMITS.metadataCborBytes);
    assert.ok(compact.signedEstimate <= M.STUDIO_TX_CAP);
    const fragmented = {
      changeHex: fixedAddress.to_hex(),
      utxos: Array.from({ length: 32 }, (_, i) =>
        utxo(
          101 + i,
          130000,
          addressForHash((101 + i).toString(16).padStart(56, '0')),
        ),
      ),
    };
    await assert.rejects(
      M.buildMusicReleaseTransaction(C, longMusic, fragmented, live()),
      /bytes|limit/,
    );
    largeMeasurements = {
      metadataBytes: compact.metadataBytes,
      compactWalletSignedEstimate: compact.signedEstimate,
      fragmentedWalletInputsAvailable: 32,
      fragmentedWalletRejectedForSignedSize: true,
    };
  });
  await test('Funding, fee cap, special outputs and wrong network reject without a wallet call', async () => {
    await assert.rejects(
      M.buildMusicReleaseTransaction(
        C,
        music,
        { ...wallet, utxos: [utxo(44, 100000, addressA)] },
        live(),
      ),
      /fund|ADA/,
    );
    await assert.rejects(
      M.buildMusicReleaseTransaction(C, music, wallet, {
        ...live(),
        feeB: 2000001,
      }),
      /2 ADA/,
    );
    await assert.rejects(
      M.buildMusicReleaseTransaction(C, music, wallet, {
        ...live(),
        fetchedAt: timestamp - 120001,
      }),
      /expired/,
    );
    const testnet = addressForHash(privateA.to_public().hash().to_hex(), 0);
    await assert.rejects(
      M.buildMusicReleaseTransaction(
        C,
        music,
        { changeHex: testnet.to_hex(), utxos: [utxo(45, 20000000, testnet)] },
        live(),
      ),
      /mainnet/,
    );
    for (const special of ['datum', 'inline', 'ref'])
      await assert.rejects(
        M.buildMusicReleaseTransaction(
          C,
          music,
          { ...wallet, utxos: [utxo(46, 20000000, addressA, false, special)] },
          live(),
        ),
        /No regular/,
      );
  });
  await test('Music packet tampering rejects and ordinary MCP/browser intent schema stays unchanged', async () => {
    const tampered = clone(music);
    tampered.tracks[0].song.artists[0].name = 'Uncommitted credits';
    await assert.rejects(
      M.buildMusicReleaseTransaction(C, tampered, wallet, live()),
      /hash/,
    );
    await assert.rejects(M.verifyMintIntent(music), /fields|Unsupported/);
    await assert.rejects(
      M.buildStudioTransaction(C, music, 'nft', wallet, live()),
      /Unsupported payload/,
    );
    assert.equal(M.buildStudioTransactionCore, undefined);
    const ordinary = await M.createMintIntent(bundle, 'nft');
    assert.deepEqual(await M.verifyMintIntent(ordinary), ordinary);
    await assert.rejects(
      M.verifyMintIntent({ ...ordinary, musicRelease: music }),
      /fields/,
    );
    assert.equal(
      Object.keys(ordinary).sort().join(','),
      'bundle,intentHash,mode,schema',
    );
  });
  await test('Package, wallet and protocol are snapshotted before music validation awaits', async () => {
    const input = clone(music),
      w = clone(wallet),
      p = live();
    const pending = M.buildMusicReleaseTransaction(C, input, w, p);
    input.tracks[0].song.artists[0].name = 'Changed after call';
    w.changeHex = addressB.to_hex();
    w.utxos.length = 0;
    p.feeB = 2000001;
    const result = await pending;
    assert.deepEqual(result, prepared);
  });
  const evidence = {
    schema: 'beacn.music-transaction.evidence.v1',
    synthetic: true,
    cslVersion: '17.0.0',
    baselineBuilderSha256: baseline.files[0].sha256,
    groups,
    ordinaryBaselineCases: cases.length,
    music: {
      rawFileBytes: music.bundle.bytes,
      metadataBytes: prepared.metadataBytes,
      completeSignedBytes: signed.bytes,
      feeLovelace: prepared.fee,
      requiredPaymentKeys: prepared.requiredKeys.length,
    },
    largePackage: largeMeasurements,
    boundaries: {
      liveWallet: false,
      chainQuery: false,
      chainSubmission: false,
      chainInclusion: false,
      productionUi: false,
      publicMcpMusicTool: false,
      privateKeysExported: false,
    },
  };
  const evidenceFile = path.join(fixtureRoot, 'verification.json');
  if (process.argv.includes('--write-evidence'))
    await writeFile(evidenceFile, JSON.stringify(evidence, null, 2) + '\n');
  else
    assert.deepEqual(
      JSON.parse(await readFile(evidenceFile, 'utf8')),
      evidence,
    );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  Date.now = normalDateNow;
}
