# Fixed State Capsule parameters over MCP

`apply_state_capsule_parameters` applies the one trusted experimental State Capsule program to a seed reference and exact UTF-8 base name. It returns the applied script/blueprint and policy hash. It performs no wallet connection, seed lookup, provider request, transaction preparation, node evaluation, signing or submission. A successful result is **parameterized only** and proves no seed existence, ownership, unspent state or chain inclusion.

This source revision exposes twelve public Worker tools and fourteen self-hosted Node tools, with 61 resources in each service. Tests compare exact discovery names from the SDK and derive those counts from the observed lists. The existing native transaction tool keeps its separate behavior. Deployment capabilities must be observed separately.

```json
{
  "name": "apply_state_capsule_parameters",
  "arguments": {
    "seed": {
      "transactionId": "1111111111111111111111111111111111111111111111111111111111111111",
      "outputIndex": 0
    },
    "baseName": "CAPSULE"
  }
}
```

The result contains `application`, the frozen adapter's deterministic export, and `processing`, the service's privacy and execution boundary. The example produces policy `a3ef3e0109b585376e6366833f022964dbf487da828fcfd35ee28d1d` and 3,100 compiled bytes. `application.readiness` is `experimental-parameterized-only`; every chain/authorization/transaction flag in `application.limitations` is false. `application.compiledCode` is Aiken's single CBOR-wrapped Flat bytes, not Lucid's double-CBOR representation.

Only the exact argument shape above is accepted. The transaction ID is 64 lowercase hex characters, index 0–65535, and base name 1–28 UTF-8 bytes of well-formed Unicode. No trimming or normalization occurs; the original codec's control-character and exact-byte name semantics remain. Treat returned display text as inert. Additional blueprint, script, raw CBOR, metadata, wallet and URL fields reject. Arguments are bounded to 1 KiB JSON and the result to 80 KiB JSON; the MCP text and structured representations duplicate that bounded result on the wire. Existing transport request, concurrency and rate bounds remain active.

**Remote MCP receives the supplied seed reference and name.** Those values may associate a request with a public UTxO. Use the [browser-only adapter](../experiments/capsule-parameterizer/README.md) when they must stay on the caller's device. The tool does not persist them or create a preparation packet. Hosting infrastructure may retain operational metadata. Its annotations are `readOnlyHint: true`, `idempotentHint: true`, `destructiveHint: false`, `openWorldHint: false`.

`studio_capabilities.stateCapsuleParameterization` exposes the exact source pin, limits, privacy receipt and unsupported operations. The program checks raw blueprint and code hashes before parsing, preserves PlutusV3/UPLC1.1.0 and the Aiken compiler pin, and checks identical mint/spend/fallback source handlers. The adapter's independent oracle compared 256 generated fixtures against actual Aiken1.1.23 and CSL17; MCP tests repeat those exact bytes through Node and actual Workerd in modern and legacy SDK modes. See the adapter's original evidence for the compiler run; MCP transport validation does not repeat chain evaluation.

## Build and integration

`mcp/build.mjs` statically bundles `experiments/capsule-parameterizer/src/index.mjs` and its fixed source through a build-time alias. There is no runtime dynamic module fetch. Install only the nested MCP package as before: its lockfile additionally pins Harmonic UPLC2.0.7, plutus-data2.0.1 and CBOR2.0.2. The browser bundler resolves those shared-source imports against the nested MCP install. It embeds required adapter/dependency notices in the Worker, so the existing wrapper's worker+compiled-CSL-WASM packaging preserves them. The separate adapter installation and generated browser artifact are not required for MCP builds.

The clean-install checker copies the adapter source/evidence subtree as well as Studio/knowledge/MCP source. It installs no root or adapter `node_modules`. The release wrapper checks five synthetic oracle fixtures in each SDK era and retains the usual static-app/assets and native-tool checks.

The live verifier now accepts `--expected-tools 8|9|10|12`, preserving default eight; `--expected-resources 55|56|61` still defaults 55. A release matching this source revision can be checked explicitly:

```sh
node mcp/integration/verify-live-endpoint.mjs \
  https://beacn-nft-studio.davidmjensen17.chatgpt.site/api/mcp \
  --expected-tools 12 --expected-resources 61
```

Eight/nine-tool modes never call the new capsule tool. Ten- and twelve-tool modes send five synthetic seed/name cases per SDK era, plus the existing synthetic native tests. The dated public verification receipt records the independently observed deployment; local tests do not substitute for it.
