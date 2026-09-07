# Fixed State Capsule parameterizer — experimental adapter

A browser-compatible adapter for the **one pinned experimental State Capsule blueprint**. It applies a seed `OutputReference` and exact UTF-8 base name using maintained Harmonic Labs UPLC parsing, AST application and serialization. It accepts no uploaded blueprint or script. No Flat bit encoder was invented.

The adapter matched **256 generated parameter pairs against Aiken v1.1.23+8949565**, including complete applied blueprint equality and 768 handler byte comparisons. All policy hashes also matched independent CSL17. Chromium 152 ran those same 256 oracle cases in 442 ms in this local test, with Node globals absent and wallet/network APIs disabled. These timings describe one local run, not a device-independent performance guarantee. Receipts and immutable source citations are in `evidence/`.

This prepares an applied script and blueprint. It does not build a transaction, inspect a wallet, check whether the seed exists or is unspent, evaluate a transaction, sign or submit. The underlying contract remains experimental; this adapter is not a live mint flow.

## API

```js
import { applyCapsuleParameters } from './src/index.mjs';

const result = applyCapsuleParameters({
  seed: { transactionId: '11'.repeat(32), outputIndex: 0 },
  baseName: 'CAPSULE',
});

result.policyId;             // a3ef3e0109b585376e6366833f022964dbf487da828fcfd35ee28d1d
result.compiledCode;         // 3,100-byte Aiken-compatible, single CBOR-wrapped Flat program
result.appliedBlueprint;     // deeply frozen; mint/spend/fallback use identical bytes and hash
result.appliedBlueprintJson; // deterministic UTF-8 JSON export, with SHA-256 alongside it
result.assetNames;           // exact CIP-67 labels 100/222 and the supplied base-name bytes
```

For a plain browser, import `dist/capsule-parameterizer.mjs` after building. It is a self-contained ESM artifact with no external imports or Node runtime dependency. Source use in the Studio bundler needs the four direct pinned runtime packages in `package.json`; it does not need CSL, Aiken, Puppeteer or esbuild at runtime. Types are in `src/index.d.mts`.

Only the exact `{seed:{transactionId,outputIndex},baseName}` shape is accepted. Extra/inherited/symbol/accessor fields, boxed/coerced values, malformed hashes and ill-formed Unicode reject. The transaction hash is exactly 64 lowercase hex characters, and the index is an integer 0–65535. The name is 1–28 UTF-8 bytes; no Unicode normalization, trimming or case conversion occurs. This matches the existing capsule codec's name-byte rules, including control characters and empty-looking names. Consumers must render names as inert text and retain exact bytes for asset identity. Display-name policy can be stricter without changing this adapter's encoding semantics.

The result is deeply frozen and detached from the input. The `policyId` equals the `scriptHash` because the pinned blueprint contains one combined program for all three handlers. All source handlers are checked before one application result is assigned to their blueprint entries. Every returned limitation flag is false: no chain or authorization claim is inferred from successful application.

## Source pin and serialization contract

