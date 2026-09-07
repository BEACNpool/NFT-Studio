// Offline synthetic tests. Ephemeral test keys are never exported or persisted.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const kit = fileURLToPath(new URL("../", import.meta.url));
const studio = process.env.NFT_STUDIO_TEST_ROOT || kit;
const musicRoot = process.env.NFT_STUDIO_MUSIC_ROOT || studio;
const require = createRequire(path.join(studio, "package.json"));
const C = require("@emurgo/cardano-serialization-lib-nodejs");
const { blake2b } = await import(pathToFileURL(require.resolve("@noble/hashes/blake2.js")));
const B = await import(
  pathToFileURL(require.resolve("@emurgo/cardano-serialization-lib-browser-inlined"))
);
const { build } = require("esbuild");
const ts = require("typescript");
const options = {
  target: ts.ScriptTarget.ES2017,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  resolveJsonModule: true,
  esModuleInterop: true,
  lib: ["lib.esnext.d.ts", "lib.dom.d.ts"],
  types: ["node"],
  typeRoots: [path.join(studio, "node_modules/@types")],
  baseUrl: studio,
  paths: { "@/*": ["*"] },
};
const resolveShared = (name) => {
  if (["./music-release", "./studio-transaction"].includes(name))
    return path.join(musicRoot, "lib", name.slice(2) + ".ts");
  if (["./studio-payload", "./cardano", "./artifact-passport"].includes(name))
    return path.join(studio, "lib", name.slice(2) + ".ts");
};
const host = ts.createCompilerHost(options);
host.resolveModuleNames = (names, containing) =>
  names.map((name) => {
    const override = resolveShared(name);
    return override
      ? { resolvedFileName: override, extension: ts.Extension.Ts }
      : ts.resolveModuleName(name, containing, options, host).resolvedModule ||
          ts.resolveModuleName(name, path.join(studio, "lib/cardano.ts"), options, host)
            .resolvedModule;
  });
