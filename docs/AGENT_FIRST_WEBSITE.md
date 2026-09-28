# Agent-first website

The September 2026 direction is **the agent is the interface**. The homepage
and `/mcp/` entry lead to cloning the repository and asking an agent to read
`START_HERE.md`. They do not lead with the TUI, visual workbench, or browser editor.
The current tool limits and final signing authority remain visible.

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

The four small prompt illustrations use original CSS; they are labeled examples,
not minted products. No external fonts, image CDN or additional runtime library
is required by the landing page.
