// Replays public synthetic fixtures. This program does not sign or access a wallet.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createHolderProofVerifier } from './holder-verifier.mjs';
import { MemoryChallengeStore } from './primitives.mjs';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/holder-proof.json', import.meta.url), 'utf8'));
const store = new MemoryChallengeStore(); store.put(fixture.record);
const verify = createHolderProofVerifier({ config: fixture.config, limits: fixture.limits, store, readSnapshot: async () => structuredClone(fixture.trustedSnapshot), clock: () => fixture.verificationTime });
const decision = await verify(fixture.body, fixture.requestContext);
await assert.rejects(() => verify(fixture.body, fixture.requestContext));
console.log(JSON.stringify({ demonstration: 'Offline cryptographic holder proof with synthetic ledger/session/clock', decision: decision.decision, observedAsset: decision.observation.assetUnit, paymentKeyHash: decision.paymentKeyHash, replayRejected: true, actualWalletAccess: false, signingPerformed: false, chainQueries: false, liveAuthorizationIssued: false }, null, 2));
