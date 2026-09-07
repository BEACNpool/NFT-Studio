# Implementation evidence register

`implementations.json` records dated observations about NFT-Studio features. It is separate from the frozen `catalog.json`: neither the catalog's research-only maturity nor any upstream CIP status changes when this register changes. The catalog's exact SHA-256 is recorded under `sourceCatalog`; CI checks those bytes and every `entryIds` join.

There are five records at this snapshot. All five have published source. Artifact Passport has a browser import/export flow; the holder-proof verifier remains experimental offline code with no deployed authentication service. A record's `publication` describes source availability; each capability's `environment`, evidence and limits describe what was actually exercised. Do not turn these into one overall readiness score.

Capsule issuance has independent node script evaluation using public inputs. Its evolution/freeze tests use synthetic transactions and a local compiled evaluator. The browser's downloadable state history is local data. None of those observations establishes a capsule mint or confirmation.

The current public MCP receipt observed nine tools and 55 resources at 2026-09-07T06:28:25.565Z, including independently checked synthetic NFT/data unsigned output. The earlier eight-tool observation is retained. These are dated observations of the deployed public service; neither establishes chain availability for fabricated inputs or signing/submission authority. The separately installed Node witness-verification service is not claimed as remotely deployed. The source-drift sample similarly describes one upstream comparison, not perpetual freshness or a successful scheduled workflow run.

## Data and validation

Each capability references evidence IDs within its record. Every artifact has a repository-relative path and SHA-256. Published artifacts additionally have a full 40-character commit and the exact `https://github.com/BEACNpool/NFT-Studio/blob/<commit>/<path>` URL. Unpublished candidate artifacts have a null commit and URL; their paths describe intended repository locations. A published experimental implementation can still have an offline-candidate capability environment. Never manufacture a public link for an unpublished file.

`observedAt` uses the original receipt time where available. Candidate developer test observations use this register's observation time; their descriptions identify a test procedure or fixture rather than pretending it is a signed receipt. A source file digest identifies bytes. It does not prove that tests passed, authenticate a reviewer, verify code safety or establish chain inclusion.

`implementations.schema.json` bounds the document's structure. `implementations.mjs` adds semantic checks: unique IDs, resolved evidence references, candidate publication restrictions, exact commit/path URL correspondence, dated external observations and capability-specific evidence kinds. Pass the validated research catalog's entry IDs to check the join. These validators cannot determine whether natural-language claims are true. Claims still require source review and scoped evidence under [ADMISSION.md](ADMISSION.md).

The pure loader accepts already-read JSON text, at most 65,536 UTF-8 bytes; it performs no file access or fetch. Object validation takes a fresh bounded inert-data snapshot. Limits are five records, 12 evidence items and eight capabilities per record, depth ten and 4,096 nodes. Imported JSON uses ordinary JSON parsing and is not an authenticated/canonical signing format. Lookup helpers take the validated register and do not mutate or promote it.

```js
import research from './catalog.json';
import raw from './implementations.json';
import {
  validateImplementations,
  implementationsForEntry,
  getImplementation,
} from './implementations.mjs';

const implementations = validateImplementations(
  raw,
  research.entries.map(entry => entry.id),
);
const related = implementationsForEntry(implementations, 'living-artifact');
const capsule = getImplementation(implementations, 'living-artifact');
```

The JSON imports above are illustrative; use the bundler's existing JSON-import convention. `parseImplementations(text, entryIds)` provides the equivalent for a host that already read a file or fixed resource. Type declarations are in `implementations.d.mts`.

## Integration points

In `components/knowledge-panel.tsx`, join the selected research entry to `implementationsForEntry`. Show a separate **Implementation evidence** area with publication status, capability environment, dated evidence links, limitations and next evidence. Preserve the original research status and CIP status. Render text as text; use only validated artifact URLs for links. A null URL should show “Candidate source awaiting publication,” with its intended path/digest available as details.

MCP exposes one fixed read-only resource, `nft-studio://implementations`, backed by the validated bundled JSON. Both `read_knowledge` and per-entry resources include sibling related implementation IDs without changing the research entry. The public service has nine tools and 56 resources; the separately installed Node service has eleven tools and the same resources. The actual public release check validates the exact register, eight linked research entries plus an unrelated empty join, and immutable evidence URL syntax. It neither fetches those URLs nor reruns their recorded experiments. See [the live receipt](../docs/MCP_PUBLIC_VERIFICATION.json). No caller-supplied URL/path reads, promotion tools or chain claims are added. Preserve older receipts as dated observations.

## Update and publication process

1. Review the exact source and observation. Keep local, synthetic transaction, independent node and live-service evidence distinct.
2. Publish the implementation source first. Obtain its full commit and verify each referenced blob's SHA-256. Candidate paths must resolve at that commit.
3. In a separate register change, add those immutable links and change only the warranted source-availability/environment claims. Source publication alone does not make an offline verifier a live service.
4. Update `asOf`, keep observation timestamps accurate, validate schema/references/blob hashes, and preserve the frozen catalog checksum. Check UI and MCP discovery after any integration change.

Run `node knowledge/verify-implementations.mjs`. The pure fixture checks need only Node 22; catalog and immutable local-git blob checks run when the full repository is available. `--require-repository` makes those admission checks mandatory. The tool does not fetch, sign, submit, edit the catalog or publish anything.
