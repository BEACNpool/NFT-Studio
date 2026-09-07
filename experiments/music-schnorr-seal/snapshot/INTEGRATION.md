# Admission handoff

All files are new candidate files outside the Studio checkout. No existing repository file was modified, so there are no proposed overwrite before-hashes. The immutable Studio source closure's original before-hashes and Git paths are in `studio/SOURCES.json`; this candidate deliberately supports that pinned codec version.

1. Verify `MANIFEST.json` against its separately delivered SHA-256, then check all listed files or run `sha256sum -c SHA256SUMS` in the kit.
2. Review `PROFILE.md`, `ATTRIBUTION.md`, the source/fixture receipts and the independent review separately. A passing local experiment is not public admission or chain execution.
3. If admitted, copy the listed files to a new experiment directory, preserving bytes. Exclude `node_modules/` and `contract/build/`; neither is part of the frozen manifest. Preserve source, fixture, receipt, license and runtime bytes across line-ending conversion using the included attributes.
4. For a browser adapter, import only `dist/seal.mjs` with its adjacent `dist/seal.d.mts`. It is already bundled and does not require adding noble or the source alias to the host application. Keep this immutable compatibility profile; do not mix a new Music codec into it without rebuilding and retesting.
5. Keep packet text, seal text and trust text as separate inputs. Default trust to empty. An explicit example-trust action can load `fixtures/example-trust.json`, labeled as synthetic exact-package/key trust. It must never establish a real artist identity.
6. Show cryptography, package matching and selected trust separately. Invalidate results on every edit/import, guard async import completion against stale state/unmount, render text inert, and catch every error rejection regardless of constructor. Diagnostic text hashes identify the exact inputs the report inspected.
7. Retain the local Aiken scope and both compatibility caveats. The helper proves no transaction policy or current ownership. No wallet signing, input private key, remote signing, provider access, mint or submission belongs to this candidate.
8. Run host TypeScript/lint and actual browser adapter checks independently. The included 255 assertions prove only this pure module. Publishing a Lab, MCP integration, dependency changes or a public capability record remains a separate owner decision.

Verification commands refresh receipts. Use a disposable copy for reproductions, and preserve the frozen original. Test-data generation is optional and deliberately separate; never regenerate synthetic signatures in an immutable evidence directory.
