# Stateless unsigned music preparation

`prepare_unsigned_music_transaction` prepares an actual unsigned native music NFT
using the shared `buildMusicReleaseTransaction`. It is a separate tool from ordinary
NFT/data preparation and from package-only `create_music_release` /
`verify_music_release`. Tool discovery and a dated live receipt describe which
capabilities are enabled on the running service.

The tool accepts exactly:

```json
{
  "packetJson": "the exact canonical .music-release.json string",
  "wallet": {
    "changeHex": "canonical mainnet key payment address bytes",
    "utxos": ["canonical CIP-30 TransactionUnspentOutput CBOR hex"]
  }
}
```

Obtain the wallet user's authorization before transmitting their snapshot. The
service receives the complete audio/cover bytes, declared credits, wallet address
and supplied UTxOs. It cannot establish ownership or whether those inputs exist or
remain unspent. A snapshot, unsigned response or matching credit hash is not
signing authority.

Use `packetJson` returned by the package tools or the Music Lab's canonical export.
Do not pretty-print it, append a newline, duplicate keys or replace it with an
ordinary file bundle. Effective file bytes and every supported release/credit field
are committed by the music package hash. Declared artist, contributor and lyrics
links remain inert content and are never fetched. The profile is the documented
CIP-60-aligned Studio extension, with its existing CDDL/player/rights limitations.

## Bounds and shared construction

Both Node and Worker Music requests use the same limits: 88 KiB encoded arguments,
32 ordinary UTxOs, 16 KiB per UTxO, 32 KiB aggregate wallet CBOR and 512 native asset
entries. The canonical package itself remains at most 80,000 UTF-8 bytes. CBOR is
bounded to depth 16 and 4,096 items before CSL; noncanonical, duplicate-input,
datum-bearing, reference-script, script-payment and wrong-network inputs reject.
All arguments are copied as bounded inert data before asynchronous validation.

Music uses the existing shared native builder. The adapter reuses ordinary wallet
preflight, fixed protocol reads, timeout, output/minimum-ADA checks and full
input/mint/output/fee conservation. The 14,000-byte metadata limit is separate from
the estimated complete signed transaction cap of 16,384 bytes and fee cap of 2 ADA.
An admissible music package can fail for a fragmented wallet's larger transaction.

One two-slot gate limits ordinary and Music preparations together. Node keeps its
ordinary 128-UTxO / 128-KiB snapshot schema, 64-packet capacity and four-minute
retention unchanged. Music never creates, occupies, evicts or refreshes an ordinary
cached packet. Its only network access is the existing fixed protocol feed, with
the existing 10-second provider deadline and 64-KiB response bound. No request
argument selects a provider URL, policy, recipient, quantity, script, metadata
override, filesystem path or transaction body.

After construction the adapter checks the actual unsigned transaction's mint,
body hash, auxiliary commitment and all values. It decodes actual CSL metadata and
reconstructs the complete package through the shared Music recovery codec, requiring
its canonical bytes to equal the original input. This is a second path over actual
CBOR using the shared codec; it is not an independent implementation. The tests
separately derive expected metadata, package/file SHA-256, CSL body/auxiliary hashes,
sole quantity-one mint and BigInt ADA/token sums directly from local fixtures.

## Response and wallet review

The response schema is `nft-studio.stateless-unsigned-music.v1`. It returns:

- Exact `unsignedHex`, transaction/body/auxiliary hashes, selected inputs, required
  payment keys, outputs, actual derived policy and asset-name bytes, validity,
  fee and signed-size estimate.
- The full canonical `musicRelease`, `musicPackageHash`, `metadataProfile`,
  `packetJson` and actual metadata verified against that package.
- A fixed Music Lab review URL and explicit checks/limitations. `signed` and
  `submitted` are false; rights, payment signatures and chain inclusion are unchecked.

There is no `packetId`. **Node's `verify_signed_transaction` does not accept this
stateless Music packet.** That tool uses only an ordinary preparation retained by
that Node instance, never caller-supplied replacement prepared data. Music responses
and fabricated packet IDs reject without a provider read where shape/cache checks
can decide the failure.

For the existing human wallet flow, save the returned canonical `packetJson` as a
`.music-release.json` file and open
`https://beacnpool.github.io/NFT-Studio/?view=labs&lab=music`. The Music Lab reviews the
files and credits and constructs a fresh transaction using the connected wallet and
current parameters. It does not import this service response as signing authority.
Any other external signer must independently verify the exact body/metadata,
current inputs, all required signatures and complete signed size/fee before a
separately authorized submission.

The native policy permits additional minting until expiry and neither minting nor
burning after expiry. Quantity one in this transaction is not a lifetime supply
cap. No recording duration, copyright assignment, royalty entitlement, ownership,
wallet/player interoperability or chain confirmation is established.

## Reproducible checks

`npm --prefix mcp test` exercises the actual official modern/legacy SDKs on Node
and Workerd with intercepted protocol responses and synthetic wallet snapshots.
The Music suite covers complete-package changes, 512-asset and empty/binary-name
preservation, malformed/oversized requests, actual fixed-reader privacy, mixed
concurrency, full ordinary cache capacity/expiry, snapshot mutation, provider
failures/deadlines, full transaction limits and tampered results. Four pinned
ordinary adapter fixtures compare complete response JSON and unsigned bytes against
the pre-Music adapter, alongside the existing ordinary transaction regressions.

`npm --prefix mcp run test:clean` installs only the nested MCP dependencies in an
isolated source fixture and runs the same suite without frontend dependencies.
Tests never use a real wallet or submit transactions; existing ordinary signature
tests retain only their original ephemeral synthetic keys.

The source discovery surface is 19 Worker tools and 21 Node tools. The
[dated public receipt](../docs/MCP_PUBLIC_VERIFICATION.json) observed all 15 public
tools, including independently checked synthetic Music unsigned output, with both
protocol eras at 2026-09-07T10:26:58.401Z. Resource
counts derive from the admitted catalog and are unaffected by this tool. The live
checker supports explicit `--expected-tools 15`; existing 8/9/10/12/13 modes and the default
8-tools/55-resources contract remain available. Both 13-tool and 15-tool modes call Music
transaction preparation. The 12-tool mode still creates/verifies music packages
without sending a Music wallet snapshot. No live endpoint is exercised by merely
importing the verifier or by running the locally intercepted suite.


The [dated mixed Music/ordinary Workerd observation](evidence/music-mixed-soak-20260907/)
contains 1,000 attempts: 990 independently verified preparations and ten expected
errors with subsequent gate recovery. It includes exact source-input hashes and
an explicit reproduction fixture helper. WASM and V8 heap observations were
favorable, but whole-process RSS remained 200.1 MiB after the final diagnostic
collection. This bounded local result is not a leak-free or production-capacity
claim; retain its rate, clock, runtime and measurement qualifications.
