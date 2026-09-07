/** Rebuild the deterministic, download-ready local capsule history. No wallet or network. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assetNames, buildDatum, transition, verifyHistory } from './capsule-codec.mjs';

const blueprint = JSON.parse(fs.readFileSync(new URL('../fixtures/applied-demo.json', import.meta.url)));
const svg = (phase, color, rings) => `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><rect width="640" height="640" fill="#080d18"/><circle cx="320" cy="292" r="150" fill="none" stroke="${color}" stroke-width="2"/>${Array.from({ length: rings }, (_, i) => `<circle cx="320" cy="292" r="${42 + i * 28}" fill="none" stroke="${color}" opacity="${(1 - i * 0.12).toFixed(2)}" stroke-width="${3 + i}"/>`).join('')}<path d="M320 142L450 367H190Z" fill="none" stroke="${color}" stroke-width="4"/><text x="320" y="520" fill="${color}" font-family="monospace" font-size="27" text-anchor="middle">${phase}</text><text x="320" y="559" fill="#798da9" font-family="monospace" font-size="14" text-anchor="middle">BEACN LABS · STATE CAPSULE</text></svg>`;
const image = (phase, color, rings) => `data:image/svg+xml;base64,${Buffer.from(svg(phase, color, rings)).toString('base64')}`;
const genesis = buildDatum({ metadata: { name: 'BEACN State Capsule', image: image('GENESIS', '#42e6bc', 1), description: 'An original BEACN Labs local demonstration.', traits: { chapter: 0, energy: 1 } } });
const evolved = transition(genesis, { metadata: { name: 'BEACN State Capsule', image: image('EVOLVED', '#8b91ff', 4), description: 'An original BEACN Labs local demonstration.', traits: { chapter: 1, energy: 8 } } });
const frozen = transition(evolved, { action: 'freeze' });
const states = [genesis, evolved, frozen];
assert.equal(verifyHistory(states).valid, true);
const demo = { schema: 'beacn.state-capsule.demo.v1', evidence: 'locally-tested-not-minted', name: 'BEACN State Capsule', purpose: 'Demonstrates deterministic CIP-68 data, linked authorized transitions, and a permanent freeze.', network: null, transactionId: null, policyId: blueprint.validators[0].hash, policyIsAppliedSyntheticExample: true, seed: { transactionId: '11'.repeat(32), outputIndex: 0 }, baseName: 'CAPSULE', ...assetNames('CAPSULE'), stateController: 'Aiken Plutus V3 combined mint/spend validator', authorization: 'Spend the exact key-held user token, require its payment-key signer, and return it to the same full address.', compiledScriptBytes: blueprint.validators[0].compiledCode.length / 2, states, verification: verifyHistory(states), limitations: ['This history is a deterministic local data example, not proof of chain inclusion.', 'No issued asset exists for this fixture.', 'Freeze preserves metadata and permanently locks the reference token and its ADA.', 'The holder token remains transferable after freeze; no burn or recovery path exists.'] };
const target = fileURLToPath(new URL('../fixtures/demo-history.json', import.meta.url));
const contents = JSON.stringify(demo, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(target, 'utf8'), contents, 'Demo must be deterministically reproducible.');
else fs.writeFileSync(target, contents);
console.log(JSON.stringify({ status: 'pass', historyStates: states.length, datumBytes: states.map(state => state.datumBytes), tipHash: frozen.datumHash, output: 'fixtures/demo-history.json' }, null, 2));
