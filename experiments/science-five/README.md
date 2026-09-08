# Five Small Worlds

[Play the collection](https://beacnpool.github.io/NFT-Studio/showcase/science-five/) · [Download all five](https://beacnpool.github.io/NFT-Studio/showcase/science-five/five-small-worlds.zip) · [Scientific notes](SCIENTIFIC-NOTES.md)

Five complete, original BEACN Labs browser studies prepared for native Cardano NFTs. **All five are unminted.** Their visuals change because the embedded program computes them locally. Interacting does not update ledger state.

| Study | What you can do | Program + cover | Synthetic complete transaction |
| --- | --- | ---: | ---: |
| Entropy Oracle | Ask a crypto magic 8-ball; compare three probability rules, entropy and histograms; play an original chime. | 11,970 B | 15,547 B |
| Turing Garden | Paint a 192 × 192 reaction–diffusion world, change its chemistry, export art and restore exact numerical state. | 11,801 B | 15,172 B |
| Chaos Mirrors | Perturb two double pendulums, grow luminous trails, track separation and numerical energy error. | 11,905 B | 15,130 B |
| Fourier Forge | Draw a shape, reconstruct it with rotating harmonics, measure error and hear a derived waveform. | 11,952 B | 15,015 B |
| Hash Cathedral | Make SHA-256 stained glass, flip one input bit and build, tamper with and verify Merkle proofs. | 11,702 B | 14,748 B |

The payloads use 97.5–99.75% of the MCP's 12,000-byte raw-media allowance. The complete synthetic transactions fit the observed 16,384-byte protocol limit. These measurements use one synthetic base-address input, a token-bearing change output and one deliberately invalid placeholder witness. They are **not funded-wallet quotes**, signatures or chain submissions. Real inputs, keys, outputs and current parameters require a new complete build. Native Studio fee: zero; Cardano network fees and minimum ADA still apply.

## Play and mint files

Open a gallery card or an extracted `program.html` in a current browser. Every program contains its own math, controls, explanations and artwork export. No CDN, external font, media host or account is needed. Audio starts after an explicit gesture.

Each [published study directory](../../public/showcase/science-five/) contains:

- `program.html`: exact compressed, self-contained executable mint candidate.
- `cover.avif`: compact, lossy static cover included in the candidate.
- `poster.png`: larger gallery illustration, **outside** the mint payload.
- `request.json`: relative files for the local MCP helper.
- `intent.json`, `review.html`, `review-url.txt`, `receipt.json`: the exact content-bound request and verified local handoff.

The review is static; open the program to interact. A marketplace may display only the cover or impose different execution restrictions. The loader needs `DecompressionStream`; Canvas and Web Audio support are required for their respective features. Tests used Chromium 152, including opaque `allow-scripts allow-downloads` iframes at 1440 and 390 CSS pixels. These are desktop/mobile-sized browser checks, not physical-phone, named-wallet or marketplace acceptance.

To make a fresh review after [installing the repository MCP](../../docs/MCP.md), run from the repository root with a new output directory:

```sh
node mcp/create-review.mjs --request public/showcase/science-five/entropy-oracle/request.json --output ./oracle-review
```

The helper creates and verifies a mint intent. Wallet connection, transaction review and signing remain separate actions. Never supply an agent with a seed phrase.

## Rebuild and inspect

`source/` contains the editable documents and high-resolution cover masters. After `npm ci` at the repository root, use Node 22.13 or newer:

```sh
node experiments/science-five/build.mjs ./science-five-rebuild
```

The output directory must not exist. The packer minifies CSS and ordinary script blocks with pinned esbuild, gzips the document and embeds it in a small loader. It verifies all five rebuilt program hashes and frozen cover hashes against [collection.json](../../public/showcase/science-five/collection.json). The Fourier math script is preserved within the compressed document. Exact compressed bytes can depend on the Node/zlib version; verification fails if they differ. The release rebuild passed with Node 22.22.2 and zlib 1.3.1-e00f703.

`cover-encoding.json` records each cover's dimensions, AV1 CRF and pixel format. These are derived thumbnails; the program contains the full drawing algorithm. Re-encoding AVIF with a different FFmpeg/libaom build can change its exact bytes.

## Evidence and scientific limits

[Scientific notes](SCIENTIFIC-NOTES.md) explain the equations, experiments and limits with primary references. The frozen program and source hashes are in the collection manifest.

- [Packed browser matrix](evidence/packed-browser.json): all five final programs passed desktop/mobile-sized opaque-iframe checks, controls, real PNG downloads, blocked external program requests and layout checks. Oracle draw/reset/rule-change regressions also passed.
- [Fourier native edges](evidence/fourier-native-edges.json): actual touch drawing, secondary-pointer release, pointer cancellation, audio replay/peak and native CSP checks. [Numeric receipt](source/fourier-forge/qa/numeric-receipt.json): independent NumPy FFT, analytic, Parseval, arc-length and audio-algebra checks.
- [Hash mathematics](source/hash-cathedral/math-qa.json): 2,164 checks, including 65 official NIST short-message vectors, the million-a example, Node crypto cross-checks and Merkle tampering. This is not NIST certification.
- [Chaos physics](evidence/chaos-physics.json): independent Lagrange mass-matrix residuals, SciPy DOP853 comparisons and integration convergence/energy measurements. [Reference generator](source/chaos-mirrors/qa/oracle.py) produces the separate numerical oracle, not a complete UI test.
- [Oracle/Garden model checks](evidence/oracle-garden-models.json): unbiased-index boundaries, deck balance, entropy, independent reaction–diffusion stencil and exact Float32 state round-trip. This model receipt predates an Oracle UI cancellation fix; final packed-browser checks verify that fix. [Garden brush/state check](evidence/garden-state.json) verifies painting and exact state recovery.
- The five `evidence/*-sizing.json` receipts record the actual local MCP calls and independent full-CBOR, media recovery, asset/ADA conservation, minimum-output and fee checks. `verify-mint-size.mjs` is the exact harness used; it takes the trusted checkout path and a request path, writes a new evidence directory beside itself and fetches current parameters. It never connects a wallet, signs or submits.

Rerun the standalone hash tests with `node experiments/science-five/source/hash-cathedral/verify.mjs`. Fourier's `qa/numeric.cjs` additionally requires Python 3 and NumPy; Chaos's `qa/oracle.py` requires NumPy and SciPy. Those numerical scripts write fresh receipts beside themselves, so use a disposable copy to preserve the release evidence.

Oracle responses are entertainment. The garden is a numerical chemical model, not an organism. Pendulum separation is not a measured Lyapunov exponent. Fourier audio sonifies x(t), not an external song. Merkle inclusion under a chosen root does not authenticate that root or establish ownership. Changing or saving browser state does not mutate an NFT.

Source and original artwork are under the repository [Apache-2.0 license](../../LICENSE). Hash test vectors are NIST's public [byte-oriented SHA test data](https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/secure-hashing). Earlier development attempts and browser profiles are excluded from this release.
