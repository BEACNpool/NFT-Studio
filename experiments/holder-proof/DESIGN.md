# BEACN holder proof — proposed application profile

Research and implementation snapshot: 2026-09-07. This is a locally tested verification candidate for NFT-Studio, not a deployed authentication service, a new Cardano standard, or an audited verifier. `IMPLEMENTATION.md` describes the implemented offline path and measured limits.

The useful product is a **transfer-aware holder check**: prove control of the payment key for an address and check an exact asset at that address in a fresh server-observed ledger view. A service can then issue a short, narrowly scoped off-chain grant. This can support a holder preview, event check-in, or access to a private API. The receipt describes what was observed and when. It does not establish a person's identity, copyright, guaranteed benefits, NFT uniqueness, or future holding.

## Standards and the proposed boundary

CIP-30 returns a COSE_Sign1 message plus COSE_Key. Its signData profile specifies Ed25519, the raw address header, an unhashed payload and empty external authenticated data. Base, enterprise and pointer addresses select the payment key; reward addresses select the staking key. Our application accepts only payment-key control. [CIP-30 signData](https://cips.cardano.org/cip/CIP-0030#apisigndataaddr-address-payload-bytes-promisedatasignature)

The COSE signature input is a structured encoding containing the original protected-header byte string. Re-encoding that header's decoded map can change the signed input. Generic CIP-8 also has a hashed-payload mode; this application explicitly does not negotiate it. [CIP-8](https://cips.cardano.org/cip/CIP-0008), [RFC 9052 sections 4.4 and 9](https://www.rfc-editor.org/rfc/rfc9052.html#section-4.4)

CIP-93 is **Proposed**. Its URI/action/time fields are useful prior art, but timestamp-only replay prevention is insufficient for our single-use application. This design adds an unpredictable server nonce, exact stored bytes and session-bound atomic consumption. It does not claim CIP-93 compliance: wallets must not change our stored timestamp or bytes. [CIP-93](https://cips.cardano.org/cip/CIP-0093)

## Minimal exchange

1. The browser connects through an explicit user action. It may use wallet UTxOs to **discover a candidate address**, selecting the address on the actual asset-bearing output. A change address is not necessarily controlled by the same payment key. This discovery is untrusted input.
2. Same-origin `POST /api/holder/challenge` sends only `{addressHex, resource}`. Server policy selects the accepted asset, audience, network and action. The endpoint binds a random challenge to its own Secure, HttpOnly, SameSite session cookie. It never lets the client select arbitrary provider URLs or permissions.
3. The server stores the exact payload bytes, expiry, address bytes, nonce, scope, and session binding. It returns `{nonce, addressHex, payloadHex, displayText}` with `Cache-Control: no-store`. The page displays the full action, origin, resource, network, asset and expiry. The wallet is asked for `api.signData(addressHex, payloadHex)` only after a user gesture. No transaction is built.
4. Same-origin `POST /api/holder/verify` sends `{nonce, signature, key}`. The body contains no trusted holdings, account ID, provider result, or new payload. The server obtains the payload from its stored challenge, validates request context, parses and verifies COSE, binds the public key to the address, and queries its own configured chain adapter.
5. After successful checks, a database compare-and-set changes `pending` to `consumed`, requiring the same session and unexpired nonce. Grant issuance and nonce consumption belong in one database transaction. Exactly one concurrent request succeeds. Rotate the session identifier when elevating access.
6. A protected server route checks the grant's audience, action, resource and expiry and performs another fresh holding check at delivery. A demo may use a 30-second grant. Asset transfers invalidate subsequent checks. Public frontend bundles and publicly hosted NFT bytes cannot be made private by this gate.

The prototype payload is compact JSON with readable whitespace, printable ASCII content and a final LF; the example is 695 bytes. It includes:

```json
{
  "protocol": "beacn-holder-proof-v1",
  "uri": "https://labs.example/api/holder/verify",
  "action": "Verify NFT holding for demo access",
  "timestamp": 1788750000,
  "expiresAt": 1788750180,
  "origin": "https://labs.example",
  "audience": "beacn-labs-demo",
  "resource": "demo:holder-preview",
  "network": { "name": "mainnet", "id": 1, "magic": 764824073 },
  "address": "<actual asset-bearing Bech32 address>",
  "asset": { "policyId": "<28-byte hex>", "assetNameHex": "<0..32-byte hex>", "minimumQuantity": "1" },
  "nonce": "<32 cryptographically random bytes as hex>"
}
```

`fixtures/challenge.json` contains the concrete raw bytes and address. No parsing/reformatting happens between issuance and signing. Verification compares the COSE payload byte-for-byte with the stored payload. Names, fingerprints and CIP labels are display aids, not substitutes for the exact policy ID plus raw asset-name bytes. The address in the payload, protected header, server record and fresh UTxO must represent identical raw bytes.

## Verification invariants

The proposed COSE acceptance profile is deliberately narrow:

- Bound input sizes before decoding: signature envelope <=4 KiB, key <=512 bytes, payload <=1536 bytes. Bound decoder nesting/items and reject trailing bytes, malformed lengths, duplicate map labels, and labels duplicated between protected/unprotected maps. Reject unknown critical headers; v1 can reject all `crit` extensions.
- Accept one COSE_Sign1, not multisignature, encryption or an arbitrary tagged object. The candidate accepts optional standard tag 18 at the outermost level. Require definite CBOR lengths and a payload byte string; reject detached/null payloads. Indefinite encodings remain an explicit compatibility limitation.
- Protected headers must contain integer `alg=-8` and byte-string `address`. Optional `kid` must be a byte string; if present in either Sign1 or COSE_Key, require both and equal bytes. Keep an allowlist of the permitted labels and reject ambiguous overrides. Require unprotected `hashed=false`; absent/true/non-boolean is outside this v1 profile.
- COSE_Key must have `kty=1`, `alg=-8`, `crv=6`, and a 32-byte `x`. Reject private key fields, unexpected key operations, and unsupported extra keys. Do not select an algorithm from untrusted input.
- Verify the 64-byte Ed25519 signature over definite, shortest-form encoding of `["Signature1", originalProtectedBytes, emptyBytes, exactStoredPayload]`. The protected map's original bytes are opaque inside that structure; do not canonicalize them.
- Hash the verified public key with blake2b-224 and require equality with the address's **payment** credential. Reject script payment, reward and Byron addresses in this profile. Check exact full address and configured network; matching only a stake credential permits unrelated spending keys. Cardano's address format explicitly separates payment and delegation authority. [CIP-19](https://cips.cardano.org/cip/CIP-0019)
- Enforce configured origin, canonical endpoint, POST method, audience, action, resource, network, exact asset, nonce, session binding, expiry and single use independently of signature validity. An expiry of 180 seconds is a demo setting, with a hard maximum of 300. Server time controls expiry; do not trust a client clock.

These checks are an application profile, not claims that a third-party decoder performs them. The candidate now implements COSE verification in `cose-verifier.mjs` and composes it with challenge, trusted snapshot and atomic memory-store checks in `holder-verifier.mjs`. It does not supply a live chain adapter or production session store.

## Fresh holdings and transfer cases

The server must obtain the current unspent output's full address and multiasset value independently. A client can fabricate CBOR for a nonexistent UTxO, return a once-valid spent output, copy somebody else's output, or omit later transfers. Signing a challenge does not authenticate a separate `getUtxos()` response. Client references may be lookup hints, never evidence.

Prefer one acquired ledger state for related queries. Ogmios can query a chosen state while the node continues syncing; independent default-tip queries can observe different points. Store the observation's slot, block hash, height, provider identity and time. An indexer adapter must establish a consistent current snapshot and its lag; mixing an indexer's old holdings with another provider's fresh tip is invalid. [Ogmios ledger state queries](https://ogmios.dev/mini-protocols/local-state-query/)

The trusted adapter must resolve every candidate reference from current ledger state, verify exact address and raw asset unit, reject duplicate rows, and complete pagination. Check quantities as bounded integers, not JavaScript floating point. The demo predicate uses at least one unit and a configurable confirmation depth; it does not prove total supply one. Its example limits (10-second observation age, 120-second tip age, six confirmations) are **test settings**, not Cardano finality guarantees or production recommendations. Quiet block intervals may fail closed.

| Case | Required behavior |
| --- | --- |
| Signature produced before a transfer | Fresh holdings are absent: reject, even if signature is valid. |
| Transfer after grant creation | Recheck at protected action. Previously downloaded content cannot be revoked. |
| Transfer races the final check | Receipt is point-in-time only. A mempool transfer may be unseen; there is no atomic link between an off-chain response and a future ledger state. Valuable one-time rights need a separate on-chain redemption design. |
| Rollback/reorganization | Invalidate grants dependent on a rolled-back observation, reacquire current state, recheck. Depth reduces exposure; it does not prove irreversible finality. |
| Provider lag, outage, disagreement | No new grant. Show unavailable/pending rather than converting lack of evidence into a valid proof. |
| Token moved to another address with same payment key | Narrow v1 requires a new challenge for the actual full address; do not silently widen signed scope. |
| Reward key or script-custodied NFT | Unsupported. Stake control and being a script beneficiary do not prove the required payment-key control. |
| Testnet confusion | Bind both network ID and configured network name/magic. ID 0 alone does not distinguish preview from preprod. CIP-142 is Proposed and optional; use it for wallet UX when available, never as server authority. [CIP-142](https://cips.cardano.org/cip/CIP-0142) |
| COSE hashed payload | Reject in this profile. Do not guess whether bytes are plaintext or a digest. |
| UTxO datum hash instead of inline datum | Membership comes from the output's value and payment address, so a datum is unnecessary. A claimed `owner` field proves nothing. If later authorization depends on metadata, independently authenticate its reference token/script and resolve/hash-check the datum under a separate rule. Outputs may carry datum hashes or inline datums. [CIP-32](https://cips.cardano.org/cip/CIP-0032) |

Domain binding makes a copied signature invalid for another configured service; it does not stop phishing that persuades a person to sign the legitimate domain's challenge. Same-session binding, CSRF checks and an informative wallet prompt reduce relay opportunities. Keep API keys and grants off URLs, avoid localStorage for session secrets, rate-limit nonce issuance/verification, and store minimal address-linked logs. An MCP caller would require a distinct audience and a separate pairing/client-binding design; a browser cookie is not an MCP authentication scheme.

## Functional demo scope and remaining work

The smallest honest browser/server demo has a public explanation, an explicit wallet/signData button, and a server-protected text response showing the observed chain point and expiry. It should demonstrate success, wrong wallet, transferred token, stale provider and replay rejection. A public simulator is useful for learning but must be labeled simulation and must never issue real grants.

The offline candidate includes a bounded byte-preserving parser, adversarial COSE tests, strict Ed25519 verification and a complete synthetic challenge/holding/replay demo. Before implementing that endpoint: independently review the new parser and composition, add positive CIP-30 fixtures from actual wallets, a pinned trusted chain adapter, transactional nonce storage, bounded grant handling, and explicit request/cookie protection. Test account/network changes and user refusal without fallback to staking-key signatures. Production service work also needs bounded caches, session cleanup and provider rollback handling. Cryptographic CSL objects created by the verifier primitives are explicitly freed. No such service was started during this research.
