# Pinned original CIP documents

This is a **source inventory of 148 original CIP README documents**, separate from NFT-Studio's curated engineering knowledge. It archives exactly the `CIP-[0-9]{4}/README.md` blobs in [cardano-foundation/CIPs commit 05ee6bb05982289dbe00c4187b9d54cf90e2e276](https://github.com/cardano-foundation/CIPs/tree/05ee6bb05982289dbe00c4187b9d54cf90e2e276). The original documents total **3,425,888 bytes**. Annexes, attachments, images, translations, CPS documents, pull requests and off-repository references are outside this inventory.

Original authors retain authorship. Source documents are unchanged UTF-8 `.source.txt` files, with their original notices and per-document licenses. Read [ATTRIBUTION.md](ATTRIBUTION.md) and [LICENSING.md](LICENSING.md). BEACN Labs authored the inventory and bounded retrieval/search code. A proposal's own title and status are copied from its frontmatter; neither is evidence of adoption, execution, conformance, ledger enforcement or Studio implementation. No summaries or maturity assessments are generated here.

## Files and evidence

- `sources/`: the 148 unchanged READMEs; names indicate the original CIP directory.
- `index.json`: exact title, full status string, original author/copyright text, byte spans, license declarations, source paths/URLs/commit, Git blob SHA-1, SHA-256 and byte counts.
- `pin.mjs`: the fixed index text hash, commit and size/count commitments used by the runtime.
- `lib.mjs` and `lib.d.mts`: browser-compatible, dependency-free API and declarations.
- `evidence/`: pinned Git commit and complete recursive/non-recursive tree responses, original root README, stable retrieval receipt, explicit table comparison and dated local verification results.
- `scripts/`: fixed-target retrieval and deterministic extraction/build. Downloaded documents are never executed.
- `test/`: Node inventory/hash/search/boundary checks, extraction negatives, optional independent YAML oracle and actual Chromium module verification.

[FINDINGS.md](FINDINGS.md) records the 143-row root table's differences from the 148 source documents. The inventory uses each document's original frontmatter, including case, inline backticks and explanatory inactive statuses. The root table remains a separate preserved observation.

## Pure runtime API

The host explicitly supplies the **exact original `index.json` text** and a plain map from each canonical CIP id to its original document text. This module does not fetch those files, read local paths, follow Markdown links, accept uploaded scripts or run source examples. Load only fixed packaged files through a host-owned loader, retaining UTF-8 bytes (`TextDecoder('utf-8', { fatal: true, ignoreBOM: true })` when starting with bytes). The supplied text must roundtrip to the pinned hash; normalization or replacement characters cause verification to fail.

```js
import { createStandardsCorpus } from './knowledge/standards/lib.mjs';

// indexJson and documents were explicitly preloaded by the host.
const corpus = await createStandardsCorpus({ indexJson, documents });
const matches = corpus.search({ query: 'music', limit: 12 });
const first = corpus.getChunk({ id: 'CIP-0190', offsetBytes: 0, limitBytes: 8192 });
const next = corpus.getChunk({ id: first.id, offsetBytes: first.nextOffsetBytes, limitBytes: 8192 });
const original = corpus.getDocument({ id: 'CIP-0026' });
```

Initialize once for the host's preloaded corpus. Construction snapshots all supplied values before asynchronous hashing, checks the fixed index SHA-256 before parsing it and authenticates every document before returning an API. Its maps and index are private/frozen; returned values cannot mutate them. Index whitespace changes also reject because the index's exact serialized bytes are pinned.

Search covers only **id, title and status**, with deterministic source-id ordering, at most 256 UTF-8 query bytes, 12 whitespace tokens and 25 results (default 12). A sole `26`, `CIP26`, `CIP 26` or `CIP-0026` is an exact numeric-id query. Other queries require every token as a case-insensitive substring in the indexed fields. The optional `status` filter requires an exact key from `corpus.index.statusCounts`; for example `Inactive (abandoned for lack of interest)`. Query `Inactive` finds all three inactive documents without discarding their explanatory status text.

Retrieval requires canonical `CIP-####` ids. Unknown ids, unknown fields, non-integer/negative offsets, coercible objects and accessor properties reject. These APIs consume plain in-memory data; they are not a sandbox for malicious JavaScript proxies or modifications to platform built-ins. An external JSON/HTTP adapter must enforce its own request size and concurrency limits before parsing/loading data.

