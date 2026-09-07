# Optional root-owned integration

No existing project file was edited by this task. Preserve the existing
`public/labs/music-demo.package.json` and its one-second test/demo behavior.

Suggested additive files: copy the kit to a source/evidence experiment location,
and publish `index.html`, `midnight-beacon.music-release.json`, `assets/`, and the
recipe under `public/labs/midnight-beacon/` if a standalone preview is useful.
All README links are relative; the preview itself embeds the exact package and
its media, and its download is an exact Blob of the canonical package string.
It does not depend on a server route or root-relative URL.

For MusicReleaseLab, add a second fixed “Try Midnight Beacon · 8s” button next to
“Try a one-second original”. Reuse the existing `run` revision/busy guard, fixed
`assetPath` fetch with ten-second timeout, and `accept` parser/budget path. The
new button should only import the reviewed canonical package. Keep playback as
an explicit user gesture and use the existing full browser wallet-review flow.
Do not accept an arbitrary demo URL or auto-open a wallet.

The current `demo` boolean's message says “Original synthetic one-second example”.
Either change that message to duration-neutral wording for both fixtures, or use
a small fixed demo identifier to select accurate copy. Do not label this eight-
second package as one second. No new public MCP tool is needed: the existing
create/verify/unsigned Music tools already use this exact supported profile.

This kit tests a local standalone preview and the shared constructor in Node. Root
should separately test the final Music Lab import, exact export, selected audio
preview, credits and transaction review after UI integration. The synthetic
preparation evidence is not a reusable live mint packet. Keep “unminted demo”
visible, preserve AI-assisted credit declarations, and do not infer player support,
rights, live fee, or chain inclusion from these tests.
