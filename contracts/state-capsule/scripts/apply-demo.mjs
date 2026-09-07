/** Apply the published synthetic seed and name; verify that both purposes remain identical. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { blake2b } from '@noble/hashes/blake2.js';
import { assetNames, fromHex, serialiseData, toHex } from './capsule-codec.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const aiken = process.env.AIKEN_BIN ?? 'aiken';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'capsule-apply-'));
const seedCbor = toHex(serialiseData({ constructor: 0, fields: [{ bytes: '11'.repeat(32) }, { int: 0 }] }));
const nameCbor = toHex(serialiseData({ bytes: assetNames('CAPSULE').baseNameHex }));
function run(args) {
  const result = spawnSync(aiken, args, { cwd: root, encoding: 'utf8', timeout: 60_000 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || String(result.error));
}
run(['blueprint', 'apply', '-i', 'plutus.json', '-o', path.join(temp, 'seed.json'), seedCbor]);
run(['blueprint', 'apply', '-i', path.join(temp, 'seed.json'), '-o', 'fixtures/applied-demo.json', nameCbor]);
const blueprint = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/applied-demo.json')));
const first = blueprint.validators[0];
for (const entry of blueprint.validators) {
  assert(!entry.parameters?.length);
  assert.equal(entry.compiledCode, first.compiledCode);
  assert.equal(entry.hash, first.hash);
}
assert.equal(first.hash, toHex(blake2b(Uint8Array.from([3, ...fromHex(first.compiledCode)]), { dkLen: 28 })));
fs.unlinkSync(path.join(temp, 'seed.json')); fs.rmdirSync(temp);
console.log(JSON.stringify({ policyId: first.hash, scriptBytes: first.compiledCode.length / 2, identicalHandlerCount: blueprint.validators.length }, null, 2));
