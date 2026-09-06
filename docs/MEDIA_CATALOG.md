# NFT Studio · existing capability and media kit

Public-safe integration material recovered and checked on 2026-09-06. No original
engine, minted artwork, validator, policy or existing website was changed. No
wallet was signed and no transaction was submitted.

`lib/capability-catalog.json` distinguishes configurable creators, exact original
copies, historical campaigns, frozen Scroll programs, specialty collection tools,
attributed demonstrations and service/contract blueprints. `lib/capabilities.ts`
provides a small optional TypeScript wrapper. These classifications describe the
existing implementations; they do not automatically enable a new mint route.

## Included

- All nine BMKR games: STARFALL, PRISM WAKE, TIDELOCK, LAST EMBER, Ledger Chess:
  Pocket, Crownline Checkers, Velvet Solitaire, NINEFOLD Sudoku and AFTERLIGHT.
  Exact compact programs, SVG covers and expanded offline programs; STARFALL
  includes its two memory-cartridge downloads.
- The Light We Leave, The Impossible Dawn, Keep Growing, Boss Fight and CHAIN
  PRESSURE: exact original image and/or program recovered from their confirmed
  Cardano transaction metadata and checked against recorded SHA-256 hashes.
- Original Ledger Chess and its original on-chain reader, recovered from their
  Scroll page transactions. The 85,994-byte game is distinct from Pocket Chess.
- Complete existing oligarCH collection pages, holder-gated PFP maker and wall,
  copied intact from the public release. The validator and live policy stay fixed.
- All three published Tipsy Turtles demo pages with their existing attribution,
  source links and expired mint-policy behavior preserved.
- Creation Engine's confirmed AVIF, separate WebP alternative, editable remix
  starter; KAYFABE's corrected-title Beat Lab and exact gold-grill AVIF; the three
  existing BMKR sculptural art sources.
- Seven ready-to-configure presets built with the existing Beat Lab, Focus Capsule
  and Decision Deck implementation. These are unminted presets, not new utility
  primitives. Their exact standalone HTML, instructional SVG and how-to files are
  in `public/presets/`.

All media paths start with `public/`; strip that prefix when serving a public
directory and pass the resulting URL through the new site's base-path helper.
`provenance.json` records each media source URL or public chain identity, byte
length and hash. `verification.json` records actual checks and their scope.
`SHA256SUMS` covers the complete delivered kit. `node verify-kit.mjs` verifies it.

## Integration rules

1. Preserve all nine `arcade-catalog.json` entries and the exact compact metadata
   and percent-encoded HTML URI logic. Generic verbose metadata or an extra base64
   wrapper can push large games over the cap. Original mint receipts used different
   wallet shapes; they are not visitor-wallet size guarantees. Preserve token
   change and reject a wallet whose complete signed transaction does not fit.
2. Extra originals are **media ready, new mint integration pending** in this kit.
   The current arcade verifier accepts only tiny 640px SVG covers. It cannot accept
   large animated SVGs or The Impossible Dawn's WebP unchanged. Use a separate
   strict, hash-pinned curated-media route with exact review/recovery and complete
   signed-byte validation. Keep generic SVG/HTML executable uploads separate.
3. The Impossible Dawn's original signed transaction was 16,341 bytes, leaving
   only 43 bytes. Use compact metadata and a freshly measured visitor transaction
   before offering a new copy. Never silently drop its renderer or replace its
   frozen original. CHAIN PRESSURE embeds its score/synth, not the generated WAV.
4. STARFALL copies reuse two public on-chain cartridges; they do not mint new
   cartridge NFTs. Automatic loading works in BMKR, while pool.pm's actual CDN CSP
   requires the saved-file picker. Include the cartridges ZIP and expanded HTML.
5. Legacy paths are self-contained trees. Keep `oligarCH/make/wall/` nested under
   `make/`. Relative back links stay valid when the complete collection tree is
   copied. CDN dependencies, existing canonical links and public chain readers
   remain external. Current epoch 654 parameters and all 350 Plutus V3 costs match
   the untouched maker; this is a dated check, not automatic future parameter
   refresh. Exercise its copied-page preview and synthetic transaction path before
   labeling the new site integration verified. Do not generalize its gate.
6. Original Ledger Chess uses LS-CHAIN v2 (two data pages plus manifest), not a
   single native-NFT transaction. Standalone play is local. Its on-chain claim
   action needs the existing reader, wallet, fee and **2 ADA locked forever**.
   An isolated iframe without the reader's messaging does not supply that flow.
   The frozen MIT referee has not changed.
7. Tipsy Turtles artwork/characters belong to that project. Retain the exact demo
   title, unaffiliated notice, original project links and attribution in any
   transaction description. Its old windows have expired. This kit provides the
   published demonstrations, not an enabled replacement collection mint policy.
8. Creation Engine's historical campaign deliberately uses a fixed gift recipient.
   A general Studio starter should use the visitor route and display its destination
   explicitly. KAYFABE and all nine game campaigns use visitor-wallet policies.
9. Only one existing interactive app attaches to custom art at a time. The seven
   presets use the bounded existing schema; apply their `spec` as `Artwork.interactive`.
   Fixed originals/games have no arbitrary custom-cover, added-trait or extra-program
   combination admitted here. The actual signed transaction decides the fit.
10. Eight membership/content/event/physical/evolution/vote/collaboration/loyalty
    entries remain blueprints. Metadata does not operate a protected service,
    consume a claim or enforce mutable state. Keep those routes explicitly at
    design/export until their complete use paths are implemented and verified.

## Verification scope

The kit re-fetched transaction metadata for all nine games, five extra originals
and Creation Engine; every exact cover/program matched the recorded hash. It also
recovered and checked the original two-page Chess game and one-page reader.
Every copied public game, campaign and legacy page was fetched and compared or
stored byte-identically; provenance records the public source.

Seven preset programs were generated twice identically, validated by the existing
bounded schema and measured below its 6,000-byte program cap. Real Chromium at
390px exercised every preset inside an opaque `allow-scripts allow-downloads`
iframe, with no outside requests or overflow. Beat presets produced finite,
nonzero native audio buffers and valid mono PCM16 WAV exports containing four
identical bars. Timer and picker controls worked. This does not claim subjective
listening, new mainnet mints, new wallet compatibility or the future Studio's
complete integration tests. Two representative mobile screenshots were inspected.

## Public standards references

[CIP-25](https://cips.cardano.org/cip/CIP-0025) describes NFT media metadata.
[CIP-30](https://cips.cardano.org/cip/CIP-0030) describes browser-wallet access.
[CIP-14](https://cips.cardano.org/cip/CIP-0014) identifies asset fingerprints.
These standards do not make public code exclusive to a token holder or activate
the service/contract blueprint benefits above.
