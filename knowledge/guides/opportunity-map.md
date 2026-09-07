# Opportunity map

The strongest BEACN showcase is a creation that a stranger can inspect, use,
transfer and recover without trusting the demonstration. The opportunity is in
connecting those steps, documenting their limits and making them usable through
both a browser and a bounded agent interface. The underlying standards already
have authors and prior implementations.

This is an engineering priority assessment, not a market-size forecast or a
claim of novelty. Priority considers user value, available primitives, new trust
dependencies and the amount of unverified behavior.

| Priority | Candidate | Concrete demonstration | Mechanism to investigate | Admission gap |
| --- | --- | --- | --- | --- |
| 1 | Artifact Passport | Recover a creation, compare every byte and inspect its declared capabilities | Existing media encoding plus exact identity, source/test manifests; study CIP-88/171/190 profiles | Independent replay and explicit proof scope |
| 1 | Agent creation workbench | Ask a bot to create a bounded artifact, then inspect the same plan in Studio | MCP preparation with finite templates and existing wallet review | Real client integration and malicious-input tests |
| 1 | Standards identity inspector | Explain two visually identical names with different bytes; diagnose an invalid label checksum | CIP-14 and CIP-67 | Official vectors and boundary tests; no ownership claims |
| 2 | Living Artifact | Change an artwork's permitted state, transfer it and prove the previous holder cannot change it | CIP-68 representation plus one-shot and state validators | Full lifecycle, adversarial evaluator and wallet tests |
| 2 | Shared Cartridges | Different instruments or games reuse one pinned engine and recover offline | Content commitments; evaluate CIP-54 viewer semantics | Viewer/CSP matrix and complete dependency recovery |
| 2 | Creator collaboration | Several creators jointly authorize a new edition | Native threshold policy and future CIP-106 wallet adapter | Actual multisig wallet behavior and asynchronous recovery |
| 2 | Multilingual exhibit | A collectible explains itself in multiple cultures with a canonical fallback | Explicit CIP-124 inline profile | Version/field agreement and byte-budget tests |
| 3 | Collection capability registration | An indexer discovers what a policy claims and what BEACN actually tested | CIP-88 plus independent receipts | Root/detail version and witness verification |
| 3 | Music interoperability | A player discovers release/song credits and reproducible audio | An explicitly tested CIP-60 profile | Resolve ledger-type and v3 example conflicts |
| 3 | One-use event pass | Two concurrent claims race; exactly one entitlement can be consumed | Reviewed consumed-state or burn policy | Atomic claim, transfer/replay and fulfillment model |
| Frontier | NFT-owned inventory | Transfer an NFT and inspect how its associated address authority changes | Proposed CIP-188 | Canonical byte vectors, self-deposit guard, escrow authority, audit |
| Frontier | Session-to-artifact | A fast multiplayer session closes into a replayable final object | Hydra and a final commitment/state design | Head lifecycle, outage, contest and L1 settlement tests |
| Frontier | Native mobile agent approvals | A native app asks a wallet to sign an exact immutable plan | Proposed CIP-186 | Real wallet/OS support and transport cryptographic review |

The status of a proposal and the existence of a Studio feature are separate.
For example, [CIP-188](https://cips.cardano.org/cip/CIP-0188) is a proposed
interoperability design with explicit authority hazards. It is valuable research
material, but its number is not permission to offer a funded vault.

## The first flagship: Living Artifact plus Passport

A useful first stateful object could be a **generative instrument**. Its immutable
program and permitted patch schema are public. The holder can choose among
bounded tunings, patterns or scenes. A reference-state revision records the
approved change. A downloadable recipe reconstructs every historical sound.

The actual promise must be narrow: the validator authorizes a state transition;
the renderer turns that state into sound. Neither proves that a performance was
musically original. The collector receives a transferable object, while copied
public code remains executable by anyone.

Before choosing parameter names or visuals, decide these mechanics:

- Does only the holder update state, or can the creator also do it?
- Is the engine immutable? Can an administrator point at new code?
- Can the holder freeze the artifact? Is freezing final?
- What happens if the reference output is missing, malformed or concurrently spent?
- Can lost authority be recovered, and who would then possess that power?

A proposal that leaves those answers implicit will eventually surprise its
holders. The [living-artifact guide](living-artifacts.md) provides the state and
test design; [CIP-68](https://cips.cardano.org/cip/CIP-0068) provides the metadata
representation, not those policy decisions.

## Novelty should be demonstrated, not declared

Maintain a prior-art list with source dates, comparable behavior and differences.
Compare products by complete use paths, not by whether a feature name appears in
marketing. The evidence bundle should let another developer reproduce the
interesting part with their own synthetic wallet and publicly available tools.

A failed hypothesis is useful KB material. Examples include an elegant renderer
blocked by a target viewer, a tiny datum whose surrounding witnesses make the
transaction too large, or an apparently standard JSON field that the ledger
cannot serialize. Publish the failure and the supported alternative; do not
quietly claim the broader capability.

## What to defer

Do not begin with financial yield, royalties on every transfer, secret public
HTML, real-world truth or arbitrary autonomous contract execution. Each adds a
large authority or enforcement problem beyond minting media. First establish
exact identity, byte preservation, explicit state transitions, wallet review and
recoverable outcomes. Richer services can then reuse that foundation with their
own honest authority boundaries.
