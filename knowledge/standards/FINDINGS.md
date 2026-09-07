# Source inventory findings

Snapshot: [cardano-foundation/CIPs commit 05ee6bb05982289dbe00c4187b9d54cf90e2e276](https://github.com/cardano-foundation/CIPs/tree/05ee6bb05982289dbe00c4187b9d54cf90e2e276). These are observations of the archived files. They do not update the curated knowledge base or establish current implementation status.

## Completeness and object identity

The complete recursive Git tree contains **148** exact `CIP-[0-9]{4}/README.md` blobs. Independent enumeration of the non-recursive root tree also finds **148** matching CIP directories. Every selected path joins to one original local file and one index entry; the exact total is **3,425,888 bytes**. CIP-0190 is the largest at **380,819 bytes**. No annexes, CPS documents or off-repository references are included.

Each original matches both its Git blob SHA-1 (`blob <length>\0` plus bytes) and an independently computed SHA-256. The tests also reconstruct every tree object from its immediate entries and reconstruct the pinned commit object from its public payload/signature representation. This authenticates object correspondence; the suite does not verify PGP signer trust. The pinned commit points to tree `f4c9712aa121707f1df1ebb0cc4ca247aa3ef6d3`.

## Root table comparison

The original [root README](https://github.com/cardano-foundation/CIPs/blob/05ee6bb05982289dbe00c4187b9d54cf90e2e276/README.md) has **143 CIP table rows**. Their declared ids omit these five source documents:

- CIP-0168
- CIP-0172
- CIP-0178
- CIP-0183
- CIP-0188

The CIP-0162 row links to CIP-0161, producing 142 unique linked ids instead of 143; CIP-0162 is consequently also missing from the set of linked destinations. The inventory is based on source paths and each source's own CIP field, so the root link typo does not redirect retrieval.

The root table calls CIP-0088, CIP-0151 and CIP-0158 `Proposed`, while their own original frontmatter says `Active`. Three inactive frontmatter fields contain explanatory text omitted in the root table: CIP-0017, CIP-0058 and CIP-0143. The index retains those complete strings. There are also **18 exact title differences**, consisting of capitalization and inline-backtick formatting. The index preserves the frontmatter title verbatim rather than silently taking the root table wording.

`evidence/enumeration.json` includes all table rows with exact original line numbers, missing-id sets and **25 explicit differences**: 18 title differences, six status-string differences and one row/link id mismatch. Differences are observations; a title case or backtick discrepancy is not described as a semantic standards error.

## Frontmatter and licensing profile

All 148 selected files use an opening/closing YAML-style frontmatter block. The extraction profile reads only plain single-line `CIP`, `Title`, `Status` and `License` scalars; it retains all other fields as exact original text. It does not execute YAML tags or attempt to interpret `Implementors`, `Discussions` or `Solution To` as evidence of adoption.

The original forms include a spaced key `Solution To`, unindented sequence items in CIP-0099 and CIP-0104, a trailing frontmatter blank line in CIP-0042, and inline backticks in several plain title values. These valid forms are preserved explicitly. Missing/duplicate selected fields, unsupported selected scalar syntax, unknown licenses/statuses, invalid UTF-8 and mismatched path/CIP ids fail closed. No selected field required a guessed value. Independent PyYAML SafeLoader comparison checked all 592 selected values against the same originals.

Statuses are **62 Active, 83 Proposed and three separately preserved explanatory Inactive strings**. License frontmatter is **127 CC-BY-4.0 and 21 Apache-2.0**. The extra code license in CIP-0115 and conflicting frontmatter/body declarations in CIP-0121 are described in [LICENSING.md](LICENSING.md); neither is silently resolved.

## Runtime evidence and limits

The dependency-free module authenticates a fixed index and all preloaded originals before permitting access. Ten Node test groups cover complete tree/source/index joins, Git object/SHA-256 identity, original byte spans, search, all-document chunk reconstruction, every actual UTF-8 continuation offset, corrupt input, unknown fields, bounds and mutation/accessor cases. Actual Chromium checks cover all originals/chunks, independent Node digest parity and runtime network/wallet prohibition.

This snapshot contains no BOM or CRLF bytes; source addition or line-ending normalization is rejected by the exact commitment. The separate extraction test preserves byte spans on synthetic CRLF variants. Chunk decoding uses fatal UTF-8 with BOM-preserving behavior; starts inside a code point reject and ends retreat to a valid boundary, with exact continuation offsets returned. Source HTML and programs are never rendered or executed by this module.

No proposal correctness review, full-repository archive, latest-HEAD monitoring, annex reconstruction, ledger execution, wallet operation, UI/MCP adapter or hosted capability is included. The 58 curated engineering entries and 73 reviewed sources remain their own register; these original documents are a parallel source inventory.