The [trusted blueprint](https://github.com/BEACNpool/NFT-Studio/blob/d2003bec53b944c7b71bd50caa2a14002008c7ea/contracts/state-capsule/plutus.json) is embedded as its exact raw JSON bytes in `src/fixed-blueprint.mjs`. The adapter checks the raw JSON SHA-256 before parsing, verifies the compiler and PlutusV3 marker, checks all three script/parameter declarations, and verifies the compiled-code SHA-256 and unapplied script hash. It then requires the known UPLC 1.1.0 program to roundtrip byte-for-byte through the pinned serializer.

- Blueprint SHA-256: `26f9377baf76d713c1aaa1f447dceb59e7ffa0b58728f59a617ae91e40c738f4`
- Compiled code SHA-256: `d11df0f4e8b733913eebaedd2eb245bc882fc188bcee0e15f9579cabd73b22bd`
- Unapplied PlutusV3 script hash: `4c9c42dbaf549439983db5c82406e423ea821f44a09c91d4b5fc59bc`

[Aiken's exact application source](https://github.com/aiken-lang/aiken/blob/8949565a9969278846ffefe30bc3b892029dd318/crates/aiken-project/src/blueprint/validator.rs#L268) validates the next parameter and applies Data in declared order. Its [UPLC program source](https://github.com/aiken-lang/aiken/blob/8949565a9969278846ffefe30bc3b892029dd318/crates/uplc/src/ast.rs#L61) constructs an application with a Data constant. This adapter uses the corresponding library `Application` and `UPLCConst.data` calls, then the [Harmonic serializer](https://github.com/HarmonicLabs/uplc/blob/3e10e46e89c184b92886f38c39e9057063dffd9f/src/UPLCEncoder/UPLCEncoder.ts). [Lucid's maintained source](https://github.com/Anastasia-Labs/lucid-evolution/blob/8a379c3bc579e623a1efb5f444bf54e78979d4e6/packages/utils/src/scripts.ts#L150) uses this library approach too. Lucid currently depends on the v1 API; this adapter directly uses and tests v2.0.7, whose `compileUPLC` returns a `Uint8Array`.

The script keeps **one CBOR byte-string wrapper around Flat**, matching Aiken `compiledCode`. It is not a Lucid double-CBOR return value. PlutusV3 hash is Blake2b-224 of `0x03` plus those compiled bytes. The independent CSL check deliberately uses `PlutusScript.new_v3(compiledBytes)`; stripping a CBOR layer changes the hash. There is no arbitrary CBOR/UPLC decoder entry point exposed to callers.

The 16-bit seed index follows the [Conway transaction input CDDL](https://github.com/IntersectMBO/cardano-ledger/blob/dae069780697449fbd9cda47f03fb72745b0b8c0/eras/conway/impl/cddl/data/conway.cddl). Names/seed inputs fix the work size; output is capped at 3,200 script bytes and 32 KiB blueprint JSON. The pinned script is 3,044 bytes before application. A future contract or compiler update requires new reviewed pins and a fresh oracle run; this API cannot select a different blueprint.

## Reproduce

Use Node 22.13+ for the build/test tools. Runtime browser requirements include ES2022 modules, TextEncoder and String.isWellFormed (verified in Chromium 152). A normal isolated nested installation works without the Studio checkout or its dependencies:

```sh
npm ci
npm run build
npm test
npm run verify:aiken
npm run verify:browser
npm run verify:clean
```

`verify:aiken` requires `aiken` on PATH, or `AIKEN_BIN=/absolute/path/to/aiken`. It rejects any version other than the pinned version and records its executable SHA-256. It runs 512 bounded local CLI invocations against the kit's trusted blueprint and generates the checked-in oracle. No source checkout is edited. `npm test` can validate against that oracle without a local Aiken binary. `verify:browser` requires local Chromium; set `CHROMIUM_BIN` if it is not `/snap/bin/chromium`. The test serves only its own two fixed local routes, blocks external page requests, and compares all oracle bytes in the real browser.

`verify:clean` copies only source into a fresh temporary directory, installs from the lockfile, rebuilds and runs the six test groups with no Studio or ancestor dependencies. The observed browser artifact hash matched the candidate exactly; see `evidence/clean-install.json`.

`scripts/capture-sources.py` is a separate maintainer research utility with explicit fixed public URLs. It refreshes evidence metadata; it is not imported by the adapter, bundled in the browser or run by build/test. Runtime performs no network calls.

## Integration boundary

The Studio imports this adapter in `components/capsule-contract-lab.tsx` and
exposes it through MCP as `apply_state_capsule_parameters`. The browser operation
is local; an MCP call discloses its supplied seed/name to the remote service.
Both return the same parameterized-only identity and blueprint. The `trusted/`
files are evidence snapshots, not replacement validators. Source pins and
independent parity receipts remain part of this adapter's contract.

A future browser builder can consume `result.appliedBlueprint` with the same exact seed/name, then require fresh inputs, protocol parameters, full node evaluation and visible wallet review through the existing contract workflow. Parameter-byte parity alone does not establish mint/spend/freeze acceptance, ownership, input availability, device wallet compatibility or chain inclusion. No capsule transaction, signing or submission operation is enabled by this adapter.
