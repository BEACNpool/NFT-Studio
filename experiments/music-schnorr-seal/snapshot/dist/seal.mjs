// node_modules/@noble/hashes/_u64.js
var fromNumH = (n) => n / 2 ** 32 | 0;
var fromNumL = (n) => n >>> 0;
function setU64FromNum(view, byteOffset, n, isLE) {
  const h = fromNumH(n);
  const l = fromNumL(n);
  view.setUint32(byteOffset, isLE ? l : h, isLE);
  view.setUint32(byteOffset + 4, isLE ? h : l, isLE);
}

// node_modules/@noble/hashes/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
var atitle = (title) => title ? `"${title}" ` : "";
function anumber(n, title = "") {
  if (typeof n !== "number")
    throw new TypeError(atitle(title) + "expected number, got " + typeof n);
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError(atitle(title) + "expected integer >= 0, got " + n);
  return n;
}
function abytes(value, length, title = "") {
  if (isBytes(value) && (length === void 0 || value.length === length))
    return value;
  if (length !== void 0)
    anumber(length, "length");
  const bytes = isBytes(value);
  const ofLen = length !== void 0 ? ` of length ${length}` : "";
  const got = bytes ? `length=${value.length}` : `type=${typeof value}`;
  const message = atitle(title) + "expected Uint8Array" + ofLen + ", got " + got;
  if (!bytes)
    throw new TypeError(message);
  throw new RangeError(message);
}
var aobject = (value, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError((label === "object" ? "" : `"${label}" `) + "expected object, got type=" + typeof value);
};
var aopts = (value, label) => {
  aobject(value, label);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null)
    throw new TypeError(`"${label}" expected plain object`);
  if (Object.hasOwn(value, "__proto__"))
    throw new TypeError(`"${label}.__proto__" is not allowed`);
};
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("hash was destroyed");
  if (checkFinished && instance.finished)
    throw new Error("digest() was already called");
}
function aoutput(out, instance) {
  abytes(out, void 0, "output");
  const min = instance.outputLen;
  if (!(out.length >= min)) {
    throw new RangeError('"output" expected length >= ' + min);
  }
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
var hasHexBuiltin = /* @__PURE__ */ (() => (
  // @ts-ignore
  typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
))();
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex(bytes) {
  abytes(bytes);
  if (hasHexBuiltin)
    return bytes.toHex();
  let hex2 = "";
  for (let i = 0; i < bytes.length; i++) {
    hex2 += hexes[bytes[i]];
  }
  return hex2;
}
function asciiToBase16(ch) {
  return ch >= 48 && ch <= 57 ? ch - 48 : ch >= 65 && ch <= 70 ? ch - (65 - 10) : ch >= 97 && ch <= 102 ? ch - (97 - 10) : void 0;
}
function hexToBytes(hex2) {
  if (typeof hex2 !== "string")
    throw new TypeError("hex string expected, got " + typeof hex2);
  if (hasHexBuiltin) {
    try {
      return Uint8Array.fromHex(hex2);
    } catch (error2) {
      if (error2 instanceof SyntaxError)
        throw new RangeError(error2.message);
      throw error2;
    }
  }
  const hl = hex2.length;
  const al = hl / 2;
  if (hl % 2)
    throw new RangeError("hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex2.charCodeAt(hi));
    const n2 = asciiToBase16(hex2.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0) {
      const char = hex2[hi] + hex2[hi + 1];
      throw new RangeError('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
function concatBytes(...arrays) {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    abytes(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}
function checkOpts(defaults, opts, title = "opts") {
  aopts(defaults, "defaults");
  if (opts !== void 0)
    aopts(opts, title);
  const merged = Object.assign(/* @__PURE__ */ Object.create(null), defaults, opts);
  return merged;
}
function createHasher(hashCons, info = {}) {
  if (typeof hashCons !== "function")
    throw new TypeError('"hashCons" expected function, got type=' + typeof hashCons);
  info = checkOpts({}, info, "info");
  const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(void 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.canXOF = tmp.canXOF;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
function randomBytes(bytesLength = 32) {
  anumber(bytesLength, "bytesLength");
  const cr = typeof globalThis === "object" ? globalThis.crypto : null;
  if (typeof cr?.getRandomValues !== "function")
    throw new Error("crypto.getRandomValues must be defined");
  if (bytesLength > 65536)
    throw new RangeError(`"bytesLength" expected <= 65536, got ${bytesLength}`);
  return cr.getRandomValues(new Uint8Array(bytesLength));
}
var oidNist = (suffix) => ({
  // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
  // Larger suffix values would need base-128 OID encoding and a different length byte.
  oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
});

// node_modules/@noble/hashes/_md.js
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD = class {
  blockLen;
  outputLen;
  canXOF = false;
  padOffset;
  isLE;
  // For partial updates less than block size
  buffer;
  view;
  finished = false;
  length = 0;
  pos = 0;
  destroyed = false;
  constructor(blockLen, outputLen, padOffset, isLE) {
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    abytes(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    let processed = false;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        processed = true;
        continue;
      }
      buffer.set(pos === 0 && take === len ? data : data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
        processed = true;
      }
    }
    this.length += data.length;
    if (processed)
      this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    buffer.fill(0, pos);
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      buffer.fill(0);
    }
    setU64FromNum(view, blockLen - 8, this.length * 8, isLE);
    this.process(view, 0);
    this.roundClean();
    const oview = out === buffer ? view : createView(out);
    const len = this.outputLen;
    const outLen = len / 4;
    const state = this.get();
    if (len % 4 || outLen > state.length)
      throw new Error("invalid outputLen");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneIntoMeta(to) {
    const { buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (pos)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);

// node_modules/@noble/hashes/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var SHA2_32B = class extends HashMD {
  // We cannot use array here since array allows indexing by variable
  // which means optimizer/compiler cannot use registers.
  // Numeric initializers matter: starting the fields as `undefined` changes
  // V8's field representation and makes sha256 3x slower (measured).
  A = 0;
  B = 0;
  C = 0;
  D = 0;
  E = 0;
  F = 0;
  G = 0;
  H = 0;
  constructor(outputLen, IV) {
    super(64, outputLen, 8, false);
    this.A = IV[0] | 0;
    this.B = IV[1] | 0;
    this.C = IV[2] | 0;
    this.D = IV[3] | 0;
    this.E = IV[4] | 0;
    this.F = IV[5] | 0;
    this.G = IV[6] | 0;
    this.H = IV[7] | 0;
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  _cloneInto(to) {
    (to ||= new this.constructor()).set(...this.get());
    return this._cloneIntoMeta(to);
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    this.destroyed = true;
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean(this.buffer);
  }
};
var _SHA256 = class extends SHA2_32B {
  constructor() {
    super(32, SHA256_IV);
  }
};
var sha256 = /* @__PURE__ */ createHasher(
  () => new _SHA256(),
  /* @__PURE__ */ oidNist(1)
);

// node_modules/@noble/curves/utils.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function aarray(item, title, inner = () => {
}) {
  if (!Array.isArray(item))
    throw new TypeError(`"${title}" expected array, got type=${typeof item}`);
  for (let i = 0; i < item.length; i++)
    inner(item[i], `${title}[${i}]`);
  return item;
}
var abytes2 = (value, length, title) => abytes(value, length, title);
var anumber2 = anumber;
function aobject2(value, title = "object") {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(title === "object" ? "expected valid options object" : `"${title}" expected object, got type=${typeof value}`);
  return value;
}
function afunction(value, title) {
  if (typeof value !== "function")
    throw new TypeError(`"${title}" is invalid: expected function, got ${typeof value}`);
  return value;
}
var bytesToHex2 = bytesToHex;
var concatBytes2 = (...arrays) => concatBytes(...arrays);
var hexToBytes2 = (hex2) => hexToBytes(hex2);
var isBytes2 = isBytes;
var randomBytes2 = (bytesLength) => randomBytes(bytesLength);
var _0n = /* @__PURE__ */ BigInt(0);
var _1n = /* @__PURE__ */ BigInt(1);
var atitle2 = (title) => title ? `"${title}" ` : "";
function abool(value, title = "") {
  if (typeof value !== "boolean")
    throw new TypeError(atitle2(title) + "expected boolean, got type=" + typeof value);
  return value;
}
function abignumber(n) {
  if (typeof n === "bigint") {
    if (!isPosBig(n))
      throw new RangeError("positive bigint expected, got " + n);
  } else
    anumber2(n);
  return n;
}
function asafenumber(value, title = "") {
  if (typeof value !== "number") {
    const prefix = title && `"${title}" `;
    throw new TypeError(prefix + "expected number, got type=" + typeof value);
  }
  if (!Number.isSafeInteger(value)) {
    const prefix = title && `"${title}" `;
    throw new RangeError(prefix + "expected safe integer, got " + value);
  }
}
function hexToNumber(hex2) {
  if (typeof hex2 !== "string")
    throw new TypeError("hex string expected, got " + typeof hex2);
  return hex2 === "" ? _0n : BigInt("0x" + hex2);
}
function bytesToNumberBE(bytes) {
  return hexToNumber(bytesToHex(bytes));
}
function bytesToNumberLE(bytes) {
  return hexToNumber(bytesToHex(copyBytes(abytes(bytes)).reverse()));
}
function numberToBytesBE(n, len) {
  anumber(len);
  if (len === 0)
    throw new Error("zero output length is invalid");
  n = abignumber(n);
  const expectedLen = len * 2;
  const hex2 = n.toString(16);
  if (hex2.length > expectedLen)
    throw new RangeError("number is too large");
  return hexToBytes(hex2.padStart(expectedLen, "0"));
}
function numberToBytesLE(n, len) {
  return numberToBytesBE(n, len).reverse();
}
function copyBytes(bytes) {
  return Uint8Array.from(abytes2(bytes));
}
function asciiToBytes(ascii) {
  if (typeof ascii !== "string")
    throw new TypeError("ascii string expected, got " + typeof ascii);
  return Uint8Array.from(ascii, (c, i) => {
    const charCode = c.charCodeAt(0);
    if (c.length !== 1 || charCode > 127) {
      throw new RangeError(`string contains non-ASCII character "${ascii[i]}" with code ${charCode} at position ${i}`);
    }
    return charCode;
  });
}
function isPosBig(n) {
  return typeof n === "bigint" && _0n <= n;
}
function inRange(n, min, max) {
  return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
function aInRange(title, n, min, max) {
  if (!inRange(n, min, max))
    throw new RangeError("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
}
function bitLen(n) {
  if (n < _0n)
    throw new Error("expected non-negative bigint, got " + n);
  return n === _0n ? 0 : n.toString(2).length;
}
var bitMask = (n) => {
  asafenumber(n, "n");
  return (_1n << BigInt(n)) - _1n;
};
function validateObject(object, fields3 = {}, optFields = {}, title = "object") {
  aobject2(object, title);
  aobject2(fields3, "fields");
  aobject2(optFields, "optFields");
  function checkField(fieldName, expectedType, isOpt) {
    const label = title === "object" ? `param "${String(fieldName)}"` : `"${title}.${String(fieldName)}"`;
    const val = object[fieldName];
    if (!Object.hasOwn(object, fieldName) && (isOpt ? val !== void 0 : expectedType !== "function")) {
      throw new TypeError(`${label} is invalid: expected own property`);
    }
    if (isOpt && val === void 0)
      return;
    const current = typeof val;
    if (current !== expectedType || val === null)
      throw new TypeError(`${label} is invalid: expected ${expectedType}, got ${current}`);
  }
  const iter = (f, isOpt) => Object.entries(f).forEach(([k, v]) => checkField(k, v, isOpt));
  iter(fields3, false);
  iter(optFields, true);
}

// node_modules/@noble/curves/abstract/modular.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n2 = /* @__PURE__ */ BigInt(0);
var _1n2 = /* @__PURE__ */ BigInt(1);
var _2n = /* @__PURE__ */ BigInt(2);
var _3n = /* @__PURE__ */ BigInt(3);
var _4n = /* @__PURE__ */ BigInt(4);
var _5n = /* @__PURE__ */ BigInt(5);
var _7n = /* @__PURE__ */ BigInt(7);
var _8n = /* @__PURE__ */ BigInt(8);
var _9n = /* @__PURE__ */ BigInt(9);
var _15n = /* @__PURE__ */ BigInt(15);
var _16n = /* @__PURE__ */ BigInt(16);
var POW_WINDOWED_MIN = /* @__PURE__ */ BigInt("0x10000000000000000");
function mod(a, b) {
  if (b <= _0n2)
    throw new Error("mod: expected positive modulus, got " + b);
  const result = a % b;
  return result >= _0n2 ? result : b + result;
}
function pow(num2, power, modulo) {
  if (modulo <= _1n2)
    throw new Error("pow: expected modulus > 1, got " + modulo);
  if (typeof power !== "bigint")
    throw new TypeError("invalid exponent: expected bigint, got " + typeof power);
  if (power < _0n2)
    throw new Error("invalid exponent, negatives unsupported");
  if (power === _0n2)
    return _1n2;
  if (power === _1n2)
    return num2;
  let d = num2 % modulo;
  if (d < _0n2)
    d += modulo;
  if (power < POW_WINDOWED_MIN) {
    let p2 = _1n2;
    while (power > _0n2) {
      if (power & _1n2)
        p2 = p2 * d % modulo;
      d = d * d % modulo;
      power >>= _1n2;
    }
    return p2;
  }
  const digits = [];
  while (power > _0n2) {
    digits.push(Number(power & _15n));
    power >>= _4n;
  }
  const table = new Array(16);
  table[0] = _1n2;
  table[1] = d;
  for (let i = 2; i < 16; i++)
    table[i] = table[i - 1] * d % modulo;
  let p = table[digits[digits.length - 1]];
  for (let w = digits.length - 2; w >= 0; w--) {
    p = p * p % modulo;
    p = p * p % modulo;
    p = p * p % modulo;
    p = p * p % modulo;
    const digit = digits[w];
    if (digit !== 0)
      p = p * table[digit] % modulo;
  }
  return p;
}
function pow2(x, power, modulo) {
  if (modulo <= _1n2)
    throw new Error("pow2: expected modulus > 1, got " + modulo);
  if (power < _0n2)
    throw new Error("pow2: expected non-negative exponent, got " + power);
  let res = x;
  while (power-- > _0n2) {
    res *= res;
    res %= modulo;
  }
  return res;
}
function invert(number, modulo) {
  if (number === _0n2)
    throw new Error("invert: expected non-zero number");
  if (modulo <= _1n2)
    throw new Error("invert: expected modulus > 1, got " + modulo);
  let a = mod(number, modulo);
  let b = modulo;
  let x = _0n2, u = _1n2;
  while (a !== _0n2) {
    const q = b / a;
    const r = b - a * q;
    const m = x - u * q;
    b = a, a = r, x = u, u = m;
  }
  const gcd = b;
  if (gcd !== _1n2)
    throw new Error("invert: does not exist");
  return mod(x, modulo);
}
function assertIsSquare(Fp, root, n) {
  const F = Fp;
  if (!F.eql(F.sqr(root), n))
    throw new Error("Cannot find square root");
}
function aoddModulus(order, fnName) {
  if ((order & _1n2) === _0n2)
    throw new Error(fnName + ": expected odd modulus, got " + order);
}
function sqrt3mod4(Fp, n) {
  const F = Fp;
  const p1div4 = (F.ORDER + _1n2) / _4n;
  const root = F.pow(n, p1div4);
  assertIsSquare(F, root, n);
  return root;
}
function sqrt5mod8(Fp, n) {
  const F = Fp;
  const p5div8 = (F.ORDER - _5n) / _8n;
  const n2 = F.mul(n, _2n);
  const v = F.pow(n2, p5div8);
  const nv = F.mul(n, v);
  const i = F.mul(F.mul(nv, _2n), v);
  const root = F.mul(nv, F.sub(i, F.ONE));
  assertIsSquare(F, root, n);
  return root;
}
function sqrt9mod16(P) {
  const Fp_ = Field(P);
  const tn = tonelliShanks(P);
  const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
  const c2 = tn(Fp_, c1);
  const c3 = tn(Fp_, Fp_.neg(c1));
  const c4 = (P + _7n) / _16n;
  return ((Fp, n) => {
    const F = Fp;
    let tv1 = F.pow(n, c4);
    let tv2 = F.mul(tv1, c1);
    const tv3 = F.mul(tv1, c2);
    const tv4 = F.mul(tv1, c3);
    const e1 = F.eql(F.sqr(tv2), n);
    const e2 = F.eql(F.sqr(tv3), n);
    tv1 = F.cmov(tv1, tv2, e1);
    tv2 = F.cmov(tv4, tv3, e2);
    const e3 = F.eql(F.sqr(tv2), n);
    const root = F.cmov(tv1, tv2, e3);
    assertIsSquare(F, root, n);
    return root;
  });
}
function tonelliShanks(P) {
  if (P < _3n)
    throw new Error("sqrt is not defined for small field");
  aoddModulus(P, "tonelliShanks");
  let Q = P - _1n2;
  let S = 0;
  while (Q % _2n === _0n2) {
    Q /= _2n;
    S++;
  }
  let Z = _2n;
  const _Fp = Field(P);
  while (FpLegendre(_Fp, Z) === 1) {
    if (Z++ > 1e3)
      throw new Error("Cannot find square root: probably non-prime P");
  }
  if (S === 1)
    return sqrt3mod4;
  let cc = _Fp.pow(Z, Q);
  const Q1div2 = (Q + _1n2) / _2n;
  return function tonelliSlow(Fp, n) {
    const F = Fp;
    if (F.is0(n))
      return n;
    if (FpLegendre(F, n) !== 1)
      throw new Error("Cannot find square root");
    let M = S;
    let c = F.mul(F.ONE, cc);
    let t = F.pow(n, Q);
    let R = F.pow(n, Q1div2);
    while (!F.eql(t, F.ONE)) {
      if (F.is0(t))
        throw new Error("Cannot find square root: probably non-prime P");
      let i = 1;
      let t_tmp = F.sqr(t);
      while (!F.eql(t_tmp, F.ONE)) {
        i++;
        t_tmp = F.sqr(t_tmp);
        if (i === M)
          throw new Error("Cannot find square root");
      }
      const exponent = _1n2 << BigInt(M - i - 1);
      const b = F.pow(c, exponent);
      M = i;
      c = F.sqr(b);
      t = F.mul(t, c);
      R = F.mul(R, b);
    }
    return R;
  };
}
function FpSqrt(P) {
  aoddModulus(P, "Fp.sqrt");
  if (P % _4n === _3n)
    return sqrt3mod4;
  if (P % _8n === _5n)
    return sqrt5mod8;
  if (P % _16n === _9n)
    return sqrt9mod16(P);
  return tonelliShanks(P);
}
var FIELD_FIELDS = [
  "create",
  "isValid",
  "is0",
  "neg",
  "inv",
  "sqrt",
  "sqr",
  "eql",
  "add",
  "sub",
  "mul",
  "pow",
  "div",
  "addN",
  "subN",
  "mulN",
  "sqrN"
];
function validateField(field) {
  aobject2(field, "field");
  if (typeof field.ORDER !== "bigint")
    throw new TypeError('param "ORDER" is invalid: expected bigint, got ' + typeof field.ORDER);
  asafenumber(field.BYTES, "BYTES");
  asafenumber(field.BITS, "BITS");
  for (const name of FIELD_FIELDS)
    afunction(field[name], "field." + name);
  if (field.BYTES < 1 || field.BITS < 1)
    throw new Error("invalid field: expected BYTES/BITS > 0");
  if (field.ORDER <= _1n2)
    throw new Error("invalid field: expected ORDER > 1, got " + field.ORDER);
  return field;
}
function FpInvertBatch(Fp, nums, passZero = false) {
  validateField(Fp);
  aarray(nums, "nums");
  abool(passZero, "passZero");
  const F = Fp;
  const inverted = new Array(nums.length).fill(passZero ? F.ZERO : void 0);
  const multipliedAcc = nums.reduce((acc, num2, i) => {
    if (F.is0(num2))
      return acc;
    inverted[i] = acc;
    return F.mul(acc, num2);
  }, F.ONE);
  const invertedAcc = F.inv(multipliedAcc);
  nums.reduceRight((acc, num2, i) => {
    if (F.is0(num2))
      return acc;
    inverted[i] = F.mul(acc, inverted[i]);
    return F.mul(acc, num2);
  }, invertedAcc);
  return inverted;
}
function FpLegendre(Fp, n) {
  validateField(Fp);
  const F = Fp;
  aoddModulus(F.ORDER, "FpLegendre");
  const p1mod2 = (F.ORDER - _1n2) / _2n;
  const powered = F.pow(n, p1mod2);
  const yes = F.eql(powered, F.ONE);
  const zero = F.eql(powered, F.ZERO);
  const no = F.eql(powered, F.neg(F.ONE));
  if (!yes && !zero && !no)
    throw new Error("invalid Legendre symbol result");
  return yes ? 1 : zero ? 0 : -1;
}
function nLength(n, nBitLength) {
  if (nBitLength !== void 0)
    anumber2(nBitLength);
  if (n <= _0n2)
    throw new Error("invalid n length: expected positive n, got " + n);
  if (nBitLength !== void 0 && nBitLength < 1)
    throw new Error("invalid n length: expected positive bit length, got " + nBitLength);
  const bits = bitLen(n);
  if (nBitLength !== void 0 && nBitLength < bits)
    throw new Error(`invalid n length: expected nBitLength (${nBitLength}) >= bitLen(n) (${bits})`);
  const _nBitLength = nBitLength !== void 0 ? nBitLength : bits;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
var FIELD_SQRT = /* @__PURE__ */ new WeakMap();
var _Field = class {
  ORDER;
  BITS;
  BYTES;
  isLE;
  ZERO = _0n2;
  ONE = _1n2;
  _lengths;
  _mod;
  constructor(ORDER, opts = {}) {
    if (ORDER <= _1n2)
      throw new Error("invalid field: expected ORDER > 1, got " + ORDER);
    let _nbitLength = void 0;
    this.isLE = false;
    if (opts != null && typeof opts === "object") {
      if (typeof opts.BITS === "number")
        _nbitLength = opts.BITS;
      if (typeof opts.sqrt === "function")
        Object.defineProperty(this, "sqrt", { value: opts.sqrt, enumerable: true });
      if (typeof opts.isLE === "boolean")
        this.isLE = opts.isLE;
      if (opts.allowedLengths)
        this._lengths = Object.freeze(opts.allowedLengths.slice());
      if (typeof opts.modFromBytes === "boolean")
        this._mod = opts.modFromBytes;
    }
    const { nBitLength, nByteLength } = nLength(ORDER, _nbitLength);
    if (nByteLength > 2048)
      throw new Error("invalid field: expected ORDER of <= 2048 bytes");
    this.ORDER = ORDER;
    this.BITS = nBitLength;
    this.BYTES = nByteLength;
    Object.freeze(this);
  }
  create(num2) {
    return mod(num2, this.ORDER);
  }
  isValid(num2) {
    if (typeof num2 !== "bigint")
      throw new TypeError("invalid field element: expected bigint, got " + typeof num2);
    return _0n2 <= num2 && num2 < this.ORDER;
  }
  is0(num2) {
    return num2 === _0n2;
  }
  // is valid and invertible
  isValidNot0(num2) {
    return !this.is0(num2) && this.isValid(num2);
  }
  isOdd(num2) {
    return (num2 & _1n2) === _1n2;
  }
  neg(num2) {
    return mod(-num2, this.ORDER);
  }
  eql(lhs, rhs) {
    return lhs === rhs;
  }
  sqr(num2) {
    return mod(num2 * num2, this.ORDER);
  }
  add(lhs, rhs) {
    return mod(lhs + rhs, this.ORDER);
  }
  sub(lhs, rhs) {
    return mod(lhs - rhs, this.ORDER);
  }
  mul(lhs, rhs) {
    return mod(lhs * rhs, this.ORDER);
  }
  pow(num2, power) {
    return pow(num2, power, this.ORDER);
  }
  div(lhs, rhs) {
    return mod(lhs * invert(rhs, this.ORDER), this.ORDER);
  }
  // Same as above, but doesn't normalize
  sqrN(num2) {
    return num2 * num2;
  }
  addN(lhs, rhs) {
    return lhs + rhs;
  }
  subN(lhs, rhs) {
    return lhs - rhs;
  }
  mulN(lhs, rhs) {
    return lhs * rhs;
  }
  inv(num2) {
    return invert(num2, this.ORDER);
  }
  sqrt(num2) {
    let sqrt = FIELD_SQRT.get(this);
    if (!sqrt)
      FIELD_SQRT.set(this, sqrt = FpSqrt(this.ORDER));
    return sqrt(this, num2);
  }
  toBytes(num2) {
    return this.isLE ? numberToBytesLE(num2, this.BYTES) : numberToBytesBE(num2, this.BYTES);
  }
  fromBytes(bytes, skipValidation = false) {
    abytes2(bytes);
    const { _lengths: allowedLengths, BYTES, isLE, ORDER, _mod: modFromBytes } = this;
    if (allowedLengths) {
      if (bytes.length < 1 || !allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
        throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
      }
      const padded = new Uint8Array(BYTES);
      padded.set(bytes, isLE ? 0 : padded.length - bytes.length);
      bytes = padded;
    }
    if (bytes.length !== BYTES)
      throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
    let scalar = isLE ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
    if (modFromBytes)
      scalar = mod(scalar, ORDER);
    if (!skipValidation) {
      if (!this.isValid(scalar))
        throw new Error("invalid field element: outside of range 0..ORDER");
    }
    return scalar;
  }
  // TODO: we don't need it here, move out to separate fn
  invertBatch(lst) {
    return FpInvertBatch(this, lst, true);
  }
  // We can't move this out because Fp6, Fp12 implement it
  // and it's unclear what to return in there.
  cmov(a, b, condition) {
    abool(condition, "condition");
    return condition ? b : a;
  }
};
function Field(ORDER, opts = {}) {
  Object.freeze(_Field.prototype);
  return new _Field(ORDER, opts);
}
function getFieldBytesLength(fieldOrder) {
  if (typeof fieldOrder !== "bigint")
    throw new Error("field order must be bigint");
  if (fieldOrder <= _1n2)
    throw new Error("field order must be greater than 1");
  const bitLength = bitLen(fieldOrder - _1n2);
  return Math.ceil(bitLength / 8);
}
function getMinHashLength(fieldOrder) {
  const length = getFieldBytesLength(fieldOrder);
  return length + Math.ceil(length / 2);
}
function mapHashToField(key, fieldOrder, isLE = false) {
  abytes2(key);
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = Math.max(getMinHashLength(fieldOrder), 16);
  if (len < minLen || len > 1024)
    throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
  const num2 = isLE ? bytesToNumberLE(key) : bytesToNumberBE(key);
  const reduced = mod(num2, fieldOrder - _1n2) + _1n2;
  return isLE ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}

// node_modules/@noble/curves/abstract/curve.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n3 = /* @__PURE__ */ BigInt(0);
var _1n3 = /* @__PURE__ */ BigInt(1);
var _4n2 = /* @__PURE__ */ BigInt(4);
var BLIND_BYTES = 16;
var BLIND_BITS = 128;
var FW_WINDOW = 5;
var TABLE_BYTES_MAX = /* @__PURE__ */ (() => 2 ** 31)();
function validatePointCons(Point) {
  const pc = Point;
  if (typeof pc !== "function")
    throw new TypeError('"Point" expected constructor, got type=' + typeof Point);
  afunction(pc.fromAffine, "Point.fromAffine");
  afunction(pc.fromBytes, "Point.fromBytes");
  afunction(pc.fromHex, "Point.fromHex");
  aobject2(pc.BASE, "Point.BASE");
  aobject2(pc.ZERO, "Point.ZERO");
  validateField(pc.Fp);
  validateField(pc.Fn);
}
function normalizeZ(c, points) {
  validatePointCons(c);
  validateMSMPoints(points, c);
  const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
  return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
}
function validateW(W, bits, min = 1) {
  if (!Number.isSafeInteger(W) || W < min || W > bits)
    throw new Error("invalid window size, expected [" + min + ".." + bits + "], got W=" + W);
}
function validateTableBytes(numPoints, fpBytes) {
  const bytes = numPoints * (4 * fpBytes + 128);
  if (bytes > TABLE_BYTES_MAX)
    throw new Error("invalid window size: table would need ~" + Math.ceil(bytes / 2 ** 20) + " MiB, max " + TABLE_BYTES_MAX / 2 ** 20 + " MiB");
}
function probeRandomBytes(randomBytes3, length) {
  if (randomBytes3 === void 0)
    return void 0;
  afunction(randomBytes3, "randomBytes");
  try {
    const probe = randomBytes3(length);
    if (!isBytes2(probe) || probe.length !== length)
      return void 0;
  } catch {
    return void 0;
  }
  return randomBytes3;
}
function validateMSMPoints(points, c) {
  aarray(points, "points");
  points.forEach((p, i) => {
    if (!(p instanceof c))
      throw new Error("invalid point at index " + i);
  });
}
function validateMSMScalars(scalars, field, maxScalar) {
  if (!Array.isArray(scalars))
    throw new Error("array of scalars expected");
  scalars.forEach((s, i) => {
    const ok = maxScalar === void 0 ? field.isValid(s) : isPosBig(s) && s < maxScalar;
    if (!ok)
      throw new Error("invalid scalar at index " + i);
  });
}
var pointWindowSizes = /* @__PURE__ */ new WeakMap();
function getWindowSize(P) {
  return pointWindowSizes.get(P) || 1;
}
function oddMultiples(p, size) {
  const dbl = p.double();
  const t = [p];
  for (let j = 1; j < size; j++)
    t.push(t[j - 1].add(dbl));
  return t;
}
function wnafDigits(n, W) {
  const size = 2 ** W;
  const half = size / 2;
  const mask = BigInt(size - 1);
  const d = [];
  while (n > _0n3) {
    let w = 0;
    if (n & _1n3) {
      w = Number(n & mask);
      if (w >= half)
        w -= size;
      n -= BigInt(w);
    }
    d.push(w);
    n >>= _1n3;
  }
  return d;
}
function signedWindowDigits(n, W, windows) {
  const size = 2 ** W;
  const half = size / 2;
  const mask = BigInt(size - 1);
  const shiftBy = BigInt(W);
  const d = [];
  for (let w = 0; w < windows; w++) {
    let v = Number(n & mask);
    n >>= shiftBy;
    if (v > half) {
      v -= size;
      n += _1n3;
    }
    d.push(v);
  }
  if (n !== _0n3)
    throw new Error("invalid wnaf");
  return d;
}
function wnafWalk(zero, tables, digits) {
  let max = 0;
  for (const d of digits)
    max = Math.max(max, d.length);
  let acc = zero;
  for (let bit = max - 1; bit >= 0; bit--) {
    if (bit !== max - 1)
      acc = acc.double();
    for (let i = 0; i < digits.length; i++) {
      const w = digits[i][bit];
      if (w) {
        const item = tables[i][Math.abs(w) - 1 >> 1];
        acc = acc.add(w < 0 ? item.negate() : item);
      }
    }
  }
  return acc;
}
var ScalarMultiplier = class {
  Point;
  BASE;
  ZERO;
  randomBytes;
  wnafPrecomputes = /* @__PURE__ */ new WeakMap();
  baseCanBeBlinded;
  bits;
  // Parametrized with a given Point class (not individual point)
  constructor(Point, randomBytes3) {
    validatePointCons(Point);
    this.randomBytes = probeRandomBytes(randomBytes3, BLIND_BYTES);
    this.Point = Point;
    this.BASE = Point.BASE;
    this.ZERO = Point.ZERO;
    this.bits = Point.Fn.BITS;
  }
  /**
   * Creates a signed fixed-window wNAF precomputation table: for every window w, the
   * multiples `[1..2^(W−1)]⋅2^(w⋅W)⋅P`, flattened. All doublings are baked into the table,
   * so cached multiplication is additions-only. `windows = ceil(bits/W) + 1`: the extra
   * window absorbs the final carry of signed-digit recoding.
   * For a 256-bit curve and W=6, the table is 44⋅32 = 1408 points.
   * @param point - Point instance
   * @param W - window size
   * @param bits - scalar bitlength the table must cover
   */
  buildWnafTable(point, W, bits) {
    const windows = Math.ceil(bits / W) + 1;
    const half = 2 ** (W - 1);
    const comp = [];
    let base = point;
    for (let w = 0; w < windows; w++) {
      let acc = base;
      for (let i = 0; i < half; i++) {
        comp.push(acc);
        acc = acc.add(base);
      }
      base = comp[comp.length - 1].double();
    }
    return { W, bits, windows, comp };
  }
  /**
   * Implements ec multiplication using precomputed signed fixed-window wNAF tables.
   * Constant-time: fixed window count with one table addition per window — zero digits feed
   * the fake accumulator — and no doublings; the lookup scans the whole window slice.
   * Scalar bounds are validated by the public entry points ({@link ScalarMultiplier.mulCT},
   * {@link ScalarMultiplier.mulCTBlinded}, {@link ScalarMultiplier.mulUnsafe});
   * signedWindowDigits throws if `n` exceeds the table.
   * @returns real and fake (for const-time) points
   */
  wnafCachedCT(precomputes, n) {
    const { W, windows, comp } = precomputes;
    const half = 2 ** (W - 1);
    const digits = signedWindowDigits(n, W, windows);
    let p = this.ZERO;
    let f = this.BASE;
    for (let w = 0; w < windows; w++) {
      const digit = digits[w];
      const start = w * half;
      const idx = Math.abs(digit) - 1;
      let sel = comp[start];
      for (let i = 1; i < half; i++)
        sel = i === idx ? comp[start + i] : sel;
      const neg = sel.negate();
      if (digit === 0)
        f = f.add(comp[start]);
      else
        p = p.add(digit < 0 ? neg : sel);
    }
    return { p, f };
  }
  // Cache key is point identity plus (W, bits); at most two entries exist per point (public-width
  // `Fn.BITS` and blinded `Fn.BITS + BLIND_BITS`). Callers must not reuse the same point with
  // incompatible `transform(...)` layouts and expect a separate cache entry.
  getWnafPrecomputes(W, point, bits, transform) {
    let entries = this.wnafPrecomputes.get(point);
    let comp = entries?.find((entry) => entry.W === W && entry.bits === bits);
    if (!comp) {
      comp = this.buildWnafTable(point, W, bits);
      if (typeof transform === "function")
        comp = { ...comp, comp: transform(comp.comp) };
      if (!entries) {
        entries = [];
        this.wnafPrecomputes.set(point, entries);
      }
      entries.push(comp);
    }
    return comp;
  }
  assertPoint(point) {
    if (!(point instanceof this.Point))
      throw new TypeError('"point" expected Point instance, got type=' + typeof point);
  }
  // Shared prologue of the constant-time entry points. Rejects scalar 0: in key/signature-style
  // callers a zero scalar means broken upstream plumbing, and concrete Points already reject it.
  // Uses inRange instead of Fn.isValidNot0: validateField() only certifies the arithmetic subset.
  validateMulInput(point, scalar) {
    this.assertPoint(point);
    if (!inRange(scalar, _1n3, this.Point.Fn.ORDER))
      throw new Error("invalid scalar");
  }
  // Constant-time dispatch shared by mulCT / mulCTBlinded. Un-precomputed points (W===1, e.g.
  // ECDH peer keys) skip building a throwaway cached table in favor of a small fixed-window
  // multiply. `n` must be < 2^bits.
  runCT(point, n, bits, transform) {
    const W = getWindowSize(point);
    if (W === 1)
      return this.fixedWindowCT(point, n, bits);
    return this.wnafCachedCT(this.getWnafPrecomputes(W, point, bits, transform), n);
  }
  mulCT(point, scalar, transform) {
    this.validateMulInput(point, scalar);
    return this.runCT(point, scalar, this.bits, transform);
  }
  mulCTBlinded(point, scalar, transform) {
    this.validateMulInput(point, scalar);
    if (this.randomBytes === void 0)
      throw new Error("randomBytes is required for scalar blinding");
    const bits = this.Point.Fn.BITS + BLIND_BITS;
    const blind = this.randomBytes(BLIND_BYTES);
    if (!isBytes2(blind) || blind.length !== BLIND_BYTES)
      throw new Error("randomBytes returned invalid byte array");
    blind[0] = blind[0] & 63 | 128;
    const n = scalar + bytesToNumberBE(blind) * this.Point.Fn.ORDER;
    return this.runCT(point, n, bits, transform);
  }
  /**
   * Constant-time multiplication `n*point` for an un-precomputed point, via a small fixed window.
   * A cached wNAF table only pays off when reused; a flat 2^FW_WINDOW table (`size-1` adds) is
   * far cheaper to build for a single use. The point-operation sequence is independent of `n`:
   * build the table, then per window exactly FW_WINDOW doublings, a data-oblivious scan over
   * every table entry, and one addition (adds the identity when the window digit is 0 — never
   * skipped).
   *
   * `n` must be `< 2^bits`. Assumes complete addition (adding the identity costs the same as any
   * add), which holds for the Weierstrass/Edwards point types used here. The table is left in
   * projective form (no normalizeZ): normalizing this small a table costs more than the
   * mixed-add savings it would buy for a single multiply.
   * @returns real point `p`; `f` duplicates it only to match {@link wnafCachedCT}'s return shape
   * (this path needs no fake accumulator — its op-count is already scalar-independent).
   */
  fixedWindowCT(point, n, bits) {
    const W = FW_WINDOW;
    const size = 1 << W;
    const mask = bitMask(W);
    const table = new Array(size);
    table[0] = this.ZERO;
    for (let i = 1; i < size; i++)
      table[i] = table[i - 1].add(point);
    const windows = Math.ceil(bits / W);
    let acc = this.ZERO;
    for (let window = windows - 1; window >= 0; window--) {
      if (window !== windows - 1)
        for (let d = 0; d < W; d++)
          acc = acc.double();
      const digit = Number(n >> BigInt(window * W) & mask);
      let sel = table[0];
      for (let i = 1; i < size; i++)
        sel = i === digit ? table[i] : sel;
      acc = acc.add(sel);
    }
    return { p: acc, f: acc };
  }
  shouldBlind(point, cofactor) {
    if (this.randomBytes === void 0)
      return false;
    if (cofactor === _1n3)
      return true;
    if (point !== this.BASE)
      return false;
    if (this.baseCanBeBlinded === void 0)
      this.baseCanBeBlinded = this.mulUnsafe(this.BASE, this.Point.Fn.ORDER).is0();
    return this.baseCanBeBlinded;
  }
  mulSecret(point, scalar, cofactor, transform) {
    return this.shouldBlind(point, cofactor) ? this.mulCTBlinded(point, scalar, transform) : this.mulCT(point, scalar, transform);
  }
  mulUnsafe(point, scalar, transform) {
    this.assertPoint(point);
    if (!isPosBig(scalar))
      throw new Error("invalid scalar");
    const W = getWindowSize(point);
    if (W === 1 || scalar >= this.Point.Fn.ORDER)
      return mulAddUnsafe(this.Point, [point], [scalar], true);
    const precomputes = this.getWnafPrecomputes(W, point, this.bits, transform);
    return this.wnafCachedCT(precomputes, scalar).p;
  }
  // Remembers the window size used for precomputed wNAF multiplication of the given point
  // and drops any previously built tables. Usually only the base point is precomputed.
  // W=1 resets the point to the un-precomputed (table-less) paths.
  // W is additionally capped so tables stay under ~2 GiB ({@link TABLE_BYTES_MAX}).
  setWindowSize(point, W) {
    this.assertPoint(point);
    validateW(W, this.bits);
    const windows = Math.ceil((this.bits + BLIND_BITS) / W) + 1;
    validateTableBytes(windows * 2 ** (W - 1), this.Point.Fp.BYTES);
    pointWindowSizes.set(point, W);
    this.wnafPrecomputes.delete(point);
  }
  // True when a window size is set: tables themselves are built lazily on first multiply.
  hasWindowSize(point) {
    return getWindowSize(point) !== 1;
  }
};
function mulAddUnsafe(c, points, scalars, allowOversized = false) {
  validatePointCons(c);
  validateMSMPoints(points, c);
  abool(allowOversized, "allowOversized");
  validateMSMScalars(scalars, c.Fn, allowOversized ? c.Fn.ORDER ** _4n2 : void 0);
  if (points.length !== scalars.length)
    throw new Error("arrays of points and scalars must have equal length");
  const tables = points.map((p) => oddMultiples(p, 4));
  const digits = scalars.map((n) => wnafDigits(n, 4));
  return wnafWalk(c.ZERO, tables, digits);
}
function createField(order, field, isLE) {
  if (field) {
    if (field.ORDER !== order)
      throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
    validateField(field);
    return field;
  } else {
    return Field(order, { isLE });
  }
}
function createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
  if (type !== "weierstrass" && type !== "edwards")
    throw new Error('expected curve type "weierstrass" or "edwards"');
  if (FpFnLE === void 0)
    FpFnLE = type === "edwards";
  if (!CURVE || typeof CURVE !== "object")
    throw new Error(`expected valid ${type} CURVE object`);
  validateObject(curveOpts);
  for (const p of ["p", "n", "h"]) {
    const val = CURVE[p];
    if (!(isPosBig(val) && val !== _0n3))
      throw new Error(`CURVE.${p} must be positive bigint`);
  }
  const Fp = createField(CURVE.p, curveOpts.Fp, FpFnLE);
  const Fn = createField(CURVE.n, curveOpts.Fn, FpFnLE);
  const _b = type === "weierstrass" ? "b" : "d";
  const params = ["Gx", "Gy", "a", _b];
  for (const p of params) {
    if (!Fp.isValid(CURVE[p]))
      throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
  }
  CURVE = Object.freeze(Object.assign({}, CURVE));
  return { CURVE, Fp, Fn };
}
function createKeygen(randomSecretKey, getPublicKey) {
  return function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: getPublicKey(secretKey) };
  };
}

// node_modules/@noble/curves/abstract/weierstrass.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var divNearest = (num2, den) => (num2 + (num2 >= 0 ? den : -den) / _2n2) / den;
function _splitEndoScalar(k, basis, n) {
  aInRange("scalar", k, _0n4, n);
  const [[a1, b1], [a2, b2]] = basis;
  const c1 = divNearest(b2 * k, n);
  const c2 = divNearest(-b1 * k, n);
  let k1 = k - c1 * a1 - c2 * a2;
  let k2 = -c1 * b1 - c2 * b2;
  const k1neg = k1 < _0n4;
  const k2neg = k2 < _0n4;
  if (k1neg)
    k1 = -k1;
  if (k2neg)
    k2 = -k2;
  const MAX_NUM = bitMask(Math.ceil(bitLen(n) / 2)) + _1n4;
  if (k1 < _0n4 || k1 >= MAX_NUM || k2 < _0n4 || k2 >= MAX_NUM) {
    throw new Error("splitScalar (endomorphism): failed for k");
  }
  return { k1neg, k1, k2neg, k2 };
}
var _0n4 = /* @__PURE__ */ BigInt(0);
var _1n4 = /* @__PURE__ */ BigInt(1);
var _2n2 = /* @__PURE__ */ BigInt(2);
var _3n2 = /* @__PURE__ */ BigInt(3);
var _4n3 = /* @__PURE__ */ BigInt(4);
function weierstrass(params, extraOpts = {}) {
  const validated = createCurveFields("weierstrass", params, extraOpts);
  const Fp = validated.Fp;
  const Fn = validated.Fn;
  let CURVE = validated.CURVE;
  const { h: cofactor, n: CURVE_ORDER } = CURVE;
  validateObject(extraOpts, {}, {
    allowInfinityPoint: "boolean",
    clearCofactor: "function",
    isTorsionFree: "function",
    fromBytes: "function",
    toBytes: "function",
    endo: "object",
    randomBytes: "function"
  });
  const { endo: endoOpts, allowInfinityPoint, clearCofactor, isTorsionFree, fromBytes, toBytes } = extraOpts;
  const randomBytes3 = extraOpts.randomBytes === void 0 ? randomBytes2 : extraOpts.randomBytes;
  if (endoOpts) {
    if (!Fp.is0(CURVE.a) || typeof endoOpts.beta !== "bigint" || !Array.isArray(endoOpts.basises)) {
      throw new Error('invalid endo: expected "beta": bigint and "basises": array');
    }
  }
  const endo = endoOpts ? {
    beta: endoOpts.beta,
    basises: endoOpts.basises.map((basis) => [...basis])
  } : void 0;
  const lengths = getWLengths(Fp, Fn);
  function assertCompressionIsSupported() {
    if (!Fp.isOdd)
      throw new Error("compression is not supported: Field does not have .isOdd()");
  }
  function pointToBytes2(_c, point, isCompressed) {
    if (point.is0()) {
      if (!allowInfinityPoint)
        throw new Error("bad point: ZERO");
      return Uint8Array.of(0);
    }
    const { x, y } = point.toAffine();
    const bx = Fp.toBytes(x);
    abool(isCompressed, "isCompressed");
    if (isCompressed) {
      assertCompressionIsSupported();
      const hasEvenY = !Fp.isOdd(y);
      return concatBytes2(pprefix(hasEvenY), bx);
    } else {
      return concatBytes2(Uint8Array.of(4), bx, Fp.toBytes(y));
    }
  }
  function pointFromBytes(bytes) {
    abytes2(bytes, void 0, "Point");
    const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths;
    const length = bytes.length;
    const head = bytes[0];
    const tail = bytes.subarray(1);
    if (allowInfinityPoint && length === 1 && head === 0)
      return { x: Fp.ZERO, y: Fp.ZERO };
    if (length === comp && (head === 2 || head === 3)) {
      const x = Fp.fromBytes(tail);
      if (!Fp.isValid(x))
        throw new Error("bad point: is not on curve, wrong x");
      const y2 = weierstrassEquation(x);
      let y;
      try {
        y = Fp.sqrt(y2);
      } catch (sqrtError) {
        const err = sqrtError instanceof Error ? ": " + sqrtError.message : "";
        throw new Error("bad point: is not on curve, sqrt error" + err);
      }
      assertCompressionIsSupported();
      const evenY = Fp.isOdd(y);
      const evenH = (head & 1) === 1;
      if (evenH !== evenY)
        y = Fp.neg(y);
      return { x, y };
    } else if (length === uncomp && head === 4) {
      const L = Fp.BYTES;
      const x = Fp.fromBytes(tail.subarray(0, L));
      const y = Fp.fromBytes(tail.subarray(L, L * 2));
      if (!isValidXY(x, y))
        throw new Error("bad point: is not on curve");
      return { x, y };
    } else {
      throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
    }
  }
  const encodePoint = toBytes === void 0 ? pointToBytes2 : toBytes;
  const decodePoint = fromBytes === void 0 ? pointFromBytes : fromBytes;
  const b3 = Fp.mul(CURVE.b, _3n2);
  const mulA = Fp.is0(CURVE.a) ? (_) => Fp.ZERO : (x) => Fp.mul(CURVE.a, x);
  function weierstrassEquation(x) {
    const x2 = Fp.sqr(x);
    const x3 = Fp.mul(x2, x);
    return Fp.add(Fp.add(x3, Fp.mul(x, CURVE.a)), CURVE.b);
  }
  function isValidXY(x, y) {
    const left = Fp.sqr(y);
    const right = weierstrassEquation(x);
    return Fp.eql(left, right);
  }
  if (!isValidXY(CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const _4a3 = Fp.mul(Fp.pow(CURVE.a, _3n2), _4n3);
  const _27b2 = Fp.mul(Fp.sqr(CURVE.b), BigInt(27));
  if (Fp.is0(Fp.add(_4a3, _27b2)))
    throw new Error("bad curve params: a or b");
  function acoord(title, n, banZero = false) {
    if (!Fp.isValid(n) || banZero && Fp.is0(n))
      throw new Error(`bad point coordinate ${title}`);
    return typeof n === "object" && n !== null ? Fp.create(n) : n;
  }
  function aprjpoint(other) {
    if (!(other instanceof Point))
      throw new Error("Weierstrass Point expected");
  }
  function splitEndoScalarN(k) {
    if (!endo || !endo.basises)
      throw new Error("no endo");
    return _splitEndoScalar(k, endo.basises, Fn.ORDER);
  }
  function pushWnafPair(points, scalars, p, k) {
    if (!Fn.isValid(k))
      throw new RangeError("invalid scalar: out of range");
    if (endo) {
      const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(k);
      const psi = new Point(Fp.mul(p.X, endo.beta), p.Y, p.Z);
      points.push(k1neg ? p.negate() : p, k2neg ? psi.negate() : psi);
      scalars.push(k1, k2);
    } else {
      points.push(p);
      scalars.push(k);
    }
  }
  const validityCache = /* @__PURE__ */ new WeakSet();
  class Point {
    static BASE = new Point(CURVE.Gx, CURVE.Gy, Fp.ONE);
    static ZERO = new Point(Fp.ZERO, Fp.ONE, Fp.ZERO);
    static Fp = Fp;
    static Fn = Fn;
    X;
    Y;
    Z;
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    constructor(X, Y, Z) {
      this.X = acoord("x", X);
      this.Y = acoord("y", Y, true);
      this.Z = acoord("z", Z);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    static fromAffine(p) {
      const { x, y } = p || {};
      if (!p || !Fp.isValid(x) || !Fp.isValid(y))
        throw new Error("invalid affine point");
      if (p instanceof Point)
        throw new Error("projective point not allowed");
      if (Fp.is0(x) && Fp.is0(y))
        return Point.ZERO;
      return new Point(x, y, Fp.ONE);
    }
    static fromBytes(bytes) {
      const P = Point.fromAffine(decodePoint(abytes2(bytes, void 0, "point")));
      P.assertValidity();
      return P;
    }
    static fromHex(hex2) {
      return Point.fromBytes(hexToBytes2(hex2));
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    /**
     * @param isLazy - true will defer table computation until the first multiplication
     */
    precompute(windowSize = 6, isLazy = true) {
      wnaf.setWindowSize(this, windowSize);
      if (!isLazy)
        this.multiply(_3n2);
      return this;
    }
    // TODO: return `this`
    /** A point on curve is valid if it conforms to equation. */
    assertValidity() {
      const p = this;
      if (p.is0()) {
        if (allowInfinityPoint && Fp.is0(p.X) && Fp.eql(p.Y, Fp.ONE) && Fp.is0(p.Z))
          return;
        throw new Error("bad point: ZERO");
      }
      if (validityCache.has(p))
        return;
      const { x, y } = p.toAffine();
      if (!Fp.isValid(x) || !Fp.isValid(y))
        throw new Error("bad point: x or y not field elements");
      if (!isValidXY(x, y))
        throw new Error("bad point: equation left != right");
      if (!p.isTorsionFree())
        throw new Error("bad point: not in prime-order subgroup");
      validityCache.add(p);
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (!Fp.isOdd)
        throw new Error("Field doesn't support isOdd");
      return !Fp.isOdd(y);
    }
    /** Compare one point to another. */
    equals(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
      const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
      return U1 && U2;
    }
    /** Flips point to one corresponding to (x, -y) in Affine coordinates. */
    negate() {
      return new Point(this.X, Fp.neg(this.Y), this.Z);
    }
    // Renes-Costello-Batina exception-free doubling formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 3
    // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
    double() {
      const { X: X1, Y: Y1, Z: Z1 } = this;
      let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
      let t0 = Fp.mul(X1, X1);
      let t1 = Fp.mul(Y1, Y1);
      let t2 = Fp.mul(Z1, Z1);
      let t3 = Fp.mul(X1, Y1);
      t3 = Fp.add(t3, t3);
      Z3 = Fp.mul(X1, Z1);
      Z3 = Fp.add(Z3, Z3);
      X3 = mulA(Z3);
      Y3 = Fp.mul(b3, t2);
      Y3 = Fp.add(X3, Y3);
      X3 = Fp.sub(t1, Y3);
      Y3 = Fp.add(t1, Y3);
      Y3 = Fp.mul(X3, Y3);
      X3 = Fp.mul(t3, X3);
      Z3 = Fp.mul(b3, Z3);
      t2 = mulA(t2);
      t3 = Fp.sub(t0, t2);
      t3 = mulA(t3);
      t3 = Fp.add(t3, Z3);
      Z3 = Fp.add(t0, t0);
      t0 = Fp.add(Z3, t0);
      t0 = Fp.add(t0, t2);
      t0 = Fp.mul(t0, t3);
      Y3 = Fp.add(Y3, t0);
      t2 = Fp.mul(Y1, Z1);
      t2 = Fp.add(t2, t2);
      t0 = Fp.mul(t2, t3);
      X3 = Fp.sub(X3, t0);
      Z3 = Fp.mul(t2, t1);
      Z3 = Fp.add(Z3, Z3);
      Z3 = Fp.add(Z3, Z3);
      return new Point(X3, Y3, Z3);
    }
    // Renes-Costello-Batina exception-free addition formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 1
    // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
    add(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
      let t0 = Fp.mul(X1, X2);
      let t1 = Fp.mul(Y1, Y2);
      let t2 = Fp.mul(Z1, Z2);
      let t3 = Fp.add(X1, Y1);
      let t4 = Fp.add(X2, Y2);
      t3 = Fp.mul(t3, t4);
      t4 = Fp.add(t0, t1);
      t3 = Fp.sub(t3, t4);
      t4 = Fp.add(X1, Z1);
      let t5 = Fp.add(X2, Z2);
      t4 = Fp.mul(t4, t5);
      t5 = Fp.add(t0, t2);
      t4 = Fp.sub(t4, t5);
      t5 = Fp.add(Y1, Z1);
      X3 = Fp.add(Y2, Z2);
      t5 = Fp.mul(t5, X3);
      X3 = Fp.add(t1, t2);
      t5 = Fp.sub(t5, X3);
      Z3 = mulA(t4);
      X3 = Fp.mul(b3, t2);
      Z3 = Fp.add(X3, Z3);
      X3 = Fp.sub(t1, Z3);
      Z3 = Fp.add(t1, Z3);
      Y3 = Fp.mul(X3, Z3);
      t1 = Fp.add(t0, t0);
      t1 = Fp.add(t1, t0);
      t2 = mulA(t2);
      t4 = Fp.mul(b3, t4);
      t1 = Fp.add(t1, t2);
      t2 = Fp.sub(t0, t2);
      t2 = mulA(t2);
      t4 = Fp.add(t4, t2);
      t0 = Fp.mul(t1, t4);
      Y3 = Fp.add(Y3, t0);
      t0 = Fp.mul(t5, t4);
      X3 = Fp.mul(t3, X3);
      X3 = Fp.sub(X3, t0);
      t0 = Fp.mul(t3, t1);
      Z3 = Fp.mul(t5, Z3);
      Z3 = Fp.add(Z3, t0);
      return new Point(X3, Y3, Z3);
    }
    subtract(other) {
      aprjpoint(other);
      return this.add(other.negate());
    }
    is0() {
      return this.equals(Point.ZERO);
    }
    /**
     * Constant time multiplication.
     * Uses precomputed tables (signed fixed-window wNAF) when available.
     * Uses scalar blinding and avoids endomorphism splitting in the secret-scalar path.
     * @param scalar - by which the point would be multiplied
     * @returns New point
     */
    multiply(scalar) {
      if (!Fn.isValidNot0(scalar))
        throw new RangeError("invalid scalar: out of range");
      const { p, f } = wnaf.mulSecret(this, scalar, cofactor, normalize);
      return normalize([p, f])[0];
    }
    /**
     * Non-constant-time multiplication. Uses width-4 wNAF with GLV endomorphism splitting
     * when available (two half-width scalars sharing one halved doubling chain).
     * It's faster, but should only be used when you don't care about
     * an exposed secret key e.g. sig verification, which works over *public* keys.
     */
    multiplyUnsafe(scalar) {
      const p = this;
      const sc = scalar;
      if (!Fn.isValid(sc))
        throw new RangeError("invalid scalar: out of range");
      if (sc === _0n4 || p.is0())
        return Point.ZERO;
      if (sc === _1n4)
        return p;
      if (wnaf.hasWindowSize(this))
        return wnaf.mulUnsafe(p, sc, normalize);
      const points = [];
      const scalars = [];
      pushWnafPair(points, scalars, p, sc);
      return mulAddUnsafe(Point, points, scalars);
    }
    /**
     * Non-constant-time double-scalar multiplication `a⋅this + b⋅other` (Strauss–Shamir).
     * Both walks share one doubling chain via {@link mulAddUnsafe}, and GLV endomorphism
     * (when available) halves the chain again by splitting each scalar into two half-width
     * parts. Used by ECDSA verification and public-key recovery for `R = u1⋅G + u2⋅P`.
     * Only for public scalars.
     */
    mulAddUnsafe(a, other, b) {
      aprjpoint(other);
      const points = [];
      const scalars = [];
      pushWnafPair(points, scalars, this, a);
      pushWnafPair(points, scalars, other, b);
      return mulAddUnsafe(Point, points, scalars);
    }
    /**
     * Converts Projective point to affine (x, y) coordinates.
     * (X, Y, Z) ∋ (x=X/Z, y=Y/Z).
     * @param invertedZ - Z^-1 (inverted zero) - optional, precomputation is useful for invertBatch
     */
    toAffine(invertedZ) {
      const p = this;
      let iz = invertedZ;
      if (iz != null && !Fp.isValid(iz))
        throw new RangeError('"invertedZ" expected valid field element');
      const { X, Y, Z } = p;
      if (Fp.eql(Z, Fp.ONE))
        return { x: X, y: Y };
      const is0 = p.is0();
      if (iz == null)
        iz = is0 ? Fp.ONE : Fp.inv(Z);
      const x = Fp.mul(X, iz);
      const y = Fp.mul(Y, iz);
      const zz = Fp.mul(Z, iz);
      if (is0)
        return { x: Fp.ZERO, y: Fp.ZERO };
      if (!Fp.eql(zz, Fp.ONE))
        throw new Error("invZ was invalid");
      return { x, y };
    }
    /**
     * Checks whether Point is free of torsion elements (is in prime subgroup).
     * Always torsion-free for cofactor=1 curves.
     */
    isTorsionFree() {
      if (cofactor === _1n4)
        return true;
      if (isTorsionFree)
        return isTorsionFree(Point, this);
      return wnaf.mulUnsafe(this, CURVE_ORDER).is0();
    }
    clearCofactor() {
      if (cofactor === _1n4)
        return this;
      if (clearCofactor)
        return clearCofactor(Point, this);
      return this.multiplyUnsafe(cofactor);
    }
    isSmallOrder() {
      if (cofactor === _1n4)
        return this.is0();
      return this.clearCofactor().is0();
    }
    toBytes(isCompressed = true) {
      abool(isCompressed, "isCompressed");
      this.assertValidity();
      return encodePoint(Point, this, isCompressed);
    }
    toHex(isCompressed = true) {
      return bytesToHex2(this.toBytes(isCompressed));
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
  }
  const normalize = (points) => normalizeZ(Point, points);
  const wnaf = new ScalarMultiplier(Point, randomBytes3);
  if (wnaf.bits >= 6)
    Point.BASE.precompute(6);
  Object.freeze(Point.prototype);
  Object.freeze(Point);
  return Point;
}
function pprefix(hasEvenY) {
  return Uint8Array.of(hasEvenY ? 2 : 3);
}
function getWLengths(Fp, Fn) {
  return {
    secretKey: Fn.BYTES,
    publicKey: 1 + Fp.BYTES,
    publicKeyUncompressed: 1 + 2 * Fp.BYTES,
    publicKeyHasPrefix: true,
    // Raw compact `(r || s)` signature width; DER and recovered signatures use
    // different lengths outside this helper.
    signature: 2 * Fn.BYTES
  };
}

// node_modules/@noble/curves/secp256k1.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var secp256k1_CURVE = {
  p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"),
  n: BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),
  h: BigInt(1),
  a: BigInt(0),
  b: BigInt(7),
  Gx: BigInt("0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"),
  Gy: BigInt("0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")
};
var secp256k1_ENDO = {
  beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
  basises: [
    [BigInt("0x3086d221a7d46bcde86c90e49284eb15"), -BigInt("0xe4437ed6010e88286f547fa90abfe4c3")],
    [BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"), BigInt("0x3086d221a7d46bcde86c90e49284eb15")]
  ]
};
var _0n5 = /* @__PURE__ */ BigInt(0);
var _2n3 = /* @__PURE__ */ BigInt(2);
function sqrtMod(y) {
  const P = secp256k1_CURVE.p;
  const _3n3 = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
  const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
  const b2 = y * y * y % P;
  const b3 = b2 * b2 * y % P;
  const b6 = pow2(b3, _3n3, P) * b3 % P;
  const b9 = pow2(b6, _3n3, P) * b3 % P;
  const b11 = pow2(b9, _2n3, P) * b2 % P;
  const b22 = pow2(b11, _11n, P) * b11 % P;
  const b44 = pow2(b22, _22n, P) * b22 % P;
  const b88 = pow2(b44, _44n, P) * b44 % P;
  const b176 = pow2(b88, _88n, P) * b88 % P;
  const b220 = pow2(b176, _44n, P) * b44 % P;
  const b223 = pow2(b220, _3n3, P) * b3 % P;
  const t1 = pow2(b223, _23n, P) * b22 % P;
  const t2 = pow2(t1, _6n, P) * b2 % P;
  const root = pow2(t2, _2n3, P);
  if (!Fpk1.eql(Fpk1.sqr(root), y))
    throw new Error("Cannot find square root");
  return root;
}
var Fpk1 = /* @__PURE__ */ Field(secp256k1_CURVE.p, { sqrt: sqrtMod });
var Pointk1 = /* @__PURE__ */ weierstrass(secp256k1_CURVE, {
  Fp: Fpk1,
  endo: secp256k1_ENDO
});
var TAGGED_HASH_PREFIXES = /* @__PURE__ */ Object.create(null);
function taggedHash(tag, ...messages) {
  let tagP = TAGGED_HASH_PREFIXES[tag];
  if (tagP === void 0) {
    const tagH = sha256(asciiToBytes(tag));
    tagP = concatBytes2(tagH, tagH);
    TAGGED_HASH_PREFIXES[tag] = tagP;
  }
  return sha256(concatBytes2(tagP, ...messages));
}
var pointToBytes = (point) => point.toBytes(true).slice(1);
var affineXToBytes = ({ x }) => Fpk1.toBytes(x);
var hasEven = (y) => !Fpk1.isOdd(y);
function schnorrGetExtPubKey(priv) {
  const { Fn, BASE } = Pointk1;
  const d_ = Fn.fromBytes(abytes2(priv, 32, "secretKey"));
  const p = BASE.multiply(d_);
  const affine = p.toAffine();
  const scalar = hasEven(affine.y) ? d_ : Fn.neg(d_);
  return { scalar, bytes: affineXToBytes(affine) };
}
function lift_x(x) {
  const Fp = Fpk1;
  if (!Fp.isValidNot0(x))
    throw new Error("invalid x: Fail if x \u2265 p");
  const xx = Fp.sqr(x);
  const c = Fp.add(Fp.mulN(xx, x), BigInt(7));
  let y = Fp.sqrt(c);
  if (!hasEven(y))
    y = Fp.neg(y);
  const p = Pointk1.fromAffine({ x, y });
  p.assertValidity();
  return p;
}
var num = bytesToNumberBE;
function challenge(...args) {
  return Pointk1.Fn.create(num(taggedHash("BIP0340/challenge", ...args)));
}
function schnorrGetPublicKey(secretKey) {
  return schnorrGetExtPubKey(secretKey).bytes;
}
function schnorrSign(message, secretKey, auxRand = randomBytes(32)) {
  const { Fn, BASE } = Pointk1;
  const m = copyBytes(abytes2(message, void 0, "message"));
  const { bytes: px, scalar: d } = schnorrGetExtPubKey(secretKey);
  const a = abytes2(auxRand, 32, "auxRand");
  const t = Fn.toBytes(d ^ num(taggedHash("BIP0340/aux", a)));
  const rand = taggedHash("BIP0340/nonce", t, px, m);
  const k_ = Fn.create(num(rand));
  if (k_ === _0n5)
    throw new Error("sign failed: k is zero");
  const p = BASE.multiply(k_);
  const affine = p.toAffine();
  const k = hasEven(affine.y) ? k_ : Fn.neg(k_);
  const rx = affineXToBytes(affine);
  const e = challenge(rx, px, m);
  const sig = new Uint8Array(64);
  sig.set(rx, 0);
  sig.set(Fn.toBytes(Fn.create(k + e * d)), 32);
  if (!schnorrVerify(sig, m, px))
    throw new Error("sign: Invalid signature produced");
  return sig;
}
function schnorrVerify(signature, message, publicKey) {
  const { Fp, Fn, BASE } = Pointk1;
  const sig = abytes2(signature, 64, "signature");
  const m = abytes2(message, void 0, "message");
  const pub = abytes2(publicKey, 32, "publicKey");
  try {
    const P = lift_x(num(pub));
    const rBytes = sig.subarray(0, 32);
    const r = num(rBytes);
    if (!Fp.isValidNot0(r))
      return false;
    const s = num(sig.subarray(32, 64));
    if (!Fn.isValidNot0(s))
      return false;
    const e = challenge(rBytes, pointToBytes(P), m);
    const R = BASE.mulAddUnsafe(s, P, Fn.neg(e));
    const { x, y } = R.toAffine();
    if (R.is0() || !hasEven(y) || !Fp.eql(x, r))
      return false;
    return true;
  } catch (error2) {
    return false;
  }
}
var schnorr = /* @__PURE__ */ (() => {
  const size = 32;
  const seedLength = 48;
  const randomSecretKey = (seed) => {
    seed = seed === void 0 ? randomBytes(seedLength) : seed;
    return mapHashToField(abytes2(seed, seedLength, "seed"), secp256k1_CURVE.n);
  };
  return Object.freeze({
    keygen: createKeygen(randomSecretKey, schnorrGetPublicKey),
    getPublicKey: schnorrGetPublicKey,
    sign: schnorrSign,
    verify: schnorrVerify,
    Point: Pointk1,
    utils: Object.freeze({
      randomSecretKey,
      taggedHash,
      lift_x,
      pointToBytes
    }),
    lengths: Object.freeze({
      secretKey: size,
      publicKey: size,
      publicKeyHasPrefix: false,
      signature: size * 2,
      seed: seedLength
    })
  });
})();

// studio/studio-payload.ts.source.txt
var DATA_LABEL = "1313231955";
var MAX_PAYLOAD_BYTES = 12e3;
var MAX_RECOVERY_BYTES = 16384;
var MAX_PAYLOAD_FILES = 8;
var PAYLOAD_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/svg+xml",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/midi",
  "video/mp4",
  "video/webm",
  "text/html",
  "text/plain",
  "text/markdown",
  "application/json",
  "application/octet-stream"
];
var enc = new TextEncoder();
var dec = new TextDecoder("utf-8", { fatal: true });
var losslessDec = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
var fail = (message) => {
  throw new Error(message);
};
async function payloadHash(bytes) {
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(
    new Uint8Array(hash),
    (b) => b.toString(16).padStart(2, "0")
  ).join("");
}
function boundedText(value, max, label, required = true) {
  if (typeof value !== "string" || enc.encode(value).length > max || required && !value.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) || dec.decode(enc.encode(value)) !== value)
    fail(`${label} must be valid UTF-8 text within ${max} bytes.`);
  return value;
}
function filename(name) {
  const value = boundedText(name, 64, "File name");
  if (value !== value.normalize("NFC") || /[\\/:<>"|?*]/.test(value) || /[. ]$/.test(value) || value === "." || value === ".." || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(value))
    fail(
      "Use a simple file name without a folder, reserved name, or trailing dot."
    );
  return value;
}
function metadataChunks(text3) {
  if (enc.encode(text3).length <= 64) return text3;
  const out = [];
  let chunk = "";
  let bytes = 0;
  for (const c of text3) {
    const size = enc.encode(c).length;
    if (bytes + size > 64) {
      out.push(chunk);
      chunk = "";
      bytes = 0;
    }
    chunk += c;
    bytes += size;
  }
  if (chunk) out.push(chunk);
  return out;
}
function isText(mime) {
  return mime.startsWith("text/") || mime === "application/json" || mime === "image/svg+xml";
}
function validateBytes(mime, bytes) {
  const ascii = (a, b) => String.fromCharCode(...bytes.slice(a, b));
  const starts = (hex2) => hex2.every((x, i) => bytes[i] === x);
  if (isText(mime)) {
    let text3;
    try {
      text3 = dec.decode(bytes);
    } catch {
      return fail("Text files must contain valid UTF-8.");
    }
    if (mime === "application/json") {
      try {
        JSON.parse(text3);
      } catch {
        fail("The JSON file is not valid JSON.");
      }
    }
    if (mime === "image/svg+xml" && !/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(text3))
      fail("The SVG file must start with its svg element.");
    return;
  }
  const matches = {
    "image/png": starts([137, 80, 78, 71, 13, 10, 26, 10]),
    "image/jpeg": starts([255, 216, 255]),
    "image/webp": ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP",
    "image/avif": ascii(4, 8) === "ftyp" && ascii(8, 64).includes("avif"),
    "image/gif": ["GIF87a", "GIF89a"].includes(ascii(0, 6)),
    "audio/wav": ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE",
    "audio/ogg": ascii(0, 4) === "OggS",
    "audio/midi": ascii(0, 4) === "MThd",
    "audio/mpeg": ascii(0, 3) === "ID3" || bytes[0] === 255 && (bytes[1] & 224) === 224,
    "video/mp4": ascii(4, 8) === "ftyp",
    "video/webm": starts([26, 69, 223, 163])
  };
  if (matches[mime] === false)
    fail("The file signature does not match its selected media type.");
}
function base64(bytes) {
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
}
function makeURI(mime, bytes) {
  const binary = `data:${mime};base64,${base64(bytes)}`;
  if (!isText(mime) || mime.startsWith("image/")) return binary;
  const text3 = `data:${mime},${encodeURIComponent(losslessDec.decode(bytes))}`;
  return text3.length < binary.length ? text3 : binary;
}
function decodePayloadURI(uri, mime) {
  if (typeof uri !== "string" || uri.length > MAX_RECOVERY_BYTES * 4 + 100)
    return fail("Invalid or oversized embedded file URI.");
  if (isText(mime)) {
    const utf8 = `data:${mime};charset=utf-8`;
    if (uri.startsWith(utf8 + ",")) uri = `data:${mime},` + uri.slice(utf8.length + 1);
    else if (uri.startsWith(utf8 + ";base64,")) uri = `data:${mime};base64,` + uri.slice((utf8 + ";base64,").length);
  }
  const binary = `data:${mime};base64,`, text3 = `data:${mime},`;
  let bytes;
  if (uri.startsWith(binary)) {
    const body = uri.slice(binary.length);
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      body
    ))
      return fail("Invalid base64 data URI.");
    bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    if (base64(bytes) !== body) return fail("Noncanonical base64 data URI.");
  } else if (isText(mime) && uri.startsWith(text3)) {
    try {
      bytes = enc.encode(decodeURIComponent(uri.slice(text3.length)));
    } catch {
      return fail("Invalid encoded UTF-8 data URI.");
    }
  } else
    return fail(
      "Only self-contained data URIs matching the media type are accepted."
    );
  if (!bytes.length || bytes.length > MAX_RECOVERY_BYTES)
    return fail("Embedded file size is outside the supported bound.");
  validateBytes(mime, bytes);
  return bytes;
}
function identity(bundle) {
  return enc.encode(
    JSON.stringify({
      schema: bundle.schema,
      name: bundle.name,
      description: bundle.description,
      cover: bundle.cover,
      files: bundle.files.map(({ name, mediaType, bytes, sha256: sha2562 }) => ({
        name,
        mediaType,
        bytes,
        sha256: sha2562
      }))
    })
  );
}
async function preparePayloadBundle(options) {
  const name = boundedText(options.name, 64, "Title");
  const description = boundedText(
    options.description || "",
    1024,
    "Description",
    false
  );
  if (!Array.isArray(options.files) || options.files.length < 1 || options.files.length > MAX_PAYLOAD_FILES)
    return fail(`Add between one and ${MAX_PAYLOAD_FILES} files.`);
  const inputs = [...options.files];
  const cover = options.coverIndex !== void 0;
  if (cover) {
    const i = options.coverIndex;
    if (!Number.isSafeInteger(i) || i < 0 || i >= inputs.length || !inputs[i].mediaType.startsWith("image/"))
      return fail("Choose an image file as the NFT cover.");
    inputs.unshift(...inputs.splice(i, 1));
  }
  let total = 0;
  const names = /* @__PURE__ */ new Set(), files = [];
  for (const input of inputs) {
    const fileName = filename(input.name), mime = input.mediaType;
    if (!PAYLOAD_TYPES.includes(mime))
      return fail("Unsupported media type.");
    if (names.has(fileName.toLocaleLowerCase("en-US")))
      return fail("Each file needs a distinct name.");
    names.add(fileName.toLocaleLowerCase("en-US"));
    if (!(input.bytes instanceof Uint8Array) || !input.bytes.length)
      return fail("Files must contain at least one byte.");
    total += input.bytes.length;
    if (total > MAX_PAYLOAD_BYTES)
      return fail(
        `The files exceed ${MAX_PAYLOAD_BYTES.toLocaleString()} raw bytes. A complete transaction may need a smaller payload.`
      );
    const bytes = new Uint8Array(input.bytes);
    validateBytes(mime, bytes);
    files.push(
      Object.freeze({
        name: fileName,
        mediaType: mime,
        bytes: bytes.length,
        sha256: await payloadHash(bytes),
        uri: makeURI(mime, bytes)
      })
    );
  }
  const partial = {
    schema: "nft-studio.payload.v1",
    name,
    description,
    files: Object.freeze(files),
    cover,
    bytes: total
  };
  return Object.freeze({
    ...partial,
    sha256: await payloadHash(identity(partial))
  });
}
async function verifyPayloadBundle(bundle) {
  if (!bundle || bundle.schema !== "nft-studio.payload.v1")
    return fail("Unsupported payload bundle.");
  const rebuilt = await preparePayloadBundle({
    name: bundle.name,
    description: bundle.description,
    coverIndex: bundle.cover ? 0 : void 0,
    files: bundle.files.map((f) => ({
      name: f.name,
      mediaType: f.mediaType,
      bytes: decodePayloadURI(f.uri, f.mediaType)
    }))
  });
  if (rebuilt.sha256 !== bundle.sha256 || rebuilt.bytes !== bundle.bytes || rebuilt.files.some(
    (f, i) => f.sha256 !== bundle.files[i].sha256 || f.bytes !== bundle.files[i].bytes || f.uri !== bundle.files[i].uri
  ))
    fail("The prepared content changed. Prepare the transaction again.");
}
function fileMetadata(file) {
  return {
    name: file.name,
    mediaType: file.mediaType,
    src: metadataChunks(file.uri),
    sha256: file.sha256,
    bytes: file.bytes
  };
}
function payloadMetadata(bundle, mint) {
  if (mint) {
    if (!/^[a-f0-9]{56}$/.test(mint.policyId) || !mint.assetName || enc.encode(mint.assetName).length > 32)
      return fail("Invalid asset identity.");
    if (!bundle.cover)
      return fail(
        "An NFT needs a cover image. Data records can be created without one."
      );
    const image = bundle.files[0];
    return {
      "721": {
        [mint.policyId]: {
          [mint.assetName]: {
            name: bundle.name,
            image: metadataChunks(image.uri),
            mediaType: image.mediaType,
            image_name: image.name,
            image_sha256: image.sha256,
            image_bytes: image.bytes,
            ...bundle.description ? { description: metadataChunks(bundle.description) } : {},
            files: bundle.files.slice(1).map(fileMetadata),
            schema: bundle.schema,
            content_sha256: bundle.sha256
          }
        },
        version: "1.0"
      }
    };
  }
  return {
    [DATA_LABEL]: {
      schema: "nft-studio.data.v1",
      name: bundle.name,
      ...bundle.description ? { description: metadataChunks(bundle.description) } : {},
      files: bundle.files.map(fileMetadata),
      content_sha256: bundle.sha256,
      cover: bundle.cover ? 1 : 0
    }
  };
}

// studio/music-release.ts.source.txt
var MUSIC_RELEASE_SCHEMA = "beacn.music-release.v1";
var MUSIC_RELEASE_PROFILE = "cip60-v3-studio-exact-files";
var MUSIC_LIMITS = Object.freeze({
  packageBytes: 8e4,
  musicJsonBytes: 6e3,
  metadataCborBytes: 14e3,
  tracks: 7,
  artists: 4,
  contributors: 8,
  authors: 8,
  links: 3,
  textBytes: 64,
  songTitleBytes: 192
});
var enc2 = new TextEncoder();
var dec2 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
function error(message) {
  throw new Error(message);
}
function snapshot(value, maxBytes = MUSIC_LIMITS.packageBytes) {
  let budget = maxBytes;
  let nodes = 0;
  const debit = (bytes) => {
    budget -= bytes;
    if (budget < 0) error("Music package exceeds its JSON size limit.");
  };
  const visit = (v, depth) => {
    if (++nodes > 4096 || depth > 16)
      error("Music package nesting or item limit exceeded.");
    if (typeof v === "string") {
      if (v.length > maxBytes || dec2.decode(enc2.encode(v)) !== v)
        error("Invalid music UTF-8 text.");
      debit(enc2.encode(JSON.stringify(v)).length);
      return v;
    }
    if (v === null || typeof v === "boolean") {
      debit(5);
      return v;
    }
    if (typeof v === "number" && Number.isSafeInteger(v) && !Object.is(v, -0)) {
      debit(String(v).length);
      return v;
    }
    if (!v || typeof v !== "object")
      error("Music package must contain plain JSON values.");
    const proto = Object.getPrototypeOf(v);
    const array = Array.isArray(v);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null)
      error("Music package requires plain objects and arrays.");
    const keys = Reflect.ownKeys(v);
    if (keys.length > 4096 || keys.some((key) => typeof key !== "string"))
      error("Invalid music object keys.");
    if (array) {
      const length = Object.getOwnPropertyDescriptor(v, "length")?.value;
      if (!Number.isSafeInteger(length) || length > 4096 || keys.length !== length + 1)
        error("Music arrays must be dense and have no extra properties.");
      debit(2 + length);
      const out2 = [];
      for (let i = 0; i < length; i++) {
        const d = Object.getOwnPropertyDescriptor(v, String(i));
        if (!d || !d.enumerable || !Object.hasOwn(d, "value"))
          error("Music arrays must contain plain values.");
        out2.push(visit(d.value, depth + 1));
      }
      return out2;
    }
    debit(2 + keys.length * 2);
    const out = {};
    for (const k of keys.sort()) {
      if (enc2.encode(k).length > 64 || dec2.decode(enc2.encode(k)) !== k)
        error("Invalid music field name.");
      const d = Object.getOwnPropertyDescriptor(v, k);
      if (!d.enumerable || !Object.hasOwn(d, "value"))
        error("Music fields must be plain enumerable values.");
      debit(enc2.encode(JSON.stringify(k)).length);
      Object.defineProperty(out, k, {
        value: visit(d.value, depth + 1),
        enumerable: true,
        writable: true,
        configurable: true
      });
    }
    return out;
  };
  return visit(value, 0);
}
function fields(value, required, optional, label) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    error(`Invalid ${label}.`);
  const row = value;
  if (required.some((key) => !Object.hasOwn(row, key)) || Object.keys(row).some(
    (key) => !required.includes(key) && !optional.includes(key)
  ))
    error(`Unexpected or missing ${label} fields.`);
  return row;
}
function text(value, label, max = 64) {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || enc2.encode(value).length > max || /[\u0000-\u001f\u007f]/.test(value))
    error(
      `${label} must be nonempty text of at most ${max} UTF-8 bytes without surrounding whitespace or controls.`
    );
  return value;
}
function list(value, max, label) {
  if (!Array.isArray(value) || !value.length || value.length > max)
    error(`${label} must contain 1\u2013${max} entries.`);
  return value;
}
function uniqueTextList(value, max, label) {
  const result = list(value, max, label).map((v) => text(v, label));
  if (new Set(result).size !== result.length)
    error(`${label} must not repeat an entry.`);
  return result;
}
function url(value, label) {
  const s = text(value, label);
  let u;
  try {
    u = new URL(s);
  } catch {
    return error(`${label} must be an absolute HTTPS URL.`);
  }
  if (u.protocol !== "https:" || !u.hostname || u.username || u.password || /[\\\s]/.test(s))
    error(`${label} must be an absolute HTTPS URL without credentials.`);
  return s;
}
function links(value) {
  const row = fields(value, [], Object.keys(value), "artist links");
  if (!Object.keys(row).length || Object.keys(row).length > MUSIC_LIMITS.links)
    error("Include 1\u20133 artist links.");
  const out = {};
  for (const [key, value2] of Object.entries(row)) {
    if (!/^[a-z][a-z0-9_]{0,23}$/.test(key) || ["constructor", "prototype", "__proto__"].includes(key))
      error("Use a short lowercase link label.");
    out[key] = url(value2, "Artist link");
  }
  return out;
}
function identifier(value, label, regex) {
  const s = text(value, label);
  if (!regex.test(s))
    error(
      `Invalid ${label} syntax; only enter an identifier that was actually assigned.`
    );
  return s;
}
function artist(value) {
  const row = fields(value, ["name"], ["isni", "links"], "artist");
  return {
    name: text(row.name, "Artist name"),
    ...row.isni !== void 0 ? { isni: identifier(row.isni, "ISNI", /^[0-9]{15}[0-9X]$/) } : {},
    ...row.links !== void 0 ? { links: links(row.links) } : {}
  };
}
function contributor(value) {
  const row = fields(
    value,
    ["name"],
    ["ipn", "ipi", "role", "links"],
    "contributor"
  );
  return {
    name: text(row.name, "Contributor name"),
    ...row.ipi !== void 0 ? { ipi: identifier(row.ipi, "IPI", /^[0-9]{9,11}$/) } : {},
    ...row.ipn !== void 0 ? { ipn: identifier(row.ipn, "IPN", /^[0-9]{1,16}$/) } : {},
    ...row.role !== void 0 ? { role: uniqueTextList(row.role, 4, "Contributor roles") } : {},
    ...row.links !== void 0 ? { links: links(row.links) } : {}
  };
}
function shares(value) {
  let total = 0;
  const result = list(value, MUSIC_LIMITS.authors, "Authors").map((v) => {
    const row = fields(v, ["name", "share"], ["ipi"], "author");
    const share = identifier(
      row.share,
      "author share",
      /^(?:0|[1-9][0-9]?|100)(?:\.[0-9]{1,2})?%$/
    );
    const [whole, fraction = ""] = share.slice(0, -1).split(".");
    const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    if (basisPoints < 1 || basisPoints > 1e4)
      error("Author shares must be above zero and at most 100%.");
    total += basisPoints;
    return {
      name: text(row.name, "Author name"),
      share,
      ...row.ipi !== void 0 ? { ipi: identifier(row.ipi, "IPI", /^[0-9]{9,11}$/) } : {}
    };
  });
  if (total !== 1e4) error("Declared author shares must total exactly 100%.");
  return result;
}
function date(value, label) {
  const s = text(value, label);
  if (!/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/.test(s))
    error(`${label} must use YYYY-MM-DD.`);
  const parsed = /* @__PURE__ */ new Date(`${s}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== s)
    error(`Invalid ${label}.`);
  return s;
}
function duration(value) {
  const s = text(value, "Song duration");
  const parts = /^PT(?:(0|[1-9][0-9]?)H)?(?:(0|[1-9][0-9]?)M)?(?:(0|[1-9][0-9]?)S)?$/.exec(
    s
  );
  if (!parts || !parts[1] && !parts[2] && !parts[3])
    error("Use a positive whole-second duration such as PT3M21S.");
  const [h, m, sec] = parts.slice(1).map((n) => Number(n || 0));
  if (h > 23 || m > 59 || sec > 59 || h * 3600 + m * 60 + sec < 1)
    error(
      "Song duration must be 1 second to less than 24 hours, with minutes and seconds below 60."
    );
  return s;
}
var songTextFields = [
  "mood",
  "set",
  "bitrate",
  "bpm",
  "mix_engineer",
  "mastering_engineer",
  "producer",
  "co_producer",
  "recording_engineer",
  "country_of_origin",
  "derived_from"
];
function song(value) {
  const row = fields(
    value,
    [
      "song_title",
      "song_duration",
      "track_number",
      "artists",
      "copyright",
      "genres"
    ],
    [
      ...songTextFields,
      "lyrics",
      "special_thanks",
      "featured_artists",
      "contributing_artists",
      "authors",
      "isrc",
      "iswc",
      "metadata_language",
      "language"
    ],
    "song"
  );
  if (!Number.isSafeInteger(row.track_number) || Number(row.track_number) < 1 || Number(row.track_number) > 999)
    error("Track number must be an integer from 1 to 999.");
  const rights = fields(
    row.copyright,
    ["master", "composition"],
    [],
    "copyright declaration"
  );
  const out = {
    song_title: text(row.song_title, "Song title", MUSIC_LIMITS.songTitleBytes),
    song_duration: duration(row.song_duration),
    track_number: row.track_number,
    artists: list(row.artists, MUSIC_LIMITS.artists, "Artists").map(artist),
    copyright: {
      master: text(rights.master, "Master copyright declaration"),
      composition: text(
        rights.composition,
        "Composition copyright declaration"
      )
    },
    genres: uniqueTextList(row.genres, 3, "Genres")
  };
  for (const key of songTextFields)
    if (row[key] !== void 0) out[key] = text(row[key], key);
  if (row.lyrics !== void 0) out.lyrics = url(row.lyrics, "Lyrics link");
  if (row.special_thanks !== void 0)
    out.special_thanks = uniqueTextList(
      row.special_thanks,
      8,
      "Special thanks"
    );
  if (row.featured_artists !== void 0)
    out.featured_artists = list(
      row.featured_artists,
      MUSIC_LIMITS.artists,
      "Featured artists"
    ).map(artist);
  if (row.contributing_artists !== void 0)
    out.contributing_artists = list(
      row.contributing_artists,
      MUSIC_LIMITS.contributors,
      "Contributors"
    ).map(contributor);
  if (row.authors !== void 0) out.authors = shares(row.authors);
  if (row.isrc !== void 0)
    out.isrc = identifier(
      row.isrc,
      "ISRC",
      /^[A-Z]{2}-[A-Z0-9]{3}-[0-9]{2}-[0-9]{5}$/
    );
  if (row.iswc !== void 0)
    out.iswc = identifier(row.iswc, "ISWC", /^T-[0-9]{9}-[0-9]$/);
  for (const key of ["language", "metadata_language"])
    if (row[key] !== void 0)
      out[key] = identifier(
        row[key],
        key,
        /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2}|-[0-9]{3})?$/
      );
  return out;
}
function parseComposer(value) {
  const row = fields(value, ["release", "tracks"], [], "music composer");
  const release = fields(
    row.release,
    ["release_type", "release_title"],
    [
      "distributor",
      "visual_artist",
      "release_date",
      "publication_date",
      "catalog_number",
      "series",
      "collection"
    ],
    "release"
  );
  if (!["Single", "Multiple"].includes(release.release_type))
    error(
      "This profile supports Single and Multiple releases; Album/EP is outside this profile."
    );
  const out = {
    release_type: release.release_type,
    release_title: text(release.release_title, "Release title")
  };
  for (const key of ["visual_artist", "catalog_number", "series", "collection"])
    if (release[key] !== void 0) out[key] = text(release[key], key);
  if (release.distributor !== void 0)
    out.distributor = url(release.distributor, "Distributor");
  for (const key of ["release_date", "publication_date"])
    if (release[key] !== void 0) out[key] = date(release[key], key);
  const tracks = list(row.tracks, MUSIC_LIMITS.tracks, "Tracks").map((item) => {
    const track = fields(item, ["fileName", "song"], [], "track");
    return {
      fileName: text(track.fileName, "Track file name"),
      song: song(track.song)
    };
  });
  if (new Set(tracks.map((t) => t.fileName)).size !== tracks.length || new Set(tracks.map((t) => t.song.track_number)).size !== tracks.length)
    error("Track files and track numbers must be unique.");
  if (release.release_type === "Single" && tracks.length !== 1)
    error("A Single release must contain exactly one track.");
  tracks.sort((a, b) => a.song.track_number - b.song.track_number);
  const result = { release: out, tracks };
  snapshot(result, MUSIC_LIMITS.musicJsonBytes);
  return result;
}
function freeze(value) {
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}
function canonical(value) {
  return JSON.stringify(snapshot(value));
}
async function createMusicRelease(bundleInput, composerInput) {
  const bundle = snapshot(bundleInput);
  fields(
    bundle,
    ["schema", "name", "description", "files", "cover", "sha256", "bytes"],
    [],
    "payload bundle"
  );
  if (bundle.schema !== "nft-studio.payload.v1" || bundle.cover !== true || typeof bundle.name !== "string" || typeof bundle.description !== "string" || typeof bundle.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(bundle.sha256) || !Number.isSafeInteger(bundle.bytes) || bundle.bytes < 1 || !Array.isArray(bundle.files) || bundle.files.length < 2 || bundle.files.length > 8)
    error(
      "Music needs a Studio NFT bundle with a cover image and 1\u20137 audio files."
    );
  for (const file of bundle.files) {
    fields(
      file,
      ["name", "mediaType", "bytes", "sha256", "uri"],
      [],
      "payload file"
    );
    if (typeof file.name !== "string" || typeof file.mediaType !== "string" || typeof file.uri !== "string" || typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 1)
      error(
        "Music payload files require exact typed names, MIME types, URIs, byte lengths and SHA-256 hashes."
      );
  }
  const composer = parseComposer(
    snapshot(composerInput, MUSIC_LIMITS.musicJsonBytes)
  );
  if (!bundle.files[0].mediaType.startsWith("image/") || bundle.files.slice(1).some(
    (f) => !["audio/mpeg", "audio/wav", "audio/ogg", "audio/midi"].includes(
      f.mediaType
    )
  ))
    error(
      "This music profile accepts one cover followed only by supported audio files."
    );
  if (composer.tracks.length !== bundle.files.length - 1 || composer.tracks.some(
    (track) => !bundle.files.slice(1).some((f) => f.name === track.fileName)
  ))
    error("Every audio file must have exactly one matching track record.");
  await verifyPayloadBundle(bundle);
  const core = {
    schema: MUSIC_RELEASE_SCHEMA,
    profile: MUSIC_RELEASE_PROFILE,
    bundle,
    ...composer
  };
  const packageHash = await payloadHash(enc2.encode(canonical(core)));
  const result = { ...core, packageHash };
  snapshot(result);
  assembleMetadata(result, {
    policyId: "0".repeat(56),
    assetName: "0".repeat(32)
  });
  return freeze(result);
}
async function verifyMusicRelease(input) {
  const row = fields(
    snapshot(input),
    ["schema", "profile", "bundle", "release", "tracks", "packageHash"],
    [],
    "music release package"
  );
  if (row.schema !== MUSIC_RELEASE_SCHEMA || row.profile !== MUSIC_RELEASE_PROFILE || typeof row.packageHash !== "string" || !/^[a-f0-9]{64}$/.test(row.packageHash))
    error("Unsupported music package or invalid hash.");
  const rebuilt = await createMusicRelease(row.bundle, {
    release: row.release,
    tracks: row.tracks
  });
  if (rebuilt.packageHash !== row.packageHash)
    error("Music package hash does not match its exact content and credits.");
  return rebuilt;
}
async function parseMusicRelease(input) {
  if (typeof input !== "string" || input.length > MUSIC_LIMITS.packageBytes || enc2.encode(input).length > MUSIC_LIMITS.packageBytes)
    error("Music package exceeds 80 KB.");
  let value;
  try {
    value = JSON.parse(input);
  } catch {
    return error("Invalid music package JSON.");
  }
  if (canonical(value) !== input)
    error("Use the canonical music package exported by this codec.");
  return verifyMusicRelease(value);
}
function musicMetadataCbor(input) {
  const metadata = snapshot(input);
  const parts = [];
  const put = (...bytes) => {
    parts.push(...bytes);
    if (parts.length > MUSIC_LIMITS.metadataCborBytes)
      error(
        "Music metadata exceeds the 14,000-byte profile cap; reduce files or credits."
      );
  };
  const head = (major, n) => {
    if (!Number.isSafeInteger(n) || n < 0 || n > 4294967295)
      error("Metadata size or integer is outside this profile.");
    if (n < 24) put(major * 32 + n);
    else if (n <= 255) put(major * 32 + 24, n);
    else if (n <= 65535) put(major * 32 + 25, n >>> 8, n & 255);
    else
      put(
        major * 32 + 26,
        n >>> 24 & 255,
        n >>> 16 & 255,
        n >>> 8 & 255,
        n & 255
      );
  };
  const write = (v) => {
    if (typeof v === "string") {
      const b = enc2.encode(v);
      if (b.length > 64) error("Ledger metadata text exceeds 64 UTF-8 bytes.");
      head(3, b.length);
      for (const byte of b) put(byte);
      return;
    }
    if (typeof v === "number") {
      head(v >= 0 ? 0 : 1, v >= 0 ? v : -1 - v);
      return;
    }
    if (Array.isArray(v)) {
      head(4, v.length);
      for (const item of v) write(item);
      return;
    }
    if (!v || typeof v !== "object")
      error("Ledger metadata has no Boolean or null values.");
    const entries2 = Object.entries(v);
    head(5, entries2.length);
    for (const [k, val] of entries2) {
      write(k);
      write(val);
    }
  };
  const entries = Object.entries(metadata);
  if (entries.length !== 1 || entries[0][0] !== "721")
    error("Music metadata must use only integer label 721.");
  head(5, 1);
  head(0, 721);
  write(entries[0][1]);
  return Uint8Array.from(parts);
}
function assembleMetadata(pkg, identity2) {
  const metadata = payloadMetadata(pkg.bundle, identity2);
  const label = metadata["721"];
  const policy = label[identity2.policyId];
  const row = policy[identity2.assetName];
  row.music_metadata_version = 3;
  row.release = snapshot(pkg.release);
  row.music_profile = MUSIC_RELEASE_PROFILE;
  row.music_package_sha256 = pkg.packageHash;
  const songs = new Map(
    pkg.tracks.map((track) => [track.fileName, track.song])
  );
  row.files = row.files.map((file) => {
    const track = songs.get(file.name);
    return {
      ...file,
      song: {
        ...snapshot(track),
        song_title: metadataChunks(track.song_title)
      }
    };
  });
  const stable = snapshot(metadata);
  const encoded = musicMetadataCbor(stable);
  return freeze({
    metadata: stable,
    metadataCborHex: Array.from(
      encoded,
      (b) => b.toString(16).padStart(2, "0")
    ).join(""),
    metadataCborBytes: encoded.length,
    packageHash: pkg.packageHash
  });
}

// studio/strict-json.mjs
function parseJson(text3, maxBytes) {
  if (typeof text3 !== "string" || text3.length > maxBytes || !text3.isWellFormed() || new TextEncoder().encode(text3).length > maxBytes) throw new TypeError("Expected bounded well-formed JSON text");
  let i = 0, nodes = 0;
  const numeric = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
  const fail2 = () => {
    throw new TypeError("Invalid or unsupported JSON structure");
  };
  const ws = () => {
    while (i < text3.length && /[\t\n\r ]/.test(text3[i])) i++;
  };
  function string() {
    const start = i++;
    while (i < text3.length) {
      const c = text3.charCodeAt(i++);
      if (c === 34) {
        let value;
        try {
          value = JSON.parse(text3.slice(start, i));
        } catch {
          fail2();
        }
        if (!value.isWellFormed()) fail2();
        return value;
      }
      if (c < 32) fail2();
      if (c === 92) i++;
    }
    fail2();
  }
  function read(depth) {
    if (depth > 10 || ++nodes > 2048) fail2();
    ws();
    const c = text3[i];
    if (c === '"') return string();
    if (c === "{") {
      i++;
      ws();
      const object = /* @__PURE__ */ Object.create(null);
      if (text3[i] === "}") {
        i++;
        return object;
      }
      while (true) {
        if (text3[i] !== '"') fail2();
        const key = string();
        if (["__proto__", "prototype", "constructor"].includes(key) || Object.hasOwn(object, key)) fail2();
        ws();
        if (text3[i++] !== ":") fail2();
        object[key] = read(depth + 1);
        ws();
        const end = text3[i++];
        if (end === "}") return object;
        if (end !== ",") fail2();
        ws();
      }
    }
    if (c === "[") {
      i++;
      ws();
      const array = [];
      if (text3[i] === "]") {
        i++;
        return array;
      }
      while (true) {
        array.push(read(depth + 1));
        ws();
        const end = text3[i++];
        if (end === "]") return array;
        if (end !== ",") fail2();
      }
    }
    for (const [word, value] of [["true", true], ["false", false], ["null", null]]) {
      if (text3.startsWith(word, i)) {
        i += word.length;
        return value;
      }
    }
    numeric.lastIndex = i;
    const token = numeric.exec(text3)?.[0];
    if (!token) fail2();
    i += token.length;
    if (/[.eE]/.test(token) || token === "-0" || !Number.isSafeInteger(Number(token))) return Object.freeze({ unsupportedNumberToken: token });
    return Number(token);
  }
  const result = read(0);
  ws();
  if (i !== text3.length) fail2();
  return result;
}

// src/index.mjs
var encoder = new TextEncoder();
var SCHEMA = "beacn.music-schnorr-seal.v1";
var TRUST_SCHEMA = "beacn.music-schnorr-trust.v1";
var PROFILE = "bip340-sha256-release-nonzero-rs-v1";
var DOMAIN = "BEACN Labs\0music-release-endorsement\0beacn.music-schnorr-seal.v1\0";
var EMPTY_TRUST = JSON.stringify({ schema: TRUST_SCHEMA, bindings: [] });
var LIMITS = Object.freeze({ packageUtf8Bytes: 8e4, sealUtf8Bytes: 1024, trustUtf8Bytes: 4096, trustBindings: 16, publicKeyBytes: 32, signatureBytes: 64, signedMessageBytes: 32 });
var hex = (bytes) => Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
var digest = (text3) => hex(sha256(encoder.encode(text3)));
function text2(value, max, label) {
  if (typeof value !== "string" || value.length > max || !value.isWellFormed() || encoder.encode(value).length > max) throw new TypeError("Expected bounded " + label + " text");
  return value;
}
function exactHex(value, bytes, label) {
  if (typeof value !== "string" || value.length !== bytes * 2 || !/^[0-9a-f]+$/.test(value)) throw new TypeError("Expected exact lowercase " + label + " hex");
  return Uint8Array.from(value.match(/../g), (x) => Number.parseInt(x, 16));
}
function fields2(value, names, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== names.length || names.some((k) => !Object.hasOwn(value, k))) throw new TypeError("Invalid " + label + " fields");
  return value;
}
function freeze2(value) {
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) freeze2(v);
    Object.freeze(value);
  }
  return value;
}
function challengeFor(packageHash) {
  const h = exactHex(packageHash, 32, "package hash");
  const prefix = encoder.encode(DOMAIN);
  const preimage = new Uint8Array(prefix.length + h.length);
  preimage.set(prefix);
  preimage.set(h, prefix.length);
  return { schema: SCHEMA, profile: PROFILE, purpose: "endorse-exact-music-package", packageHash, domain: DOMAIN, preimageHex: hex(preimage), messageHex: hex(sha256(preimage)), messageBytes: 32, explanation: "Endorse the exact files and credits committed by this Music package. This is not a transaction, login, rights certificate or mint authorization." };
}
function trustFrom(value) {
  text2(value, LIMITS.trustUtf8Bytes, "trust");
  const row = fields2(parseJson(value, LIMITS.trustUtf8Bytes), ["schema", "bindings"], "trust");
  if (row.schema !== TRUST_SCHEMA || !Array.isArray(row.bindings) || row.bindings.length > LIMITS.trustBindings) throw new TypeError("Unsupported trust configuration");
  const seen = /* @__PURE__ */ new Set();
  for (const b of row.bindings) {
    fields2(b, ["packageHash", "publicKeyHex"], "trust binding");
    exactHex(b.packageHash, 32, "trust package hash");
    exactHex(b.publicKeyHex, 32, "trust public key");
    const key = b.packageHash + ":" + b.publicKeyHex;
    if (seen.has(key)) throw new TypeError("Duplicate trust binding");
    seen.add(key);
  }
  return row;
}
async function packageFrom(value) {
  text2(value, LIMITS.packageUtf8Bytes, "canonical music package");
  return parseMusicRelease(value);
}
async function prepareChallenge(packetJson) {
  const pkg = await packageFrom(packetJson);
  return freeze2({ ...challengeFor(pkg.packageHash), packageJsonSha256: digest(packetJson) });
}
async function inspectSeal(packetJson, sealJson = null, trustJson = EMPTY_TRUST) {
  text2(packetJson, LIMITS.packageUtf8Bytes, "canonical music package");
  if (sealJson !== null) text2(sealJson, LIMITS.sealUtf8Bytes, "seal");
  const trust = trustFrom(trustJson);
  let seal = null;
  if (sealJson !== null) {
    seal = fields2(parseJson(sealJson, LIMITS.sealUtf8Bytes), ["schema", "profile", "packageHash", "publicKeyHex", "signatureHex"], "seal");
    if (seal.schema !== SCHEMA || seal.profile !== PROFILE) throw new TypeError("Unsupported seal schema/profile");
    exactHex(seal.packageHash, 32, "seal package hash");
    exactHex(seal.publicKeyHex, 32, "public key");
    exactHex(seal.signatureHex, 64, "signature");
  }
  const pkg = await packageFrom(packetJson);
  const base = { schema: "beacn.music-schnorr-inspection.v1", profile: PROFILE, packageHash: pkg.packageHash, packageJsonSha256: digest(packetJson), sealJsonSha256: sealJson === null ? null : digest(sealJson), trustJsonSha256: digest(trustJson), signingPerformed: false, networkRequests: false, identityVerified: false, rightsVerified: false, walletAuthorityVerified: false, chainEvidence: false, limitations: ["Valid signatures establish an endorsement by the checked key only. Explicit key trust is caller configuration, not issuer discovery.", "Static endorsement replay for the same package is intentional; this profile is unsuitable for login, session authorization or one-time redemption.", "No Bitcoin address derivation, wallet signing compatibility or chain holdings verification.", "BIP-340 r=0 or s=0 encodings are outside this narrow application profile. Aiken native evaluation supports only 32-byte messages."] };
  if (seal === null) return freeze2({ ...base, cryptography: "absent", packageBinding: "absent", trust: "unmatched", verdict: "no-seal", trustedExactRelease: false });
  const key = exactHex(seal.publicKeyHex, 32, "public key"), signature = exactHex(seal.signatureHex, 64, "signature");
  const challenge2 = challengeFor(seal.packageHash);
  const nonzero = signature.subarray(0, 32).some((x) => x !== 0) && signature.subarray(32).some((x) => x !== 0);
  const cryptography = !nonzero ? "unsupported" : schnorr.verify(signature, exactHex(challenge2.messageHex, 32, "message"), key) ? "valid" : "invalid";
  const packageBinding = seal.packageHash === pkg.packageHash ? "match" : "mismatch";
  const matched = trust.bindings.some((b) => b.packageHash === seal.packageHash && b.publicKeyHex === seal.publicKeyHex);
  const trustedExactRelease = cryptography === "valid" && packageBinding === "match" && matched;
  const verdict = cryptography === "unsupported" ? "unsupported-signature" : cryptography === "invalid" ? "invalid-signature" : packageBinding === "mismatch" ? "different-release" : matched ? "trusted-exact-release" : "valid-untrusted";
  return freeze2({ ...base, seal, challenge: challenge2, cryptography, packageBinding, trust: matched ? "matched" : "unmatched", trustScopePackageHash: seal.packageHash, verdict, trustedExactRelease });
}
export {
  DOMAIN,
  EMPTY_TRUST,
  LIMITS,
  PROFILE,
  SCHEMA,
  TRUST_SCHEMA,
  inspectSeal,
  prepareChallenge
};
