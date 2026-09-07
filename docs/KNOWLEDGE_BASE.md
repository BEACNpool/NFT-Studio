# BEACN Labs knowledge base

This is a public, source-pinned engineering reference for Cardano creative technology.
It contains original summaries of **40 standards, 10 tools and 8 BEACN design
patterns**, backed by **73 primary sources**. The initial snapshot was researched
on **2026-09-07 UTC**. It is a starting corpus, not a complete Cardano encyclopedia,
a live adoption registry or evidence that every described feature exists in Studio.

The strongest direction is **artifacts that carry their own evidence**: exact
content recovery, explicit authority, reproducible contract builds and testable
capability claims. The ideas compose existing work; we make no first-in-the-world
or breakthrough claim merely for combining standards.

## Read or integrate

- [Machine-readable catalog](../knowledge/catalog.json) — the canonical entries and sources.
- [JSON Schema](../knowledge/schema.json) — bounded interchange structure.
- [Admission and evidence rules](../knowledge/ADMISSION.md) — what a claim means.
- [Implementation evidence register](../knowledge/IMPLEMENTATIONS.md) — six published implementations with separate capability environments, limitations and immutable source links. The browser joins these records to related research entries.
- [Open source-review issues](../knowledge/review-issues.json) — contradictions and missing evidence.
- [Five additional primitives](../knowledge/guides/underexplored-primitives.md) — scoped CIP-26/45/69/116/170 experiments and source discrepancies.
- [Opportunity map](../knowledge/guides/opportunity-map.md) — priority, dependencies and acceptance gates.
- [Living artifacts](../knowledge/guides/living-artifacts.md) — lifecycle and validator invariants.
- [Artifact passports](../knowledge/guides/artifact-passports.md) — reproducibility and compatibility evidence.
- [Agent minting](../knowledge/guides/agent-minting.md) — a concrete authority boundary for MCP.
- [Toolchain selection](../knowledge/guides/toolchain.md) — how to select and test components.
- [Source-change monitoring](../knowledge/guides/source-drift.md) — weekly, read-only CIP drift reports for review; no automatic catalog edits.

```js
import catalog from './knowledge/catalog.json' with { type: 'json' };
import { validateCatalog, getEntry, searchKnowledge } from './knowledge/lib.mjs';
validateCatalog(catalog);
getEntry(catalog, 'CIP68');
searchKnowledge(catalog, 'self-deposit', { kind: 'standard', limit: 5 });
```

`lib.mjs` is pure and browser-safe: no filesystem, fetch, wallet or code execution.
Search is bounded literal token matching and returns full entries with a score;
its score is relevance, not truth or quality. Filters accept `kind`, `tag` and
exact upstream `status`. `getEntry` returns an entry or `null`. Node consumers can
use the fixed package-relative `loadCatalog()` from `knowledge/node.mjs`.

```sh
node knowledge/verify.mjs
node knowledge/verify-implementations.mjs --require-repository
node knowledge/audit-sources.mjs --online
```

The first command checks structure, reference integrity, search behavior,
status distinctions, hostile inputs and accidental public-data contamination.
The second validates implementation records and immutable local Git blobs.
The third downloads only the catalog's pinned source URLs with explicit size,
time and concurrency bounds and checks SHA-256; it does not update the catalog
or execute downloaded content. None of these commands evaluates a Cardano transaction.

## What each entry tells you

`facts` carries source-linked observations. `designNotes` and `opportunities`
are BEACN's reasoning or proposals. `enforcement` names the mechanism and what it
cannot establish. `lifecycle`, `risks` and `interoperability` make the cost of a
working implementation visible. Source hashes identify the exact reviewed files.

`maturity.standardStatus` preserves upstream wording. For example, CIP-68 is
Active while CIP-67 remains Proposed; CIP-143 is Inactive and points to candidate
CIP-113. **All knowledge entries are research-only.** Implementation evidence
belongs in the separate implementation register and capability receipts, not an
automatically promoted research field. This avoids implying that a successful search result is a
working minting feature.

Current-source status was read from the official
[Cardano CIPs repository snapshot](https://github.com/cardano-foundation/CIPs/tree/05ee6bb05982289dbe00c4187b9d54cf90e2e276).
A source commit pins the repository snapshot; it is not the individual document's
last-modified date. Tool release metadata is a dated observation of the upstream
release endpoint; it is not a recommendation to install that release or a claim
that every package in a monorepo has that version.

## Contribute

Edit the catalog and relevant guide with original prose. Add primary evidence,
record uncertainties, keep all references resolvable, and run the validator.
Do not copy private operational records, credentials, signing packets or personal
data into this public corpus. No private fleet document is a research source here.

Read [attribution](../knowledge/ATTRIBUTION.md) before reusing upstream text or
artifacts. This corpus links and summarizes; upstream specifications, code and
third-party art retain their own licenses.
