# CIP-113 merged — September 29, 2026

After years of community work, **CIP-113: Programmable token-like assets**
was merged into the official Cardano CIPs repository's default branch (`master`)
on **2026-09-29 at 16:58:03 UTC**. It specifies programmable tokens on Cardano,
including transfer controls relevant to tokenized securities. Projects can now
build against the merged specification.

The supplied community announcement particularly recognizes **Giovanni Gargiulo
(@CryptoJoe101)** for his work toward production readiness. The specification
credits **Michele Nuzzi, Matteo Coppola, Philip DiSarro and Giovanni Gargiulo**.

## Exact status and scope

The merged document still declares **Status: Proposed**, identifies the current
design as **Version 3.0**, and leaves its Path to Active criteria unchecked.
Repository merge, formal Active status, implementation security and actual
production adoption are separate claims. This update records the merge and
credits; it does not independently certify production readiness.

NFT-Studio exposes this addition through `search_knowledge`, `read_knowledge`
with `id: "cip-0113"`, and `nft-studio://knowledge/cip-0113`. Its classification
remains **research-only**. Ordinary Studio NFTs do not acquire transfer rules
from metadata or from this knowledge update. The separately frozen September 7
full-source corpus remains historical; use this entry for the newer CIP-113.

## Primary evidence and implementation discovery

- [Merged PR #444](https://github.com/cardano-foundation/CIPs/pull/444).
- [Exact merged specification](https://github.com/cardano-foundation/CIPs/blob/e759a4a56c03c87175f3561b136283398fefccfe/CIP-0113/README.md).
- [Cardano Foundation reference contracts](https://github.com/cardano-foundation/cip113-programmable-tokens).
- [Platform and substandards](https://github.com/cardano-foundation/cip113-programmable-tokens-platform).

`merge.json` records the observed GitHub API merge fields, retrieval time and
source SHA-256. `CIP-0113.md` preserves exact specification bytes from the merge
commit. Implementation links are discovery references, not reviewed deployment
or audit receipts. Verify exact contract versions and audit scope before use.

## Attribution

The archived specification is by Michele Nuzzi, Matteo Coppola, Philip DiSarro
and Giovanni Gargiulo, licensed **CC-BY-4.0**, as declared in its frontmatter and
copyright section. It is reproduced unchanged; source and license links remain
in the document. This summary and Studio integration notes are separate writing.

## Catalog admission

This targeted update advances the catalog date and adds CIP-113 with its own
immutable source pin. The base `sourceRevision` and all previous source pins
remain unchanged. CIP-143 now links to the admitted replacement. The implementation
register's `sourceCatalog.sha256` is rebound to these reviewed catalog bytes;
its dated implementation records, observations and evidence are unchanged.

## Verification

- Catalog validation: 8 groups, 59 entries / 74 sources.
- Online immutable-source audit: all 74 source hashes match.
- Drift-checker fixtures and implementation admission passed; 56 historical
  evidence blobs still match, with no implementation record changed.
- Rebuilt local stdio MCP: search by CIP113, securities and CryptoJoe101;
  entry read and resource read passed with exact pin and Proposed/research-only.
- Full MCP run: 98/103 initially passed; five assertions still expected the old
  resource count. Updated the release verifiers for 63 resources and added
  CIP-113 status/pin/no-implementation assertions. Both affected test files
  reran successfully (12/12), covering all five initial failures.
- Public-host privacy scan and Git whitespace checks passed.

Existing connected MCP processes must reconnect to load the rebuilt catalog.
This source/local MCP update does not deploy the hosted Worker or Pages app.
