# Static CSL WASM for unsigned native preparation

The Worker build uses the unmodified CSL 17 browser glue and exact browser WASM from `@emurgo/cardano-serialization-lib-browser-inlined@17.0.0`. `build.mjs` extracts the embedded binary at build time and rejects a changed SHA-256. The runtime imports a precompiled module and creates its instance with the browser glue's exact import namespace:

```js
import wasmModule from './cardano_serialization_lib_bg.wasm';
import * as glue from '@emurgo/cardano-serialization-lib-browser-inlined/cardano_serialization_lib_bg.js';
const wasm = new WebAssembly.Instance(wasmModule, {
  './cardano_serialization_lib_bg.js': glue
}).exports;
glue.__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
```

The build bundles the glue into `worker.mjs`; only the `.wasm` import stays external. The binary is 2,791,001 bytes, SHA-256 `30f78ee3d0e5fc2f4cd1c87347b330e69fcdd0acb07d4a6e08ff8278d7d9a40b`. Its upstream MIT notice is in `CSL-LICENSE` and the JS artifact banner. The Node package's WASM differs and is not interchangeable with the browser glue.

Actual Workerd tests run with compatibility date `2026-05-15` and no Node flags. Directly importing the original inlined loader fails because it attempts runtime WASM compilation. The static module pattern passes the entire shared native NFT/data builder and matches Node CSL. Cloudflare documents that Workers accepts precompiled WASM and explains separate non-JavaScript module bundling. [Workers WASM API](https://developers.cloudflare.com/workers/runtime-apis/webassembly/), [Wrangler bundling](https://developers.cloudflare.com/workers/wrangler/bundling/).

The wrapper verifier registers the binary as `CompiledWasm` in actual Miniflare/Workerd. It separately tests the application build's own compatibility date and flags; a new app runtime may need a newer Workerd than the standalone package test harness. The optional Miniflare v5 configuration conversion preserves this distinction.

Read-only production packager inspection on 2026-09-07 found:

- Installed Wrangler 4.129.0 recognizes `**/*.wasm` and `**/*.wasm?module` as `CompiledWasm`, maps that to `compiled-wasm`, and sends such modules with `application/wasm`.
- The Sites 0.1.57 build preparer copies the entire regular Worker `dist/` tree, including the binary. It requires `server/index.js`; its file-tree checks reject symlinks/special files and do not filter `.wasm` out.
- These observations prove the local package shape and the standard Wrangler upload representation. They do **not** prove that the separate Sites backend uploader registers the file as a compiled module. No Sites call or deployment was made for this experiment.

Keep `server/cardano_serialization_lib_bg.wasm` in the verified staged output next to `mcp-public.mjs`. The production uploader must register it as a compiled module, preserving the relative import. Publishing it only under client/static assets will not work. Root release verification must confirm the public endpoint initializes the module and successfully prepares a synthetic unsigned transaction before the ninth hosted tool is advertised. The existing eight-tool service remains an independent release until then.

## Observed hosted release

The actual public Sites endpoint passed modern and legacy official SDK clients at 2026-09-07T06:28:25.565Z with nine tools and 55 resources. Both NFT and data unsigned transactions passed independent body-hash, exact-metadata, output and ADA/token conservation checks using synthetic input snapshots. This observed release confirms that the packaged static CSL module executes on this host. No real wallet was accessed and no transaction was signed or submitted. See the [public receipt](../../docs/MCP_PUBLIC_VERIFICATION.json); local measurements above remain separate from production capacity guarantees.
