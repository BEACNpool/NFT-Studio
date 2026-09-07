# Music packages over MCP

`create_music_release` packages exact supplied cover/audio bytes with release and credit metadata. `verify_music_release` checks a canonical exported package with the same browser codec. Both return a fixed link to [Music Lab](https://beacnpool.github.io/NFT-Studio/?view=labs&lab=music), where a person imports the package, checks the content and explicitly continues to wallet review.

These are pure package tools. They do not prepare unsigned music transactions, accept wallet snapshots, sign, submit, retrieve media, follow credit links or verify chain state. They do not add a music lane to the existing mint-intent or unsigned-preparation schema. Those tools continue to reject music packages.

## Create a package

Supply a strict object with the existing payload fields plus release/tracks:

```json
{
  "name": "Release display name",
  "description": "Optional description",
  "coverIndex": 0,
  "files": [
    {"name": "cover.svg", "mediaType": "image/svg+xml", "base64": "<canonical base64 bytes>"},
    {"name": "song.mid", "mediaType": "audio/midi", "base64": "<canonical base64 bytes>"}
  ],
  "release": {"release_type": "Single", "release_title": "Release title"},
  "tracks": [{
    "fileName": "song.mid",
    "song": {
      "song_title": "Song title",
      "song_duration": "PT1S",
      "track_number": 1,
      "artists": [{"name": "Artist name"}],
      "copyright": {"master": "Master declaration", "composition": "Composition declaration"},
      "genres": ["Electronic"]
    }
  }]
}
```

The base64 placeholders above must be replaced with actual file bytes. No filesystem path, media URL, provider URL, executable instruction, policy, recipient or wallet argument is accepted. `release` and `tracks` are required; the shared codec requires an image cover and exact one-to-one association of all audio files with their named track records. `Single` supports one track; `Multiple` supports up to seven.

Tool discovery includes the full strict nested credit schema. Optional supported fields include featured artists, contributors and roles, authors and exact percentage-share declarations totaling 100%, identifiers, copyright declarations, producer/engineering credits, dates, language fields and labeled artist links. The shared codec remains authoritative for UTF-8 byte limits, identifier/date/duration syntax, unique fields and cross-file rules. It deliberately does not infer missing credits or validate rights. Artist/contributor/lyrics/distributor URLs already supported by the codec remain inert declarations and are never fetched.

## Verify and save

`verify_music_release` accepts exactly `{ "packetJson": "<canonical package JSON text>" }`. Use the `packetJson` string returned by creation or the exact text of a Studio `.music-release.json` export. It validates the effective package with `parseMusicRelease`, which parses JSON and compares it with canonical serialization before rebuilding the files and credit hash. Tests demonstrate rejection of duplicate keys inside this canonical packet text, changed hashes, extra fields, pretty-printed replacements and trailing newlines. No claim is made about detecting duplicate keys in the outer JSON-RPC envelope, which is parsed by the transport.

The response has:

- `musicRelease`: the verified content package, with exact files and complete supported credits.
- `packageHash`: the canonical package SHA-256 commitment.
- `packetJson`, `filename`, `packageJsonBytes`: save the exact string as the suggested `.music-release.json` file. Do not pretty-print or append a newline.
- `budget`: `metadataBytesAt32ByteAssetName`, `metadataByteLimit`, `remainingMetadataBytes` and `completeTransactionMeasured: false` from the existing music codec.
- `review.url`: always `https://beacnpool.github.io/NFT-Studio/?view=labs&lab=music`.
- `status: "package-only; no transaction prepared"`, `operation: "created" | "verified"`, and explicit unchecked transaction/inclusion/authorship/rights fields.

The metadata budget uses a full 32-byte asset name, with a 14,000-byte music metadata cap. It is not a full transaction size, fee quote or promise that a wallet can mint the package. Browser preparation must still obtain current protocol parameters and selected inputs, then check the actual transaction, signatures and fees through the shared mint flow.

## Bounds and privacy

The existing MCP file rules remain: 12,000 total raw bytes, up to eight supported files, canonical base64 and verified filenames/MIME signatures. Music credits are limited to 6,000 JSON bytes; a canonical package is limited to 80,000 UTF-8 bytes. These service tools additionally limit their wrapped argument JSON to 80 KiB, leaving room under the public Worker's existing 96 KiB request limit. They snapshot bounded plain values before asynchronous work and reject getters, unsupported prototypes and sparse/extended arrays at the exported action boundary.

The remote MCP receives the explicit bytes and credits supplied to it. These tools do not persist or publish them and make no network requests. General hosting operational metadata policies still belong to the host. Hashes and MIME signatures establish byte identity, not complete media validity, safe execution, authorship or legal rights.

## Service and release checks

The proposed discovery surface is 12 public tools and 14 Node tools, derived by exact-name comparisons against `integration/tool-names.mjs`. The tested catalog exposes 61 resources from 58 entries and 73 pinned sources; these two tools add no new resource. Resource checks derive the exact set from the imported catalog. Capabilities expose a separate `musicReleases` object with limits and the explicit package-only boundary.

The live verifier keeps its default eight-tool behavior. `--expected-tools 9` includes ordinary stateless unsigned preparation, `10` also includes Capsule parameters, and explicit `12` also checks this original synthetic music fixture. Old modes do not send music files or call new music tools. Resource counts remain explicit via `--expected-resources 55|56|61` and must match the admitted catalog revision. The default remains 55; implementation-register verification applies to both 56 and 61 and binds the exact local catalog. The music verifier never signs, submits or prepares a music transaction; older native checks retain their existing synthetic ordinary NFT/data behavior.

This is the CIP-60-aligned Studio exact-file extension documented in [the music profile](../docs/MUSIC_RELEASE.md), not a strict CIP-60 v3 CDDL compliance or player-support claim.
