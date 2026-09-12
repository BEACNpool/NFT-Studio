# Utility and mint options

The ordinary NFT creator and MCP share the same options. In Studio, inspect your
files, expand **Add a useful capability**, then **Mint options**. Apply your choices
before printing, phone transfer or wallet review. Changes create a new request hash;
old files, links and prepared transactions remain separate snapshots.

| Choice | Working behavior | Limit |
|---|---|---|
| Copies in this transaction | 1–1,000 interchangeable units of one asset, all initially sent to your wallet | Not separately numbered NFTs; not a lifetime cap |
| Policy closes after preparation | 1 hour, 24 hours, 7 days or 30 days in a signature + expiry native policy | Starts when preparing the transaction, not when sharing or scanning |
| Public traits | Up to 12 text pairs in the generated CIP-25 asset metadata | 64 UTF-8 bytes per name/value; descriptive only |
| Public message | Optional CIP-20 `674: {msg: [text]}` | At most 64 UTF-8 bytes |

The same wallet-controlled policy can authorize more minting until expiry. Once
closed, it rejects both minting and burning; existing tokens can still transfer.
A fresh preparation may produce a different policy ID. A shared QR lets another
wallet mint its own asset; it does not run a single collection sale.

## Add real utility

- **Playable app/game/instrument:** embed the actual compact program. Anyone who has its public bytes can use it. Use the existing App, Game or exact Files creator.
- **Exact files or proof:** attach compact files; use Proof of existence when only publishing file hashes. A hash is not authorship or proof of truth.
- **Music and credits:** use the dedicated Music release creator. Its CIP-60-aligned exact-file profile has documented compatibility limits; ordinary mint options do not apply to music packets.
- **Evolving state / CIP-68:** explore the experimental State Capsule lab. This ordinary builder does not issue an evolving asset by setting a metadata flag.
- **Holder access, redemption, tickets, royalties:** require a complete enforcing service/contract or the relevant registration workflow. No ordinary checkbox enables these. Physical fulfillment also needs a real issuer process.

The original Artifact Passport adapter admits its original quantity-one, exact
producer profile only. Advanced receipts with new traits/messages or multiple
copies need a different passport profile. Keep the complete transaction receipt;
ordinary Recovery still reconstructs the embedded files. Do not weaken the old
passport checks to accept unrelated metadata.

## Request schema

Unchanged default requests retain `nft-studio.intent.v1`. Explicit options use
`nft-studio.intent.v2` and include the following object in the canonical intent hash:

```json
{
  "quantity": 25,
  "mintWindowHours": 168,
  "traits": {"Collection": "Pocket signals", "Edition": "Blue"},
  "message": "A small creation to pass on."
}
```

Use this as `mintOptions` in `create_mint_intent` or a local-file helper request.
For an existing intent, call `configure_mint_options` with that intent and only
the fields to change. Omitted fields are preserved. The server, browser and phone
transfer all validate and carry the same exact options. No setting grants signing
or submission permission. Data-only mode rejects NFT options.

## Primary sources

- [Cardano native minting policies](https://developers.cardano.org/docs/developers/curriculum/native-tokens/minting-policies/)
- [CIP-25 NFT metadata](https://cips.cardano.org/cip/CIP-0025)
- [CIP-20 transaction messages](https://cips.cardano.org/cip/CIP-0020)
- [CIP-10 metadata labels](https://cips.cardano.org/cip/CIP-0010)
- [CIP-27 royalty registration](https://cips.cardano.org/cip/CIP-0027)
- [CIP-68 datum metadata](https://cips.cardano.org/cip/CIP-0068)

Reviewed September 12, 2026. A standard's existence does not establish Studio support.
