# Independent node evaluation — 2026-09-07 UTC

**Issuance passed an independent public-provider Cardano node evaluation.** The
same transaction with its required signer removed, and a variant carrying the
seed only as a reference input, both failed during Plutus script execution.

This used `POST /utils/txs/evaluate?version=6` at Blockfrost, current public chain
UTxOs, freshly fetched epoch-654 protocol parameters and a separately applied
capsule policy. The transaction remained unsigned. There was no key access,
signing, submission, account/service change or production-node operation.

The positive execution used **894,708 memory units / 296,197,894 CPU steps**.
Its complete unsigned transaction was **9,475 bytes**; existing assets were
preserved with seven ordinary inputs and ADA-only collateral. These larger
wallet contents explain why its size/cost differs from the minimal local fixture.

`public-utxo-node-evaluation.json` is the sanitized receipt, containing raw
provider responses, timestamps, byte counts and SHA-256 commitments. It deliberately
omits holder addresses, balances, exact public UTxOs and the unsigned transaction.
The executing policy ID is a **separately parameterized evaluation example**, not
the synthetic `11…11#0` demonstration policy and not an issued asset.

## What this establishes

- A current independent node constructed the real Plutus V3 context from actual
  chain UTxOs and executed the compiled minting policy successfully.
- Required-signer omission and reference-only seed variants reached the mint
  validator and returned script failure code `3012` within error `3010`.
- The policy's seed/name application, script identity and issuance datum work
  together through Cardano transaction serialization and node context conversion.
- The positive transaction preserves its existing native assets and balances
  inputs, minted pair, outputs and fees in CSL checks before evaluation.

## What this does not establish

Ogmios evaluation skips complete ledger phase-1 validation. A successful result
does not certify key signatures, current input availability at a later time,
wallet approval, minimum fees under every witness set, or transaction acceptance.
The negative mutations intentionally test script predicates and are not intended
as balanced publishable transactions. No transaction was submitted, so no capsule
was issued. The spending/evolution/freeze path still has **local compiled-script
execution evidence only**; a real reference/user pair must exist before a live
chain state can exercise those paths. Independent security audit and device wallet
acceptance remain outstanding.

## The additional-UTxO endpoint trap

The OpenAPI specification documents `POST /utils/txs/evaluate/utxos`, including an
optional `version=6`. Tested here, that endpoint returned HTTP 200 with an Ogmios
v5 `jsonwsp/fault`, reporting that it could not decode the current transaction.
Adding `?version=6` returned the same v5 fault. These responses are **not evidence
that the capsule validator rejected anything**. Keep protocol/transport faults
separate from script failures; HTTP 200 alone means neither success nor failure
at the contract level.

The normal `/utils/txs/evaluate?version=6` endpoint decoded identical synthetic
CBOR successfully and reported missing synthetic inputs. It subsequently
evaluated the version with current public UTxOs successfully. This establishes
an endpoint-specific compatibility problem without asserting its server-side
root cause. The original v5 fault and the v6 unknown-input response are retained
as `provider-response-ogmios5.json`, `provider-response.json` and
`provider-response-basic-v6.json`.

## Reproduce safely

Install the pinned compiler and repository npm dependencies. This script reads
an existing Blockfrost mainnet API credential **by path**; it never prints or
retains the credential. It discovers a current public holder from a historical
public policy, performs bounded public UTxO lookups, parameterizes a temporary
capsule script, builds unsigned evaluation transactions and calls only the
evaluation endpoint. It does not have a submission function.

```sh
AIKEN_BIN=/path/to/aiken \
BLOCKFROST_PROJECT_ID_FILE=/path/to/existing-api-credential \
node contracts/state-capsule/evaluation/evaluate-public-utxos.mjs
```

Current UTxOs, policy identity, transaction commitment and slot window will vary.
A read-only evaluation may stop if the discovered holder no longer has suitable
inputs. Do not turn that into a funding or signing action.

The contract's initial reusable unsigned builder deliberately accepts one seed
input. The public wallet selected here held enough ADA but needed additional
ordinary inputs to preserve its existing native assets and min-ADA change.
`build-evaluation.mjs` implements this narrow evaluation extension and checks
same-holder input identity, non-overlap with collateral and complete conservation.
It does not modify the shipped contract or original mint builder.

## Verified compiler

`compiler-verification.json` pins Aiken v1.1.23 (`8949565`) and its official Linux
x64 archive URL/hash. The currently installed archive matches the checksum fetched
again from the official release. No installer or new dependency was executed.

## Primary references

- [Blockfrost OpenAPI, version 0.1.93](https://github.com/blockfrost/openapi/blob/master/openapi.yaml): evaluation endpoints, hosted additional-UTxO format and optional Ogmios version.
- [Ogmios transaction evaluation](https://ogmios.dev/mini-protocols/local-tx-submission/#evaluating-transactions): omitted signatures, partial ledger checks, execution-unit evaluation and additional UTxO semantics.
- [Aiken v1.1.23 release](https://github.com/aiken-lang/aiken/releases/tag/v1.1.23): pinned compiler, source commit and platform archives.

These sources were checked on 2026-09-07 UTC. The measured response artifacts,
rather than the documentation alone, establish which provider routes worked.
