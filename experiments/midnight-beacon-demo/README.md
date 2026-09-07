# Midnight Beacon

An original, AI-assisted BEACN Labs music demonstration: four bars at 120 BPM,
eight decoded seconds of pulse melody, triangle bass, arpeggios and synthesized
percussion. The score, synthesis code and 893-byte SVG cover were created for
this task. No samples, recorded performances, stock artwork or fetched media.

[Open the standalone preview](index.html), [download the canonical Music package](midnight-beacon.music-release.json), or [open the encoded audio](assets/midnight-beacon.ogg).

The release is unminted. Credits explicitly say AI-assisted demonstration and
are declarations; they do not certify rights or authorship. No human listening
review is claimed. This is a useful playable showcase, not a confirmed NFT.

This v2 candidate changes only the declared bitrate from unitless `7200` to
`7.2 kbit/s`, then regenerates its package, transaction and browser evidence.
Both raw media files and the synthesis/encoding recipe are unchanged. The original
dated encoder receipt is retained for those identical bytes; encoding tests were
not repeated for v2. The frozen v1 kit remains unchanged.

## Exact package and transaction

| Item | Bytes |
| --- | ---: |
| Ogg/Opus audio | 7,707 |
| SVG cover | 893 |
| Both raw files | 8,600 |
| Canonical package JSON | 12,901 |
| Actual metadata CBOR | 13,194 |
| Actual unsigned transaction | 13,591 |
| Estimated signed transaction | 13,697 |

`packageHash`: `3655e44e6c5a1ddd735c3e60b72e8ef76cecb5749f6763250e6ba629ebb96f65`.
This is the codec's whole-content commitment, distinct from a hash of the complete
JSON file. `MANIFEST.json` supplies ordinary file SHA-256 digests.

The shared Studio Music constructor and dedicated stateless MCP preparer produced
the same bytes in Node with CSL 17. Existing direct CSL/Node-crypto assertions
checked the body hash, auxiliary commitment, sole quantity-one mint, full-package
identity, exact expected file/credit metadata, ADA/token sums, output minima and
fee/size bounds. The synthetic fee was 758,225 lovelace. This is one recorded wallet
shape and a fixed synthetic quote, not a live fee or universal fit guarantee.
The synthetic preparation in [the evidence](evidence/synthetic-prepared.json)
uses invented inputs and must never be signed or submitted.

Recovery decoded the actual transaction's metadata and reconstructed the complete
package, including every credit and both files. The recovery path shares the
Studio codec; the direct assertions share CSL. Neither is an independent ledger
implementation. No network calls, private keys, signatures or submissions were used.
The 25 read source inputs match Git commit
`b870f55ea095747b4eafc10e7be925c8e71cd16c`; see [source provenance](evidence/source-provenance.json).

## Playback and levels

Final FFmpeg float decoding returned 384,000 mono samples at 48 kHz: exactly eight
seconds, peak 0.77755 and RMS 0.17107, with no output samples at full scale. Native
Chromium WebAudio returned eight seconds with peak 0.70795 and RMS 0.17147, also
without full-scale output samples. Different decoder output is recorded rather
than presented as byte-identical PCM. The container/media element reports 8.0065
seconds; the decoded audio buffer is 8.0000 seconds.

The encoder applies **-3 dB Opus output gain**. Earlier drafts without this gain
had rare decoder peaks above full scale. The final checks concern the final
output PCM; they are not a claim about every decoder's internal arithmetic.
This compact 7.2-kbit/s recording intentionally trades fidelity for size. It is
the encoded Ogg bytes that the package commits; the larger synthesis WAV is not
part of the mint payload.

Chromium 152 was exercised at 390×844 and 1440×900: audio stayed paused until an
explicit click, advanced to `ended`, and decoded successfully. The cover rendered,
there was no horizontal overflow or page error, and only the local preview page
was requested. Displayed package hashes and actual browser-downloaded JSON bytes
matched the canonical file at both sizes. The preview uses embedded media and
no CDN, remote player or wallet. No Safari/Firefox/wallet-player support claim.

## Reproduce locally

Use a fresh working copy of this kit; verification scripts write local evidence.
Never rerun them in the frozen original. Python 3.12.3, FFmpeg 6.1.1 and libopus
1.4 were used. Exact repeat synthesis and encoding matched on that environment;
other encoder/library/platform versions may produce different bytes.

```sh
python3 scripts/synthesize.py /new/reference.wav
ffmpeg -hide_banner -loglevel error -n -fflags +bitexact \
  -i /new/reference.wav -map_metadata -1 -c:a libopus -b:a 7200 \
  -vbr off -application audio -frame_duration 60 -compression_level 10 \
  -ar 24000 -ac 1 -bsf:a opus_metadata=gain=-768 \
  -flags:a +bitexact -fflags +bitexact /new/midnight-beacon.ogg
python3 scripts/verify-encoding.py
node scripts/verify-package.mjs /path/to/NFT-Studio
python3 scripts/render-preview.py
```

The Node verification reads the selected Studio checkout and its already-installed,
pinned `mcp/node_modules`; it bundles only into this working copy. It does not
install dependencies or mutate the selected checkout. Use the recorded source
commit and package lock when reproducing the dated transaction bytes.

For the optional preview, serve this directory locally. The browser verifier
uses the existing webdev-toolkit's Puppeteer and snap Chromium, with fresh private
profiles and download directories. These browser checks were run on Linux.

```sh
python3 -m http.server 8926 --bind 127.0.0.1
node scripts/verify-browser.mjs /path/to/webdev-toolkit
```

This candidate is offered for inclusion under NFT-Studio's Apache-2.0 project
license; no third-party artwork, audio or font files are bundled. Encoding tools
and the Studio/CSL dependencies retain their own licenses. The preview uses the
reader's local system fonts. This statement is not a rights-verification service.
