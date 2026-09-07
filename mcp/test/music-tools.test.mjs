import test from "node:test";
import assert from "node:assert/strict";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { build } from "esbuild";
import * as C from "@emurgo/cardano-serialization-lib-nodejs";
import { createService } from "../dist/server.mjs";
import { createHttpService } from "../dist/http.mjs";
import { createPublicMcpHandler } from "./workerd-helper.mjs";
import { PUBLIC_TOOL_NAMES, NODE_TOOL_NAMES } from "../integration/tool-names.mjs";
import {
  verifyMusicTools,
  loadMusicToolFixture,
  assertMusicToolResult,
} from "../integration/verify-music-tools.mjs";
import { address, utxo } from "./wallet-fixtures.mjs";
const token = "music-fixture-local-only-token-0000000000000000000000";
const clone = (value) => JSON.parse(JSON.stringify(value));
const checked = (result) => {
  assert.ok(!result.isError, result.content?.[0]?.text);
  return result.structuredContent || JSON.parse(result.content[0].text);
};
async function reject(client, name, args) {
  let rejected = false;
  try {
    rejected = (await client.callTool({ name, arguments: args })).isError === true;
  } catch {
    rejected = true;
  }
  assert.ok(rejected, "Unexpected accepted music input");
}
async function exercise(client, tools) {
  assert.ok(
    tools.find((t) => t.name === "create_music_release").inputSchema.additionalProperties === false,
  );
  assert.ok(
    tools.find((t) => t.name === "verify_music_release").inputSchema.additionalProperties === false,
  );
  const summary = await verifyMusicTools(client, tools),
    { args } = loadMusicToolFixture();
  const full = clone(args),
    song = full.tracks[0].song;
  full.release = {
    ...full.release,
    release_date: "2026-09-07",
    publication_date: "2026-09-07",
    catalog_number: "MCP-001",
    visual_artist: "Fixture artist",
    distributor: "https://example.invalid/distributor",
    series: "Signals",
    collection: "Synthetic",
  };
  song.artists[0] = {
    ...song.artists[0],
    isni: "000000000000000X",
    links: { site: "https://artist.invalid/a" },
  };
  song.featured_artists = [
    { name: "Featured fixture", links: { site: "https://featured.invalid/" } },
  ];
  song.contributing_artists = [
    {
      name: "Drum fixture",
      ipi: "123456789",
      ipn: "1234",
      role: ["Drums"],
      links: { site: "https://credit.invalid/" },
    },
  ];
  song.authors = [
    { name: "Author A", share: "33.33%", ipi: "123456789" },
    { name: "Author B", share: "66.67%" },
  ];
  Object.assign(song, {
    mood: "Calm",
    set: "One",
    lyrics: "https://lyrics.invalid/1",
    special_thanks: ["Listener"],
    bitrate: "MIDI events",
    bpm: "120",
    mix_engineer: "Mix fixture",
    mastering_engineer: "Master fixture",
    producer: "Producer fixture",
    co_producer: "Coproducer fixture",
    recording_engineer: "Engineer fixture",
    isrc: "US-AAA-26-00001",
    iswc: "T-123456789-0",
    metadata_language: "en",
    country_of_origin: "US",
    language: "en",
    derived_from: "Original synthetic source",
  });
  const created = checked(await client.callTool({ name: "create_music_release", arguments: full }));
  assertMusicToolResult(created, full);
  const verified = checked(
    await client.callTool({
      name: "verify_music_release",
      arguments: { packetJson: created.packetJson },
    }),
  );
  assert.deepEqual(verified.musicRelease, created.musicRelease);
  assert.notEqual(created.packageHash, summary.packageHash);
  assert.equal(created.processing.declaredLinksFetched, false);
  const names = [
    "wallet",
    "recipient",
    "policyId",
    "assetName",
    "unsignedHex",
    "path",
    "url",
    "mediaUrl",
    "providerUrl",
    "reviewUrl",
    "mode",
    "bundle",
    "musicRelease",
    "composer",
    "instructions",
  ];
  for (const name of names)
    await reject(client, "create_music_release", { ...args, [name]: "not allowed" });
  const invalid = [];
  function variant(change) {
    const v = clone(args);
    change(v);
    invalid.push(v);
  }
  variant((v) => {
    v.files[0].base64 = "https://media.invalid/cover";
  });
  variant((v) => {
    v.files[0].base64 = "AB==";
  });
  variant((v) => {
    v.files[0].name = "../cover.svg";
  });
  variant((v) => {
    v.files[1].mediaType = "audio/wav";
  });
  variant((v) => {
    v.files.pop();
  });
  variant((v) => {
    v.coverIndex = 1;
  });
  variant((v) => {
    v.files[1].path = "file:///tmp/track";
  });
  variant((v) => {
    v.files[1].base64 = Buffer.alloc(12001).toString("base64");
  });
  variant((v) => {
    v.release.release_type = "Album";
  });
  variant((v) => {
    v.release.extra = true;
  });
  variant((v) => {
    v.release.release_date = "2026-02-30";
  });
  variant((v) => {
    v.release.distributor = "javascript:alert(1)";
  });
  variant((v) => {
    v.tracks[0].fileName = "different.mid";
  });
  variant((v) => {
    v.tracks[0].song.artists[0].name = "🦾".repeat(17);
  });
  variant((v) => {
    v.tracks[0].song.song_title = "🦾".repeat(49);
  });
  variant((v) => {
    v.tracks[0].song.song_duration = "PT0S";
  });
  variant((v) => {
    v.tracks[0].song.track_number = 0;
  });
  variant((v) => {
    v.tracks[0].song.track_number = "1";
  });
  variant((v) => {
    v.tracks[0].song.explicit = true;
  });
  variant((v) => {
    v.tracks[0].song.copyright.rightsVerified = true;
  });
  variant((v) => {
    v.tracks[0].song.artists[0].role = ["Owner"];
  });
  variant((v) => {
    v.tracks[0].song.artists[0].links = { site: "http://artist.invalid/" };
  });
  variant((v) => {
    v.tracks[0].song.artists[0].links = {
      a: "https://a.invalid/",
      b: "https://b.invalid/",
      c: "https://c.invalid/",
      d: "https://d.invalid/",
    };
  });
  variant((v) => {
    v.tracks[0].song.authors = [{ name: "Author", share: "99.99%" }];
  });
  variant((v) => {
    v.tracks[0].song.authors = [{ name: "Author", share: "100%", role: "Songwriter" }];
  });
  variant((v) => {
    v.tracks[0].song.contributing_artists = [{ name: "Someone", role: ["Drums", "Drums"] }];
  });
  variant((v) => {
    v.tracks[0].song.genres = ["Electronic", "Electronic"];
  });
  variant((v) => {
    v.tracks[0].song.lyrics = "data:text/plain,lyrics";
  });
  variant((v) => {
    v.tracks[0].song.special_thanks = ["\ud800"];
  });
  variant((v) => {
    v.tracks.push(clone(v.tracks[0]));
  });
  for (const value of invalid) await reject(client, "create_music_release", value);
  for (const packetJson of [
    created.packetJson + "\n",
    JSON.stringify(created.musicRelease, null, 2),
    created.packetJson.replace('"schema":', '"schema":"duplicate","schema":'),
    created.packetJson.replace(created.packageHash, "00".repeat(32)),
    "{}",
    "x".repeat(80001),
  ])
    await reject(client, "verify_music_release", { packetJson });
  await reject(client, "verify_music_release", {
    packetJson: created.packetJson,
    url: "https://media.invalid/",
  });
  await reject(client, "verify_music_release", { musicRelease: created.musicRelease });
  await reject(client, "verify_mint_intent", { intent: created.musicRelease });
  await reject(client, "create_mint_intent", { ...args, mode: "nft" });
  await reject(client, "prepare_unsigned_transaction", {
    intent: created.musicRelease,
    wallet: { changeHex: address().to_hex(), utxos: [utxo(1)] },
  });
  const final = checked(await client.callTool({ name: "create_music_release", arguments: args }));
  assert.equal(final.packageHash, summary.packageHash);
  const caps = checked(await client.callTool({ name: "studio_capabilities", arguments: {} }));
  assert.deepEqual(caps.musicReleases.tools, ["create_music_release", "verify_music_release"]);
  assert.equal(caps.musicReleases.transactionPreparation, false);
  assert.equal(caps.musicReleases.reviewUrl, created.review.url);
  return { rejectedCases: names.length + invalid.length + 11, summary };
}
for (const mode of ["auto", "legacy"]) {
  test(
    "Music Node " +
      mode +
      " SDK preserves all fields and rejects service expansion without provider reads",
    async () => {
      let reads = 0;
      const service = createService({
          protocol: async () => {
            reads++;
            throw new Error("Music tools must not read a provider.");
          },
        }),
        http = createHttpService({ port: 0, token, service, rateLimit: 1000 });
      const at = await http.listen();
      const client = new Client(
        { name: "music-node-test", version: "1.0.0" },
        { versionNegotiation: { mode } },
      );
      try {
        await client.connect(
          new StreamableHTTPClientTransport(new URL("http://127.0.0.1:" + at.port + "/mcp"), {
            requestInit: { headers: { Authorization: "Bearer " + token } },
          }),
        );
        const tools = (await client.listTools()).tools;
        assert.deepEqual(tools.map((t) => t.name).sort(), NODE_TOOL_NAMES);
        assert.ok((await exercise(client, tools)).rejectedCases >= 50);
        assert.equal(reads, 0);
        assert.equal(service.packetCount(), 0);
      } finally {
        await client.close();
        await http.close();
        service.close();
      }
    },
  );
  test(
    "Music Workerd " +
      mode +
      " SDK works with provider unavailable and does not fetch declared links",
    async () => {
      const handler = await createPublicMcpHandler({
        publicOrigin: "https://music.example.org",
        rateLimit: 1000,
        studioUrl: "https://review.example.org/",
      });
      handler.setScenario("unavailable");
      const client = new Client(
        { name: "music-worker-test", version: "1.0.0" },
        { versionNegotiation: { mode } },
      );
      try {
        await client.connect(
          new StreamableHTTPClientTransport(new URL("https://music.example.org/mcp"), {
            fetch: (url, init) => handler.dispatchFetch(url, init),
          }),
        );
        const tools = (await client.listTools()).tools;
        assert.deepEqual(tools.map((t) => t.name).sort(), PUBLIC_TOOL_NAMES);
        assert.ok((await exercise(client, tools)).rejectedCases >= 50);
        assert.equal(handler.calls.length, 0);
      } finally {
        await client.close();
        await handler.close();
      }
    },
  );
}
test("Actual stdio exposes pure music packages and protocol-only stdout", async () => {
  const transport = new StdioClientTransport({
      command: process.execPath,
      args: [fileURLToPath(new URL("../dist/cli.mjs", import.meta.url))],
      stderr: "pipe",
    }),
    client = new Client({ name: "music-stdio-test", version: "1.0.0" });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => {
    stderr += chunk;
  });
  try {
    await client.connect(transport);
    const tools = (await client.listTools()).tools;
    assert.deepEqual(tools.map((t) => t.name).sort(), NODE_TOOL_NAMES);
    assert.equal((await verifyMusicTools(client, tools)).packageOnly, true);
  } finally {
    await client.close();
  }
  assert.equal(stderr, "");
});
test("Pure music boundary snapshots hostile objects, preserves ordering and measures actual CSL metadata", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url)),
    mcp = resolve(root, "mcp");
  const built = await build({
    stdin: {
      contents: `export * from ${JSON.stringify(resolve(mcp, "src/music-tools.mjs"))};export {musicReleaseMetadata} from ${JSON.stringify(resolve(root, "lib/music-release.ts"))};`,
      resolveDir: mcp,
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    preserveSymlinks: true,
    nodePaths: [resolve(mcp, "node_modules")],
    plugins: [
      {
        name: "shared-music-boundary",
        setup(b) {
          b.onResolve({ filter: /^@studio\// }, (a) => ({
            path: resolve(root, "lib", a.path.slice(8)),
          }));
          b.onResolve({ filter: /^@\/lib\// }, (a) => ({
            path: resolve(root, "lib", a.path.slice(6) + ".ts"),
          }));
        },
      },
    ],
  });
  const M = await import(
    "data:text/javascript;base64," + Buffer.from(built.outputFiles[0].text).toString("base64")
  );
  const { args } = loadMusicToolFixture(),
    pending = M.createMusicPackage(args);
  args.name = "Changed after call";
  args.files[1].base64 = "AB==";
  const original = await pending;
  assert.equal(original.musicRelease.bundle.name, "Music MCP fixture");
  let calls = 0;
  const getter = { ...loadMusicToolFixture().args };
  Object.defineProperty(getter, "name", {
    enumerable: true,
    get() {
      calls++;
      return "Surprise";
    },
  });
  await assert.rejects(M.createMusicPackage(getter));
  assert.equal(calls, 0);
  const nested = loadMusicToolFixture().args;
  Object.defineProperty(nested.tracks[0].song, "artists", {
    enumerable: true,
    get() {
      calls++;
      return [];
    },
  });
  await assert.rejects(M.createMusicPackage(nested));
  assert.equal(calls, 0);
  const extended = loadMusicToolFixture().args;
  extended.files.extra = "hidden";
  await assert.rejects(M.createMusicPackage(extended));
  const sparse = loadMusicToolFixture().args;
  delete sparse.files[0];
  await assert.rejects(M.createMusicPackage(sparse));
  await assert.rejects(M.createMusicPackage(Object.create({ name: "Inherited" })));
  await assert.rejects(M.verifyMusicPackage({ packetJson: '"'.repeat(80000) }));
  const multi = loadMusicToolFixture().args;
  multi.release.release_type = "Multiple";
  multi.files.push({ ...multi.files[1], name: "second.mid" });
  multi.tracks.unshift({
    fileName: "second.mid",
    song: { ...clone(multi.tracks[0].song), song_title: "Second exact track", track_number: 2 },
  });
  const result = await M.createMusicPackage(multi);
  assert.deepEqual(
    result.musicRelease.tracks.map((t) => t.song.track_number),
    [1, 2],
  );
  assert.deepEqual(
    result.musicRelease.bundle.files.map((f) => f.name),
    ["cover.svg", "signal.mid", "second.mid"],
  );
  const { metadata } = await M.musicReleaseMetadata(result.musicRelease, {
      policyId: "0".repeat(56),
      assetName: "0".repeat(32),
    }),
    general = C.GeneralTransactionMetadata.new();
  for (const [label, row] of Object.entries(metadata))
    general.insert(
      C.BigNum.from_str(label),
      C.encode_json_str_to_metadatum(JSON.stringify(row), C.MetadataJsonSchema.NoConversions),
    );
  assert.equal(general.to_bytes().length, result.budget.metadataBytesAt32ByteAssetName);
  assert.equal(result.budget.completeTransactionMeasured, false);
});
