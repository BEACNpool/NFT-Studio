# Agent mint request: React development StrictMode regression

Seven focused browser checks pass using React 19.2.8 in development mode and the
exact before/after AgentMintPanel source snapshots. Source inputs use inert
`.source.txt` extensions so repository TypeScript compilation does not include
them; the standalone build uses explicit TypeScript/TSX loaders. The real shared payload,
intent and link codecs run in Chromium. UI primitives, media-preview rendering,
the wallet dialog and export helpers are inert stubs; no wallet/provider is used.

The old component loses the request when StrictMode replays its mount effect:
the first setup clears the fragment, cleanup invalidates its pending parse, and
the next setup sees no fragment to resume. The same old source works without
StrictMode. The patched source retains the verification promise during replay,
reattaches with a new generation and renders the verified request. Incoming newer
links, clear, invalid links and unmount preserve the expected invalidation rules.

`receipt.json` pins both components and all three shared source inputs. Tests:

1. Old source, StrictMode: reproduces empty review with disabled “Checking files”.
2. Old source, ordinary mount: verifies the request normally.
3. Patched source, StrictMode: verifies the request and removes its fragment.
4. A newer link wins over a deliberately delayed older parse.
5. Clear removes the verified result.
6. A malformed link is removed and rejected visibly.
7. Unmount prevents a delayed result from updating the page.

No external requests, wallet calls or downloads were observed. Screenshots were
inspected for the old failure and patched verified state. This is a lifecycle
regression test, not the separately performed production-layout, actual media
preview or funded-wallet acceptance.

## Reproduce

Install the repository's locked dependencies. Supply a package directory where
`puppeteer-core` is already installed and a Chromium executable path explicitly;
the harness has no machine-specific default paths.

```sh
node build.mjs "$NFT_STUDIO_CHECKOUT"
node browser.mjs "$PUPPETEER_PACKAGE_ROOT" "$CHROMIUM_EXECUTABLE"
```

The build reads installed esbuild/React dependencies from the supplied checkout,
uses its own pinned component/source snapshots and writes only local `before.js`
and `after.js`. The browser harness uses an ephemeral loopback HTTP port, blocks
requests to other origins, creates an isolated browser and writes a receipt plus
three screenshots here. Use a copy of this frozen evidence directory when
rerunning. Generated bundles and screenshots are not required source inputs.

The supplied component and Studio codec snapshots retain NFT-Studio's Apache-2.0
licensing. React/Puppeteer/Chromium are installed toolchain dependencies; their
source is not vendored in this fixture.
