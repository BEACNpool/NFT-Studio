/** Verify the admitted immutable profile before importing its verification API. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const snapshot = new URL(
  '../experiments/music-schnorr-seal/snapshot/',
  import.meta.url,
);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const raw = await readFile(new URL('MANIFEST.json', snapshot));
assert.equal(
  sha(raw),
  '0a6441fd446f1d8a0298bf1e8c27b3b2a5f19db64cdab75ffcb7dbbdf97a7e32',
);
const manifest = JSON.parse(raw);
assert.equal(manifest.files.length, 52);
for (const file of manifest.files) {
  assert.match(file.path, /^[A-Za-z0-9_.\/-]+$/);
  assert.ok(!file.path.startsWith('/') && !file.path.split('/').includes('..'));
  const bytes = await readFile(new URL(file.path, snapshot));
  assert.equal(bytes.length, file.bytes, file.path);
  assert.equal(sha(bytes), file.sha256, file.path);
}
for (const name of [
  'midnight-beacon.music-release.json',
  'example-seal.json',
  'example-trust.json',
  'changed-credit.music-release.json',
]) {
  const original = await readFile(new URL('fixtures/' + name, snapshot));
  const publicBytes = await readFile(
    new URL('../public/labs/music-seal/' + name, import.meta.url),
  );
  assert.deepEqual(publicBytes, original, 'Public fixture: ' + name);
}
const { inspectSeal, prepareChallenge } = await import(
  new URL('dist/seal.mjs', snapshot)
);
const packet = await readFile(
  new URL('fixtures/midnight-beacon.music-release.json', snapshot),
  'utf8',
);
const seal = await readFile(
  new URL('fixtures/example-seal.json', snapshot),
  'utf8',
);
const trust = await readFile(
  new URL('fixtures/example-trust.json', snapshot),
  'utf8',
);
const changed = await readFile(
  new URL('fixtures/changed-credit.music-release.json', snapshot),
  'utf8',
);
assert.equal((await inspectSeal(packet, seal)).verdict, 'valid-untrusted');
assert.equal(
  (await inspectSeal(packet, seal, trust)).verdict,
  'trusted-exact-release',
);
const mismatch = await inspectSeal(changed, seal, trust);
assert.equal(mismatch.cryptography, 'valid');
assert.equal(mismatch.packageBinding, 'mismatch');
assert.equal(mismatch.trustedExactRelease, false);
assert.equal(
  (await prepareChallenge(packet)).messageHex,
  '1e5a280d813866263a58dd48624accf498adce488090e826a9a6493336bc65b2',
);
console.log(
  'PASS: 52 immutable release-seal files, exact public examples and explicit trust/package separation.',
);
