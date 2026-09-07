// Direct-library input regressions. No keys, signatures, network or fixture writes.
import assert from 'node:assert/strict';
import { decodeCborProfile, encodeSigStructure } from './cbor-profile.mjs';
const passed = [];
const test = (name, run) => { run(); passed.push(name); };
let callbacks = 0;
const trap = () => { callbacks++; throw new Error('Caller code executed'); };
const hideProperties = value => {
  for (const key of ['length', 'byteLength', 'byteOffset', 'buffer', 'constructor', 'slice'])
    Object.defineProperty(value, key, { get: trap });
  Object.defineProperty(value, Symbol.iterator, { get: trap });
  return value;
};
test('ordinary Buffer and nonzero offset retain exact bytes', () => {
  const backing = Buffer.from([255, 0x42, 7, 9, 255]);
  const output = decodeCborProfile(backing.subarray(1, 4));
  assert.deepEqual(output, new Uint8Array([7, 9]));
  backing[2] = 88;
  assert.equal(output[0], 7);
});
test('fake length cannot admit one MiB through 4096 byte decoder bound', () => {
  const value = new Uint8Array(1048581);
  value.set([0x5a, 0, 0x10, 0, 0]);
  Object.defineProperty(value, 'length', { value: 1 });
  assert.throws(() => decodeCborProfile(value), /input size/);
});
test('decoder never invokes caller length/buffer/iterator/slice/species', () => {
  assert.equal(decodeCborProfile(hideProperties(new Uint8Array([1]))), 1);
  assert.equal(callbacks, 0);
});
test('Buffer custom properties remain inert', () => {
  assert.equal(decodeCborProfile(hideProperties(Buffer.from([2]))), 2);
  assert.equal(callbacks, 0);
});
test('Uint8Array subclass callbacks remain inert', () => {
  class Hostile extends Uint8Array {
    static get [Symbol.species]() { return trap(); }
    [Symbol.iterator]() { return trap(); }
    slice() { return trap(); }
  }
  assert.equal(decodeCborProfile(new Hostile([3])), 3);
  assert.equal(callbacks, 0);
});
test('Sig_structure uses exact bounded view offsets', () => {
  const protectedBacking = new Uint8Array([255, 0xa0, 255]);
  const payloadBacking = Buffer.from([255, 0x61, 255]);
  assert.equal(encodeSigStructure(protectedBacking.subarray(1, 2), payloadBacking.subarray(1, 2)).toString('hex'), '846a5369676e61747572653141a0404161');
});
test('Sig_structure never invokes caller properties or iterator', () => {
  assert.equal(encodeSigStructure(hideProperties(new Uint8Array([0xa0])), hideProperties(Buffer.from([0x61]))).toString('hex'), '846a5369676e61747572653141a0404161');
  assert.equal(callbacks, 0);
});
test('Sig_structure cannot spoof protected or payload size', () => {
  const protectedBytes = new Uint8Array(513), payloadBytes = new Uint8Array(1537);
  Object.defineProperty(protectedBytes, 'length', { value: 1 });
  Object.defineProperty(payloadBytes, 'length', { value: 1 });
  assert.throws(() => encodeSigStructure(protectedBytes, new Uint8Array()), /protected header size/);
  assert.throws(() => encodeSigStructure(new Uint8Array(), payloadBytes), /payload size/);
});
test('shared memory rejects even when caller conceals buffer property', () => {
  const value = new Uint8Array(new SharedArrayBuffer(1));
  Object.defineProperty(value, 'buffer', { get: trap });
  assert.throws(() => decodeCborProfile(value), /shared memory/);
  assert.throws(() => encodeSigStructure(value, new Uint8Array()), /shared memory/);
  assert.throws(() => encodeSigStructure(new Uint8Array(), value), /shared memory/);
  assert.equal(callbacks, 0);
});
test('detached views reject', () => {
  const value = new Uint8Array([0]);
  structuredClone(value.buffer, { transfer: [value.buffer] });
  assert.throws(() => decodeCborProfile(value));
  assert.throws(() => encodeSigStructure(value, new Uint8Array()));
  assert.throws(() => encodeSigStructure(new Uint8Array(), value));
});
test('non-byte typed arrays and DataView reject', () => {
  for (const value of [new Uint16Array([0]), new DataView(new ArrayBuffer(1))]) {
    assert.throws(() => decodeCborProfile(value), /byte array/);
    assert.throws(() => encodeSigStructure(value, new Uint8Array()), /byte array/);
  }
});
console.log(JSON.stringify({ schema: 'beacn-holder-byte-view-regressions-v1', checks: passed.length, cases: passed, callerCallbacks: callbacks, signingPerformed: false, chainQueries: false }, null, 2));
