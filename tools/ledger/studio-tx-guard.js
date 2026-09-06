/* NFT Studio: compare the complete wallet return with the reviewed transaction.
 * No keys, provider calls, wallet connection, signing, or submission live here.
 */
(() => {
  'use strict';
  const fail = message => { throw new Error(message); };
  function decode(raw) {
    let p = 0, items = 0;
    const byte = () => p < raw.length ? raw[p++] : fail('Truncated wallet transaction');
    function item(depth = 0) {
      if (depth > 64 || ++items > raw.length) fail('Wallet transaction is too complex');
      const start = p, b = byte(), major = b >>> 5, ai = b & 31;
      let length;
      if (ai < 24) length = BigInt(ai);
      else if (ai === 31) length = null;
      else {
        const width = {24:1,25:2,26:4,27:8}[ai];
        if (!width) fail('Invalid wallet CBOR');
        length = 0n;
        for (let i = 0; i < width; i++) length = length * 256n + BigInt(byte());
      }
      const children = [];
      if (major <= 1) {
        if (length === null) fail('Invalid wallet integer');
      } else if (major === 2 || major === 3) {
        if (length === null) {
          while (raw[p] !== 255) {
            const part = item(depth + 1);
            if (part.major !== major || part.length === null) fail('Invalid wallet byte chunks');
            children.push(part);
          }
          byte();
        } else {
          if (length > BigInt(raw.length - p)) fail('Truncated wallet bytes');
          p += Number(length);
        }
      } else if (major === 4 || major === 5) {
        if (length === null) {
          while (raw[p] !== 255) children.push(item(depth + 1));
          byte();
          if (major === 5 && children.length % 2) fail('Invalid wallet map');
        } else {
          const count = length * (major === 5 ? 2n : 1n);
          if (count > BigInt(raw.length - p)) fail('Truncated wallet collection');
          for (let i = 0; i < Number(count); i++) children.push(item(depth + 1));
        }
      } else if (major === 6) {
        if (length === null) fail('Invalid wallet tag');
        children.push(item(depth + 1));
      } else if (major === 7) {
        if (![20,21,22].includes(ai)) fail('Unsupported wallet CBOR value');
      } else fail('Invalid wallet CBOR type');
      return {start, end:p, major, length, children};
    }
    const root = item();
    if (p !== raw.length) fail('Wallet transaction has trailing bytes');
    return root;
  }
  const same = (a, x, b, y) => x.end - x.start === y.end - y.start &&
    a.subarray(x.start, x.end).every((v, i) => v === b[y.start + i]);
  function assertReviewed(signed, expected, params) {
    if (!(signed instanceof Uint8Array) || !(expected instanceof Uint8Array)) fail('Expected transaction bytes');
    const limit = Math.min(16384, Number(params?.maxTx || 16384));
    if (!Number.isSafeInteger(limit) || limit < 1 || signed.length > limit) fail('Signed transaction exceeds the network byte limit');
    if (expected.length > limit) fail('Reviewed transaction exceeds the network byte limit');
    const got = decode(signed), want = decode(expected);
    if ([got, want].some(t => t.major !== 4 || t.children.length !== 4)) fail('Wallet returned an invalid signed transaction');
    if (got.children[0].major !== 5 || !same(signed, got.children[0], expected, want.children[0])) fail('Wallet changed the reviewed transaction body');
    if (got.children[1].major !== 5) fail('Wallet returned invalid witnesses');
    const witnessKeys = new Set();
    for (let i = 0; i < got.children[1].children.length; i += 2) {
      const key = got.children[1].children[i];
      if (key.major !== 0 || witnessKeys.has(String(key.length))) fail('Wallet returned duplicate or invalid witness keys');
      witnessKeys.add(String(key.length));
    }
    if (signed[got.children[2].start] !== 0xf5 || !same(signed, got.children[2], expected, want.children[2])) fail('Wallet changed the transaction validity flag');
    if (!same(signed, got.children[3], expected, want.children[3])) fail('Wallet changed the reviewed transaction metadata');
    let fee;
    const body = got.children[0].children;
    for (let i = 0; i < body.length; i += 2) if (body[i].major === 0 && body[i].length === 2n) {
      if (fee !== undefined || body[i + 1].major !== 0) fail('Invalid reviewed transaction fee');
      fee = body[i + 1].length;
    }
    const a = Number(params?.a), b = Number(params?.b);
    if (![a,b].every(n => Number.isSafeInteger(n) && n >= 0) || fee === undefined) fail('Live fee parameters are required before submission');
    if (fee < BigInt(a * signed.length + b)) fail('Wallet witnesses increased the fee; rebuild before submitting');
    return true;
  }
  async function checkNetwork(wallet, expected) {
    if (![0,1].includes(expected) || await wallet.getNetworkId() !== expected) fail('Wallet network changed. Reconnect and review before signing or submitting.');
  }
  async function sign(wallet, unsigned, partial, network) {
    await checkNetwork(wallet,network);
    return wallet.signTx(unsigned,partial);
  }
  globalThis.NFTStudioTxGuard = Object.freeze({assert:assertReviewed,checkNetwork,sign});
})();
