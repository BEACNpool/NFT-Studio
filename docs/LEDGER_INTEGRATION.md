# Ledger Scrolls and Ledger Book integration

This kit contains the public MIT source from
[`BEACNpool/ledger-scrolls`](https://github.com/BEACNpool/ledger-scrolls),
commit `500d0c73b724060e477d9a5d88d31816ac68e341`, with narrow Studio adapters.
Copy `site/` to `public/tools/ledger/` in NFT Studio. It is a static directory:
do not run the legacy `scripts/build_static.py` inside the Studio repository.
Preserve the MIT license, all relative paths and frozen files.

## Routes and product contract

| Lane | Entry point | Complete path |
|---|---|---|
| Ledger Scroll | `calculator.html` | Upload/compose → exact file hash and storage quote → wallet connection → questions/review → wallet approvals → chain byte recovery → portable receipt |
| Ledger Book | `ledger-book.html?create=1` | Name/animated cover → ownership explanation → estimated fee/ADA movement → wallet/network review → mint → supply, policy, metadata, holder and provider confirmation checks |
| Book entries | `ledger-book.html?book=POLICY.0xASSETHEX` | Open identity/history → compose public entry → review keeper payment → wallet approval → provider confirmation → read entries |
| Library/reader | `index.html` | Registry discovery or exact pointer → strict decode and hash checking → sandboxed display/download → saved shelf |
| Recovery | `calculator.html#vaultsec` | Import/export receipts, reopen and verify; interrupted Chain Scrolls retain submitted pages and page boundaries on this browser origin |
| Countersign | `calculator.html#cssec` | Pointer + decoded hash + optional role/name → review wallet transaction → public label-22026 receipt |

Scrolls preserve files; a fixed file revision is another publication. Books collect
public entries over time and work independently. Book starters change the suggested
name, not entry permissions. Entries are not private, owner-only updates or proof of
a human identity. The holder receives each protocol entry's minimum-ADA anchor.

Standard and Chain Scrolls store data in locked outputs/metadata; they do not create
an NFT themselves. The locked ADA cannot be recovered. Ledger Book creates an NFT.
Do not relabel a Scroll as an NFT mint in the surrounding Studio review.

## In-memory File handoff

`studio-ledger-client.mjs` exports:

```js
import { mountLedger, ledgerUrl } from './tools/ledger/studio-ledger-client.mjs';

const editor = mountLedger(container, {
  base: './tools/ledger/', // resolves beneath /NFT-Studio/ or a root deployment
  seed: {kind: 'scroll', title: 'Release notes', text: 'A public original.'},
  onEvent: event => { /* status and receipts; no wallet commands */ }
});
await editor.ready;
// Call from the user's explicit “Use Ledger Scroll” button.
const preparation = await editor.prepareFile(fileAlreadyHeldInMemory);
// preparation: {kind, prepared, file, sha256, decodedBytes, encodedBytes, ...}
// No wallet connection, signature, submission, network file upload or disk copy.
fullPageLink.href = editor.topLevelUrl;
// On component cleanup:
editor.destroy();
```

The frame must be the trusted same-origin Studio application. The parent CSP must
permit `frame-src 'self'` (and `blob:` if used for artwork). Wallet extensions vary
in iframe injection support: always provide the explicit full-page link. A full-page
navigation cannot carry an in-memory File; let users download/reselect their file if
they need that fallback. Seed-only title URLs must not contain file contents or secrets.

`NFTStudioLedger.prepareFile` accepts a genuine File created in the parent window;
native Blob brand checks handle the separate constructor realm. It refuses a current
signing session or partially published work. Image metadata stripping follows the
existing creator's visible option: the exact prepared bytes/hash may differ from
the uploaded camera file. The UI reports that transformation.

`ledgerUrl(base, {kind, title, embedded, book, network})` returns an origin-checked
absolute URL. `kind` is `scroll`, `book`, or `reader`. Set `embedded:true` for the
Studio graphite/lime theme and condensed navigation; the original complete page is
available without that option. Book names use 1–28 letters, digits, spaces, `_`, `-`.
Scroll title limit is 120 characters. Seed text handoff is limited to 2 MB; larger
works use File handoff. The application itself measures and pages actual files.

## Bridge contract

- `window.NFTStudioLedger`: frozen `{version, kind, seed, prepareFile, getState}`.
- `mountLedger`: `{frame, ready, prepareFile, topLevelUrl, destroy}`.
- `postMessage.protocol`: `nft-studio-ledger-v1`.
- Frame accepts only its parent and exact same origin; allowed commands: `seed`,
  `state`. No sign, submit, wallet selection, recipient, policy or provider mutation.
- Responses: `{protocol,type:'response',requestId,result}` or `error`.
- Events: `ready`, `seeded`, `prepared`, `status`, `published`, `error`.
- Scroll `published` contains the existing complete receipt, including
  `verifiedFromChain`. A submitted/unverified receipt must stay visibly unverified.
- Book `status` includes the application state/message. `submitted` does not imply
  confirmed, final supply or closed policy. Read the individual post-mint checks.
- Events are also dispatched locally as `nftstudio:ledger:TYPE` CustomEvents.

## Changes in this copy

1. Runtime Book permanent links and Scroll share links use the deployed subdirectory.
   No registry pointer, policy script, asset-name bytes, labels or data format changed.
2. New reviewed-transaction guard covers all six Scroll submission paths and both
   Book submission paths. It compares complete reviewed body/metadata/validity bytes,
   parses bounded CBOR, rejects malformed/duplicate witness maps, enforces the full
   transaction byte cap and fee including wallet witnesses, and checks wallet network
   again immediately before submitting. Scroll signing also rechecks the network.
3. Optional experimental CIP-103 bulk button is unavailable in this Studio copy.
   Its upstream partial-submit failure lacks per-page persistence and misleadingly
   says nothing was spent. The verified sequential/resume route remains available.
   Bulk source is retained for a separately tested recovery repair.
4. Draft preparation immediately displays `Preparing this version…`, removing a
   stale “Prepared” status while older bytes are locked and a new version is built.
5. Service-worker cache namespace belongs to this copied tool; its fetch handler
   is confined to this subdirectory and does not delete upstream shell caches.
6. `studio=1` activates optional matching theme; complete creator controls remain.

`docs/adaptation.patch` records copied HTML/worker changes; new adapters are separate
files. `evidence/upstream-manifest.json` pins every copied upstream source hash.

## Validation and limits

Run the copied protocol checks from `site/`; run the portable browser scripts from
the kit or copied test directory, pointing at the served Ledger directory:

```sh
PUPPETEER_MODULE=/path/to/node_modules/puppeteer-core CHROMIUM_BIN=/path/to/chromium \
  node tests/browser-regression.mjs http://127.0.0.1:PORT/tools/ledger/ ./results/regression
PUPPETEER_MODULE=/path/to/node_modules/puppeteer-core CHROMIUM_BIN=/path/to/chromium \
  node tests/studio-integration.mjs http://127.0.0.1:PORT/tools/ledger/ ./results/integration
```

The browser tests intercept all external requests. Integration signing uses fresh
synthetic in-memory Ed25519 keys and verifies each test signature. Provider responses
and `submitTx` are fixtures; no real wallet, mainnet transaction or key file is used.
This demonstrates the actual application's signing/assembly/submit/confirmation and
recovery control flow, not real wallet compatibility or chain inclusion.

The copied regression harness keeps the real click handlers but makes scrolling
instant to avoid click-coordinate races during explicit smooth scrolling; it adds
the CIP-30-required `getNetworkId` method to one older synthetic wallet fixture.

Measured limitations inherited from upstream:

- One configured browser-capable Koios mirror; providers are trusted for chain
  facts, and no independent block/header/inclusion proof is verified in the browser.
- The Book-to-Scroll subject extension has synthetic coverage; real-wallet mint
  acceptance remains outstanding. Existing Book v1/v2 and Scroll paths have prior
  upstream mainnet receipts, not new acceptance for this copied Studio release.
- Book history is bounded, with partial scans and ambiguous same-block keeper
  changes shown as unresolved. No private/owner-only Book mode is implemented.
- Browser-origin storage does not automatically migrate to a different hostname.
  Existing same-origin GitHub Pages drafts remain accessible under their original
  keys; receipts/drafts can be exported. Never clear them as part of migration.
- Chain large-file storage can require many transactions/fees and approvals.
  Protocol parameters and complete transaction size, not a marketing raw-file
  limit, govern what fits. Metadata stripping, compression and reconstruction
  are visible parts of the Scroll review.

No original sites, frozen engines, production nodes, repository branches, or public
deployments were modified to prepare this kit.
