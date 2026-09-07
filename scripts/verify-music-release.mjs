// Original deterministic media and local CBOR only. No wallet or network operations.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const kit = fileURLToPath(new URL("../", import.meta.url));
const studio = process.env.NFT_STUDIO_TEST_ROOT || kit;
const require = createRequire(path.join(studio, "package.json"));
const { build } = require("esbuild");
const C = require("@emurgo/cardano-serialization-lib-nodejs");
assert.equal(require("@emurgo/cardano-serialization-lib-nodejs/package.json").version, "17.0.0");
const ts = require("typescript");
const compilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
  types: [],
};
const compilerHost = ts.createCompilerHost(compilerOptions);
compilerHost.resolveModuleNames = (names, containing) =>
  names.map((name) =>
    name === "./studio-payload"
      ? { resolvedFileName: path.join(studio, "lib/studio-payload.ts"), extension: ts.Extension.Ts }
      : ts.resolveModuleName(name, containing, compilerOptions, compilerHost).resolvedModule,
  );
const diagnostics = ts.getPreEmitDiagnostics(
  ts.createProgram([path.join(kit, "lib/music-release.ts")], compilerOptions, compilerHost),
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
console.log("PASS strict TypeScript against the real shared Studio payload module");
const compiled = await build({
  stdin: {
    contents: `export * from ${JSON.stringify(path.join(kit, "lib/music-release.ts"))}; export * from ${JSON.stringify(path.join(studio, "lib/studio-payload.ts"))};`,
    resolveDir: kit,
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [
    {
      name: "shared-payload",
      setup(b) {
        b.onResolve({ filter: /^\.\/studio-payload$/ }, () => ({
          path: path.join(studio, "lib/studio-payload.ts"),
        }));
      },
    },
  ],
});
const M = await import(
  "data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64")
);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const clone = (v) => JSON.parse(JSON.stringify(v));
const encoder = new TextEncoder();
const identity = { policyId: "4a".repeat(28), assetName: "BEACNMusic01" };
const fixtures = path.join(kit, "tests/fixtures/music-release");
const svg = await readFile(path.join(fixtures, "cover.svg"));
const wav = await readFile(path.join(fixtures, "one-second.wav"));
const midi = await readFile(path.join(fixtures, "one-second.mid"));
const input = JSON.parse(await readFile(path.join(fixtures, "composer.json"), "utf8"));
const basic = clone(input);
basic.release = { release_type: "Single", release_title: "Signal One" };
basic.tracks = basic.tracks.slice(0, 1);
const bundle = await M.preparePayloadBundle({
  name: "BEACN Signal Study",
  description: "Original synthetic music metadata fixture; not an issued release.",
  coverIndex: 0,
  files: [
    { name: "cover.svg", mediaType: "image/svg+xml", bytes: svg },
    { name: "one-second.wav", mediaType: "audio/wav", bytes: wav },
  ],
});
const multipleBundle = await M.preparePayloadBundle({
  name: bundle.name,
  description: bundle.description,
  coverIndex: 0,
  files: [
    { name: "cover.svg", mediaType: "image/svg+xml", bytes: svg },
    { name: "one-second.wav", mediaType: "audio/wav", bytes: wav },
    { name: "one-second.mid", mediaType: "audio/midi", bytes: midi },
  ],
});
let assertions = 0;
function ok(value, message) {
  assertions++;
  assert.ok(value, message);
}
async function reject(fn, pattern = /./) {
  assertions++;
  await assert.rejects(fn, pattern);
}
function rejects(fn, pattern = /./) {
  assertions++;
  assert.throws(fn, pattern);
}
const positive = [];
async function roundtrip(id, payload, composer, asset = identity) {
  const before = JSON.stringify(payload);
  const packageBefore = JSON.stringify(composer);
  const pkg = await M.createMusicRelease(payload, composer);
  ok(
    Object.isFrozen(pkg) &&
      Object.isFrozen(pkg.bundle.files) &&
      Object.isFrozen(pkg.tracks[0].song),
    "deeply immutable output",
  );
  const serialized = await M.musicReleaseBytes(pkg);
  assert.deepEqual(await M.parseMusicRelease(new TextDecoder().decode(serialized)), pkg);
  assertions++;
  const result = await M.musicReleaseMetadata(pkg, asset);
  const cslGeneral = C.GeneralTransactionMetadata.new();
  cslGeneral.insert(
    C.BigNum.from_str("721"),
    C.encode_json_str_to_metadatum(
      JSON.stringify(result.metadata["721"]),
      C.MetadataJsonSchema.NoConversions,
    ),
  );
  const generalHex = cslGeneral.to_hex();
  assert.equal(generalHex, result.metadataCborHex, "independent TS bytes equal pinned CSL bytes");
  assertions++;
  const aux = C.AuxiliaryData.new();
  aux.set_metadata(cslGeneral);
  assert.deepEqual(await M.recoverMusicRelease(result.metadata, asset), pkg);
  assertions++;
  const plainRecovered = await M.recoverPayloadMetadata(result.metadata, asset);
  assert.equal(plainRecovered.bundle.sha256, payload.sha256);
  assertions++;
  for (let i = 0; i < payload.files.length; i++) {
    assert.equal(plainRecovered.bundle.files[i].uri, payload.files[i].uri);
    assertions++;
    assert.equal(sha(plainRecovered.files[i].bytes), payload.files[i].sha256);
    assertions++;
  }
  assert.equal(JSON.stringify(payload), before);
  assertions++;
  assert.equal(JSON.stringify(composer), packageBefore);
  assertions++;
  positive.push({
    id,
    identity: asset,
    package: pkg,
    metadata: result.metadata,
    canonicalPackageSha256: sha(serialized),
    metadataCborHex: generalHex,
    metadataCborBytes: generalHex.length / 2,
    auxiliaryCborHex: aux.to_hex(),
    auxiliaryCborBytes: aux.to_bytes().length,
    auxiliaryHash: C.hash_auxiliary_data(aux).to_hex(),
  });
  return { pkg, result };
}
const single = await roundtrip("single-wave", bundle, basic);
const multiple = await roundtrip("multiple-wave-midi", multipleBundle, input);
const unicode = clone(basic);
unicode.tracks[0].song.song_title = "🎵".repeat(48);
await roundtrip("unicode-title-boundary", bundle, unicode, {
  ...identity,
  assetName: "🎵".repeat(8),
});
const reverse = clone(input);
reverse.tracks.reverse();
const reversed = await M.createMusicRelease(multipleBundle, reverse);
assert.equal(reversed.packageHash, multiple.pkg.packageHash);
assertions++;
ok(
  multiple.pkg.tracks[0].song.track_number < multiple.pkg.tracks[1].song.track_number,
  "track records sort numerically while bundle file order stays exact",
);
console.log("PASS exact media/package/metadata roundtrips and independent CSL byte parity");

const invalidComposer = [
  [
    "unknown release field",
    (v) => {
      v.release.unexpected = 1;
    },
  ],
  [
    "unknown song field",
    (v) => {
      v.tracks[0].song.royalty = "50%";
    },
  ],
  [
    "ambiguous explicit Boolean",
    (v) => {
      v.tracks[0].song.explicit = true;
    },
  ],
  [
    "ambiguous explicit string",
    (v) => {
      v.tracks[0].song.explicit = "true";
    },
  ],
  [
    "ambiguous AI Boolean",
    (v) => {
      v.tracks[0].song.ai_generated = false;
    },
  ],
  [
    "unsupported Album EP",
    (v) => {
      v.release.release_type = "Album/EP";
    },
  ],
  [
    "unknown release type",
    (v) => {
      v.release.release_type = "LP";
    },
  ],
  [
    "release title too long UTF8",
    (v) => {
      v.release.release_title = "🎵".repeat(17);
    },
  ],
  [
    "song title too long UTF8",
    (v) => {
      v.tracks[0].song.song_title = "🎵".repeat(49);
    },
  ],
  [
    "lone surrogate",
    (v) => {
      v.release.release_title = "\ud800";
    },
  ],
  [
    "blank artist",
    (v) => {
      v.tracks[0].song.artists[0].name = "";
    },
  ],
  [
    "controls",
    (v) => {
      v.tracks[0].song.artists[0].name = "a\nb";
    },
  ],
  [
    "surrounding whitespace",
    (v) => {
      v.tracks[0].song.artists[0].name = " Artist";
    },
  ],
  [
    "missing copyright",
    (v) => {
      delete v.tracks[0].song.copyright;
    },
  ],
  [
    "missing master",
    (v) => {
      delete v.tracks[0].song.copyright.master;
    },
  ],
  [
    "missing composition",
    (v) => {
      delete v.tracks[0].song.copyright.composition;
    },
  ],
  [
    "old string copyright",
    (v) => {
      v.tracks[0].song.copyright = "Unknown";
    },
  ],
  [
    "empty artists",
    (v) => {
      v.tracks[0].song.artists = [];
    },
  ],
  [
    "too many artists",
    (v) => {
      v.tracks[0].song.artists = Array.from({ length: 5 }, () => ({ name: "A" }));
    },
  ],
  [
    "four genres",
    (v) => {
      v.tracks[0].song.genres = ["a", "b", "c", "d"];
    },
  ],
  [
    "repeated genre",
    (v) => {
      v.tracks[0].song.genres = ["a", "a"];
    },
  ],
  [
    "zero track",
    (v) => {
      v.tracks[0].song.track_number = 0;
    },
  ],
  [
    "fractional track",
    (v) => {
      v.tracks[0].song.track_number = 1.5;
    },
  ],
  [
    "string track",
    (v) => {
      v.tracks[0].song.track_number = "1";
    },
  ],
  [
    "unbound filename",
    (v) => {
      v.tracks[0].fileName = "elsewhere.wav";
    },
  ],
  [
    "zero duration",
    (v) => {
      v.tracks[0].song.song_duration = "PT0S";
    },
  ],
  [
    "empty duration",
    (v) => {
      v.tracks[0].song.song_duration = "PT";
    },
  ],
  [
    "fractional duration outside profile",
    (v) => {
      v.tracks[0].song.song_duration = "PT0.5S";
    },
  ],
  [
    "calendar duration",
    (v) => {
      v.tracks[0].song.song_duration = "P1D";
    },
  ],
  [
    "duration too long",
    (v) => {
      v.tracks[0].song.song_duration = "PT24H";
    },
  ],
  [
    "seconds overflow",
    (v) => {
      v.tracks[0].song.song_duration = "PT60S";
    },
  ],
  [
    "invalid date",
    (v) => {
      v.release.release_date = "2026-02-30";
    },
  ],
  [
    "invalid leap date",
    (v) => {
      v.release.release_date = "2025-02-29";
    },
  ],
  [
    "catalog number numeric prose conflict",
    (v) => {
      v.release.catalog_number = 123;
    },
  ],
  [
    "http URL",
    (v) => {
      v.tracks[0].song.artists[0].links = { website: "http://example.com" };
    },
  ],
  [
    "credential URL",
    (v) => {
      v.tracks[0].song.artists[0].links = { website: "https://user:pass@example.com" };
    },
  ],
  [
    "script URL",
    (v) => {
      v.tracks[0].song.lyrics = "javascript:alert(1)";
    },
  ],
  [
    "long unchunkable link",
    (v) => {
      v.tracks[0].song.artists[0].links = { website: "https://example.com/" + "a".repeat(50) };
    },
  ],
  [
    "author incomplete shares",
    (v) => {
      v.tracks[0].song.authors = [{ name: "A", share: "99.99%" }];
    },
  ],
  [
    "author excess shares",
    (v) => {
      v.tracks[0].song.authors = [{ name: "A", share: "100.01%" }];
    },
  ],
  [
    "author zero share",
    (v) => {
      v.tracks[0].song.authors = [
        { name: "A", share: "0%" },
        { name: "B", share: "100%" },
      ];
    },
  ],
  [
    "author missing share",
    (v) => {
      v.tracks[0].song.authors = [{ name: "A" }];
    },
  ],
  [
    "author role conflicts with CDDL",
    (v) => {
      v.tracks[0].song.authors = [{ name: "A", share: "100%", role: "Composer" }];
    },
  ],
  [
    "share float number",
    (v) => {
      v.tracks[0].song.authors = [{ name: "A", share: 100 }];
    },
  ],
  [
    "share too precise",
    (v) => {
      v.tracks[0].song.authors = [{ name: "A", share: "100.000%" }];
    },
  ],
  [
    "invalid ISNI syntax",
    (v) => {
      v.tracks[0].song.artists[0].isni = "Invented";
    },
  ],
  [
    "invalid ISRC syntax",
    (v) => {
      v.tracks[0].song.isrc = "made up";
    },
  ],
  [
    "invalid ISWC syntax",
    (v) => {
      v.tracks[0].song.iswc = "T-123456789-Z";
    },
  ],
  [
    "contributors too many",
    (v) => {
      v.tracks[0].song.contributing_artists = Array.from({ length: 9 }, () => ({ name: "A" }));
    },
  ],
  [
    "contributor role string",
    (v) => {
      v.tracks[0].song.contributing_artists = [{ name: "A", role: "synth" }];
    },
  ],
  [
    "language outside profile",
    (v) => {
      v.tracks[0].song.language = "english";
    },
  ],
  [
    "empty tracks",
    (v) => {
      v.tracks = [];
    },
  ],
  [
    "duplicate audio record",
    (v) => {
      v.tracks.push(clone(v.tracks[0]));
    },
  ],
];
const negativeComposerFixtures = [];
for (const [label, mutate] of invalidComposer) {
  const value = clone(basic);
  mutate(value);
  negativeComposerFixtures.push({ label, composer: value });
  await reject(() => M.createMusicRelease(bundle, value));
}
const duplicateNumbers = clone(input);
duplicateNumbers.tracks[1].song.track_number = duplicateNumbers.tracks[0].song.track_number;
await reject(() => M.createMusicRelease(multipleBundle, duplicateNumbers));
const singleMultipleFiles = clone(input);
singleMultipleFiles.release.release_type = "Single";
await reject(() => M.createMusicRelease(multipleBundle, singleMultipleFiles));
const missingRecord = clone(input);
missingRecord.tracks.pop();
await reject(() => M.createMusicRelease(multipleBundle, missingRecord));
console.log(`PASS ${invalidComposer.length + 3} malformed or unsupported composer profiles`);

const badBundles = [
  (v) => {
    v.cover = false;
  },
  (v) => {
    v.files[0].mediaType = "audio/wav";
  },
  (v) => {
    v.files[1].mediaType = "text/html";
  },
  (v) => {
    v.files[1].uri = "https://example.com/audio.wav";
  },
  (v) => {
    v.files[1].sha256 = "00".repeat(32);
  },
  (v) => {
    v.files[1].bytes++;
  },
  (v) => {
    v.files[1].uri += "=";
  },
  (v) => {
    v.bytes++;
  },
  (v) => {
    v.sha256 = "00".repeat(32);
  },
  (v) => {
    v.extra = true;
  },
  (v) => {
    v.files[1].extra = true;
  },
  (v) => {
    v.description = null;
  },
  (v) => {
    v.description = 0;
  },
  (v) => {
    v.files[0].mediaType = 3;
  },
  (v) => {
    v.files[1].uri = 3;
  },
];
for (const mutate of badBundles) {
  const b = clone(bundle);
  mutate(b);
  await reject(() => M.createMusicRelease(b, basic));
}
const changedPackage = clone(single.pkg);
changedPackage.tracks[0].song.artists[0].name = "Changed";
await reject(() => M.verifyMusicRelease(changedPackage), /hash/);
const changedMetadata = clone(single.result.metadata);
changedMetadata["721"][identity.policyId][identity.assetName].files[0].song.artists[0].name =
  "Changed";
await reject(() => M.recoverMusicRelease(changedMetadata, identity), /hash/);
const extraMetadata = clone(single.result.metadata);
extraMetadata["721"][identity.policyId][identity.assetName].extra = "unbound";
await reject(() => M.recoverMusicRelease(extraMetadata, identity), /representation/);
const wrongVersion = clone(single.result.metadata);
wrongVersion["721"][identity.policyId][identity.assetName].music_metadata_version = "3";
await reject(() => M.recoverMusicRelease(wrongVersion, identity));
await reject(() =>
  M.recoverMusicRelease(single.result.metadata, { ...identity, assetName: "Other" }),
);
await reject(() => M.musicReleaseMetadata(single.pkg, { ...identity, policyId: "00".repeat(27) }));
await reject(() => M.musicReleaseMetadata(single.pkg, { ...identity, assetName: "🎵".repeat(9) }));
await reject(() => M.musicReleaseMetadata(single.pkg, { ...identity, assetName: "\ud800" }));
console.log("PASS file/credits/identity tampering and strict adapter recovery");

let invoked = 0;
const accessor = clone(basic);
Object.defineProperty(accessor.release, "release_title", {
  enumerable: true,
  get() {
    invoked++;
    return "Surprise";
  },
});
await reject(() => M.createMusicRelease(bundle, accessor));
assert.equal(invoked, 0);
assertions++;
const customArray = clone(basic);
Object.defineProperty(customArray.tracks, "map", {
  value() {
    invoked++;
    return [];
  },
});
await reject(() => M.createMusicRelease(bundle, customArray));
assert.equal(invoked, 0);
assertions++;
const sparse = clone(basic);
sparse.tracks.length = 2;
await reject(() => M.createMusicRelease(bundle, sparse));
const withPrototype = clone(basic);
Object.setPrototypeOf(withPrototype.release, { release_title: "Inherited" });
await reject(() => M.createMusicRelease(bundle, withPrototype));
const symbol = clone(basic);
symbol[Symbol("hidden")] = true;
await reject(() => M.createMusicRelease(bundle, symbol));
const largeArray = clone(basic);
largeArray.tracks = Array(5000).fill(null);
await reject(() => M.createMusicRelease(bundle, largeArray));
let deep = {};
for (let i = 0; i < 30; i++) deep = { next: deep };
await reject(() => M.verifyMusicRelease(deep));
await reject(() => M.parseMusicRelease(" ".repeat(80001)));
await reject(() => M.parseMusicRelease("{"));
const mutableBundle = clone(bundle),
  mutableComposer = clone(basic);
const pending = M.createMusicRelease(mutableBundle, mutableComposer);
mutableComposer.tracks[0].song.artists[0].name = "Mutated after call";
mutableBundle.name = "Mutated after call";
assert.equal((await pending).packageHash, single.pkg.packageHash);
assertions++;
console.log("PASS bounded plain values and pre-await snapshot isolation");

rejects(() => M.musicMetadataCbor({ 721: { flag: true } }), /Boolean/);
rejects(() => M.musicMetadataCbor({ 721: { flag: null } }), /Boolean/);
rejects(() => M.musicMetadataCbor({ 721: { text: "a".repeat(65) } }), /64/);
rejects(() => M.musicMetadataCbor({ 721: { text: "🎵".repeat(17) } }), /64/);
rejects(() => M.musicMetadataCbor({ 721: { value: 1.5 } }));
rejects(() => M.musicMetadataCbor({ 721: { data: Array(250).fill("a".repeat(64)) } }), /14,000/);
rejects(() =>
  C.encode_json_str_to_metadatum('{"explicit":true}', C.MetadataJsonSchema.NoConversions),
);
rejects(() =>
  C.encode_json_str_to_metadatum('{"explicit":false}', C.MetadataJsonSchema.NoConversions),
);
const integerCases = [
  0, 1, 23, 24, 255, 256, 65535, 65536, 0xffffffff, -1, -24, -25, -256, -257, -65536, -65537,
];
for (const n of integerCases) {
  const v = { 721: { number: n, text: "🎵".repeat(16), empty: [], map: {} } };
  const general = C.GeneralTransactionMetadata.new();
  general.insert(
    C.BigNum.from_str("721"),
    C.encode_json_str_to_metadatum(JSON.stringify(v["721"]), C.MetadataJsonSchema.NoConversions),
  );
  assert.equal(Buffer.from(M.musicMetadataCbor(v)).toString("hex"), general.to_hex());
  assertions++;
}
console.log("PASS ledger primitive boundaries, actual CSL Boolean rejection and metadata cap");

const raw = await M.musicReleaseBytes(single.pkg);
await reject(() => M.parseMusicRelease(JSON.stringify(single.pkg, null, 2)), /canonical/);
await reject(
  () =>
    M.parseMusicRelease(
      new TextDecoder().decode(raw).replace('"schema":', '"schema":"ignored","schema":'),
    ),
  /canonical/,
);
const budget = await M.musicReleaseBudget(single.pkg);
assert.equal(
  budget.metadataBytesAt32ByteAssetName,
  single.result.metadataCborBytes + 32 - encoder.encode(identity.assetName).length + 1,
);
assertions++;
assert.equal(budget.completeTransactionMeasured, false);
assertions++;
const largeAudio = Buffer.alloc(11800, 128);
wav.copy(largeAudio, 0, 0, 44);
largeAudio.writeUInt32LE(largeAudio.length - 8, 4);
largeAudio.writeUInt32LE(largeAudio.length - 44, 40);
const largeBundle = await M.preparePayloadBundle({
  name: bundle.name,
  coverIndex: 0,
  files: [
    { name: "cover.svg", mediaType: "image/svg+xml", bytes: svg },
    { name: "one-second.wav", mediaType: "audio/wav", bytes: largeAudio },
  ],
});
await reject(() => M.createMusicRelease(largeBundle, basic), /14,000/);
for (let i = 0; i < 128; i++) {
  const changed = clone(single.pkg);
  const pos = i % changed.packageHash.length;
  changed.packageHash =
    changed.packageHash.slice(0, pos) +
    (changed.packageHash[pos] === "0" ? "1" : "0") +
    changed.packageHash.slice(pos + 1);
  await reject(() => M.verifyMusicRelease(changed), /hash/);
}
const output = {
  schema: "beacn.music-release.test-evidence.v1",
  cslVersion: "17.0.0",
  sourceBundleModuleSha256: sha(await readFile(path.join(studio, "lib/studio-payload.ts"))),
  positive,
  checks: {
    assertions,
    malformedComposerProfiles: invalidComposer.length + 3,
    mutatedChecksums: 128,
  },
  boundaries: {
    chainInclusion: false,
    walletAcceptance: false,
    playerCompatibility: false,
    signatureVerification: false,
    audioDecodeVerification: false,
    rightsVerification: false,
    strictCip60V3CddlConformance: false,
  },
};
const outputDir = process.env.MUSIC_EVIDENCE_DIR || fixtures;
if (process.argv.includes("--write-fixtures")) {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "roundtrips.json"), JSON.stringify(output, null, 2) + "\n");
  await writeFile(path.join(outputDir, "single.music-release.json"), raw);
  await writeFile(
    path.join(outputDir, "negative-composers.json"),
    JSON.stringify(negativeComposerFixtures, null, 2) + "\n",
  );
} else {
  assert.deepEqual(
    JSON.parse(await readFile(path.join(outputDir, "roundtrips.json"), "utf8")),
    output,
    "pinned fixture and measurement receipt",
  );
  assert.deepEqual(
    new Uint8Array(await readFile(path.join(outputDir, "single.music-release.json"))),
    raw,
    "pinned canonical package",
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(outputDir, "negative-composers.json"), "utf8")),
    negativeComposerFixtures,
    "pinned malformed composer fixtures",
  );
}
console.log(
  JSON.stringify(
    {
      status: "pass",
      ...output.checks,
      cslVersion: output.cslVersion,
      fixtures: positive.map((v) => ({
        id: v.id,
        rawFiles: v.package.bundle.bytes,
        metadataCborBytes: v.metadataCborBytes,
        auxiliaryCborBytes: v.auxiliaryCborBytes,
        packageHash: v.package.packageHash,
      })),
    },
    null,
    2,
  ),
);
