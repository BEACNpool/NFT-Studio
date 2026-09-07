# Dependency verification

The September 7, 2026 refresh updates React, React DOM and React Server Components
to 19.2.8; vinext to 1.0.0-beta.9; Vite to 8.2.2; the RSC plugin to 0.5.34;
Cloudflare's Vite plugin to 1.54.4; Wrangler to 4.129.0; Workers types to 5.20260903.1;
and esbuild to 0.28.2. Versions and transitives are pinned in package-lock.json.

The earlier lockfile reported 11 affected direct/transitive dependencies, including
[React's Server Functions denial-of-service advisory](https://github.com/react/react/security/advisories/GHSA-wx67-qw84-cm4g).
The refreshed dependency tree reports zero known vulnerabilities in the dated
[npm audit receipt](DEPENDENCY_AUDIT.json). This is a registry advisory check,
not proof that the code is free of vulnerabilities. The receipt includes the
exact lockfile SHA-256.

Validation includes TypeScript, lint, the existing transaction/receipt/recovery
and nine-game checks, Labs proof/contract/knowledge checks, all MCP SDK tests,
root and Pages builds, static browser minting/navigation, and the combined
app/MCP in actual Workerd. No real wallet or chain submission was used.

Wrangler's transitive Miniflare 5 requires its new configuration shape. The
wrapper verifier uses the package's exported convertV4MiniflareOptions adapter
when available; older Miniflare installations keep the existing options. Runtime
behavior is checked after conversion, including static bytes, app fallback,
modern/legacy MCP clients and hostile-origin/body checks.

Do not run npm audit fix --force as a release step. Update explicit versions,
resolve peer requirements together, and exercise the actual build and wallet
review paths before publication.