const diagnostics = ts.getPreEmitDiagnostics(
  ts.createProgram([path.join(kit, "lib/music-receipt.ts")], options, host),
);
assert.equal(
  diagnostics.length,
  0,
  ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => kit,
    getNewLine: () => "\n",
  }),
);
console.log("PASS strict TypeScript including current ES2017 target");
const built = await build({
  stdin: {
    contents: `export * from ${JSON.stringify(path.join(kit, "lib/music-receipt.ts"))}; export * from ${JSON.stringify(path.join(musicRoot, "lib/studio-transaction.ts"))}; export * from ${JSON.stringify(path.join(musicRoot, "lib/music-release.ts"))}; export {parseProtocol,mergeAndCheckSignatures} from ${JSON.stringify(path.join(studio, "lib/cardano.ts"))};`,
    resolveDir: studio,
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  alias: { "@": studio },
  nodePaths: [path.join(studio, "node_modules")],
  external: ["@emurgo/cardano-serialization-lib-browser-inlined"],
  plugins: [
    {
      name: "shared",
      setup(b) {
        b.onResolve(
          {
            filter:
              /^\.\/(?:music-release|studio-transaction|studio-payload|cardano|artifact-passport)$/,
          },
          (a) => ({ path: resolveShared(a.path) }),
        );
      },
    },
  ],
});
const M = await import(
  "data:text/javascript;base64," + Buffer.from(built.outputFiles[0].text).toString("base64")
);
const clone = (v) => JSON.parse(JSON.stringify(v));
const bn = (n) => C.BigNum.from_str(String(n));
const enc = new TextEncoder();
const time = Date.UTC(2026, 8, 7, 7, 0, 0),
  originalNow = Date.now;
Date.now = () => time;
const parameters = {
  epoch_no: 653,
  min_fee_a: 44,
  min_fee_b: 155381,
  max_tx_size: 16384,
  max_val_size: 5000,
  coins_per_utxo_size: "4310",
  key_deposit: "2000000",
  pool_deposit: "500000000",
};
const protocol = M.parseProtocol(
  { epoch_no: 653, abs_slot: 197151000, block_time: Math.floor(time / 1000) - 15 },
  parameters,
);
const privateKey = C.PrivateKey.generate_ed25519();
const address = C.EnterpriseAddress.new(
  1,
  C.Credential.from_keyhash(privateKey.to_public().hash()),
).to_address();
const utxo = C.TransactionUnspentOutput.new(
  C.TransactionInput.new(C.TransactionHash.from_hex("11".repeat(32)), 0),
  C.TransactionOutput.new(address, C.Value.new(bn(20000000))),
).to_hex();
const wallet = { changeHex: address.to_hex(), utxos: [utxo] };
let passed = 0,
  rejections = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log("PASS " + name);
}
async function rejects(value, expected, impl = C) {
  await assert.rejects(() => M.recoverMusicReceipt(impl, value), expected);
  rejections++;
}
function review(hex, extra = {}) {
  return {
    schema: "nft-studio.review.v1",
    mode: "nft",
    unsignedHex: hex,
    hash: C.FixedTransaction.from_hex(hex).transaction_hash().to_hex(),
    createdAt: time,
    ...extra,
  };
}
function altered(prepared, action) {
  const tx = C.Transaction.from_hex(prepared.unsignedHex);
  const context = { body: tx.body(), witnesses: tx.witness_set(), aux: tx.auxiliary_data() };
  action(context);
  return C.Transaction.new(context.body, context.witnesses, context.aux).to_hex();
}
try {
  const music = await M.parseMusicRelease(
    await readFile(
      path.join(musicRoot, "tests/fixtures/music-release/single.music-release.json"),
      "utf8",
    ),
  );
  const prepared = await M.buildMusicReleaseTransaction(C, music, wallet, protocol);
  const unsigned = { schema: "nft-studio.review.v1", ...prepared };
  const set = C.TransactionWitnessSet.new(),
    vkeys = C.Vkeywitnesses.new();
  vkeys.add(C.make_vkey_witness(C.TransactionHash.from_hex(prepared.hash), privateKey));
  set.set_vkeys(vkeys);
  const signed = M.mergeAndCheckSignatures(C, prepared, set.to_hex(), protocol);
  const receipt = {
    schema: "nft-studio.receipt.v1",
    kind: "nft",
    hash: prepared.hash,
    signedHex: signed.hex,
    bytes: signed.bytes,
    state: "confirmed",
    createdAt: time,
    checkedAt: time + 1000,
    blocksAfterInclusion: 12,
    metadataProfile: M.MUSIC_RELEASE_PROFILE,
    musicPackageHash: music.packageHash,
    policyId: prepared.policyId,
    assetName: prepared.assetName,
    metadata: prepared.metadata,
    prepared,
  };
  let recovered;
  await test("Signed and unsigned packages recover exact bytes and every credit; browser/Node CSL17 parity", async () => {
    recovered = await M.recoverMusicReceipt(C, JSON.stringify(receipt, null, 2));
    assert.deepEqual(recovered.musicRelease, music);
    assert.deepEqual(await M.recoverMusicReceipt(B, receipt), recovered);
    const r = await M.recoverMusicReceipt(C, unsigned);
    assert.deepEqual(r.musicRelease, music);
    assert.equal(r.transaction.packetKind, "unsigned-review");
    assert.equal(r.transaction.paymentWitnessCount, 0);
    assert.equal(recovered.transaction.paymentWitnessCount, 1);
    assert.equal(recovered.identity.policyId, prepared.policyId);
    assert.equal(recovered.identity.assetName, prepared.assetName);
    const raw = C.FixedTransaction.from_hex(signed.hex);
    assert.equal(
      recovered.transaction.hash,
      Buffer.from(blake2b(raw.raw_body(), { dkLen: 32 })).toString("hex"),
    );
    assert.equal(
      recovered.transaction.auxiliaryDataHash,
      Buffer.from(blake2b(raw.raw_auxiliary_data(), { dkLen: 32 })).toString("hex"),
    );
    assert.equal(recovered.receiptObservation.state, "confirmed");
    assert.equal(recovered.receiptObservation.evidence, "receipt-reported");
    assert.equal(recovered.checks.chainInclusion, "not-checked");
    assert.equal(recovered.checks.paymentSignatures, "not-checked");
    assert.equal(recovered.checks.rights, "not-checked");
    assert.ok(Object.isFrozen(recovered.musicRelease.tracks[0].song.artists));
    for (const forbidden of [
      "signedHex",
      "unsignedHex",
      "utxos",
      "changeHex",
      "inputRefs",
      "address",
      "requiredSigners",
    ])
      assert.ok(!JSON.stringify(recovered).includes('"' + forbidden + '"'));
  });
  await test("Imported prepared wallet internals are neither invoked nor returned", async () => {
    let calls = 0;
    const ignored = {
      get secret() {
        calls++;
        throw new Error("must not read");
      },
    };
    const p = { ...receipt, prepared: { ...prepared, wallet: ignored } };
    assert.deepEqual(await M.recoverMusicReceipt(C, p), recovered);
    assert.equal(calls, 0);
  });
  await test("Top-level and prepared claims must match the actual transaction", async () => {
    for (const [key, value] of [
      ["hash", "00".repeat(32)],
      ["metadataProfile", "cip60-v999"],
      ["musicPackageHash", "00".repeat(32)],
      ["policyId", "00".repeat(28)],
      ["assetName", "wrong"],
    ]) {
      await rejects({ ...receipt, [key]: value }, { code: "MISMATCH" });
      await rejects({ ...receipt, prepared: { ...prepared, [key]: value } }, { code: "MISMATCH" });
    }
    await rejects({ ...receipt, bytes: receipt.bytes + 1 }, { code: "MISMATCH" });
    await rejects({ ...receipt, mode: "data" }, { code: "MISMATCH" });
    await rejects({ ...receipt, prepared: { ...prepared, mode: "data" } }, { code: "MISMATCH" });
    const meta = clone(prepared.metadata);
    meta["721"][prepared.policyId][prepared.assetName].release.release_title = "Changed";
    await rejects({ ...receipt, metadata: meta }, { code: "MISMATCH" });
    const wrongMusic = clone(music);
    wrongMusic.tracks[0].song.artists[0].name = "Someone else";
    await rejects({ ...receipt, musicRelease: wrongMusic });
    const wrongBundle = clone(music.bundle);
    wrongBundle.name = "Different name";
    await rejects({ ...receipt, bundle: wrongBundle }, { code: "MISMATCH" });
    const changed = altered(prepared, ({ body }) => body.set_ttl(bn(197151001)));
    await rejects(
      { ...receipt, prepared: { ...prepared, unsignedHex: changed } },
      { code: "MISMATCH" },
    );
    await rejects(
      { ...receipt, prepared: { ...prepared, unsignedHex: signed.hex } },
      { code: "MISMATCH" },
    );
    const noNative = altered(prepared, (ctx) => {
      ctx.witnesses = C.TransactionWitnessSet.new();
    });
    await rejects(
      { ...receipt, prepared: { ...prepared, unsignedHex: noNative } },
      { code: "MISMATCH" },
    );
  });
  await test("Witness presence is distinguished from cryptographic signature verification", async () => {
    await rejects(
      { ...receipt, signedHex: prepared.unsignedHex, bytes: prepared.unsignedHex.length / 2 },
      { code: "MISMATCH" },
    );
    await rejects(review(signed.hex), { code: "MISMATCH" });
    const bad = C.FixedTransaction.from_hex(prepared.unsignedHex);
    bad.add_vkey_witness(
      C.Vkeywitness.new(
        C.Vkey.new(privateKey.to_public()),
        C.Ed25519Signature.from_hex("00".repeat(64)),
      ),
    );
    const unverified = await M.recoverMusicReceipt(C, {
      ...receipt,
      signedHex: bad.to_hex(),
      bytes: bad.to_hex().length / 2,
    });
    assert.equal(unverified.checks.paymentSignatures, "not-checked");
    assert.equal(unverified.status, "verified-local-content");
  });
  await test("Body, auxiliary bytes and actual credit profile are independently bound", async () => {
    const fixed = C.FixedTransaction.from_hex(prepared.unsignedHex);
    const tampered = C.AuxiliaryData.from_hex(
      Buffer.from(fixed.raw_auxiliary_data()).toString("hex"),
    );
    const gm = tampered.metadata();
    gm.insert(bn(674), C.TransactionMetadatum.new_text("extra"));
    tampered.set_metadata(gm);
    fixed.set_auxiliary_data(tampered.to_bytes());
    await rejects(review(fixed.to_hex()), { code: "MISMATCH" });
    const feeChange = altered(prepared, (ctx) => {
      const j = JSON.parse(ctx.body.to_json());
      j.fee = "123456";
      ctx.body = C.TransactionBody.from_json(JSON.stringify(j));
    });
    await rejects({ ...review(feeChange), hash: prepared.hash }, { code: "MISMATCH" });
    for (const edit of [
      (row) => {
        row.music_metadata_version = 4;
      },
      (row) => {
        row.music_profile = "other";
      },
      (row) => {
        row.music_package_sha256 = "00".repeat(32);
      },
      (row) => {
        row.files[0].song.artists[0].name = "Different credit";
      },
      (row) => {
        row.files[0].src[0] = row.files[0].src[0].replace("data:", "xxxx:");
      },
    ]) {
      const data = clone(prepared.metadata),
        row = data["721"][prepared.policyId][prepared.assetName];
      edit(row);
      const next = altered(prepared, ({ body, aux }) => {
        const metadata = C.GeneralTransactionMetadata.new();
        for (const [label, value] of Object.entries(data))
          metadata.insert(
            bn(label),
            C.encode_json_str_to_metadatum(
              JSON.stringify(value),
              C.MetadataJsonSchema.NoConversions,
            ),
          );
        aux.set_metadata(metadata);
        body.set_auxiliary_data_hash(C.hash_auxiliary_data(aux));
      });
      await rejects(review(next));
    }
  });
  await test("Mint identity, policy witness, output recipient and native producer restrictions are enforced", async () => {
    const mutations = [
      ({ body }) => body.set_mint(C.Mint.new()),
      ({ body }) =>
        body.set_mint(
          C.Mint.new_from_entry(
            C.ScriptHash.from_hex(prepared.policyId),
            C.MintAssets.new_from_entry(
              C.AssetName.new(enc.encode(prepared.assetName)),
              C.Int.new_i32(2),
            ),
          ),
        ),
      (ctx) => {
        const j = JSON.parse(ctx.body.to_json());
        j.fee = "2000001";
        ctx.body = C.TransactionBody.from_json(JSON.stringify(j));
      },
      ({ body }) => body.set_network_id(C.NetworkId.testnet()),
      ({ body }) => body.set_validity_start_interval_bignum(bn(1)),
      ({ body }) => body.set_ttl(bn(prepared.expirySlot)),
      (ctx) => {
        ctx.witnesses = C.TransactionWitnessSet.new();
      },
      ({ witnesses }) => {
        const ns = C.NativeScripts.new();
        ns.add(C.NativeScript.new_script_all(C.ScriptAll.new(C.NativeScripts.new())));
        witnesses.set_native_scripts(ns);
      },
    ];
    for (const mutate of mutations) await rejects(review(altered(prepared, mutate)));
    // Reconstructing via CSL JSON permits replacing immutable output/input collections.
    for (const mutate of [
      (j) => {
        j.outputs = [];
      },
      (j) => {
        j.inputs = [];
      },
      (j) => {
        j.outputs[0].address = C.EnterpriseAddress.new(
          0,
          C.Credential.from_keyhash(privateKey.to_public().hash()),
        )
          .to_address()
          .to_bech32();
      },
      (j) => {
        j.inputs[0].transaction_id = "00".repeat(32);
      },
      (j) => {
        for (const output of j.outputs) output.amount.multiasset = null;
      },
      (j) => {
        j.outputs.push(clone(j.outputs[0]));
      },
      (j) => {
        const output = C.TransactionOutput.from_json(JSON.stringify(j.outputs[0]));
        output.set_data_hash(C.DataHash.from_hex("aa".repeat(32)));
        j.outputs[0] = JSON.parse(output.to_json());
      },
    ]) {
      const tx = C.Transaction.from_hex(prepared.unsignedHex),
        j = JSON.parse(tx.body().to_json());
      mutate(j);
      const next = C.Transaction.new(
        C.TransactionBody.from_json(JSON.stringify(j)),
        tx.witness_set(),
        tx.auxiliary_data(),
      ).to_hex();
      await rejects(review(next));
    }
  });
  await test("Ordinary NFT fallback is explicit and cannot swallow a declared music mismatch", async () => {
    const plain = await M.buildStudioTransaction(C, music.bundle, "nft", wallet, protocol);
    await rejects({ schema: "nft-studio.review.v1", ...plain }, { code: "NOT_MUSIC_TRANSACTION" });
    await rejects(
      { schema: "nft-studio.review.v1", ...plain, metadataProfile: M.MUSIC_RELEASE_PROFILE },
      { code: "MISMATCH" },
    );
    await rejects(
      { schema: "nft-studio.review.v1", ...plain, prepared: { musicRelease: music } },
      { code: "MISMATCH" },
    );
    await rejects({ ...unsigned, mode: "data" }, { code: "UNSUPPORTED_PROFILE" });
    await rejects({ ...receipt, schema: "unknown" }, { code: "UNSUPPORTED_PROFILE" });
  });
  await test("Routing reads actual CBOR even without sidecars and preserves large ordinary and legacy inputs", async () => {
    assert.equal(M.routeMusicReceipt(C, receipt), "music");
    assert.equal(M.routeMusicReceipt(B, review(prepared.unsignedHex)), "music");
    const plain = await M.buildStudioTransaction(C, music.bundle, "nft", wallet, protocol);
    assert.equal(
      M.routeMusicReceipt(C, {
        schema: "nft-studio.review.v1",
        ...plain,
        metadata: "x".repeat(1000000),
      }),
      "ordinary-nft",
    );
    assert.throws(
      () =>
        M.routeMusicReceipt(C, {
          schema: "nft-studio.review.v1",
          ...plain,
          musicPackageHash: music.packageHash,
        }),
      { code: "MISMATCH" },
    );
    assert.throws(
      () =>
        M.routeMusicReceipt(C, {
          schema: "nft-studio.receipt.v1",
          kind: "nft",
          musicPackageHash: music.packageHash,
        }),
      { code: "MISMATCH" },
    );
    assert.equal(
      M.routeMusicReceipt(C, {
        schema: "nft-studio.receipt.v1",
        kind: "nft",
        metadata: plain.metadata,
      }),
      "other",
    );
    for (const kind of ["game", "art", "app", "data", "scroll", "book"])
      assert.equal(
        M.routeMusicReceipt(C, {
          schema: "nft-studio.receipt.v1",
          kind,
          signedHex: "invalid",
          metadata: "x".repeat(1000000),
        }),
        "other",
      );
    assert.equal(M.routeMusicReceipt(C, music), "other");
    assert.equal(M.routeMusicReceipt(C, { schema: "beacn.artifact-passport.v1" }), "other");
    const catalog = JSON.parse(
      await readFile(path.join(studio, "lib/arcade-catalog.json"), "utf8"),
    );
    for (const entry of Object.values(catalog))
      assert.equal(
        M.routeMusicReceipt(C, {
          721: {
            [entry.original.policy]: {
              [Buffer.from(entry.original.assetHex, "hex").toString("utf8")]: {
                name: "Frozen catalog",
              },
            },
          },
        }),
        "other",
      );
    // A route is never accepted as verification: strict recovery still checks all original JSON.
    const duplicate = JSON.stringify(receipt).replace('"schema":', '"schema":"wrong","schema":');
    assert.equal(M.routeMusicReceipt(C, JSON.parse(duplicate)), "music");
    await rejects(duplicate, { code: "INVALID_MUSIC_RECEIPT" });
    const oversized = JSON.stringify({ ...receipt, ignored: "x".repeat(512001) });
    assert.equal(M.routeMusicReceipt(C, JSON.parse(oversized)), "music");
    await rejects(oversized, { code: "INVALID_MUSIC_RECEIPT" });
  });
  await test("Receipt declarations and JSON structures are bounded before content recovery", async () => {
    for (const changes of [
      { createdAt: -1 },
      { state: "finalized" },
      { state: "review" },
      { checkedAt: NaN },
      { blocksAfterInclusion: 1.5 },
      { hash: "AA".repeat(32) },
      { bytes: undefined },
    ])
      await rejects({ ...receipt, ...changes });
    for (const raw of [
      '{"schema":"one","schema":"two"}',
      '{"schema":"one","\\u0073chema":"two"}',
      '{"schema":',
      '{"x":1,}',
      "{}{}",
      "[".repeat(26) + "0" + "]".repeat(26),
      '{"x":[' + Array(20001).fill("0").join(",") + "]}",
      " ".repeat(M.MUSIC_RECEIPT_LIMITS.jsonBytes + 1),
    ])
      await rejects(raw);
    let getters = 0;
    await rejects({
      get schema() {
        getters++;
        return "nft-studio.receipt.v1";
      },
    });
    assert.equal(getters, 0);
    await rejects(Object.create({ schema: receipt.schema }));
    await rejects({ ...receipt, metadata: new Date() });
    const cycle = {};
    cycle.self = cycle;
    await rejects({ ...receipt, metadata: cycle });
  });
  await test("Hostile CBOR structures are refused before CSL and do not poison later decoding", async () => {
    let calls = 0;
    const forbiddenCsl = {
      FixedTransaction: {
        from_hex() {
          calls++;
          throw new Error("CSL must not see these");
        },
      },
    };
    const bad = [
      "",
      "0",
      "GG",
      "00".repeat(16385),
      "84a0a0f5f600",
      "841800a0f5f6",
      "84a200000000a0f5f6",
      "84a1180000a0f5f6",
      "84a10063ffffffa0f5f6",
      "84a1005f40ffa0f5f6",
      "84a1009affffffffa0f5f6",
      "84a100" + "81".repeat(17) + "00a0f5f6",
      "84a1009f" + "00".repeat(4097) + "ffa0f5f6",
    ];
    for (const unsignedHex of bad)
      await rejects({ ...review(prepared.unsignedHex), unsignedHex }, undefined, forbiddenCsl);
    assert.equal(calls, 0);
    assert.deepEqual(await M.recoverMusicReceipt(C, receipt), recovered);
  });
  await test("Credit changes produce a distinct recovered package and transaction identity", async () => {
    const composer = { release: clone(music.release), tracks: clone(music.tracks) };
    composer.tracks[0].song.artists[0].name = "Another credited artist";
    const other = await M.createMusicRelease(music.bundle, composer),
      next = await M.buildMusicReleaseTransaction(C, other, wallet, protocol);
    const result = await M.recoverMusicReceipt(C, { schema: "nft-studio.review.v1", ...next });
    assert.equal(result.musicRelease.packageHash, other.packageHash);
    assert.notEqual(result.musicRelease.packageHash, music.packageHash);
    assert.notEqual(result.identity.assetName, recovered.identity.assetName);
    assert.notEqual(result.transaction.auxiliaryDataHash, recovered.transaction.auxiliaryDataHash);
    assert.notEqual(result.transaction.hash, recovered.transaction.hash);
    assert.deepEqual(result.musicRelease.bundle, music.bundle);
  });
  const evidence = {
    schema: "beacn.music-receipt-verification.v1",
    csl: "17.0.0",
    testGroups: passed,
    rejectedCases: rejections,
    fixturePackageHash: music.packageHash,
    measurements: {
      unsignedBytes: prepared.unsignedHex.length / 2,
      signedBytes: signed.bytes,
      metadataBytes: recovered.transaction.metadataBytes,
      receiptJsonBytes: Buffer.byteLength(JSON.stringify(receipt)),
      feeLovelace: prepared.fee,
    },
    syntheticOnly: true,
    privateKeysExported: false,
    providerRequests: 0,
    chainTransactionsSubmitted: 0,
  };
  if (process.env.UPDATE_MUSIC_RECEIPT_EVIDENCE === "1")
    await writeFile(
      path.join(kit, "tests/fixtures/music-receipts/verification.json"),
      JSON.stringify(evidence, null, 2) + "\n",
    );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  Date.now = originalNow;
}
