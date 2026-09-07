# RecoveryPanel integration contract

`components/recovery-panel.tsx` uses this branch order to preserve existing
receipt formats while checking music credits against their actual transaction.

Keep the ordinary 1.5 MB file-size check. Read `const source = await file.text(); const data = JSON.parse(source);` once for dispatch, retaining the original source for strict readers. Use this priority:

1. Existing Artifact Passport branch and its unsupported-music guard remain unchanged.
2. A standalone `beacn.music-release.v1` package can use `verifyMusicRelease(data)` or `parseMusicRelease(source)` according to the package import format. Show package integrity and exact files/credits, without claiming a transaction binding or chain inclusion. The receipt router deliberately returns `other` for this package; it is not a receipt.
3. For exact NFT receipt/review envelopes, call the route helper below. `music` must complete strict recovery before any result is displayed. `ordinary-nft`/`other` can reach the existing generic file branch. A routing/recovery error must stop that import.
4. Legacy art/app/game/data receipt kinds and raw metadata keep their existing generic recovery. The nine frozen programs must continue through the real `recoverEmbedded` parser.

```ts
const candidate =
  (data?.schema === 'nft-studio.receipt.v1' && data.kind === 'nft') ||
  (data?.schema === 'nft-studio.review.v1' && data.mode === 'nft');

if (candidate) {
  const { routeMusicReceipt, recoverMusicReceipt } =
    await import('@/lib/music-receipt');
  const C = await loadCSL();
  const route = routeMusicReceipt(C, data);
  if (route === 'music') {
    const recovered = await recoverMusicReceipt(C, source);
    setMusicRecovery({ music: recovered.musicRelease, receipt: recovered });
    setFiles(recovered.musicRelease.bundle.files.map((file) => ({
      file, verified: true, title: recovered.musicRelease.release.release_title,
    })));
    setHash(recovered.transaction.hash);
    setNotice('Music files and credits match the transaction metadata locally. Receipt status is reported; signatures and chain inclusion were not checked.');
    return;
  }
}
// Existing generic file recovery follows here.
```

`run()` must clear `musicRecovery` alongside files/status/notice. Do not label a generic bundle recovery as credit verification. A details region should read only `recovered.musicRelease`: release title/type, each exact audio filename with track/song title, required artists/copyright/genres and optional contributors/authors/share declarations. Keep the full recovered package export available so optional supported credits are not silently hidden or omitted. The receipt declaration should be a visibly separate line such as `Receipt reports: confirmed (12 blocks); not independently checked here.`

Do not set `ChainObservation` from receipt state or display its green confirmation icon merely because the imported JSON said `confirmed`. Existing Check chain remains an independent action. If generic provider metadata is subsequently loaded, reset the strict receipt result unless the transaction binding is independently rebuilt and checked by a dedicated verified flow.

FileMintDialog's current signed export is compatible: top-level `metadataProfile`/`musicPackageHash` and `prepared.musicRelease` are checked when present. A review export of `{schema:'nft-studio.review.v1', ...prepared}` is also compatible. Signing guards, ordinary MCP schema, signature merger and Passport code need no changes for this reader.

The browser regression tests a valid signed receipt, unsigned review, credits changed only in a sidecar, stripped music sidecars, duplicate raw JSON fields, declared-confirmed receipt without provider evidence, own music package, ordinary large receipt and each frozen catalog program. The library/routing checks and the integrated browser suite cover these cases separately.
