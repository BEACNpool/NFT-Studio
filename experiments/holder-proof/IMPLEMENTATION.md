# Offline verification candidate

The complete local path is: stored server challenge → byte-preserving COSE parse → strict Ed25519 verification → Cardano payment-key binding → scope/session/expiry checks → trusted snapshot predicate → atomic single-process nonce consumption. `npm run demo` replays a saved synthetic proof and demonstrates successful verification followed by replay rejection. It does not generate a signature, contact a wallet, query a chain, start a service or issue a live grant.

## Files and trust boundary

`cbor-profile.mjs` is a new limited decoder: maximum 4096 input bytes, depth 6, 128 items, arrays/maps at most 16 entries, text labels at most 64 bytes. Protected/key maps use tighter 512-byte, depth-2, 32-item limits. It accepts definite CBOR only, safe-range integers and byte/text/map/array/bool/null types, with optional outer tag 18. It rejects trailing bytes, semantic duplicate labels, reserved lengths, floats, unknown simple values, inner tags and invalid UTF-8. The integer decoder accepts non-minimal encodings while preserving original protected bytes, so an alternate encoding cannot bypass duplicate-label checks. These restrictions are narrower than general CBOR. [RFC 8949](https://www.rfc-editor.org/rfc/rfc8949.html)

`cose-verifier.mjs` accepts exactly `{signature,key}` plus server-provided `{addressHex,payloadHex,networkId}`. It checks the fixed COSE/CIP-30 profile described in `DESIGN.md`, assembles shortest-form Sig_structure with the original protected bstr, runs noble strict Ed25519 plus CSL verification, and returns the bound identity and exact byte diagnostics. All added header/key labels are rejected unless explicitly allowed; `crit`, private key and key-operation fields are outside this profile. `kid` is optional but must be a nonempty matching byte string when present.

`holder-verifier.mjs` accepts only `{nonce,signature,key}` from a caller. Configuration, request context, clock, stored challenge, chain adapter and nonce store come from the host application. It checks the challenge before any provider lookup, then checks expiry and holding freshness after all awaited reads. Proofs with bad signatures, request origin or replayed nonces never call the snapshot adapter. Snapshot failure does not consume the nonce. Concurrent successful checks race at the store's atomic consumption operation; exactly one wins in the included memory implementation.

An asynchronous database adapter must check expiry **at its own commit time**, using its trusted clock. It must provide immutable pending challenge records and atomic pending-to-consumed comparison scoped to the original session. The candidate checks time after an asynchronous store read, including a test where the challenge expires during that read. Network delay inside a real database commit cannot be handled by trusting a timestamp captured before that delay.

## Measured validation

The direct byte-array APIs read native typed-array buffer, offset and length slots, then copy a bounded view without invoking caller getters, iterators or species. Ordinary Node Buffers and offset views remain supported; shared and detached buffers are rejected. A source review found the previous decoder's caller-controlled length/iterator could bypass its library byte cap. The hex transport adapter already constructed bounded ordinary Buffers; this finding did not demonstrate an authentication bypass through that adapter. Eleven direct input regression groups now cover the correction.

- 52 primitive checks for public RFC-8032 verification, address/key binding, challenge scope, snapshot rules and memory-store behavior.
- 17 accepted COSE cases, including opposite map order, optional tag 18, non-minimal integer encodings, matched kid, base/pointer/enterprise addresses and payload lengths crossing CBOR boundaries. Two additional positive diagnostic checks reproduce CSL weak-key acceptance and noble strict rejection.
- 84 named rejection checks; 192 truncated inputs; all 512 one-bit signature mutations; 1,000 deterministic malformed envelopes.
- 23 combined-engine checks, including transfer, rollback, stale provider, wrong session/origin, client-injected snapshot, expiry during provider/store reads and concurrent replay.
- 16 public fixtures independently parsed and cryptographically verified by Python cryptography 41.0.7, with separate Sig_structure encoding and hashlib payment-key hashing. This cross-check is optional and not a package/runtime dependency.

The JS fixture generator uses an independent test encoder and Node's native Ed25519 KeyObjects. It never imports the production parser/encoder. Private KeyObjects remain only in process memory, are never exported or written, and are discarded after the test process exits. The saved fixtures contain only public keys, signatures and synthetic messages. Tests do not touch a real wallet, chain, signing key, provider credential or service. Python only verifies those saved public fixtures.

## Review boundaries

This is implementer QA, not an independent audit. The code is a candidate for review before a real authentication endpoint. Synthetic signature interoperability does not prove any particular wallet/device accepts the challenge or returns this exact profile. Missing `hashed`, empty `kid`, indefinite CBOR and unsupported headers are intentionally rejected, even if a broader generic CIP-8 implementation accepts them.

The proof establishes local signature validity and an identity binding. The snapshot's `canonical`, `complete`, tip and UTxO fields are **trusted adapter observations**, not cryptographic evidence derived by this code. A client supplying those same fields would invalidate the security model. No actual provider is implemented here. The memory store lacks production persistence, distribution, request quotas and cleanup. There is no HTTP middleware, cookie issuer, CORS/CSRF implementation, private-object delivery, durable grant or MCP authentication.

A successful result is `verified_at_observed_point`; it cannot guarantee future holding, irreversible finality, exclusive human identity, copyright or entitlement fulfillment. Protected delivery still needs a fresh check and clear transfer/reorg policy. A copied downloadable response cannot be revoked. Integration must preserve the intended network, action and asset rather than letting request JSON select them.
