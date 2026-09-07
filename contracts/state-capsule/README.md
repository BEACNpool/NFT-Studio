# State Capsules — experimental CIP-68 contracts

A transferable user NFT controls its paired reference NFT's public metadata. A
holder can evolve the metadata, then freeze it permanently. Each transition
commits to the prior datum. A one-shot seed UTxO limits issuance to one pair.

This is a BEACN implementation of established Cardano capabilities. It is not a
new token standard, an audited contract, or a mainnet-ready mint flow.

See [the complete lifecycle, schema, evidence and limits](../../docs/STATE_CAPSULES.md).

Issuance also passed an [independent node evaluation](evaluation/README.md) with
current public UTxOs and two script rejection cases. This was unsigned and did
not issue an asset. Evolution/freeze still have local compiled-test evidence.

From this directory, with NFT-Studio's npm dependencies installed at repository root:

```sh
aiken check -D --max-success 500 --seed 20260906
aiken build -D
node scripts/apply-demo.mjs
node scripts/verify-codec.mjs
node scripts/verify-transactions.mjs --uplc
node scripts/build-demo.mjs --check
```

Pinned compiler: **Aiken v1.1.23**; Plutus V3; stdlib v3.1.0; fuzz v2.2.0.
`AIKEN_BIN` can point scripts to a specific Aiken binary. The test transaction
builder consumes the checked-in, dated protocol snapshot, never a live API.
It generates synthetic wallet keys in memory and discards them; no key files are
read or written, and no transaction is submitted.

`plutus.json` is the parameterized CIP-57 blueprint. `fixtures/applied-demo.json`
is its application to the intentionally synthetic seed `11…11#0` and base name
`CAPSULE`. Each person’s real issuance needs its own applied seed/policy identity.
The example policy is not an existing minted asset.

`scripts/capsule-codec.mjs` is browser-safe and has TypeScript declarations.
`scripts/unsigned-mint.mjs` prepares unsigned CSL transactions for evaluation.
The latter is intentionally a narrow, experimental builder: one key-held seed,
one separate ADA-only collateral UTxO, one reference output and one user output.
It does not supply wallet approval, chain freshness, public-node evaluation,
actual signed-byte checks or submission.

Code is Apache-2.0; see `LICENSE`. Original demo SVG is provided with the same
license. Standards retain their own upstream licenses and attribution.
