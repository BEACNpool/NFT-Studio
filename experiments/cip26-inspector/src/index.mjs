import { blake2b } from '@noble/hashes/blake2.js';
import { bytesToHex, hexToBytes, concatBytes } from '@noble/hashes/utils.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { parseJson } from './strict-json.mjs';

const encoder = new TextEncoder();
const need = (v, message) => { if (!v) throw new TypeError(message); };
const hash = bytes => blake2b(bytes, { dkLen: 32 });
const freeze = value => { if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); } return value; };
export const PROFILE = freeze({
  id: 'beacn.cip26.scalar-inspector.v1', standard: 'CIP-0026', standardStatus: 'Active',
  source: 'https://github.com/cardano-foundation/CIPs/blob/05ee6bb05982289dbe00c4187b9d54cf90e2e276/CIP-0026/README.md',
  localOnly: true, policyAuthentication: false, chainVerification: false, persistence: false,
  limits: { recordBytes: 98304, configBytes: 49152, properties: 8, signaturesPerProperty: 4, subjectBytes: 255, propertyNameBytes: 64, scalarStringBytes: 4096, trustSubjects: 32, keysPerSubject: 8, observations: 128 },
  supportedValues: ['UTF-8 text', 'safe integer', 'boolean', 'null'],
  unsupported: ['logo', 'preimage', 'arrays', 'maps', 'floating-point/exponent/negative-zero number tokens', 'native-policy authentication'],
});
function text(value, label, max, min = 1) {
  need(typeof value === 'string' && value.isWellFormed(), `${label} must be well-formed text`);
  const n = encoder.encode(value).length; need(n >= min && n <= max, `${label} byte limit`); return value;
}
function object(value, label) { need(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`); return value; }
function exact(value, required, optional, label) {
  object(value, label); const keys = Object.keys(value);
  need(required.every(k => Object.hasOwn(value, k)) && keys.every(k => required.includes(k) || optional.includes(k)), `${label} fields`);
}
function integer(value, label) { need(Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0), `${label} must be a nonnegative safe integer`); return value; }
function hex(value, bytes, label) { need(typeof value === 'string' && value.length === bytes * 2 && /^[0-9a-f]+$/i.test(value), `${label} encoding`); return value.toLowerCase(); }
// RFC 8949 preferred, definite scalar encodings. No external CBOR is ever decoded.
function head(major, number) {
  let n = BigInt(number);
  if (n < BigInt(24)) return Uint8Array.of((major << 5) | Number(n));
  const width = n <= BigInt(255) ? 1 : n <= BigInt(65535) ? 2 : n <= BigInt(4294967295) ? 4 : 8;
  const bytes = new Uint8Array(width + 1); bytes[0] = (major << 5) | ({ 1: 24, 2: 25, 4: 26, 8: 27 })[width];
  for (let j = width; j > 0; j--) { bytes[j] = Number(n & BigInt(255)); n >>= BigInt(8); }
  return bytes;
}
function scalar(value) {
  if (typeof value === 'string') { const bytes = encoder.encode(value); return concatBytes(head(3, bytes.length), bytes); }
  if (typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0)) return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (value === false) return Uint8Array.of(244);
  if (value === true) return Uint8Array.of(245);
  if (value === null) return Uint8Array.of(246);
  throw new TypeError('Unsupported scalar value');
}
function unsupported(name, value) {
  if (name === 'logo') return 'Logo preimage differs between the general JSON-text rule and registry decoded-byte implementation; this profile does not choose one.';
  if (name === 'preimage') return 'Preimage algorithm/subject authentication is outside this profile.';
  if (typeof value === 'string' && encoder.encode(value).length > PROFILE.limits.scalarStringBytes) return 'Scalar text exceeds the application byte limit.';
  if (!(value === null || typeof value === 'boolean' || typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0)))) return 'Only unambiguous scalar values are supported; maps, arrays and non-integer number tokens are not attested here.';
  const rules = { name: [1, 50], description: [0, 500], ticker: [2, 9], url: [1, 250] };
  if (Object.hasOwn(rules, name)) {
    const [min, max] = rules[name];
    if (typeof value !== 'string' || [...value].length < min || [...value].length > max) return 'Value does not meet this well-known property shape.';
  }
  if (name === 'decimals' && !(Number.isSafeInteger(value) && value >= 0 && value <= 19)) return 'Decimals must be an integer from 0 through 19.';
  if (name === 'url') {
    if (!/^[A-Za-z0-9:/?#\[\]@!$&'()*+,;=._~%+-]+$/.test(value) || /%(?![0-9a-f]{2})/i.test(value)) return 'URL profile requires valid ASCII URI characters and percent escapes.';
    // Preserve the original text. WHATWG URL parsing alone admits delimiters that
    // RFC 3986 excludes from path/query/fragment, and may repair an empty authority.
    const parts = /^https:\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/i.exec(value);
    const path = /^[A-Za-z0-9!$&'()*+,;=:@/._~%+-]*$/;
    const queryOrFragment = /^[A-Za-z0-9!$&'()*+,;=:@/?._~%+-]*$/;
    if (!parts || parts[1].includes('@') || !path.test(parts[2]) ||
        !queryOrFragment.test(parts[3] ?? '') || !queryOrFragment.test(parts[4] ?? ''))
      return 'URL profile requires an explicit HTTPS authority without userinfo and RFC 3986 path, query and fragment delimiters.';
    try { const url = new URL(value); if (!/^https:\/\//i.test(value) || url.protocol !== 'https:' || !url.hostname || url.username || url.password) return 'URL profile requires an absolute HTTPS URL without credentials.'; } catch { return 'URL profile requires an absolute HTTPS URL.'; }
  }
  return null;
}
function preimage(subject, name, value, sequenceNumber) {
  const names = ['subject', 'property', 'value', 'sequenceNumber'];
  const parts = [subject, name, value, sequenceNumber].map(scalar);
  const digests = parts.map(hash); const concatenated = concatBytes(...digests);
  return { components: Object.fromEntries(names.map((n, i) => [n, { cborHex: bytesToHex(parts[i]), blake2b256: bytesToHex(digests[i]) }])), concatenatedHashesHex: bytesToHex(concatenated), attestationDigestHex: bytesToHex(hash(concatenated)) };
}
function strictVerify(signature, message, publicKey) {
  try {
    const s = hexToBytes(signature), key = hexToBytes(publicKey);
    const a = ed25519.Point.fromBytes(key, false), r = ed25519.Point.fromBytes(s.subarray(0, 32), false);
    // Attestation profile: canonical, non-small-order points in the prime-order subgroup.
    if (a.isSmallOrder() || !a.isTorsionFree() || r.isSmallOrder() || !r.isTorsionFree()) return false;
    return ed25519.verify(s, hexToBytes(message), key, { zip215: false });
  } catch { return false; }
}
function configuration(json) {
  const c = parseJson(json, PROFILE.limits.configBytes);
  exact(c, ['schema', 'bindings', 'observations'], [], 'Trust configuration');
  need(c.schema === 'beacn.cip26.trust.v1', 'Trust schema');
  need(Array.isArray(c.bindings) && c.bindings.length <= PROFILE.limits.trustSubjects, 'Trust subject limit');
  need(Array.isArray(c.observations) && c.observations.length <= PROFILE.limits.observations, 'Observation limit');
  const keys = new Map(), observations = new Map();
  for (const b of c.bindings) {
    exact(b, ['subject', 'publicKeys'], [], 'Binding'); text(b.subject, 'Subject', PROFILE.limits.subjectBytes);
    need(!keys.has(b.subject), 'Duplicate subject binding');
    need(Array.isArray(b.publicKeys) && b.publicKeys.length > 0 && b.publicKeys.length <= PROFILE.limits.keysPerSubject, 'Trusted key count');
    const list = b.publicKeys.map(k => hex(k, 32, 'Trusted public key')); need(new Set(list).size === list.length, 'Duplicate trusted key');
    for (const k of list) { let valid = false; try { const point = ed25519.Point.fromBytes(hexToBytes(k), false); valid = !point.isSmallOrder() && point.isTorsionFree(); } catch {} need(valid, 'Trusted key is not a strict prime-order public key'); }
    keys.set(b.subject, new Set(list));
  }
  for (const o of c.observations) {
    exact(o, ['subject', 'property', 'sequenceNumber', 'attestationDigestHex'], [], 'Observation');
    text(o.subject, 'Observation subject', PROFILE.limits.subjectBytes); text(o.property, 'Observation property', PROFILE.limits.propertyNameBytes); integer(o.sequenceNumber, 'Observed sequence');
    const id = JSON.stringify([o.subject, o.property]); need(!observations.has(id), 'Duplicate observation');
    observations.set(id, { sequenceNumber: o.sequenceNumber, attestationDigestHex: hex(o.attestationDigestHex, 32, 'Observed digest') });
  }
  return { keys, observations };
}

/** The configuration is host/user-owned input, never extracted from inspected record JSON. */
export function createCip26Inspector(trustConfigurationJson = '{"schema":"beacn.cip26.trust.v1","bindings":[],"observations":[]}') {
  const config = configuration(trustConfigurationJson);
  return Object.freeze({
    profile: PROFILE,
    inspect(recordJson) {
      const record = parseJson(recordJson, PROFILE.limits.recordBytes); object(record, 'Record');
      const subject = text(record.subject, 'Subject', PROFILE.limits.subjectBytes);
      const propertyNames = Object.keys(record).filter(k => k !== 'subject' && k !== 'policy');
      need(propertyNames.length > 0 && propertyNames.length <= PROFILE.limits.properties, 'Property count limit');
      const policyPresent = Object.hasOwn(record, 'policy');
      if (policyPresent) text(record.policy, 'Opaque unsupported policy', 16384, 0);
      const entries = [];
      for (const property of propertyNames) {
        text(property, 'Property name', PROFILE.limits.propertyNameBytes);
        const e = record[property]; exact(e, ['value', 'sequenceNumber'], ['signatures'], 'Property entry');
        integer(e.sequenceNumber, 'Sequence number');
        const signatures = Object.hasOwn(e, 'signatures') ? e.signatures : [];
        need(Array.isArray(signatures) && signatures.length <= PROFILE.limits.signaturesPerProperty, 'Signature count limit');
        for (const s of signatures) exact(s, ['publicKey', 'signature'], [], 'Signature');
        const reason = unsupported(property, e.value);
        if (reason) { entries.push({ property, sequenceNumber: e.sequenceNumber, status: 'unsupported', reason, signatureTrust: 'not-checked', sequenceStatus: 'not-checked', eligibleForTrustedDisplay: false, eligibleAsUpdate: false }); continue; }
        const commitment = preimage(subject, property, e.value, e.sequenceNumber);
        const seen = new Set();
        const checked = signatures.map(s => {
          let publicKey, signature;
          try { publicKey = hex(s.publicKey, 32, 'Public key'); signature = hex(s.signature, 64, 'Signature'); }
          catch { return { status: 'invalid', reason: 'encoding' }; }
          const duplicate = seen.has(publicKey); seen.add(publicKey);
          const valid = strictVerify(signature, commitment.attestationDigestHex, publicKey);
          const trusted = valid && (config.keys.get(subject)?.has(publicKey) ?? false);
          return { publicKey, status: trusted ? 'valid-trusted' : valid ? 'valid-untrusted' : 'invalid', duplicateKey: duplicate };
        });
        const trust = checked.some(s => s.status === 'valid-trusted') ? 'trusted' : checked.some(s => s.status === 'valid-untrusted') ? 'untrusted' : signatures.length ? 'invalid' : 'unsigned';
        const prior = config.observations.get(JSON.stringify([subject, property]));
        const sequenceStatus = !prior ? 'unobserved' : e.sequenceNumber < prior.sequenceNumber ? 'older' : e.sequenceNumber > prior.sequenceNumber ? 'newer' : commitment.attestationDigestHex === prior.attestationDigestHex ? 'same-observation' : 'conflict';
        entries.push({ property, value: e.value, sequenceNumber: e.sequenceNumber, status: 'inspected', ...commitment, signatures: checked, signatureTrust: trust, sequenceStatus,
          eligibleForTrustedDisplay: trust === 'trusted' && !['older', 'conflict'].includes(sequenceStatus),
          eligibleAsUpdate: trust === 'trusted' && ['unobserved', 'newer'].includes(sequenceStatus) });
      }
      return freeze({ schema: 'beacn.cip26.inspection.v1', profile: PROFILE.id, subject, trustBasis: 'explicit-local-subject-key-configuration',
        policy: { present: policyPresent, authentication: 'not-performed' }, sequenceBasis: 'supplied-local-observations-only', sequenceStoreUpdated: false,
        fullCip26Conformance: false, chainEvidence: false, ownershipEvidence: false, contentTruthEstablished: false, entries });
    },
  });
}
