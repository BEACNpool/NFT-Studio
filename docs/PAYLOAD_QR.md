# BEACN Payload QR

**Create. Scan. Carry.** Small creations that people can print, scan and pass on.

For artists sharing a collectible, event organizers making keepsakes, educators
handing out small interactive lessons, and communities remixing a tiny game or tool.
The code carries a creation request. The viewer chooses whether to mint it with
 their own wallet. Sharing is an invitation, not an automatic ownership transfer.

## Choose the right QR

| | Continue on phone | Print & share payload QR |
|---|---|---|
| Purpose | Move today's desktop creation into a phone wallet | Print or forward a small public creation |
| Content | AES-GCM ciphertext on the Studio relay | Complete compressed intent in the QR URL fragment |
| Lifetime | 15 minutes; creator can end it | No transport expiry; cannot revoke public copies |
| Capacity | Ordinary 12,000 raw-byte / 8-file / 80,000 intent-byte bounds | At most 2,331 encoded bytes for the entire URL, ECC M |
| Privacy | Anyone with the complete key-bearing link can view until expiry | Anyone with the code can read and forward it |

Neither code connects a wallet, signs, submits, or transfers an already minted NFT.
The reader application must load. A new mint needs internet, wallet approval,
network fees and minimum output ADA. The request's absence of expiry does not
promise that a website remains hosted forever.

## Make one

1. Create and preview exact compact content with your connected AI, or the browser's Files creator.
2. Open **Add a useful capability** and **Mint options**. Apply changes before sharing.
3. Choose **Print & share payload QR**. If the content does not fit, Studio shows the measured encoded size and preserves your original files.
4. Save PNG or SVG, print, copy the full link, or use the phone's Share action where supported.
5. Scan a real test print. Keep its white border, use a generous size, and verify on the intended phone.

Anyone can forward the same code or link. Exact content and mint options survive
copying. Each recipient's wallet creates its own policy at preparation; this is
not one shared collection or a capped campaign. No viral-growth guarantee is made.

## MCP

- `studio_utilities`: available capabilities and their enforcement/dependencies.
- `configure_mint_options`: update a verified intent. Omitted options retain their existing values. The returned v2 hash binds the new choices; prepare a fresh transaction.
- `create_payload_qr`: return the exact public URL and printable SVG, with measured capacity and no network upload.
- `create_mobile_handoff`: keep using this for the separate encrypted 15-minute phone route.

Local exact-file export:

```sh
node mcp/create-review.mjs --request request.json --output new-output --payload-qr
```

Outputs include the original verified request/review, `payload-qr.png`,
`payload-qr.svg`, `payload-url.txt`, `payload.html`, and a verification receipt.
Use `--mobile` instead for the temporary encrypted route. A request may include
`mintOptions` in the exact shape documented in [Mint options](MINT_OPTIONS.md).

The codec uses canonical JSON, deterministic raw DEFLATE level 9 and canonical
base64url, prefixed `#payload=v1.`. Decode into a fixed 80,001-byte buffer; reject
anything exceeding 80,000 bytes. Recompression, UTF-8, strict intent validation
and the content hash must agree before rendering. Imported programs remain inert
in Studio's review. Sharing the payload does not certify its author or safety.

## Evidence and primary sources

`npm run verify:payload-qr` checks exact BOM/Unicode recovery, tampering, bad UTF-8,
trailing encoding, bounded expansion and oversize preservation. MCP tests exercise
real Node and Workerd, actual QR decode, copy-forward, bound options and actual
unsigned quantities. These are synthetic checks, not new real-wallet mint acceptance.
The marketing film's ATM RUNNER mobile mint is separate recorded evidence.

- [DENSO capacity table](https://www.qrcode.com/en/about/versionPage/versionPage31_40.html): QR version 40 byte mode, ECC M = 2,331 bytes.
- [DENSO print guidance](https://www.qrcode.com/en/howto/code.html/index.html): keep a four-module clear margin.
- [RFC 3986, fragment semantics](https://www.rfc-editor.org/rfc/rfc3986#section-3.5): fragment interpretation is separate from HTTP retrieval.
- [fflate source](https://github.com/101arrowz/fflate/blob/master/src/index.ts): supplied output buffers truncate; the extra byte is a required rejection sentinel.

Sources reviewed September 12, 2026. No new QR standard is claimed; BEACN Payload QR
is NFT-Studio's application of existing QR, compression and Cardano tools.
