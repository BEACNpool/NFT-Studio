/** Reproducible unminted showcase fixture. No network, wallet, private keys or signatures. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
import { build } from 'esbuild';

const check = process.argv.includes('--check');
const directory = resolve('public/labs');
const temporary = await mkdtemp(join(tmpdir(), 'nft-studio-passport-demo-'));
const timestamp = Date.parse('2026-09-07T00:00:00.000Z');
const originalNow = Date.now;
const originalFetch = globalThis.fetch;
Date.now = () => timestamp;
globalThis.fetch = () => {
  throw new Error('The passport demo must be completely offline.');
};
try {
  await build({
    stdin: {
      contents:
        "export {preparePayloadBundle} from './lib/studio-payload.ts'; export {buildStudioTransaction} from './lib/studio-transaction.ts'; export {createArtifactPassport,artifactPassportBytes,verifyArtifactPassport} from './lib/artifact-passport.ts';",
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: join(temporary, 'source.mjs'),
  });
  const {
    preparePayloadBundle,
    buildStudioTransaction,
    createArtifactPassport,
    artifactPassportBytes,
    verifyArtifactPassport,
  } = await import(pathToFileURL(join(temporary, 'source.mjs')).href);
  const artwork =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#cbb4ff"/><stop offset="1" stop-color="#67e4ca"/></linearGradient></defs><rect width="640" height="640" rx="32" fill="#15121e"/><g fill="none" stroke="url(#g)"><circle cx="320" cy="286" r="174" stroke-width="2"/><circle cx="320" cy="286" r="128" stroke-width="2"/><path d="M120 286h90l44-106 71 212 65-151 38 45h92" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></g><text x="320" y="529" fill="#ece5ff" font-family="monospace" font-size="32" text-anchor="middle" letter-spacing="8">BEACN SIGNAL</text><text x="320" y="570" fill="#b6a9c9" font-family="monospace" font-size="14" text-anchor="middle" letter-spacing="3">UNMINTED DEMONSTRATION</text></svg>';
  const note =
    'BEACN Signal — an unminted demonstration.\n\nThese exact SVG and text bytes travel inside the passport. The transaction uses a fabricated input and public dummy payment-key hash. It was never signed, submitted or confirmed.\n\nA content match proves byte identity. It does not prove chain inclusion, authorship, ownership or a completed build.\n';
  const bundle = await preparePayloadBundle({
    name: 'BEACN Signal — unminted demo',
    description:
      'An offline demonstration with fabricated transaction inputs. Never signed, submitted or confirmed.',
    files: [
      {
        name: 'signal.svg',
        mediaType: 'image/svg+xml',
        bytes: new TextEncoder().encode(artwork),
      },
      {
        name: 'read-me.txt',
        mediaType: 'text/plain',
        bytes: new TextEncoder().encode(note),
      },
    ],
    coverIndex: 0,
  });
  const address = C.EnterpriseAddress.new(
    1,
    C.Credential.from_keyhash(C.Ed25519KeyHash.from_hex('42'.repeat(28))),
  ).to_address();
  const utxo = C.TransactionUnspentOutput.new(
    C.TransactionInput.new(C.TransactionHash.from_hex('d0'.repeat(32)), 0),
    C.TransactionOutput.new(
      address,
      C.Value.new(C.BigNum.from_str('20000000')),
    ),
  );
  const protocol = {
    fetchedAt: timestamp,
    slot: 197151000,
    blockTime: timestamp / 1000,
    epoch: 654,
    feeA: '44',
    feeB: '155381',
    keyDeposit: '2000000',
    poolDeposit: '500000000',
    coinsPerByte: '4310',
    maxTx: 16384,
    maxValue: 5000,
  };
  const prepared = await buildStudioTransaction(
    C,
    bundle,
    'nft',
    { changeHex: address.to_hex(), utxos: [utxo.to_hex()] },
    protocol,
  );
  const receipt = {
    schema: 'nft-studio.receipt.v1',
    demo: 'UNMINTED: fabricated inputs; never signed, submitted or confirmed. signedHex is the historical receipt field name and contains unsigned CBOR in this demonstration.',
    hash: prepared.hash,
    kind: 'nft',
    name: bundle.name,
    createdAt: timestamp,
    state: 'unknown',
    bytes: prepared.unsignedHex.length / 2,
    signedHex: prepared.unsignedHex,
    metadata: prepared.metadata,
  };
  assert.equal(
    C.Transaction.from_hex(receipt.signedHex).witness_set().vkeys(),
    undefined,
  );
  const passport = await createArtifactPassport(C, receipt);
  const verified = await verifyArtifactPassport(C, passport, {
    transactionCborHex: receipt.signedHex,
  });
  assert.equal(verified.status, 'verified-local-content');
  assert.equal(verified.signaturesVerified, false);
  assert.equal(verified.chainInclusionVerified, false);
  const files = new Map([
    ['signal-demo.passport.json', Buffer.from(artifactPassportBytes(passport))],
    [
      'signal-demo.receipt.json',
      Buffer.from(JSON.stringify(receipt, null, 2) + '\n'),
    ],
  ]);
  if (!check) await mkdir(directory, { recursive: true });
  for (const [name, bytes] of files) {
    const target = join(directory, name);
    if (check)
      assert.deepEqual(
        await readFile(target),
        bytes,
        `${name} must reproduce exactly`,
      );
    else await writeFile(target, bytes, { flag: 'wx' });
  }
  console.log(
    JSON.stringify({
      mode: check ? 'verified' : 'created',
      passportHash: passport.passportHash,
      contentBytes: bundle.bytes,
      transactionBytes: receipt.bytes,
      signed: false,
      submitted: false,
      walletAccess: false,
    }),
  );
} finally {
  Date.now = originalNow;
  globalThis.fetch = originalFetch;
  // Only the small generated module in this process's own temporary directory.
  await rm(temporary, { recursive: true, force: true });
}
