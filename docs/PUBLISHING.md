# GitHub Pages publication

Public app: **https://beacnpool.github.io/NFT-Studio/**

- `main` contains the editable source and verification workflow.
- `gh-pages` contains the validated static app, published from its root.
- `.nojekyll` preserves the framework’s `_next` assets.
- `nft-studio-release.json` records the source commit used for the current app.
- Main-source CI builds and uploads an artifact. Publication currently uses an
  explicit account-authenticated push to `gh-pages`; it is not automatic on main.

## Publish an update

Start from the intended clean source revision and complete its required checks.
Build with `npm run build:pages`, not the root `npm run build` output. The exporter
validates the `/NFT-Studio/` asset paths and excludes private hosting metadata.

Prepare a clean worktree from current `origin/gh-pages` and copy the **contents**
of `dist/github-pages` into its root. Preserve older hashed `_next` assets so an
open or cached page can still load its dependencies. Update the public release
record with the exact source commit used for the build. Review the changes,
commit, and make a normal, non-forced push to `gh-pages` using the repository’s
account SSH access.

GitHub runs **pages build and deployment**. Wait for success, then check the live
page and release record. Exercise wallet discovery, Ledger frames and a creation
review under `/NFT-Studio/`. Simulated transaction checks must intercept signing
and broadcasting; a normal deployment does not authorize spending from a wallet.

The initial account SSH push activated branch-based Pages on this repository.
For any separately created repository, confirm its actual Pages configuration;
auto-activation should not be assumed. If settings need to be set explicitly,
choose **Settings → Pages → Deploy from a branch → gh-pages → /(root)**.

## Moving from another origin

Editable projects and receipts stay in the browser/origin where they were saved.
Export them from the previous hosted copy before importing them into this one.
The previous hosted app remains available during migration.
