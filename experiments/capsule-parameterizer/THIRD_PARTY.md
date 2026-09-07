# Third-party software

The application adapter is Apache-2.0. The frozen State Capsule blueprint and codec snapshot retain the repository's Apache-2.0 license. The UPLC compiler/CBOR libraries are consumed unchanged from exact npm versions, with transitive versions and integrity hashes in `package-lock.json`.

| Runtime package | Version | License |
| --- | --- | --- |
| @harmoniclabs/uplc | 2.0.7 | Apache-2.0 |
| @harmoniclabs/plutus-data | 2.0.1 | Apache-2.0 |
| @harmoniclabs/cbor | 2.0.2 | Apache-2.0 |
| @harmoniclabs/bigint-utils | 1.0.0 | Apache-2.0 |
| @harmoniclabs/uint8array-utils | 1.0.4 | Apache-2.0 |
| @harmoniclabs/crypto | 0.3.1 | MIT |
| @harmoniclabs/obj-utils | 1.0.0 | MIT |
| @harmoniclabs/bitstream | 1.0.0 | MIT |
| @noble/hashes | 2.4.0 | MIT |

Harmonic Laboratories copyright and Apache/MIT notices are retained in `licenses/`. `LICENSE` contains Apache-2.0. Harmonic's crypto package includes noble code, whose MIT copyright is preserved by esbuild's generated `.LEGAL.txt` as well as the noble MIT notice included in `licenses/`.

The bitstream package declares MIT in its pinned package metadata but omits a standalone LICENSE file. `licenses/harmoniclabs-bitstream.txt` retains that exact provenance and supplies the standard MIT text, without inventing an upstream copyright year.

Distribute the browser module together with its generated `.LEGAL.txt`, `LICENSE`, `THIRD_PARTY.md` and `licenses/` directory. Build copies those notices into `dist/`. CSL17, esbuild and Puppeteer are development/test dependencies and are not in the runtime browser artifact.
