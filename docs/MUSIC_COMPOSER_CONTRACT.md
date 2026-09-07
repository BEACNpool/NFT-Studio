# Music composer behavior

The browser composer is `components/music-release-lab.tsx`, under
**Labs → Music release**. It creates a local exact package, then offers explicit
wallet review through the dedicated music transaction builder.

The form accepts one image cover and one to seven WAV, MPEG, Ogg or MIDI files,
with at most 12,000 raw bytes. It neither compresses nor transcodes. A package can
still exceed the complete transaction limit once credits, inputs and witnesses
are included. Metadata is bounded to 14,000 bytes using a worst-case asset name;
the wallet review measures the complete signed estimate separately.

Release controls include title, description and an optional date. Each track has
an exact filename, song title, declared whole-second duration, artists, genres,
master declaration and composition declaration. One track uses Single; additional
tracks use Multiple. Duration is a supplied declaration, not a decoded measurement.
Optional songwriting shares must total exactly 100%; they configure no payments.

Opening a canonical music package verifies its contents before displaying a
result. Imported optional credits are retained and shown in full in the review.
An imported NFT display name distinct from the release title is preserved; an
unchanged rebuild must return the same package hash. Editing the release title
also updates its NFT display name.

Every draft change increments a revision and clears the old verified package,
export actions and wallet review. Asynchronous file reads, imports, builds and
exports discard results for obsolete revisions. A malformed replacement clears
old success. Imported programs are never executed. The exact file preview uses
the shared sandboxed, no-network renderer; MIDI files can be downloaded for a
separate player. The original one-second example requires no wallet connection.

The wallet dialog binds its identity to the complete package hash, including
credits. It uses `buildMusicReleaseTransaction` and
`assertMusicReleaseUnchanged`, plus the ordinary freshness/account/signature and
transaction checks. Credit changes during an outstanding wallet prompt prevent
submission. The signed receipt is persisted before submission is attempted.
See [the transaction contract](MUSIC_TRANSACTIONS.md) and
[receipt recovery](MUSIC_RECEIPTS.md).

This is a documented CIP-60-aligned Studio extension, not a claim of strict v3
CDDL conformance or universal player interoperability. Optional Boolean fields
from the upstream schema cannot be directly represented in ledger metadata and
are omitted; absence is not a false classification. Identifiers and rights
statements are declarations, not verification of assignment or copyright.

Run `npm run verify:music` for codec/builder/receipt checks and
`scripts/audit-music.cjs` against a built local preview for the browser workflow.
The browser suite uses synthetic wallet/chain responses and checks actual signed
metadata recovery, asset conservation, stale reviews, receipt failures and import
boundaries. Real device-wallet acceptance remains a separate observation.
