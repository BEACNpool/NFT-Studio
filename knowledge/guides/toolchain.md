# Toolchain selection and reproducibility

Choose tools by the invariant or evidence they supply. Importing a large SDK does
not remove the need to verify identity, authority, value conservation and exact
signed bytes. The catalog records upstream repository revisions and release
observations, not a universal recommended-version matrix.

| Responsibility | Candidate | What to test before adoption |
| --- | --- | --- |
| Validator source, compiler and blueprint | [Aiken](https://github.com/aiken-lang/aiken) | Pinned compiler/stdlib, language target, adversarial properties, blueprint and independent hash |
| Exact byte construction and decoding | [CSL](https://github.com/Emurgo/cardano-serialization-lib) | Browser/Node parity, CBOR wrappers, witness merge, token and ADA conservation |
| Higher-level Plutus builder | [Lucid Evolution](https://github.com/Anastasia-Labs/lucid-evolution) or [Mesh](https://github.com/MeshJS/mesh) | Exact package, provider/evaluator adapter, supported wallet forms and independent decoded output |
| Fresh state and concrete evaluation | [Ogmios](https://github.com/CardanoSolutions/ogmios) | Node compatibility, cost models, final body/context and error semantics |
| Targeted UTxO discovery | [Kupo](https://github.com/CardanoSolutions/kupo) | Pattern coverage, initial point, tip/rollback handling and datum completeness |
| Public API observations | [Koios](https://github.com/cardano-community/koios-artifacts) | Network, response identity, pagination, freshness and exact field semantics |
| Disposable lifecycle integration | [Yaci DevKit](https://github.com/bloxbean/yaci-devkit) | Correct era/images, no-value keys, rollback and multi-transaction recovery |
| Interactive session protocol | [Hydra](https://github.com/cardano-scaling/hydra) | Head participants, lifecycle, known issues, closure/contest and final L1 observation |
| Optional certified recovery artifacts | [Mithril](https://github.com/IntersectMBO/mithril) | Supported artifact type, certificate chain/trust anchor, coverage and freshness |

## Three version traps observed in this research

The Lucid Evolution repository's latest GitHub release was a release of the
`scalus-uplc` workspace component. That is not the version of the main Lucid
package. Select the package first, then inspect its own release and lockfile.

Yaci's release endpoint returned a beta-tagged release with `prerelease: false`.
Its own README distinguishes stable and beta versions and their node/protocol
targets. A GitHub boolean does not override that compatibility table.

Mithril's historical repository URL redirected to IntersectMBO. Preserve the
captured source bytes and their hash while following the maintained upstream
for new research. A renamed repository is not evidence that its cryptographic
assumptions or artifact readiness changed.

The supporting dated observations are in [catalog.json](../catalog.json).
Recheck them before installation; source HEAD and installed release are separate.

## Preserve useful independence

A practical pipeline uses one component to build and another path to inspect.
For example, a high-level builder can construct a proposed update while a
low-level decoder checks the mint map, outputs and committed data. An evaluator
checks the actual script context. A browser test exercises the holder action.
An independent recovery tool reconstructs bytes from a receipt.

Independence is reduced when every test calls the same helper that contains the
bug. Write fixtures around external invariants: a wrong policy must fail, a
missing reference token must fail, and transfer must invalidate former-holder
authority. Include negatives that differ by one byte or one quantity.

Pin compiler, standard library, serialization library, evaluator, network-era
parameters and expected artifacts. Record exact source and applied parameters
for every validator. Rebuilding should produce the same script identity; if it
does not, the result is a mismatch to investigate, not a reason to update the
expected hash silently.

## Coverage before convenience

A public provider can be excellent for discovery while still being a trusted
source of mutable observations. Never describe a successful HTTP response as a
cryptographic proof. An empty index result may reflect configuration, sync lag,
pruning or pagination rather than absence on chain.

Keep reads bounded and network-specific. Do not expose a generic database,
node-RPC or URL proxy through MCP simply because the backend library supports
one. The useful public interface is the finite action the creator needs, with
its evidence and limitations attached.
