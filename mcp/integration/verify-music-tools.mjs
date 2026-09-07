/** Read-only live-check component. Sends only this repository's original synthetic music fixture. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const checked = (result) => {
  assert.ok(!result.isError, result.content?.[0]?.text);
  return result.structuredContent || JSON.parse(result.content[0].text);
};
const canonical = (value) =>
  JSON.stringify(
    value && typeof value === "object"
      ? Array.isArray(value)
        ? value.map((v) => JSON.parse(canonical(v)))
        : Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((k) => [k, JSON.parse(canonical(value[k]))]),
          )
      : value,
  );
export function loadMusicToolFixture() {
  const cover =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M4 12V4h8v8M4 8h8" fill="none" stroke="#5bf"/></svg>';
  // Original one-second MIDI: 96 ticks/quarter, 500000 us/quarter, 192 ticks.
  const midi = Buffer.from(
    "4d546864000000060000000100604d54726b0000001400ff510307a12000903c408140803c0000ff2f00",
    "hex",
  );
  return {
    args: {
      name: "Music MCP fixture",
      description: "Original synthetic codec fixture",
      coverIndex: 0,
      files: [
        {
          name: "cover.svg",
          mediaType: "image/svg+xml",
          base64: Buffer.from(cover).toString("base64"),
        },
        { name: "signal.mid", mediaType: "audio/midi", base64: midi.toString("base64") },
      ],
      release: { release_type: "Single", release_title: "One second signal" },
      tracks: [
        {
          fileName: "signal.mid",
          song: {
            song_title: "One second signal",
            song_duration: "PT1S",
            track_number: 1,
            artists: [{ name: "BEACN Labs synthetic fixture" }],
            copyright: {
              master: "Original test bytes; declaration only",
              composition: "Original test sequence; declaration only",
            },
            genres: ["Electronic"],
          },
        },
      ],
    },
  };
}
export function assertMusicToolResult(result, args) {
  const expected = result.musicRelease;
  assert.deepEqual(
    Object.keys(expected).sort(),
    ["schema", "profile", "bundle", "release", "tracks", "packageHash"].sort(),
  );
  assert.deepEqual(
    Object.keys(expected.bundle).sort(),
    ["schema", "name", "description", "cover", "bytes", "files", "sha256"].sort(),
  );
  assert.equal(expected.bundle.schema, "nft-studio.payload.v1");
  assert.equal(expected.schema, "beacn.music-release.v1");
  assert.equal(expected.profile, "cip60-v3-studio-exact-files");
  assert.deepEqual(expected.release, args.release);
  assert.deepEqual(expected.tracks, args.tracks);
  assert.equal(expected.bundle.name, args.name);
  assert.equal(expected.bundle.description, args.description);
  assert.equal(expected.bundle.cover, true);
  assert.equal(expected.bundle.files.length, args.files.length);
  for (const [index, input] of args.files.entries()) {
    const file = expected.bundle.files[index];
    assert.deepEqual(
      Object.keys(file).sort(),
      ["name", "mediaType", "bytes", "sha256", "uri"].sort(),
    );
    assert.equal(file.bytes, Buffer.from(input.base64, "base64").length);
    assert.equal(file.name, input.name);
    assert.equal(file.mediaType, input.mediaType);
    const prefix = `data:${input.mediaType};base64,`;
    assert.ok(file.uri.startsWith(prefix));
    assert.equal(file.uri.slice(prefix.length), input.base64);
    assert.equal(
      file.sha256,
      createHash("sha256").update(Buffer.from(input.base64, "base64")).digest("hex"),
    );
  }
  assert.equal(
    expected.bundle.bytes,
    expected.bundle.files.reduce((sum, file) => sum + file.bytes, 0),
  );
  const bundleIdentity = {
    schema: expected.bundle.schema,
    name: args.name,
    description: args.description,
    cover: true,
    files: expected.bundle.files.map(({ name, mediaType, bytes, sha256 }) => ({
      name,
      mediaType,
      bytes,
      sha256,
    })),
  };
  assert.equal(
    expected.bundle.sha256,
    createHash("sha256").update(JSON.stringify(bundleIdentity)).digest("hex"),
  );

  assert.equal(result.schema, "nft-studio.music-package-result.v1");
  assert.equal(result.valid, true);

  assert.equal(result.packetJson, canonical(expected));
  assert.equal(result.packageHash, expected.packageHash);
  const { packageHash, ...body } = expected;
  assert.equal(createHash("sha256").update(canonical(body)).digest("hex"), packageHash);
  assert.equal(result.packageJsonBytes, Buffer.byteLength(result.packetJson));
  assert.equal(result.filename, `nft-studio-${packageHash.slice(0, 12)}.music-release.json`);
  assert.equal(result.review.url, "https://beacnpool.github.io/NFT-Studio/?view=labs&lab=music");
  assert.equal(result.status, "package-only; no transaction prepared");
  assert.equal(result.budget.completeTransactionMeasured, false);
  assert.equal(result.budget.metadataByteLimit, 14000);
  assert.ok(
    result.budget.metadataBytesAt32ByteAssetName > 0 &&
      result.budget.metadataBytesAt32ByteAssetName <= 14000,
  );
  assert.equal(
    result.budget.remainingMetadataBytes,
    14000 - result.budget.metadataBytesAt32ByteAssetName,
  );
  assert.deepEqual(result.processing, {
    inputBytesReceivedByThisServer: true,
    networkRequestsByTool: false,
    inputBytesPersistedByTool: false,
    declaredLinksFetched: false,
  });
  assert.deepEqual(result.checks, {
    exactFilesAndCredits: true,
    completeTransactionFit: false,
    transactionPrepared: false,
    signed: false,
    submitted: false,
    chainInclusion: false,
    authorship: false,
    rights: false,
  });
  for (const field of [
    "unsignedHex",
    "signedHex",
    "wallet",
    "packetId",
    "transactionHash",
    "policyId",
    "assetName",
  ])
    assert.ok(!Object.hasOwn(result, field));
}
export async function verifyMusicTools(client, tools) {
  for (const name of ["create_music_release", "verify_music_release"]) {
    const tool = tools.find((t) => t.name === name);
    assert.ok(tool);
    assert.deepEqual(tool.annotations, {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  }
  const fixture = await loadMusicToolFixture();
  const created = checked(
    await client.callTool({ name: "create_music_release", arguments: fixture.args }),
  );
  assertMusicToolResult(created, fixture.args);
  assert.equal(created.operation, "created");
  const verified = checked(
    await client.callTool({
      name: "verify_music_release",
      arguments: { packetJson: created.packetJson },
    }),
  );
  assertMusicToolResult(verified, fixture.args);
  assert.equal(verified.operation, "verified");
  const changed = created.packetJson.replace(created.packageHash, "00".repeat(32));
  assert.equal(
    (await client.callTool({ name: "verify_music_release", arguments: { packetJson: changed } }))
      .isError,
    true,
  );
  return {
    packageHash: created.packageHash,
    canonicalRoundtrip: true,
    exactFilesAndCredits: true,
    changedHashRejected: true,
    packageOnly: true,
    metadataBytes: created.budget.metadataBytesAt32ByteAssetName,
    completeTransactionMeasured: false,
  };
}
