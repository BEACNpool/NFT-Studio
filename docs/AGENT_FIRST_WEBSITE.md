# Agent-first website

The September 2026 direction is **the agent is the interface**. The homepage
and `/mcp/` entry lead to cloning the repository and asking an agent to read
`START_HERE.md`. They do not lead with the TUI, visual workbench, or browser editor.
The copy button provides an agent-readable clone/setup prompt. The agent
handles installation using START_HERE.md and the repository-local Codex / Claude
skills; it does not claim to install a global skill from a website click.

`components/agent-home.tsx` keeps existing `?view=`, `?create=` and mint/transfer
fragment links on the original Studio renderer. The default homepage uses
`components/agent-landing.tsx` and scoped `app/agent-landing.css`. Existing minted
artifacts and the restored Koios configuration are unchanged.

The Claude routing skill reads the same canonical `.agents` skill as Codex.
It is intentionally a short reference, not a second copy of the minting rules.
The local SDK helper permits creation in the current session without waiting
for an MCP reconnect. Native registration remains available for future sessions.

## Original visual asset

`public/agent/imagination.webp` was generated with the built-in imagegen tool,
then optimized for web delivery (1024 × 1024). It is website artwork, not a
claim of a minted NFT. Original generation prompt:

> Create a premium editorial art photograph for the hero of an experimental
> creative coding / on-chain art website. Square 1:1 composition. One impossible
> continuous sculptural ribbon, a thick liquid chrome and translucent pale
> chartreuse glass loop folded into a complex organic knot, suspended over a warm
> ivory studio background (#f3f1e9). The form occupies about 75 percent of the
> frame, centered, broad graceful undulating folds, brushed silver, mirror chrome,
> subtle green caustics, very fine realistic surface texture. Refined art gallery
> product photography, dramatic soft directional light from upper left, delicate
> contact shadow beneath floating sculpture, crisp high resolution with physically
> realistic reflections, luminous surreal but restrained. Pale warm grey background,
> no black background. No lettering, no logo, no UI, no border, no watermarks,
> no coins, no crypto symbols. This is an abstract metaphor for imagination
> becoming a tangible object.

## Single-screen refinement — September 27, 2026

David requested one page with no scrolling, a copy-install-directions button,
Codex / Claude Code skill onboarding, creative features and browser-wallet minting.
The default page now has a single viewport composition: headline, Art / Games /
Music / Interactive NFTs / Apps & utility list, one setup CTA, and wallet guidance.
Decorative sculpture is omitted on small screens so the complete content fits.
There is no overflow clipping; clipboard failure reveals selectable instructions,
and enlarged text may naturally scroll rather than hiding content.

The copy button writes a complete clone + START_HERE prompt. Success is announced,
and denied clipboard access focuses/selects a read-only manual-copy field.
Existing review links and historical views retain their renderer.

Generated local review/payload pages now include a CIP-158 mobile-wallet link,
with the complete content fragment percent-encoded and a VESPR paste fallback.
Agent instructions prefer self-contained payload QR or exact review URLs because
the encrypted relay has not been restored. Real phone/app launching and wallet
signing are not established by automated browser/link checks.

No external fonts, image CDN or additional runtime library is required.
