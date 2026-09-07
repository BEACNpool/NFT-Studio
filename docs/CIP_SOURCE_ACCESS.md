# Original CIP source access

Knowledge has two distinct collections: **58 curated research entries** with engineering interpretation and implementation evidence, and **148 original CIP README documents** from [the fixed official repository snapshot](https://github.com/cardano-foundation/CIPs/tree/05ee6bb05982289dbe00c4187b9d54cf90e2e276). The original-source collection adds no curated facts or implementation records. Its scope excludes annexes, CPS documents, attachments and off-repository references.

In **Labs → Knowledge → Original CIPs**, search an id, title or exact declared status. Source documents load from one packaged browser asset only when that tab is selected, then their original index and document hashes are verified. The selected reader shows at most 8,192 UTF-8 bytes at a time. Next/Previous chunks preserve exact byte continuity; wrapping changes only the display. Original Markdown, HTML, links and programs stay inert text. The explicit source link opens the exact pinned revision only on user action. Original author notices, full retained license texts and the **whole-original** SHA-256 are available in the reader.

The original source may contain misleading or outdated claims. A displayed status is the author's upstream status string at that commit, not a claim of current adoption, correctness, chain enforcement or Studio support. The explanatory inactive strings and observed CIP-0121 license inconsistency remain visible. Read [source findings](../knowledge/standards/FINDINGS.md), [licensing](../knowledge/standards/LICENSING.md) and [attribution](../knowledge/standards/ATTRIBUTION.md).

## MCP interface

This source adds two read-only, deterministic, closed-world tools to both transports:

| Tool | Input | Output boundary |
| --- | --- | --- |
| `search_cip_sources` | `query` (default empty), optional exact `status`, `limit` 1–10 (default 5) | At most ten id/title/status/source descriptors; searches only id/title/status, not document bodies. |
| `get_cip_source_chunk` | Canonical `CIP-####` id, `offsetBytes` (default 0), `limitBytes` 4–16,384 (default 8,192) | One inert original text chunk, exact UTF-8 offsets, next offset, total original bytes, source citation, original authorship/license and whole-document hashes. |

Search enforces 256 UTF-8 bytes and 12 words through the shared pure API. Unknown fields, caller URLs/paths, nonexistent ids, non-integer bounds and mid-codepoint start offsets reject. If a requested end falls inside a code point, it retreats to a complete boundary; `nextOffsetBytes` identifies the next exact start. `nextOffsetBytes: null` means the document end was reached. `complete: true` additionally means the returned chunk started at byte zero and contained the whole original. Neither returned hash is a hash of only the current chunk.

The tools accept no wallet snapshot, content upload, provider URL or arbitrary blueprint. They do not read the network, execute programs, mutate a draft, sign or submit. Tool discovery exposes them and `studio_capabilities.cipSources` describes the source pin and bounds. **No new resources are added:** the integrated package exposes **15 public tools / 17 Node tools / 61 resources**. The retained 13-tool music flow is covered by compatibility checks. The observed hosted count remains whatever the current [public release receipt](MCP_PUBLIC_VERIFICATION.json) records; local integration tests do not constitute a deployment.

Example arguments:

```json
{"query":"CIP188","limit":1}
```

```json
{"id":"CIP-0190","offsetBytes":0,"limitBytes":8192}
```

External consumers must treat returned source text as untrusted data, preserve the original attribution/licenses and impose their own request/concurrency limits. Do not render imported HTML or follow embedded URLs automatically.

## Reproduction and packaging

The source index SHA-256 remains `669831b130fceebfa87bdcacea2497e04962be47e47729181c01f8c93e9f8a1f`. All 148 original README bytes and all 58 curated entries are unchanged. `knowledge/standards/scripts/build-bundle.mjs` generates fixed raw imports and retained license text; it accepts no source URL or path arguments. Vite handles those fixed `?raw` imports. MCP's scoped esbuild loader handles exactly the corresponding original-source/index files.

```bash
node knowledge/standards/scripts/build-bundle.mjs --check
npm --prefix mcp test
npm --prefix mcp run test:clean
npm run typecheck
npm run build:pages
```

The integration was tested with modern and legacy official clients in Node and actual Workerd, including original source slices/hash identity, bad ids/offsets/UTF-8 budgets and the original unsigned music behavior. The actual static app was exercised at 390px/1440px with lazy-load cancellation, separate curated controls, exact chunk navigation, mobile statuses, focus recovery and zero wallet/external requests. The optional standalone retriever now rejects redirects before contacting their destinations, demonstrated with an owned loopback fixture; the original immutable corpus stays unchanged.

This adds approximately 3.83 MB of uncompressed browser source data (about 1.10 MB gzip), loaded on explicit selection. The complete Worker artifact is approximately 6.94 MB (about 1.58 MB gzip), plus the existing static CSL WASM. Source text, authorship and both license texts remain packaged. Runtime construction validates once per module instance; host-level rate/concurrency limits remain the existing server responsibility. No hosted service, quota, production CPU budget or new adoption claim is established by these local checks.

A [separate-agent corpus review](../knowledge/standards/evidence/independent-review.json)
verified native Git objects, original-source identity and UTF-8 reconstruction. Its
low-severity optional-retriever finding is corrected in this source; the
[owned-loopback check](../knowledge/standards/evidence/redirect-fix-check.json)
observed zero redirect-destination requests. This is a scoped review from the same
development session, not an external security audit.
