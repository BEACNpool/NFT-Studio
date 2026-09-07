# Dated mixed Music/ordinary Workerd observation

At **2026-09-07T09:18:18Z**, one local Workerd handler completed **1,000 preparation
attempts: 500 Music and 500 ordinary**. All **990 successes** passed independent
exact metadata, hashes and ADA/token conservation assertions. Ten expected errors
covered the shared gate, malformed input, wallet bounds, real provider timeout and
stale quote; subsequent valid calls established gate release.

This is synthetic local evidence for the pinned source below. It is not a hosted
traffic benchmark, ledger inclusion check or proof of no leaks. All 1,988 protocol
reads were locally intercepted; no public provider requests, real wallets,
private keys, signing or submissions were used.

## Memory and interpretation

WASM capacity reached **3.5 MiB** and stayed there. Sampled V8 used heap peaked at
**48.8 MiB** and was **14.1 MiB** after one final diagnostic garbage collection.
**Whole Workerd process RSS reached about 281.5 MiB and remained 200.1 MiB after
that collection.** The process includes runtime/native/other-isolate overhead;
this run cannot attribute all retained allocations or establish production
capacity. Keep this observation attached to any memory summary.

The run used one real clock, one handler/WASM instance, the supported local
`rateLimit: 1000` override, a local 64-MiB V8 old-space flag, at most two admitted
preparations and no forced collection during workload. Ten expected failures
include two actual ten-second timeouts. These are explicit test settings, not the
public service defaults.

An initial harness run stopped at 646 attempts because it incorrectly compared
transaction hashes across different real validity slots. Independent content and
conservation assertions had passed for that triggering response. Product source
was unchanged; the final run compared identical fixture plus actual validity slot
and checked expiry against quote/creation time. The completed receipt preserves
that history. Native policy expiry affects policy IDs, metadata keys and hashes.

## Evidence and exact source

`mixed-soak-check.json`, `SOURCE_INPUTS.json`, `SUMMARY.json`, `samples.json` and
`responses.jsonl` are unchanged copies of the observed run. All 189 source-input
hashes match published commit
`7b3ff81a57a55f4ccbeed2177870ab5c6e2579dd`. The receipt records the tested Worker
and CSL WASM digests. The 990 response rows bind identity, validity, metadata and
conservation outcomes; they are developer observations, not signed attestations.

`harness.source.txt` is the observed harness with exactly one portability change:
its held-source directory now resolves to the recreated fixture rather than a
private absolute checkout. The corresponding `readFile` uses a file URL. No
workload, assertion, limits or measurement behavior changed. This portable copy
has not been used to claim a new completed benchmark. The original harness digest
and the portable digest are recorded in `PROVENANCE.json`.

## Explicit reproduction

From a complete Git checkout with the pinned commit available, choose a new,
nonexistent output directory. The preparation helper reads only immutable Git
blobs, verifies all 189 hashes and writes a fresh fixture. It does not install
packages, run the workload or change the checkout.

```sh
python3 mcp/evidence/music-mixed-soak-20260907/prepare-reproduction.py /new/output-directory
npm --prefix /new/output-directory/fixture/mcp ci --ignore-scripts
npm --prefix /new/output-directory/fixture/mcp run build
node /new/output-directory/fixture/mcp/integration/verify-mixed-soak.mjs
```

Linux `/proc`, Node 22.13+ and the pinned nested MCP dependencies are required.
The explicitly launched harness writes new evidence under that output directory
and uses only its local Workerd/inspector transport. Never run it in this published
evidence directory or interpret a later run as the original dated receipt.
Independent transaction assertions still share CSL with the service; they are
not a separate ledger implementation or dependency audit.
