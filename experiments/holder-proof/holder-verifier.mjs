import { verifyCip30DataSignature } from './cose-verifier.mjs';
import { assertChallengeContext, assertCurrentHolder, validateConfig } from './primitives.mjs';

const need = (ok, message) => { if (!ok) throw new Error(`Holder proof: ${message}`); };

// Compose cryptography with server-owned context, snapshot adapter and nonce store.
// readSnapshot and store are trusted injected adapters; no transport is supplied.
// A successful result is an observed-point decision, not a chain inclusion proof.
export function createHolderProofVerifier({ config, limits, store, readSnapshot, clock }) {
  const scope = structuredClone(validateConfig(config));
  const policy = structuredClone(limits);
  need(store && typeof store.get === 'function' && typeof store.consume === 'function', 'challenge store required');
  need(typeof readSnapshot === 'function' && typeof clock === 'function', 'trusted snapshot adapter and clock required');
  return async function verifyAndConsume(body, requestContext) {
    need(body && typeof body === 'object' && !Array.isArray(body), 'proof body required');
    const keys = Object.keys(body);
    need(keys.length === 3 && keys.every(key => ['nonce', 'signature', 'key'].includes(key)), 'body must contain only nonce, signature, key');
    need(typeof body.nonce === 'string' && /^[0-9a-f]{64}$/.test(body.nonce), 'invalid nonce');
    const nonce = body.nonce;
    const record = await store.get(nonce);
    need(record && record.challenge.nonce === nonce, 'unknown challenge');
    const context = structuredClone(requestContext);
    const request = { ...context, payloadHex: record.payloadHex };
    assertChallengeContext(record, scope, request, clock());
    const identity = verifyCip30DataSignature({ signature: body.signature, key: body.key }, {
      addressHex: record.addressHex, payloadHex: record.payloadHex, networkId: scope.network.id,
    });
    need(identity.addressBech32 === record.challenge.address, 'stored display address differs from signed raw address');
    const snapshot = structuredClone(await readSnapshot({ network: structuredClone(scope.network), addressHex: identity.addressHex, asset: structuredClone(scope.asset) }));
    const current = await store.get(nonce);
    const now = clock(); // Recheck time after every awaited lookup.
    need(current && current.payloadSha256 === record.payloadSha256 && current.addressHex === record.addressHex, 'challenge changed during verification');
    assertChallengeContext(current, scope, request, now);
    const observation = assertCurrentHolder(current, snapshot, policy, now);
    // Adapter contract: atomic pending->consumed conditional on expiry/session,
    // and immutable payload. An async DB adapter must check expiry using its
    // current clock at commit, not blindly trust this pre-call timestamp.
    await store.consume(nonce, current.sessionBinding, now);
    return {
      protocol: 'beacn-holder-proof-v1',
      decision: 'verified_at_observed_point',
      nonce, audience: scope.audience, action: scope.action, resource: scope.resource,
      verifiedAt: now, addressHex: identity.addressHex, paymentKeyHash: identity.paymentKeyHash,
      payloadSha256: identity.payloadSha256, observation,
      evidence: { signature: 'locally verified Ed25519 COSE_Sign1', holdings: 'trusted adapter observation', nonce: 'consumed by configured store' },
    };
  };
}
