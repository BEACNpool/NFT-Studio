# Add `/api/mcp` to the existing Sites Worker build

This kit stages and verifies a wrapper around the **existing** application Worker. It does not replace the app server, edit the source checkout, change a hosting manifest, or deploy anything.

The wrapper requires an operator-selected HTTPS origin:

- MCP origin: supplied explicitly with `--public-origin`; `https://mcp.example.org` below is an example, not a deployed service.
- Browser review: `https://beacnpool.github.io/NFT-Studio/`

These are configuration targets. A successful local check does not establish that `/api/mcp` is live.

Before release, run `npm --prefix mcp run test:clean` from the repository root. This
copies source inputs into a temporary fixture, installs only the nested MCP package,
and exercises Node/Worker builds and real SDK calls without root `node_modules`.
It retains the fixture and a `mcp-clean-install-check.json` receipt. The app wrapper
check below separately needs the application's build and installed Miniflare.

## Stage the exact intended build

Build the intended Sites release normally, with its root URL/base-path settings and its private hosting metadata kept on the proper private hosting branch. Build the current MCP artifact from that exact checkout. Then run:

```sh
npm --prefix /path/to/NFT-Studio/mcp ci
npm --prefix /path/to/NFT-Studio/mcp run build

node /path/to/NFT-Studio/mcp/integration/wrap-site-build.mjs \
  --source-dist /path/to/NFT-Studio/dist \
  --output-dist /path/to/new-staged-dist \
  --public-origin https://mcp.example.org \
  --worker /path/to/NFT-Studio/mcp/dist/worker.mjs

node /path/to/NFT-Studio/mcp/integration/verify-site-wrapper.mjs \
  --dist /path/to/new-staged-dist \
  --project-root /path/to/NFT-Studio
```

The output directory must not exist and must be outside the source build directory. The stage operation rejects symlinks and an already wrapped build. It preserves the source build and all its assets; it does not modify the source `dist/`.

Within the staged copy only:

1. Original `server/index.js` becomes `server/studio-app.js`, byte-identically.
2. The compiled public MCP artifact is copied as `server/mcp-public.mjs`, with the pinned `server/cardano_serialization_lib_bg.wasm` compiled module beside it.
3. A new `server/index.js` imports both modules. Exact `/api/mcp` paths go to MCP; all other paths call the original `app.fetch(request, env, context)` unchanged. Other app exports/handlers remain available.
4. `mcp-wrapper-receipt.json` records the original/copied app, wrapper, MCP and WASM hashes.
5. `mcp-wrapper-check.json` records the local Workerd verification result.

The wrapper is ordinary browser-compatible ES module code. It has no Node imports. The original app keeps whatever runtime flags its own build requires.

## What the integration check proves

The verifier uses the checkout's installed Miniflare/Workerd (including the v4-to-v5 configuration adapter when available) and the MCP package's official SDK client. It runs the original and wrapped app with the same module tree and assets. It checks:

- Representative JavaScript, CSS and SVG/PNG return 200 and match the exact files by SHA-256.
- The original application's home route still renders through the wrapper. It checks both root and retained `/NFT-Studio/` bases, so a Pages test build can be exercised honestly.
- Modern and legacy MCP clients discover 15 tools and exactly 61 resources: capabilities, the knowledge index, 58 research entries and the fixed `nft-studio://implementations` register.
- The implementation register passes the bounded shared JSON validator, binds the exact research catalog hash, and resolves its immutable evidence links. Related `read_knowledge` responses and per-entry resources add sibling implementation record IDs; the original research entries and sources remain unchanged. Evidence URLs are validated as data and are never fetched.
- Capabilities, cited search, intent creation/verification and proof-record creation/verification and actual unsigned data preparation work through the real Worker runtime. Protocol reads are intercepted with fixed synthetic data; no wallet or public network is used.
- The fixed State Capsule parameter application tool matches five pinned Aiken oracle cases with independent CSL hashes; the returned status remains parameterized only and performs no provider lookup.
- Returned intents point to the primary Studio for review.
- Wrong URL/browser origins, a body above 96 KiB and query-bearing `/api/mcp` requests reject.

Vinext contains variable dynamic imports, so the verifier explicitly enumerates the generated JS and compiled WASM modules instead of asking Miniflare to infer every dependency. Its assets router explicitly sets `has_user_worker: true`; omitting this makes unknown routes return an asset 404 without calling the Worker. Worker origin checks use the authoritative `Request.url.origin`, since Miniflare/proxies can send an internal raw Host header.

## Release boundary

Root owns the actual Sites release. A static-only declaration cannot serve an executable MCP handler. Any hosting-mode change belongs in the existing private hosting release branch and the documented Sites deployment workflow; this wrapper does not invent a platform MCP declaration or change site access policy.

Package/deploy the **verified staged output**, keeping its existing server module tree, original asset configuration and runtime compatibility flags. Do not deploy an older Pages-basepath test artifact as the new root Sites application. Run this check again after the final build changes.

After deployment, verify the actual public `/api/mcp` URL with an official SDK client in both protocol eras and anonymously check the main app and static assets. Keep the distinction clear: this public route supports stateless unsigned native transactions, knowledge, payload validation, browser intents, music packages, fixed Capsule parameters and proof-record exports. External witness verification and retained preparation packets belong to the separate Node service. Source availability alone does not establish the running deployment’s capabilities.

The live verifier keeps compatibility defaults of eight tools and 55 resources. Select the expected release explicitly. For this source revision, including music packages, Capsule parameters, unsigned preparation and the implementation resource, run:

```sh
node mcp/integration/verify-live-endpoint.mjs \
  https://mcp.example.org/api/mcp \
  --expected-tools 15 --expected-resources 61
```

Use `--expected-tools 12` for the package-only music release without unsigned Music preparation, `--expected-tools 10` for the Capsule release without the music-package tools, `--expected-tools 9` for a release without the Capsule tool, and `--expected-resources 55` for the earlier resource surface. The 55-resource mode does not read the new register. The 56- and 61-resource modes check the register JSON, fixed research joins and catalog hash against the local source tree; use the source revision that matches the release. These checks validate the evidence records and link syntax, without independently re-running their reported experiments or fetching the linked artifacts. The thirteen-tool mode also prepares an original synthetic Music transaction and directly checks package/credit metadata, sole mint, hashes and value conservation without signing or submitting. The twelve-tool mode additionally creates and verifies the repository’s original synthetic music package; it performs no music transaction preparation. Verification with nine, ten or twelve tools sends only the verifier's synthetic wallet snapshot and prepares unsigned NFT/data transactions; it does not access a wallet, sign or submit.

Rollback is the original unwrapped artifact or previous deployment. `studio-app.js` is preserved byte-for-byte in the staged build, and the source checkout remains untouched.

Measured on 2026-09-07: the Sites front dispatcher reserves `/mcp` and returned a plain 404 before the application Worker when no platform MCP capability was declared. The supplied wrapper uses the application route `/api/mcp`. The generic handler still defaults to `/mcp`; `endpointPath` configures an exact alternative. No platform authentication or Sites MCP registration is claimed.

The WASM must be uploaded as a compiled Worker module. Archive inclusion alone does not establish that a particular hosting uploader registers its type correctly. Read [the verified static WASM pattern and hosting boundary](WASM_DEPLOYMENT.md) before a candidate release.