`getDocument` returns one complete original document, bounded by the 512 KiB source cap (the largest actual document is CIP-0190 at 380,819 bytes). `getChunk` accepts **UTF-8 byte offsets**, not JavaScript UTF-16 character indexes. Chunk limits are 4–16,384 bytes, default 8,192. A start offset within a multibyte code point rejects. If the requested end falls inside one, the end retreats to the preceding complete code-point boundary. No byte is dropped: use `nextOffsetBytes` until it is `null`. At the exact document end an empty chunk is valid. Results include exact start/end/next offsets, returned/total bytes and the **whole-document** SHA-256 and Git blob identity. No chunk hash or section interpretation is claimed. The original UTF-8 text, including line endings, remains unchanged. This snapshot contains no BOM or CRLF bytes; adding them fails the pinned commitment. The extraction tests separately exercise CRLF span preservation.

Returned text includes Markdown, HTML and code examples as **inert data**. Integrations must render it as text or fenced code; do not use `innerHTML`, auto-execute code blocks, fetch images, or follow embedded links automatically. A selected source URL is attribution, not authorization for a provider or network operation. The pure API itself includes no UI, wallet/provider integration or deployment. The separate browser/MCP adapters are described below.

## Reproduction

Runtime/build tests need Node 22+ (Web Crypto and well-formed-string support) and Python 3. No npm packages are needed for the runtime, retrieval, build, or core tests. From this directory:

```bash
python3 -B scripts/build.py --check
python3 -B test/extraction.py
node --test test/corpus.test.mjs
```

`python3 -B test/extraction.py --yaml-oracle` additionally compares all 592 selected fields with PyYAML SafeLoader. The recorded independent run used installed PyYAML 6.0.1; this optional test dependency is not imported by the builder or browser library.

For a fresh online check against the same immutable sources:

```bash
python3 -B scripts/retrieve.py --online
python3 -B scripts/build.py --check
```

Retrieval is fixed to the reviewed repository/commit, matching source paths and the official Apache 2.0 text. Four workers, 512 KiB per-source, 4 MiB per-tree and 32 KiB license caps bound downloads. Socket operations time out after 25 seconds; an elapsed 45-second source deadline and 600-second overall deadline are checked between reads. A currently blocked read may take up to its socket timeout beyond the elapsed deadline. No arbitrary command-line URL/path/commit is accepted. Redirects, truncation, count/size/blob mismatches and differing existing files fail. Partial runs are resumable only when already written bytes match. Retrieval emits a dated stdout audit; the committed stable receipt deliberately has no wall-clock field. To regenerate missing derived files, run `python3 -B scripts/build.py` without `--check`.

The browser test takes an installed Puppeteer module and Chromium executable through explicit environment variables; neither is a runtime dependency:

```bash
PUPPETEER_MODULE=/absolute/path/to/puppeteer-core.js CHROMIUM_PATH=/absolute/path/to/chromium node test/browser.mjs
```

It serves only the two fixed library modules on an ephemeral loopback port, supplies the corpus in memory, forbids runtime fetch/wallet capabilities and compares every document digest against independent Node crypto. Native browser ES-module import is the build/runtime proof; there are no Node shims or runtime dependency bundles. The recorded run used Chromium 152.0.7977.64 and passed 2,199 browser assertions with no external requests or runtime network/wallet calls.

The Git commit/tree/blob checks establish correspondence to the pinned Git object inventory received from the official repository. They do not independently authenticate an author's identity, review proposal correctness, fetch later revisions or establish chain facts. This snapshot intentionally remains separate from the curated entries and implementation receipts in the parent knowledge directory.

## Studio integration

The adjoining `bundled.mjs`/`bundled.d.mts` and `scripts/build-bundle.mjs` package this same authenticated source inventory for host adapters. The original pure `lib.mjs` API and index pin remain unchanged. Browser/MCP interfaces and their distinct capability limits are documented in [CIP source access](../../docs/CIP_SOURCE_ACCESS.md); the 148 originals are still separate from curated research. Both full retained license texts travel with the packaged source. The optional retriever now refuses HTTP redirects before contacting the destination; `python3 -B test/retrieval-redirect.py` proves that behavior using an owned loopback fixture.
