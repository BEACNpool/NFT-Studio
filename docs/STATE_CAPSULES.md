# State Capsules

State Capsules give an NFT a small, public, holder-controlled state machine:
evolve its appearance and metadata, pass the controlling token to another wallet,
and freeze the result permanently. The implementation combines CIP-68 reference
and user tokens, a one-shot mint policy, a Plutus V3 spending validator and
deterministic state-history tooling. These are established Cardano mechanisms;
the capsule lifecycle and implementation are BEACN's design.

**Readiness: experimental; issuance independently evaluated.** The repository
includes real compiled contracts and synthetic full transaction execution.
Issuance passed a public node's script evaluation against current chain UTxOs,
including missing-signer and reference-only-seed rejection cases. Evolution and
freeze have local compiled Plutus V3 evidence. No capsule was minted or confirmed;
full phase-1, external audit and wallet acceptance remain pending. Downloadable
histories are local data, not on-chain receipts.

## What the chain enforces

1. **Issue one pair.** Parameterize the combined mint/spend script with a specific
   seed UTxO and a 1–28-byte base name. Spend the key-controlled seed and require
   its payment-key signer. Mint exactly one `(100)` reference NFT and one `(222)`
   user NFT, under that script's policy. The reference goes to that script’s
   enterprise address with an unfrozen sequence-zero inline datum; the user token
   goes to the exact seed holder address. The spent seed cannot be consumed again.
2. **Evolve.** Spend the reference state and the exact user token from a key-held
   input. Require that input's payment-key signer, and return the user token to
   that same complete address. Produce exactly one reference successor at the
   same script address, retaining its ADA, exact NFT and bounded inline datum.
   Increment sequence by exactly one and commit to the prior serialized datum.
   No token under the capsule policy may be minted or burned during this action.
3. **Transfer.** The user NFT can be transferred by an ordinary wallet transaction.
   The new key holder gains update/freeze authority. The former holder loses it.
   An update itself must retain the user token at the input holder address, so
   transfer and update are separate actions in this first lifecycle.
4. **Freeze.** A distinct `Freeze` redeemer advances the sequence and records the
   prior hash, preserves the exact metadata and marks the state frozen. Every
   later state spend fails. The user NFT remains transferable.

There is no issuer admin key, unfreeze, emergency recovery, burn or withdrawal
path. Lost holder keys prevent further updates. Script custody of the user token
prevents updates until its own rules return it to a key address. The reference
token’s ADA is locked permanently, including after freeze. Required ADA may be
added during evolution but cannot be withdrawn. These are material product
choices, not unfinished hidden recovery features.

The same compiled script serves both purposes. Its hash is simultaneously the
minting policy ID and the reference output’s payment credential. Rebuild tooling
asserts byte-for-byte equality of every handler entry; splitting these scripts
without redesigning their identity binding would break this construction.

## Datum and asset identity

CIP-67 labels are `000643b0` for reference `(100)` and `000de140` for user `(222)`.
Both asset names append the same exact base-name bytes and share one policy ID.
A display title or copied datum cannot authenticate a capsule.

```text
constructor 0 [
  metadata map<byte-string, PlutusData>,
  1,                                      # CIP-68 metadata version
  constructor 0 [
    1,                                    # BEACN state schema version
    sequence,
    frozen,                               # False = constructor 0 []; True = constructor 1 []
    previousDatumHash                      # empty genesis; 32 bytes thereafter
  ]
]
```

The contract requires strictly ascending raw-byte metadata keys, which also
rejects duplicates. `name` is a 1–64-byte string. `image` is a list of 1–48
byte strings, each 1–64 bytes. The entire datum serialized by Plutus
`serialiseData` must be at most 4,096 bytes. Sequence is bounded by signed int64;
the JavaScript tooling deliberately uses the smaller safe-integer range.

The JavaScript codec enforces well-formed Unicode, permitted image URI schemes,
bounded nesting and ordinary CIP-68 metadata values. The validator checks the
byte/type/size constraints of `name` and `image`; it does not interpret UTF-8,
fetch or parse the image, or recursively validate arbitrary additional metadata.
A holder can intentionally publish meaningless content. Authorization does not
prove the truth of a trait, an achievement, authorship or a real-world event.

`previousDatumHash = blake2b-256(serialiseData(previousDatum))`. This is a hash of
the deterministic semantic serialization, not a promise that arbitrary original
CBOR encodings have identical bytes. The Aiken golden, JavaScript encoder and
CSL 17 agree on the 76-byte baseline datum and hash
`b8ecd637e8cc8f5bddbf3d288517880a397166aa3e39670520c7beb408fb273a`.

Sequence and a hash link make local histories verifiable; they do not prove the
history was accepted by Cardano. Verify authentic policy issuance, exact token
identity, current UTxO placement and transaction inclusion independently. Two
transactions consuming the same state UTxO conflict; only ledger confirmation
settles which successor exists. A locally generated branch has no chain authority.

Mint redeemer: constructor `0 []`. Evolve: constructor `0 []`. Freeze:
constructor `1 []`. Genesis may not start frozen; sealing is deliberately explicit.

## Evidence supplied

Sources and reproducible artifacts live in [`contracts/state-capsule`](../contracts/state-capsule/).

