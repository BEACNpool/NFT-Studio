# Architecture and limits

The React shell provides format selection, workbenches, the showcase, saved
projects and recovery. It runs without an application database or server signer.
Wallet access occurs only inside explicit final-review controls.

- `components/studio-shell.tsx`: navigation and shared creation handoffs.
- `components/art-workbench.tsx`: image/app workflow, project storage and exports.
- `components/mint-dialog.tsx`, `lib/cardano.ts`: existing image/app/game transaction
  builder with shared signed-body/auxiliary checks and persisted receipts.
- `components/file-workbench.tsx`, `lib/studio-payload.ts`: exact file packages,
  MIME validation, SHA-256 commitments and inert previews.
- `lib/studio-transaction.ts`: visitor-wallet NFT and metadata-only transactions.
- `lib/studio-submission.ts`: local attempt coordination and read-only chain checks.
- `components/recovery-panel.tsx`: imported receipts and known-hash recovery.
- `public/tools/ledger/`: complete copied Ledger creators, readers, protocols,
  recovery vault and frozen programs. The small source adapter mounts this trusted
  same-origin application and transfers a retained File only on an explicit click.
- `public/legacy/`: isolated existing collection tools and original Chess.
- `lib/capability-catalog.json`, `docs/MEDIA_PROVENANCE.json`: capability boundaries
  and pinned media provenance. A copied historical work is not a new mint receipt.

## Transaction bounds

Ordinary native transactions must satisfy the smaller of live `max_tx_size` and
16,384 bytes, including actual witnesses. Payload input bounds of 12,000 raw bytes
and eight files do not guarantee a transaction fits. Encoding, metadata, signatures
and token change consume space. Images are visibly fitted to a byte budget;
file packages are not silently rewritten to fit. Large works use Scroll storage.

The nine games use their existing compact metadata path. They cannot arbitrarily
combine new cover art, traits or additional apps with an already full transaction.
The Impossible Dawn’s original signed transaction used 16,341 bytes. Its historical
fit is not a promise for a new visitor wallet or the generic package encoding.

A Scroll can involve many transactions, network fees and permanently locked ADA.
Its creator retains exact submitted-page boundaries for interruption recovery.
The copied experimental bulk button is disabled; the sequential/resume path remains.
Books create NFTs and accept public entries; the protocol anchor goes to the holder.
See the Ledger contract for provider trust and bounded-history limitations.

## Persistence and execution boundaries

Editable artwork uses a separate IndexedDB database. Detailed ordinary Studio
receipts use `nft-studio:receipt:v1:<hash>`; attempt markers are separate. Store
receipts before broadcast, persist attempts before calling the wallet, and never
interpret a failed HTTP response as proof that a transaction was rejected.
Chain confirmation means observed inclusion, with later blocks counted separately;
it is not irreversible settlement. The public indexer is trusted for those facts.

Storage is local to the browser origin. Export projects/receipts before switching
hosts, browsers or devices. Clearing local storage removes local recovery guards.
No draft upload or wallet connection occurs simply by opening the creator.

Imported files never execute in the wallet-connected parent. HTML previews use a
strict inert allowlist and an empty iframe sandbox. Downloaded/minted files retain
their original source. Known catalogue programs are hash-checked and use an opaque
script-enabled runner without same-origin privileges. Ledger creators are separately
trusted application code and offer a full-page fallback for wallet extensions.

## Automation and hosting

Optional feature-detected WebMCP tools read Studio navigation and open a creator.
They cannot connect, build, sign or submit a wallet transaction. Browsers without
this proposed API use the visible interface normally.

The public repository builds without `.openai/hosting.json`. A host-specific ignored
manifest may be supplied to Sites; source credentials and private host metadata
must never be committed to the public branch. Both root and `/NFT-Studio/` static
exports retain relative Ledger and game URLs.
