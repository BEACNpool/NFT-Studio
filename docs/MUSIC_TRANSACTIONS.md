# Music-aware native transaction preparation

The ordinary Studio builder reconstructs plain file metadata from its bundle, so
passing only the bundle of a music package loses its credits. The dedicated music entry point adds
`buildMusicReleaseTransaction` to the same module and keeps one private constructor
for coin selection, native minting, outputs, change, fee and complete size checks.

The public ordinary `buildStudioTransaction(C, bundle, mode, wallet, protocol)`
signature and outputs remain unchanged. Six NFT/data fixtures match the original
builder's complete preparation records and unsigned CBOR byte-for-byte, including
ordinary token change and multiple input keys. The reviewed baseline commit and
file hashes are in [MUSIC_TRANSACTION_BASELINE.json](MUSIC_TRANSACTION_BASELINE.json).

This depends on the separately reviewed `lib/music-release.ts` codec. Its profile
is a documented CIP-60-aligned Studio extension; the upstream schema conflicts
and player/rights limitations remain. No CIP status or interoperability claim is
promoted by this transaction adapter.

## Dedicated entry point

```ts
const prepared = await buildMusicReleaseTransaction(
  C, musicPackage, walletSnapshot, liveProtocol,
);
await assertMusicReleaseUnchanged(prepared, currentMusicPackage);
```

The entry point snapshots wallet and protocol values before awaiting package
verification. It validates the whole package, supplies its verified exact bundle
to the private constructor in NFT mode, and returns a `MusicReleaseTransaction`:
the ordinary preparation plus `metadataProfile` and a deeply frozen `musicRelease`.

Only trusted code selects the music metadata branch. No exported callback accepts
arbitrary metadata. There is no caller-provided policy, destination, provider URL,
mint quantity, transaction body, or sign/submit operation. The package itself
contains declared links and credits; this adapter never fetches those links.

For music, asset-name derivation uses the consumed seed reference and the whole
package hash. A credit-only change therefore changes the asset name. The existing
native policy still uses the connected payment credential and its expiry window.
After deriving the real policy/name, the constructor calls `musicReleaseMetadata`
and builds its exact metadata into the auxiliary-data commitment. Ordinary NFT
asset-name derivation continues to use its bundle hash unchanged.

`assertMusicReleaseUnchanged` verifies both the current package and the package
stored in the trusted local preparation. It compares their hashes, the bundle,
profile, identity presence and regenerated metadata. It is a content-review guard,
not authentication of an imported preparation packet. The preparation must have
just been produced by trusted local code; never accept an uploaded `prepared`
object as authority to sign.

The shared `assertFreshReview`, `assertWalletUnchanged` and
`mergeAndCheckSignatures` remain necessary. They retain live-parameter/account/
input checks, required payment signatures, body/auxiliary integrity, complete
signed size and minimum fee checks. None establishes that caller-supplied UTxOs
are unspent without the surrounding live wallet/provider workflow.

## What the tests establish

Ten integration groups run against the actual shared modules, with fresh
ephemeral synthetic test keys that are never exported. There is no real wallet,
network query, chain submission or chain-inclusion claim.

The unchanged Studio regression suite also passes all nine groups against the
isolated adapter, and ordinary Artifact Passport passes all eight groups.
Typed lint passes with the repository configuration after the included one-line
music-codec narrowing patch.

- Six ordinary preparation records and unsigned CBOR encodings equal the pinned
  original builder, including all own-property keys for optional data fields.
- Music preparation and signature merging agree between browser-inlined and
  Node CSL 17. Exact signed metadata recovers every original file and credit.
- Credit-only revisions change package hash, asset name, transaction hash,
  auxiliary commitment and, for the tested length change, the calculated fee.
  Old signatures and stale credit reviews reject.
- Inputs containing three existing assets retain their quantities, including
  empty and binary asset names. Every output remains at the selected change
  address; ADA balances after the fee; minimum output ADA is checked.
- Multiple selected payment keys remain mandatory. Wrong, missing, extra and
  altered-body signatures, altered auxiliary data, changed account/input state
  and expired/changed protocol reviews reject through the existing checks.
- Metadata and full signed-size limits remain separate. An otherwise admissible
  music package can fail when the wallet needs many input witnesses.
- Insufficient funding, the 2 ADA fixture fee cap, wrong network and datum/
  reference-script inputs retain the ordinary failure behavior.
- Tampered music packages fail; `nft-studio.intent.v1` retains its exact schema
  and rejects music packages and extra music fields. No MCP music tool is added.
- Caller mutation after the music entry point starts cannot replace the captured
  package, wallet values or protocol values.

Measured with synthetic protocol values and a test wallet, not a price quote:

| Case | Metadata bytes | Complete signed bytes / estimate |
| --- | ---: | ---: |
| Original one-second WAV + SVG + required credits | 6,844 | 7,380 actual synthetic signed bytes |
| Larger package, compact test wallet | 13,717 | 14,253 estimated signed bytes |
| Same larger package, 32 small outputs available | 13,717 | Rejected by the complete signed-size check |

The first fixture's fee is 480,277 lovelace with its fixed protocol inputs.
The larger WAV fixture exercises byte size, not a verified duration declaration.
Sanitized repeatable measurements are in
`tests/fixtures/music-transactions/verification.json`; no keys are stored there.

```sh
node scripts/verify-music-transactions.mjs
```

For review kits, `NFT_STUDIO_TEST_ROOT` selects the original Studio checkout and
`NFT_STUDIO_MUSIC_ROOT` selects the reviewed music codec/fixtures. The runner
performs strict TypeScript checking and normal runs compare committed evidence
without writing it. `--write-baselines` requires the exact original builder hash;
it cannot silently regenerate ordinary baselines from this adapter.

## Browser review and recovery

`components/music-release-lab.tsx` composes the exact package and supplies it to
`FileMintDialog` through the explicit `musicPackage` input. Ordinary callers keep
their existing `bundle`/`mode` inputs. No generic metadata callback was added.
The component identity uses the whole music package hash. A draft change clears
the package and unmounts its wallet review, including an outstanding wallet prompt.

The dialog runs the dedicated music builder with fresh wallet/protocol reads.
Before and after signing it checks the music package against the trusted local
preparation, then applies the existing account, quote, body, metadata, signature,
fee and signed-size checks. The signed receipt is saved before the exactly-once
submission attempt. Storage failure prevents submission; an uncertain response
stays unknown. The complete declared credits appear in the visible wallet review.

The receipt adds `metadataProfile` and `musicPackageHash` and retains the exact
preparation. Activity uses [strict music receipt recovery](MUSIC_RECEIPTS.md) to
check actual transaction CBOR before displaying verified local credits. Imported
receipt confirmation remains an unverified report. The ordinary Passport profile
continues to reject music metadata; export a music package and retain its receipt.

`scripts/audit-music.cjs` exercises the actual static browser UI with a synthetic
CIP-30 wallet: exact canonical package exports, credit changes, signing and asset
conservation, receipt-before-submit, stale wallet-prompt cancellation, storage
failure, uncertain submission, signed/unsigned recovery, stripped and altered
sidecars, duplicate JSON, reported confirmation and large ordinary imports.
No real wallet or chain submission is used in these checks.

The ordinary `nft-studio.intent.v1` schema remains unchanged and rejects music.
Music agent integrations must transport the complete verified music package to
its dedicated browser workflow; a plain file bundle does not carry its credits.