| Evidence | What it demonstrates |
| --- | --- |
| Aiken source and `plutus.json` | The actual Plutus V3 policy/spending program and CIP-57 schemas. |
| `fixtures/aiken-check.json` | 81 Aiken unit/property tests, including 500 runs per property: issuance, signer, reference-only attacks, names/policies/quantity, conservation, datum bounds, freeze, transfer and replay. |
| `fixtures/codec-verification.json` | 256 independent CSL serialization/hash fixtures, a 258-state history and 34 rejected codec/history attacks. |
| `fixtures/transaction-verification.json` | Five complete synthetic signed CSL transactions; eight unsigned-builder rejection cases; applied script-wrapper execution through Aiken’s offline CEK evaluator. |
| `fixtures/demo-history.json` | Deterministic original SVG capsule through genesis, evolution and freeze; full datum JSON/CBOR and digest at each step. |
| `fixtures/protocol-parameters.json` | Public epoch-654 parameter snapshot, with source and access timestamp, for reproducible synthetic transaction tests. |
| `evaluation/public-utxo-node-evaluation.json` | Independent node issuance execution and two script rejections using current public UTxOs; unsigned, no submission. |

The [independent evaluation record](../contracts/state-capsule/evaluation/README.md)
used 894,708 memory units / 296,197,894 CPU steps. Its 9,475-byte unsigned mint
preserved existing assets from seven current public inputs. The provider's
additional-UTxO route separately returned a protocol decode fault; that fault
is not counted as a contract rejection. Reproduction scripts, compiler hashes
and a scoped implementer correctness review accompany the sanitized receipt.

The applied demonstration script is **3,100 bytes**. With one signer and the
checked-in fixtures, the 76-byte genesis datum produced a **3,798-byte signed
mint**; evolve/freeze produced **3,869 bytes**. A **3,693-byte datum** produced a
7,416-byte signed mint and a 7,462-byte update. These are measured complete
fixture transactions, not universal byte or fee promises. Actual wallets need
fresh parameters, complete signed-size measurements and node evaluation.

The offline compiled wrapper used about 0.385 million memory units / 137.6 million
CPU steps for the small mint and 0.691 million / 268.0 million for its update.
The larger update used about 1.82 million / 1.04 billion. The synthetic declared
budget is 4 million / 1.5 billion. These are local evaluator measurements;
real execution costs depend on the full transaction and network cost model.

The adapter passes actual CSL transaction inputs, resolved outputs, output values,
inline datums, required signers, mint and redeemers into the compiled V3 wrapper.
It intentionally supports the fixture lane only. Its validity interval is a
synthetic POSIX interval because this contract does not use time; real evaluation
must obtain network era history. This is not ledger phase-1 validation.

## Reproduce and extend

Install the pinned Aiken compiler from its official release and NFT-Studio's npm
dependencies, then run the commands in the [contract README](../contracts/state-capsule/README.md).
Those deterministic scripts do not fetch chain data or submit transactions. The
separate `evaluation/` scripts perform explicit read-only provider evaluation
with an operator-supplied API credential. `apply-demo.mjs`
reapplies the synthetic seed and name. `build-demo.mjs --check` checks deterministic
history reproduction. The browser-safe codec exposes `buildDatum`, `transition`,
`verifyState`, `verifyHistory`, `assetNames`, and TypeScript types.

`prepareUnsignedCapsuleMint` in `scripts/unsigned-mint.mjs` builds a real unsigned
CSL transaction from caller-supplied UTxOs, a fully applied blueprint, current
parameters and an explicit execution budget. Its body is checked against the
independently assembled signed fixture. It does not sign, submit, verify fresh
ownership or infer that arbitrary supplied applied code matches its seed. Its
readiness remains `experimental-unsigned`; the chain must evaluate the binding.

Before admitting this as a live creator template: finish a complete wallet
issuance/update/freeze flow, independent node spending/evolution/freeze evaluation,
preproduction confirmation and state recovery, chain-origin/history verification,
fee/ADA explanations, independent security review and mobile wallet acceptance.
Keep existing ordinary native minting unchanged until these steps are evidenced.

The useful next directions are deterministic evolving artwork, transferable
configuration capsules, collectible public journals and bounded stateful game
objects. A trusted achievement source, secret payload, yield position, rental or
redemption protocol requires additional rules; this holder-editable state alone
does not enforce those promises.

## Primary sources

Accessed 2026-09-07 UTC:

- [CIP-68 — Datum Metadata Standard](https://cips.cardano.org/cip/CIP-0068): paired assets, labels, three-field datum, metadata representation and arbitrary update logic.
- [CIP-67 — Asset Name Label Registry](https://cips.cardano.org/cip/CIP-0067): checked label prefixes.
- [CIP-31 — Reference inputs](https://cips.cardano.org/cip/CIP-0031) and [CIP-32 — Inline datums](https://cips.cardano.org/cip/CIP-0032): read-only references and inline state.
- [Aiken gift-card example](https://aiken-lang.org/example--gift-card): one-shot UTxO issuance pattern.
- [Aiken tests](https://aiken-lang.org/language-tour/tests): unit/property execution and expected-failure semantics.
- [Aiken stdlib v3.1.0](https://github.com/aiken-lang/stdlib/tree/v3.1.0): `cardano/transaction`, `cardano/script_context`, `aiken/cbor` and `aiken/crypto` representations used by this build.

Standards describe interoperability and ledger mechanisms. They do not certify
this implementation or its threat model.
