# Happy Labor Day — to the American worker

An **unminted** two-file example for an actual AI-agent → MCP → browser review
demonstration. The animated flag carries “Happy Labor Day” and “To the American
worker · 2026.” The 7.2-second original whistle march uses a determined pulse,
whistled lead and snare. It contains no supplied recording or sampled song.

Dedication: “To the American worker—who builds, serves, repairs, teaches, and
keeps this country moving. Happy Labor Day 2026.” September 7, 2026 is Labor Day:
[OPM calendar](https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/),
[Department of Labor history](https://www.dol.gov/general/laborday/history).

## Try the prepared example

From the NFT-Studio repository after the normal MCP dependency install/build:

```sh
node mcp/create-review.mjs --request experiments/labor-day-worker-demo/request.json --output ./labor-day-review
```

Choose a fresh output directory. Open its `review.html`, follow the complete
link, and inspect both file tabs in Studio. Click Play on the audio tab. The
separate local `index.html` shows the same cover and audio together; it is an
asset preview, not a wallet screen or minted viewer. The saved `intent.json`
also works as the ordinary Agent minting import fallback.

For reliable local Ogg seeking, run `node scripts/serve-preview.mjs` from this
example directory and open its printed loopback URL. It serves only the preview
and two fixed media files. The public synthesis recipe is
`scripts/synthesize.py`; run it in a scratch copy with Python and FFmpeg/libopus
to preserve the recorded example. Encoder versions can change the encoded bytes.

In Codex, with the repository skill loaded:

> $nft-studio Use the prepared Labor Day files in
> experiments/labor-day-worker-demo/request.json. Create and verify the exact
> mint request with the local-file helper, save a fresh review folder, and give
> me its review.html. I will inspect it and approve any mint with Eternl myself.
> Do not sign or submit.

This prepared-file prompt verifies packaging and handoff. A separate natural
language creation request asks the agent to make new artwork/music first; do
not represent these already-prepared files as newly generated during a recording.
The MCP packages bytes supplied by the agent; it is not a music-generation API.

## Observed evidence

| Content | Bytes | SHA-256 |
| --- | ---: | --- |
| `happy-labor-day.svg` | 1,880 | `789acd5c1b5fa11cdf7041e486833c41f32712fff0066afa5e743f608b93a857` |
| `original-whistle-march.ogg` | 6,266 | `ff4a427f455c2f95c7a01461a103eabddcbfde9d0a7a5b45a3f5dc05e7e3a3a9` |

Total raw content: **8,146 bytes**. Expected intent:
`7b62df3ce92b69b7ee3d149eb3f757c1cd17e79f80ddbafd1bb04810b944d0a1`.
The exact review URL is 15,684 characters. The client saves it programmatically;
it need not pass through a model's text response or a Windows shell argument.

[Synthetic transaction sizing](evidence/synthetic-size.json) used the actual
shared builder and observed public parameters with invented inputs. Its complete
transaction with an invalid sizing witness was 12,475 bytes. This establishes
fit for that fixture only; the user's wallet must build and review its actual
transaction. No sizing transaction was submitted or signed with a real wallet.

[Local browser evidence](evidence/browser-preview.json) checks animation,
finite Ogg duration and playback at 1440/390 pixels. [Published Studio review](evidence/public-content-review.json)
checks exact cover/audio playback at both widths and the exact desktop request
export. These are technical playback observations; human listening review and
Eternl acceptance remain pending. No confirmed NFT identity exists yet.

[Actual Codex materialization](evidence/codex-materialization.json) records one
reviewed helper command and the exact matching saved outputs. A first local
workspace sandbox attempt failed before execution; the successful retry used
host execution for that command. The helper performed the three SDK MCP calls.
It did not ask the model to copy the opaque media or full link. Raw private
inference logs are excluded from this public evidence.

The ordinary native flow charges **0 ADA Studio fee**. Cardano network fees
apply, and minimum ADA remains with the NFT. The native policy's mint window
does not establish permanent one-of-one supply. Actual wallet approval, chain
inclusion, asset identity, destination and reconstructed files must be observed
before describing a finished mint or publishing a completed-mint demonstration.
