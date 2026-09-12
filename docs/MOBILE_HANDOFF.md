# Send to mobile in NFT-Studio

After previewing a creation, choose **Send to mobile (QR)** or tell your agent
“Send this to my phone.” The agent shows a scannable QR image, the complete phone
link and its expiry. Scan it with your phone camera to open the same creation.

In the browser, the equivalent control is **Continue on phone → Create QR code**
on an ordinary Agent minting review. On the receiving phone, **Open in wallet
browser** continues to a compatible wallet browser when you want wallet review.
Creating or opening a transfer does not connect a wallet, sign, submit or mint.

## Agent workflow

1. Preserve the exact files the user reviewed. Discover `studio_capabilities` and
   validate them with `create_mint_intent` / `verify_mint_intent`.
2. When the user requests mobile delivery, call `create_mobile_handoff` with that
   exact `intent`. The tool uploads encrypted content, retrieves it, decrypts it
   and verifies the complete intent matches before returning success.
3. Display `qr.svg` as an image using your client's artifact facility. Give the
   exact `url` and `expiresAtIso`; do not hand-copy the link or encode the long
   desktop `#mint=` link instead. The local helper below also produces PNG.
4. Retain the desktop review and `.intent.json` fallback. Keep `endTransfer`
   private; use its exact arguments with `revoke_mobile_handoff` if the creator
   asks to end the transfer. A fresh QR requires a fresh requested transfer.

For local files:

```sh
node mcp/create-review.mjs --request REQUEST.json --output NEW_DIRECTORY --mobile
```

The exporter saves `mobile-qr.png`, `mobile-qr.svg`, `mobile-url.txt`, a
self-contained `mobile.html`, a private transfer/revocation record, the ordinary
desktop review files and a receipt. See [local-file exports](MCP_LOCAL_FILES.md).

If an older MCP lacks `create_mobile_handoff`, open the exact review in Studio
and use **Continue on phone → Create QR code**. Update the checkout, run
`npm --prefix mcp ci && npm --prefix mcp run build`, then reconnect the MCP client
to discover the new tools. The setup page is an installation guide, not a remote
MCP endpoint. Do not replace this workflow with a LAN server or unrelated QR.

## Limits and privacy

The transfer accepts ordinary `nft-studio.intent.v1` NFT/data packages: one to
eight files, up to **12,000 total raw bytes** and 80,000 bytes of intent JSON.
Full transaction fit is checked later. Large preview GIFs, dedicated music
release packets, Scrolls, Books and large catalogue creators are not ordinary
transfer inputs. Preserve unsupported files, explain the limit and use their
supported browser route; agree on material artwork changes before making a
compact version. A QR does not make an oversized file mintable.

This uses the existing Studio relay at
`https://handoff.beacnpool.org/api/handoffs`. AES-GCM ciphertext expires after
**15 minutes**. The content decryption key stays in the `#transfer=` fragment of
the phone link and is not sent to the relay. Anyone holding the complete link or
QR can view the creation until expiry; share it only with intended reviewers.
The creator revocation token is separate from the phone link. The relay may
reject excess traffic; retain the saved request and retry when requested.

Both the local Node MCP and optional public Worker expose the same two mobile
tools and capability description. Public-MCP clients send their supplied intent
to their chosen MCP operator before it is encrypted for the handoff relay.
Local stdio keeps that processing on the user's computer.
