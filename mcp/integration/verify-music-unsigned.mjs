/** Direct local assertions over synthetic unsigned output. No shared builder/recovery imports. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
import { loadMusicToolFixture, assertMusicToolResult } from './verify-music-tools.mjs';
import { syntheticNativeFixture } from './verify-synthetic-native.mjs';
import { preflightCbor } from '../src/cbor-preflight.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const bn = value => C.BigNum.from_str(String(value));
const hex = value => Buffer.from(value).toString('hex');
const reference = input => input.transaction_id().to_hex() + '#' + input.index();
const checked = result => { assert.ok(!result.isError, result.content?.[0]?.text); return result.structuredContent || JSON.parse(result.content[0].text); };
export const canonicalMusicJson = value => JSON.stringify(value && typeof value === 'object'
  ? Array.isArray(value) ? value.map(item => JSON.parse(canonicalMusicJson(item)))
    : Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(canonicalMusicJson(value[key]))])) : value);
function chunks(text) {
  if (Buffer.byteLength(text) <= 64) return text;
  const parts = []; let part = '';
  for (const character of text) { if (Buffer.byteLength(part + character) > 64) { parts.push(part); part = ''; } part += character; }
  if (part) parts.push(part); return parts;
}
function valueEntries(value, into, multiplier = 1n) {
  const add = (key, quantity) => into.set(key, (into.get(key) || 0n) + multiplier * BigInt(quantity));
  add('lovelace', value.coin().to_str());
  const multi = value.multiasset(); if (!multi) return;
  const policies = multi.keys();
  for (let p = 0; p < policies.len(); p++) {
    const policy = policies.get(p), assets = multi.get(policy), names = assets.keys();
    for (let n = 0; n < names.len(); n++) add(policy.to_hex() + '.' + hex(names.get(n).name()), assets.get(names.get(n)).to_str());
  }
}
function directMetadata(pkg, asset) {
  const image = pkg.bundle.files[0], tracks = new Map(pkg.tracks.map(track => [track.fileName, track.song]));
  const row = {
    name: pkg.bundle.name, image: chunks(image.uri), mediaType: image.mediaType,
    image_name: image.name, image_sha256: image.sha256, image_bytes: image.bytes,
    ...(pkg.bundle.description ? { description: chunks(pkg.bundle.description) } : {}),
    files: pkg.bundle.files.slice(1).map(file => ({ name: file.name, mediaType: file.mediaType, src: chunks(file.uri), sha256: file.sha256, bytes: file.bytes,
      song: { ...tracks.get(file.name), song_title: chunks(tracks.get(file.name).song_title) } })),
    schema: pkg.bundle.schema, content_sha256: pkg.bundle.sha256, music_metadata_version: 3,
    release: pkg.release, music_profile: pkg.profile, music_package_sha256: pkg.packageHash,
  };
  return JSON.parse(canonicalMusicJson({ '721': { [asset.policyId]: { [Buffer.from(asset.assetNameHex, 'hex').toString('utf8')]: row }, version: '1.0' } }));
}

export function assertSyntheticMusicUnsigned(result, packageResult, fixture) {
  assertMusicToolResult(packageResult, fixture.args);
  const pkg = packageResult.musicRelease, { packageHash, ...packageBody } = pkg;
  assert.equal(sha(canonicalMusicJson(packageBody)), packageHash, 'Direct SHA-256 of all package content');
  assert.equal(result.schema, 'nft-studio.stateless-unsigned-music.v1');
  assert.equal(result.mode, 'nft'); assert.equal(result.networkId, 1);
  assert.equal(result.musicPackageHash, packageHash); assert.equal(result.metadataProfile, pkg.profile);
  assert.deepEqual(result.musicRelease, pkg); assert.equal(result.packetJson, packageResult.packetJson);
  for (const field of ['packetId', 'intentHash', 'signedHex']) assert.equal(Object.hasOwn(result, field), false);
  assert.equal(result.signed, false); assert.equal(result.submitted, false);
  assert.equal(result.witnessVerification.nodeStoredVerifierAcceptsThisPacket, false);
  assert.equal(result.checks.rightsVerified, false); assert.equal(result.checks.chainInclusionVerified, false);
  assert.match(result.checks.walletInputs, /ownership unverified/);
  assert.equal(result.reviewUrl, 'https://beacnpool.github.io/NFT-Studio/?view=labs&lab=music');
  assert.equal(result.review.url, result.reviewUrl);
  assert.ok(result.unsignedHex.length <= 32768); preflightCbor(result.unsignedHex);
  const tx = C.Transaction.from_hex(result.unsignedHex), body = tx.body(), witnesses = tx.witness_set();
  assert.equal(tx.to_hex(), result.unsignedHex); assert.equal(body.to_hex(), result.bodyHex);
  assert.equal(C.FixedTransaction.from_hex(result.unsignedHex).transaction_hash().to_hex(), result.transactionHash);
  assert.equal(result.unsignedBytes, result.unsignedHex.length / 2);
  assert.equal(body.fee().to_str(), result.feeLovelace);
  assert.ok(BigInt(result.feeLovelace) > 0n && BigInt(result.feeLovelace) <= 2000000n);
  assert.ok(result.estimatedSignedBytes >= result.unsignedBytes && result.estimatedSignedBytes <= 16384);
  assert.ok(BigInt(result.feeLovelace) >= BigInt(result.protocol.feeA) * BigInt(result.estimatedSignedBytes) + BigInt(result.protocol.feeB));
  assert.equal(Number(body.ttl_bignum().to_str()), result.validUntilSlot);
  for (const field of ['required_signers', 'validity_start_interval', 'certs', 'withdrawals', 'update', 'script_data_hash', 'collateral', 'collateral_return', 'reference_inputs', 'total_collateral', 'voting_procedures', 'proposal_procedures', 'donation', 'current_treasury_value'])
    if (typeof body[field] === 'function') assert.equal(body[field](), undefined, 'Unexpected transaction action: ' + field);
  for (const field of ['vkeys', 'bootstraps', 'plutus_scripts', 'plutus_data', 'redeemers']) assert.equal(witnesses[field](), undefined);
  const supplied = new Map(fixture.wallet.utxos.map(raw => { const u = C.TransactionUnspentOutput.from_hex(raw); return [reference(u.input()), u]; }));
  const required = new Set(), selected = [], balance = new Map();
  for (let i = 0; i < body.inputs().len(); i++) {
    const ref = reference(body.inputs().get(i)); assert.ok(!selected.includes(ref)); selected.push(ref);
    const original = supplied.get(ref); assert.ok(original, 'Selected input must come from local snapshot');
    valueEntries(original.output().amount(), balance);
    required.add(original.output().address().payment_cred().to_keyhash().to_hex());
  }
  assert.ok(selected.length > 0); assert.deepEqual([...result.selectedInputRefs].sort(), [...selected].sort());
  const change = C.Address.from_hex(fixture.wallet.changeHex), key = change.payment_cred().to_keyhash();
  required.add(key.to_hex()); assert.deepEqual([...result.requiredPaymentKeyHashes].sort(), [...required].sort());
  assert.equal(result.recipient, change.to_bech32());
  const asset = result.asset; assert.equal(asset.quantity, '1'); assert.equal(asset.policyExpirySlot, result.validUntilSlot + 3000);
  assert.equal(selected.filter(ref => Buffer.from('NFTS' + sha(ref + '|' + packageHash).slice(0, 28)).toString('hex') === asset.assetNameHex).length, 1, 'Asset name commits the full package and one consumed seed');
  const scripts = C.NativeScripts.new(); scripts.add(C.NativeScript.new_script_pubkey(C.ScriptPubkey.new(key)));
  scripts.add(C.NativeScript.new_timelock_expiry(C.TimelockExpiry.new_timelockexpiry(bn(asset.policyExpirySlot))));
  const policy = C.NativeScript.new_script_all(C.ScriptAll.new(scripts));
  assert.equal(policy.to_hex(), asset.nativeScriptHex); assert.equal(policy.hash().to_hex(), asset.policyId);
  assert.equal(witnesses.native_scripts().len(), 1); assert.equal(witnesses.native_scripts().get(0).to_hex(), policy.to_hex());
  const mint = body.mint(); assert.equal(mint.keys().len(), 1); assert.equal(mint.keys().get(0).to_hex(), asset.policyId);
  const groups = mint.get(mint.keys().get(0)); assert.equal(groups.len(), 1);
  const assets = groups.get(0); assert.equal(assets.len(), 1); const name = assets.keys().get(0);
  assert.equal(hex(name.name()), asset.assetNameHex); assert.equal(assets.get(name).to_str(), '1');
  const mintedKey = asset.policyId + '.' + asset.assetNameHex; balance.set(mintedKey, (balance.get(mintedKey) || 0n) + 1n);
  assert.equal(result.outputs.length, body.outputs().len()); assert.ok(body.outputs().len() > 0);
  for (let i = 0; i < body.outputs().len(); i++) {
    const out = body.outputs().get(i); assert.equal(out.address().to_hex(), fixture.wallet.changeHex);
    assert.equal(out.has_data_hash() || out.has_plutus_data() || out.has_script_ref(), false);
    const minimum = C.min_ada_for_output(out, C.DataCost.new_coins_per_byte(bn(result.protocol.coinsPerByte))).to_str();
    assert.ok(BigInt(out.amount().coin().to_str()) >= BigInt(minimum));
    assert.deepEqual(result.outputs[i], { index: i, address: change.to_bech32(), valueCborHex: out.amount().to_hex(), lovelace: out.amount().coin().to_str(), minimumLovelace: minimum });
    valueEntries(out.amount(), balance, -1n);
  }
  balance.set('lovelace', balance.get('lovelace') - BigInt(result.feeLovelace));
  for (const [asset, remaining] of balance) assert.equal(remaining, 0n, 'Independent ADA/asset sum: ' + asset);
  const metadata = directMetadata(pkg, asset), general = C.GeneralTransactionMetadata.new();
  general.insert(bn(721), C.encode_json_str_to_metadatum(JSON.stringify(metadata['721']), C.MetadataJsonSchema.NoConversions));
  const expectedAux = C.AuxiliaryData.new(); expectedAux.set_metadata(general);
  assert.deepEqual(result.metadata, metadata);
  assert.equal(tx.auxiliary_data().to_hex(), expectedAux.to_hex(), 'Expected file/credit metadata assembled directly from local inputs');
  assert.equal(body.auxiliary_data_hash().to_hex(), C.hash_auxiliary_data(expectedAux).to_hex());
  assert.equal(result.auxiliaryDataHash, C.hash_auxiliary_data(expectedAux).to_hex());
  assert.ok(expectedAux.to_bytes().length <= 14000);
  return { packageHash, transactionHash: result.transactionHash, unsignedBytes: result.unsignedBytes,
    metadataBytes: expectedAux.to_bytes().length, estimatedSignedBytes: result.estimatedSignedBytes,
    packageSha256Verified: true, exactFilesAndCredits: true, bodyHashVerified: true, auxiliaryCommitmentVerified: true,
    soleQuantityOneMint: true, valueConservation: true, noStoredPacket: true, chainStateVerified: false, ownershipVerified: false, signed: false, submitted: false };
}
export async function verifyMusicUnsignedTool(client, tools) {
  const tool = tools.find(tool => tool.name === 'prepare_unsigned_music_transaction'); assert.ok(tool);
  assert.deepEqual(tool.annotations, { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true });
  const { args } = loadMusicToolFixture(), fixture = { args, wallet: syntheticNativeFixture('nft').wallet };
  const packageResult = checked(await client.callTool({ name: 'create_music_release', arguments: args }));
  const result = checked(await client.callTool({ name: tool.name, arguments: { packetJson: packageResult.packetJson, wallet: fixture.wallet } }));
  return assertSyntheticMusicUnsigned(result, packageResult, fixture);
}
