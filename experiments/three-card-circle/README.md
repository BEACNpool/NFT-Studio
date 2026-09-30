# Three-Card Circle

An NFT-Studio promotional collection of exactly three distinct business cards.
[Public preview](https://beacnpool.github.io/NFT-Studio/showcase/three-card-circle/).
**Mainnet is inactive. No real NFTs were minted and no ADA was spent.**

## Ownership rules

The initial issuance creates CARD01, CARD02 and CARD03 together, all owned by the
creator. A sender who held one or two before a transaction may send only to an
existing holder of this collection. A sender who held all three before it may
introduce a new owner. Receiving the third card within a transaction does not
give that transaction permission to introduce an outsider.

Every transfer consumes and recreates the unique CIRCLE_STATE output, containing
three owner payment-key hashes and a revision. The validator checks each input
and output against that record and requires each sender's signature. This
serializes concurrent transfers: a transaction with an already-spent record must
be rebuilt and reviewed. History is the chain of state-token outputs, not an
ever-growing array in the current datum.

All cards remain at CIP-113 programmable payment-script addresses with an owner's
verification-key staking credential. Ordinary addresses and script-owner
credentials are unsupported. The initial issuer has no seizure override.
Additional editions, repeat issuance and burns are disabled. Protocol settings
and this collection's registry entry become immutable during setup. There is no
public mint queue, return-only inventory pool or later retirement mechanism.

## Evidence and limits

- `evidence/full-tests.json` and `assertion-tests.json`: 645 passing checks each
  (609 unit, 36 property tests), including 27 new circle-specific tests. The
  complete core suite runs both with and without assertion instrumentation.
- `evidence/emulator.json`: 13 successful signed transactions, 10 rejected
  attempts, five snapshots cross-checked against actual card outputs. Tests cover
  existing holders, new owners, multi-output and whole-set transfers, missing or
  dishonest records, forbidden addresses, missing signatures, repeat issuance
  and stale concurrent transactions. All funds and identities are synthetic.
- `evidence/node-evaluation.json`: a mainnet node accepts an allowed transfer and
  rejects a forbidden one. Transactions are unsigned with synthetic additional
  UTxOs. This validates script execution, not wallet signatures, phase-one
  validity, inclusion or a deployed mainnet instance. Nothing was submitted.
- `evidence/submission-checks.json`: body, metadata, signature, fee and size
  integrity plus durable at-most-once submission behavior. The reusable guard
  requires a live preflight before and after signing and stores an attempt
  before broadcasting. An ambiguous response stays unresolved; it is not retried.
  These guards are connected to the owner transfer dialog. The inactive public deployment never requests a signature.
- `evidence/hash-check.json`: Aiken independently applies parameters. Lucid 0.6.5
  re-encodes embedded Data maps with indefinite CBOR, so its state script hash
  differs from Aiken's encoding. The applied programs are byte-identical after
  the same encoding step. Python Blake2b-224 and CML verify both encodings against
  their respective hashes. Builders consistently use the Lucid-encoded hashes.
- `evidence/reader-checks.json`: the website checks the pinned state token, exact
  datum identity, all three card UTxOs, programmable-address credentials and
  agreement with the owner record. It rejects inconsistent reads, a changed state
  UTxO during fetching, stale provider tips and updates with fewer than three
  confirmations. This is an indexer-backed display, not an independent chain
  verifier. Confirmation depth does not eliminate rollback risk.
- `evidence/budget-checks.json`: an isolated 55 ADA wallet completes all setup
  steps, transfers the complete set to a separate recipient key and returns
  unused ADA to that recipient's ordinary base address. Every signed transaction
  passes the body, script, signature, fee and size guard. No real keys or funds
  are used. The 5 ADA collateral output stays separate until the final refund;
  3 ADA is declared as collateral, leaving a valid return output if a script fails.

These checks are not an independent contract audit. CIP-113 remains a proposed
standard. Physical-wallet interoperability, actual funding inputs, fee estimates,
signed size and real deployment identities must be rechecked before activation.
The published deployment remains inactive until setup is approved, funded and
confirmed. No synthetic owners are shown. The owner transfer interface is
implemented and tested with synthetic CIP-30 signatures; physical VESPR
acceptance and real mainnet activation are still pending.

## Compact ownership view

The page shows the three cards and their full programmable addresses on one
screen. It derives each address from the pinned payment script and the owner key
in the authenticated state, then checks the actual card output matches it. The
"all 3" rule therefore means one exact address, not wallet-wide holdings.

BEACN Koios supplies confirmed state and card UTxOs. The page refreshes every
minute while visible and supports manual refresh. History opens in a dialog,
three entries per page, pinned to the same confirmed block for pagination.
Unavailable or inconsistent data clears the addresses instead of keeping an
apparently live stale ledger. An inactive deployment reads only the provider tip.

`scripts/audit-site.mjs` covers inactive and synthetic active layouts, full address
copy/fallback, history, failures wallet discovery, and the creator guide with copy/fallback. Its revised
browser suite must pass on the final static export before this update is published.

## Measured ADA budget

Based on the September 29, 2026 mainnet parameter snapshot and synthetic funding
inputs in `evidence/budget-checks.json`, including delivery to the recipient and
return of unused funds:

| Purpose | ADA | Treatment |
| --- | ---: | --- |
| Setup, delivery and refund network fees | 4.661873 | Spent, not refunded |
| Six registration deposits | 12.000000 | Locked; these validators do not authorize deregistration |
| Permanent protocol outputs | 9.550960 | Locked |
| Shared ownership record | 1.784340 | Preserved in every update; no exit |
| Backing for all three cards | 3.439380 | Travels with cards; cannot be withdrawn by this design |
| State reference-script reserve | 15.399630 | Issuer-key output; recoverable, but the same script must be available for subsequent transfers |
| **Measured net setup and delivery total** | **46.836183** | After returning unused funds |

The bounded rehearsal starts with **55 ADA** in an isolated setup wallet and
returns **8.163817 ADA** after all eleven transactions succeed. The 15.399630 ADA
reference-script output remains in that wallet for transfer availability. The
recipient controls all three NFTs through their own payment key. Funding the
setup wallet is distinct from paying a contract address. No live setup wallet or
mainnet instance has been created by this rehearsal.

This replaces the earlier 52 ADA allowance, which was based on net activation
cost with large synthetic funding inputs. Actual inputs, signatures and live
protocol parameters must be rechecked before a concrete funding instruction.
Never fund an address derived from synthetic test seeds. A budget is not approval
to sign or submit real transactions.

The three-card mint is **15,194 signed bytes** against the current 16,384-byte
maximum, with a measured 1.019753 ADA fee included above. Earlier tested transfers cost
0.565805–0.693953 ADA. There is no universal under-one-ADA promise. The former
five-card prototype's first mint was 16,684 bytes and failed; this design uses one
state reference script and embeds the exact three SVG artworks in CIP-25 metadata.

## Build and reproduce

Install the root dependencies and run `npm ci` here. Use Aiken
`v1.1.23+8949565` at `tools/aiken-x86_64-unknown-linux-musl/aiken` (not checked in).
`npm run test:contracts`, then `npm run build:contracts`. The assertion suite uses
`aiken check -D --env with_assertions`; rebuild normally afterward.

`node scripts/fetch-parameters.mjs` refreshes the mainnet snapshot (read only).
`npm test` runs the synthetic emulator; `node scripts/verify-submission.mjs`,
`node scripts/verify-reader.mjs` and `node scripts/hash-check.mjs` verify the
associated boundaries. The emulator writes ignored raw synthetic transaction
contexts required by the submission and node-evaluation tests. Node evaluation
uses `BLOCKFROST_PROJECT_ID_FILE` pointing to a private credential file; credential
contents are never committed. The test scripts never submit a real mainnet transaction. The explicit setup
operator below can submit only under its separate reviewed-plan approval.

`node scripts/verify-budget.mjs` rehearses the bounded 55 ADA setup and recipient
delivery. It constructs its own in-memory Emulator provider; it cannot broadcast
to Cardano. Run it again after refreshing parameters or changing a builder.

From the repository root, `node experiments/three-card-circle/scripts/build-site.mjs`
bundles the reader and generates the sharing image from the exact SVG card art.
The normal `npm run build:pages` exports the site. Follow `docs/PUBLISHING.md`.

`public/showcase/three-card-circle/deployment.json` stays inactive/null until a
separately approved deployment is confirmed. Activation must pin Mainnet,
`statePolicy`, `tokenPolicy`, `transferHash`, `programmableHash`, `startBlock` and
`confirmations: 3` from the actual reviewed instance. It must also update all
activation labels and sharing metadata and enable a reviewed signing interface;
changing the manifest alone is not a complete activation.

## Source and provenance

The CIP-113 core in `contracts/` is based on Cardano Foundation
[`cip113-programmable-tokens` at 6b75ba3286b4692ca23059ff51285db357fb09c6](https://github.com/cardano-foundation/cip113-programmable-tokens/tree/6b75ba3286b4692ca23059ff51285db357fb09c6),
with its license retained. The new collection-specific modules are
`lib/circle.ak`, `validators/circle_scripts.ak` and
`validators/circle_scripts.test.ak`. Transaction builders and this preview are
NFT-Studio code under the repository license. Earlier five-card and return-only
prototypes are separate experiments and do not define these rules.

## Create your own with NFT-Studio

The showcase’s **Create your own** dialog explains the three steps: define art
and behavior, build and test with a coding agent, then review and approve with a
wallet. Its copyable prompt routes to `START_HERE.md` and capability discovery.
Embedded games/apps run in viewers; contract-enforced ownership rules require a
separate tested contract and a new deployment identity. An ordinary native mint
does not enforce Circle rules. Use this experiment as implementation evidence,
not a claim that every proposed rule is a one-click Studio feature.

## Owner transfers

The lockfile uses registry packages with integrity hashes and the tested versions;
it does not depend on a neighboring local checkout.

The lazy browser engine is generated by `npm run build:wallet` from the same
`transactions.mjs` and `submission.mjs` used in the rehearsals. CML and UPLC WASM
are served locally, with browser Buffer/EventEmitter compatibility packages.
CIP-30 wallet methods provide wallet addresses, inputs, signatures and submission.
Reference: https://cips.cardano.org/cip/CIP-0030 (checked September 30, 2026).

After connecting, an owner selects cards and a receiving address. The review
shows that entered address, the derived full programmable destination, exact
fee, 3 ADA declared collateral and expiry. Only the explicit approval button
requests a signature and one submission. Fresh wallet identity, parameters,
state, inputs and references are checked before and after signing. The signature
must preserve the exact transaction and pass the complete fee/size guard.
An uncertain result keeps a transaction link and a durable attempt marker;
reopening the dialog cannot resubmit the same ownership state.

The wallet needs separate clean ADA-only outputs of at least 5 ADA for
collateral and 3 ADA for fees/change. No automatic wallet restructuring occurs.
The fee cap is 1.5 ADA per transfer; minimum ADA with each NFT is preserved.
`utxo_info` supplies spent-aware input checks instead of Lucid 0.6.5’s stock
Koios `getUtxosByOutRef`. Protocol/ownership data uses BEACN Koios. Submission
uses the connected wallet; no public operator signer or credential is shipped.

`evidence/wallet-browser-checks.json` records the actual browser bundle completing
whole-set and reunion transfers against an Emulator, and rejecting split-to-new,
changed-wallet, stale-input and duplicate/uncertain attempts. Synthetic CIP-30
keys are used. Emulator registrations use a documented test-only reward-address
alias for mainnet-form addresses. This is not a physical phone or mainnet receipt.
The deployment must also pin `bootstrap.transactionId`, `bootstrap.admin` and
`referenceOutref` from its confirmed setup receipt. The builder independently
derives and compares all four collection script identities before preparing.

## Bounded setup operator

`npm run test:setup` exercises the exact eleven-step operator workflow using a
55 ADA synthetic wallet. `npm run test:operator` tests real filesystem exclusive
writes, private permissions, journal replacement, interrupted-run locks, approval
and source refusals, submission-disabled transport and unknown outcomes. Current
budgets and fees are in `evidence/setup-checks.json`; they are measured estimates,
not an unchanging fee quote. Fee caps: 5.5 ADA aggregate and 1.5 ADA per step;
minimum ordinary-address refund: 5 ADA. The reference script remains funded.

The explicit CLI has `prepare`, `inspect` and `execute` commands. It requires a
verified `--host`, a canonical absolute private `--directory` outside this repo,
and an existing `--credential` path for Blockfrost mainnet. The private parent
must already exist. `prepare` also requires `--recipient`, verifies fresh
parameters/rehearsal, creates an exclusive 0600 setup key in a 0700 directory,
proves key control internally and produces a source-bound 12-hour plan.
`execute` additionally requires `--approve` with that exact plan hash **after
explicit user approval**. Funding alone is not approval. Never place credentials,
keys, unsigned/signed production packets or private journal files in this repo.

The operator confirms each step three blocks deep, keeps immutable journal
revisions, and records each attempt before its single submission. On an unknown
outcome it reconciles the saved hash; it cannot blindly retry. A killed process
leaves `run.lock`: inspect its owner PID/host and journal, prove the process is
absent and reconcile outstanding hashes before removing that specific stale lock.
Never create a replacement wallet to bypass a lock, expiry or fingerprint error.
Preserve the same wallet and funding address when renewing an unstarted plan;
an in-progress plan needs state-specific recovery, not another setup.

`evidence/setup-node-checks.json` records unsigned mainnet-node script evaluation
with synthetic additional UTxOs. That is separate from full signed inclusion.
After all eleven confirmed steps the operator writes a private receipt with the
real manifest identity; it does not publish or activate the website itself.

For browser checks set `PLAYWRIGHT_MODULE` to an installed Playwright module and
`CIRCLE_URL` to the preview or static export. No physical wallet is connected.
