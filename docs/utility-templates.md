# BMKR interactive templates

Start with an image, choose a utility, customize it, then review and mint. You can try both
programs without a wallet. Choosing **Create the example NFT** opens an editable draft with a
cover that explains its use; it does not submit a transaction.

| Template | Creator controls | What a person does |
|---|---|---|
| Focus capsule | Focus and break lengths, accent, artwork/title | Open the HTML attachment; choose a mode; start, pause or reset |
| Decision deck | 2–8 different prompts/choices, accent, artwork/title | Open the HTML attachment; press Pick one; use the result or pick again |

The cover and complete program are embedded in the mint transaction. A compatible NFT viewer
can run the HTML attachment. If a wallet only displays the cover, download `interactive.html`
and open it in a current browser. The standalone file works offline. Keep the creation package
for the full-resolution cover, editable project and how-to instructions.

Both are public tools: anyone with a copy can use them. The minted configuration is fixed;
in-session progress resets on reload. Transfer changes ownership of the collectible, not who
can execute copied public code. The apps do not access wallets, submit transactions, store
personal data or fetch remote resources. A focus timer is not a background alarm service; the
decision picker is not a lottery or vote.

## Adding a template

1. Extend the versioned data union and strict validator in `lib/interactive.ts`. Keep supported
   configuration bounded. Generate from maintained program code and escaped data; do not add
   an arbitrary-script editor to this trusted template flow.
2. Add a functional preview, matching instructional cover and short how-to instructions.
   Cover text must agree with selected settings. Preserve accessibility, phone controls and
   independent operation without a wallet or external resources.
3. Include the exact program in prepared metadata and exports. Import, collection, undo and
   remix paths must preserve supported configuration. Measure the complete signed transaction,
   including the cover, program, metadata, inputs, change and every witness.
4. Extend tests for the actual capability and its failure cases. Recover the program from
   decoded signed CBOR; test sandbox isolation and offline operation in a browser. Confirm
   actual chain inclusion and viewer behavior before describing a showcase as minted.

## Capabilities that need another mechanism

Private downloads and membership require a protected service that verifies a signed wallet
challenge and current holdings. Already downloaded copies cannot be revoked after resale.
One-time redemption requires authoritative consumed state; evolving NFTs require authorized
state transitions. These are not activated by attaching an app, a link or a utility flag.
The existing benefit blueprints keep these dependencies visible.

For implementation research, start with the primary specifications:
[CIP-25 media](https://cips.cardano.org/cip/CIP-0025),
[CIP-30 wallets](https://cips.cardano.org/cip/CIP-0030),
[CIP-8 message signing](https://cips.cardano.org/cip/CIP-0008),
[CIP-68 datum metadata](https://cips.cardano.org/cip/CIP-0068),
and the [Aiken gift-card example](https://aiken-lang.org/example--gift-card).
