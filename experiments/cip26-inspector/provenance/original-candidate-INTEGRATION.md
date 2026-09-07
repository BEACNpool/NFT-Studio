# Integration handoff

All proposed files are new and remain outside the Studio checkout. Suggested destination: `experiments/cip26-inspector/`. `MANIFEST.json` lists the complete candidate files and hashes; `node_modules/` is development installation state and is excluded. No root dependency, source, skill, catalog, MCP tool, endpoint or deployment was changed.

The reusable runtime is `src/index.mjs` plus `src/strict-json.mjs` and the two pinned noble packages. `src/index.d.mts` provides types. The already-built `dist/cip26-inspector.mjs` is a self-contained alternative for a browser host; its reproducibility is recorded by the browser and isolated-install receipts.

After source review, copy the manifest-listed files into a new experiment directory, run its nested clean installation/tests/build, and preserve its evidence and license files. A future UI should pass original JSON text, render imported values as inert diagnostic data, and use the reported trust/sequence flags before treating any property as an accepted display label. Keep trust configuration visibly separate from the inspected record. Do not prefill trusted bindings from discovered signatures, and do not advance stored sequences for invalid/untrusted data.

A future remote MCP adapter needs a separate design decision about whose trust configuration and observations are authoritative. This candidate has no remote endpoint and no persistent store. Its explicit local trust context must not be converted into a claim that an agent's own supplied keys independently authenticate its payload.

Observed validation:

- 12 Node test groups, zero failures; declaration typecheck passed.
- 133 independent Python/hashlib CBOR/component/digest fixtures.
- 59 original published upstream attestations, verified by this profile and independent Node crypto.
- 394 actual Chromium assertions; zero external requests or wallet/network capability calls; no Node globals.
- An isolated `npm ci --ignore-scripts`, tests and browser build used only that package's dependencies and matched the original module byte-for-byte.
- 13 immutable source files passed both archived and online hash checks.

Material boundaries are documented in `SOURCE_REVIEW.md`: logo text/bytes signing mismatch, annex named-field/decimals mismatch, strict scalar and point profile, and native policy authentication deliberately absent. No real wallet, provider, signing authority, registry publication or chain inclusion was tested. The module/profile has not had an independent security audit.
