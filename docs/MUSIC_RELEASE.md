# Exact music release metadata

This local codec binds music credits and release details to a Studio exact-file NFT
bundle. It exports a portable music package, a ledger-encodable label-721 metadata
object, and its exact CBOR byte count. It recovers the same package from that metadata.
It neither mints a token nor proves a recording, credit, identifier, or rights claim.

The profile is `cip60-v3-studio-exact-files`, carried inside
`beacn.music-release.v1`. Call it a **CIP-60-aligned Studio extension**, not strict
CIP-60 v3 CDDL conformance. The published standard and the Studio file format do not
currently fit together without an explicit adapter.

## Primary-source findings

CIP-60 is Active and its README links v3 CDDL while marking v1/v2 deprecated.
It places release data at asset level and song data on the audio file. This profile
uses its Single/Multiple branch and song-level artist, genre and copyright fields.
The document's prose and examples contain type inconsistencies; the selected field
types and omissions below are deliberate. [CIP-60, pinned source](https://github.com/cardano-foundation/CIPs/blob/05ee6bb05982289dbe00c4187b9d54cf90e2e276/CIP-0060/README.md).

The v3 CDDL restricts `image` and file `src` to one text string of at most 64 bytes,
uses closed maps, includes Boolean `explicit`/`ai_generated`, and omits author
`role` despite the prose mentioning it. It also types `catalog_number` as text and
copyright as a map. These constraints conflict with Studio's chunked embedded
URIs and extra integrity fields. Its conditional expressions are not a basis for
claiming that this profile passed a complete CDDL validator.
[CIP-60 v3 CDDL](https://github.com/cardano-foundation/CIPs/blob/05ee6bb05982289dbe00c4187b9d54cf90e2e276/CIP-0060/cddl/version-3.cddl).

CIP-25 describes chunked URI fields and inline base64 images. We retain Studio's
existing textual policy/asset-name keys, label-level `version: "1.0"`, image
integrity fields and file hashes. No switch to CIP-25 byte-string keys or CIP-68
datums occurs. [CIP-25, pinned source](https://github.com/cardano-foundation/CIPs/blob/05ee6bb05982289dbe00c4187b9d54cf90e2e276/CIP-0025/README.md).

Cardano transaction metadata supports maps, arrays, integers, byte strings and text;
it has no Boolean or null metadatum. Both true and false are rejected by the actual
CSL 17 `NoConversions` encoder in this profile's tests. We reject those optional
fields rather than silently convert them to strings or integers.
[Conway ledger CDDL](https://github.com/IntersectMBO/cardano-ledger/blob/dae069780697449fbd9cda47f03fb72745b0b8c0/eras/conway/impl/cddl/data/conway.cddl).

Exact source hashes, access times, attribution/license records and the reviewed
Studio boundary are in [MUSIC_RELEASE_SOURCES.json](MUSIC_RELEASE_SOURCES.json).
The TypeScript implementation, tests and synthetic media are original BEACN Labs
work under the repository's Apache-2.0 license. Referenced CIP texts are CC-BY-4.0;
they are linked, not copied into the implementation.

## Supported profile

| Area | Required | Optional |
| --- | --- | --- |
| Files | One image cover followed by 1–7 WAV, MPEG, Ogg or MIDI files; every audio file has exactly one song | None; source code and other attachments need a separate future profile |
| Release | `release_type`: Single or Multiple; `release_title` | Release/publication date, visual artist, distributor HTTPS URL, textual catalog number, series, collection |
| Song | Title, positive whole-second duration, track number 1–999, 1–4 artists, master and composition declarations, 1–3 genres | Featured artists, contributors, authors, engineering/production credits, mood, set, thanks, bitrate, BPM, origin, derivation, lyrics HTTPS URL, identifiers, limited language tags |
| Artist | Name | ISNI syntax, up to three named HTTPS links |
| Contributor | Name | IPI/IPN syntax, 1–4 role strings, links |
| Author | Name and declared share | IPI syntax |

Single contains one track. Multiple can contain one or more. Album/EP is excluded
because this profile does not determine the special shared-release conditions.
Author shares, when supplied, must all be present and total exactly 100% using
integer basis points; they do not configure royalties or payments. Unknown fields
are rejected. Optional arrays, when present, must be nonempty.

Ordinary text is at most 64 UTF-8 bytes. Song titles allow 192 bytes and use Studio's
existing code-point-safe chunker. Text is preserved, not normalized or truncated.
Control characters, surrounding whitespace and lone surrogates are rejected.
Dates are real YYYY-MM-DD calendar dates. Durations support hours/minutes/seconds,
with each minute/second component below 60, positive total and less than 24 hours.
Declared duration is not measured from arbitrary uploaded audio.

Identifier validation is syntax only, with deliberately narrow formats. No registry
lookup or checksum verification establishes assignment. The language format is a
small language/script/region subset, not the complete BCP-47 registry. The fixture
uses no purported assigned identifier. The catalog code is visibly test-only.

## Bounds and integrity

- Maximum 12,000 raw file bytes comes from the shared Studio bundle codec.
- Composer data is bounded to 6,000 JSON bytes; the full package to 80,000, with
  bounded depth/items. Plain enumerable values only; getters, custom prototypes,
  sparse arrays and extra array properties are rejected before asynchronous work.
- A package must fit 14,000 **metadata CBOR** bytes using the worst-case supported
  32-byte asset name. That cap leaves no guaranteed transaction headroom: inputs,
  outputs, mint script and every witness still require complete measurement.
- The package hash binds canonical release/track data and the exact bundle.
  It does not bind a real asset identity, network, owner, signature or timestamp.
- The metadata records the package hash, adds integer `music_metadata_version: 3`,
  and attaches a song to each existing file. File order and all data URI bytes are
  retained. Track records sort numerically for a consistent UI.
- Music-aware recovery recomputes the bundle/package and requires exact supported
  metadata reconstruction. Generic Studio recovery retrieves the original files
  and ignores the music fields; it does not verify music credits.
- Exported package JSON is canonical and has no trailing newline. The string
  parser accepts only that format, rejecting duplicate keys and alternate JSON
  spellings. The object API takes a bounded value snapshot first.

Links are stored declarations. The codec never fetches them. It does not decode
arbitrary audio, execute programs, prove ownership/copyright, check supply or
royalties, or establish wallet/player support. MIDI is a performance instruction
file; playback sound depends on the consumer's synthesizer.

## API and minting boundary

```ts
const music = await createMusicRelease(exactStudioBundle, composerInput);
const budget = await musicReleaseBudget(music);
const packageFile = await musicReleaseBytes(music);
const reopened = await parseMusicRelease(new TextDecoder().decode(packageFile));

// Only when a real builder has chosen the actual policy and exact textual name:
const encoded = await musicReleaseMetadata(reopened, { policyId, assetName });
const recovered = await recoverMusicRelease(encoded.metadata, { policyId, assetName });
```

Current `buildStudioTransaction` always calls ordinary `payloadMetadata(bundle)`.
Current `nft-studio.intent.v1` binds only `mode` and `bundle`. **Passing a music
package's bundle through that path drops its music metadata.** The package schema
is intentionally different and must not be advertised as an existing mint intent.

The dedicated `buildMusicReleaseTransaction` adapter accepts the whole package,
regenerates metadata after choosing the actual policy and asset name, and binds
all files and credits to the review. It measures the complete signed transaction
and preserves the shared ordinary token/ADA checks. The browser checks package
identity on both sides of the wallet's asynchronous signing response. Strict
receipt recovery reconstructs music from actual transaction CBOR and rejects
changed credit sidecars. See [transaction preparation](MUSIC_TRANSACTIONS.md)
and [receipt recovery](MUSIC_RECEIPTS.md).

**Labs → Music release** composes, imports and exports canonical packages before
opening the visible wallet review. Files, credits and the prepared package survive
visiting another Lab. Leaving Music unmounts its wallet dialog and cancels pending
review work; returning requires a new wallet review. The public MCP's
`create_music_release` and `verify_music_release` tools exchange the same canonical
packet and return the fixed Music Lab review link. See [the MCP contract](MCP.md).
Creating a package alone does not mint it.

Artifact Passport still accepts the ordinary exact-file profile. Music recovery
has its own explicit package/receipt path and is not silently treated as a
verified ordinary Passport.

## Reproducible evidence

From an integrated repository with its pinned dependencies installed:

```sh
node scripts/verify-music-release.mjs
python3 scripts/music-release-oracle.py
```

For a review kit, set `NFT_STUDIO_TEST_ROOT` to the inspected Studio checkout.
The runner compiles against its actual shared payload module and checks strict
TypeScript. Default verification compares committed fixtures; `--write-fixtures`
is an explicit regeneration operation and changes the expected evidence.

The suite has 285 assertions: three exact roundtrips, 56 malformed composer
profiles, 128 checksum mutations, additional file/identity/credit errors,
untrusted plain-value boundaries, metadata cap checks and integer/UTF-8 CBOR
boundaries. An independent TypeScript writer matches CSL 17 byte-for-byte.
A separate Python standard-library oracle verifies all CBOR, SHA-256 and
BLAKE2b-256 results and the original WAV/MIDI one-second fixture structure.

| Fixture | Raw file bytes | Metadata / auxiliary bytes |
| --- | ---: | ---: |
| Original one-second WAV and SVG cover | 4,166 | 6,823 |
| WAV + MIDI with fuller release/credit data | 4,208 | 7,663 |
| 192-byte song title and 32-byte asset name | 4,166 | 7,032 |

These are synthetic metadata measurements. They are not submitted transactions,
wallet signatures, mainnet inclusion receipts or player interoperability tests.
