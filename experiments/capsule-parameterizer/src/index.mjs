/** Fixed State Capsule parameter application. Pure JS: no wallet, URL, filesystem or network API. */
import { Application, UPLCConst, UPLCProgram, parseUPLC, compileUPLC } from '@harmoniclabs/uplc';
import { DataConstr, DataB, DataI, dataToCbor } from '@harmoniclabs/plutus-data';
import { Cbor, CborBytes } from '@harmoniclabs/cbor';
import { sha256 } from '@noble/hashes/sha2.js';
import { blake2b } from '@noble/hashes/blake2.js';
import { FIXED_BLUEPRINT_JSON } from './fixed-blueprint.mjs';

const utf8 = new TextEncoder();
const check = (condition, message) => { if (!condition) throw new TypeError(message); };
const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const unhex = value => Uint8Array.from(value.match(/../g) ?? [], part => parseInt(part, 16));
const sha = bytes => hex(sha256(bytes));
const scriptHash = bytes => hex(blake2b(Uint8Array.from([3, ...bytes]), { dkLen: 28 }));
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
export const CAPSULE_PARAMETERIZER_LIMITS = freeze({ outputIndex: 65535, baseNameUtf8Bytes: 28, baseNameCodeUnits: 28, appliedScriptBytes: 3200, appliedBlueprintUtf8Bytes: 32768 });
export const CAPSULE_PARAMETERIZER_SOURCE = freeze({
  repository: 'https://github.com/BEACNpool/NFT-Studio',
  commit: 'd2003bec53b944c7b71bd50caa2a14002008c7ea',
  path: 'contracts/state-capsule/plutus.json',
  url: 'https://github.com/BEACNpool/NFT-Studio/blob/d2003bec53b944c7b71bd50caa2a14002008c7ea/contracts/state-capsule/plutus.json',
  blueprintSha256: '26f9377baf76d713c1aaa1f447dceb59e7ffa0b58728f59a617ae91e40c738f4',
  compiledCodeSha256: 'd11df0f4e8b733913eebaedd2eb245bc882fc188bcee0e15f9579cabd73b22bd',
  unappliedScriptHash: '4c9c42dbaf549439983db5c82406e423ea821f44a09c91d4b5fc59bc',
  compiler: 'v1.1.23+8949565', plutusVersion: 'PlutusV3', uplcVersion: '1.1.0',
  applicator: { package: '@harmoniclabs/uplc', version: '2.0.7', commit: '3e10e46e89c184b92886f38c39e9057063dffd9f' },
});

// Validate exact fixed bytes before either CBOR or UPLC decoder receives them.
check(FIXED_BLUEPRINT_JSON.length <= 32768, 'Trusted blueprint exceeds the fixed bound.');
check(sha(utf8.encode(FIXED_BLUEPRINT_JSON)) === CAPSULE_PARAMETERIZER_SOURCE.blueprintSha256, 'Trusted blueprint SHA-256 mismatch.');
const blueprint = JSON.parse(FIXED_BLUEPRINT_JSON);
check(blueprint.preamble.plutusVersion === 'v3' && blueprint.preamble.compiler.name === 'Aiken' && blueprint.preamble.compiler.version === CAPSULE_PARAMETERIZER_SOURCE.compiler, 'Trusted compiler or Plutus version mismatch.');
const titles = ['capsule.capsule.mint', 'capsule.capsule.spend', 'capsule.capsule.else'];
check(blueprint.validators.length === 3, 'Trusted handler count mismatch.');
const sourceCode = blueprint.validators[0].compiledCode;
check(typeof sourceCode === 'string' && sourceCode.length === 6088 && /^[0-9a-f]+$/.test(sourceCode), 'Trusted compiled code shape mismatch.');
const sourceBytes = unhex(sourceCode);
check(sha(sourceBytes) === CAPSULE_PARAMETERIZER_SOURCE.compiledCodeSha256 && scriptHash(sourceBytes) === CAPSULE_PARAMETERIZER_SOURCE.unappliedScriptHash, 'Trusted script hash mismatch.');
const parameterShape = '[{"title":"seed","schema":{"$ref":"#/definitions/cardano~1transaction~1OutputReference"}},{"title":"base_name","schema":{"$ref":"#/definitions/ByteArray"}}]';
for (let index = 0; index < 3; index++) {
  const validator = blueprint.validators[index];
  check(validator.title === titles[index] && validator.compiledCode === sourceCode && validator.hash === CAPSULE_PARAMETERIZER_SOURCE.unappliedScriptHash && JSON.stringify(validator.parameters) === parameterShape, 'Trusted handlers or parameter order mismatch.');
}
freeze(blueprint);
const wrapped = Cbor.parseWithOffset(sourceBytes);
check(wrapped.offset === sourceBytes.length && wrapped.parsed instanceof CborBytes && wrapped.parsed.isDefiniteLength, 'Trusted script needs one exact definite CBOR bytestring.');
const program = parseUPLC(wrapped.parsed.bytes, 'flat');
check(program.version.toString() === CAPSULE_PARAMETERIZER_SOURCE.uplcVersion, 'Trusted UPLC version mismatch.');
check(hex(compileUPLC(program)) === hex(wrapped.parsed.bytes), 'Trusted UPLC serialization does not roundtrip exactly.');

function exactObject(value, keys, label) {
  check(value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)), `${label} must be a plain object.`);
  const properties = Reflect.ownKeys(value);
  check(properties.length === keys.length && properties.every(key => typeof key === 'string' && keys.includes(key)), `${label} has unsupported or missing fields.`);
  const result = Object.create(null);
  for (const key of keys) {
    const property = Object.getOwnPropertyDescriptor(value, key);
    check(property && Object.hasOwn(property, 'value') && property.enumerable, `${label} must contain ordinary enumerable data fields.`);
    result[key] = property.value;
  }
  return result;
}
/** Only these explicit fields are accepted; no script, blueprint, CBOR, URL or wallet input. */
export function applyCapsuleParameters(input) {
  const data = exactObject(input, ['seed', 'baseName'], 'Capsule parameters');
  const seed = exactObject(data.seed, ['transactionId', 'outputIndex'], 'Seed');
  check(typeof seed.transactionId === 'string' && seed.transactionId.length === 64 && /^[0-9a-f]{64}$/.test(seed.transactionId), 'Seed transactionId must be 32 bytes of lowercase hex.');
  check(Number.isInteger(seed.outputIndex) && !Object.is(seed.outputIndex, -0) && seed.outputIndex >= 0 && seed.outputIndex <= CAPSULE_PARAMETERIZER_LIMITS.outputIndex, 'Seed outputIndex must be an integer from 0 to 65535.');
  check(typeof data.baseName === 'string' && data.baseName.length >= 1 && data.baseName.length <= CAPSULE_PARAMETERIZER_LIMITS.baseNameCodeUnits && data.baseName.isWellFormed(), 'Base name must be bounded well-formed Unicode text.');
  const nameBytes = utf8.encode(data.baseName);
  check(nameBytes.length >= 1 && nameBytes.length <= CAPSULE_PARAMETERIZER_LIMITS.baseNameUtf8Bytes, 'Base asset name must be 1–28 UTF-8 bytes.');
  const seedData = new DataConstr(0, [new DataB(seed.transactionId), new DataI(seed.outputIndex)]);
  const nameData = new DataB(nameBytes);
  // Maintained library AST application and serialization; no custom Flat bit encoding.
  const body = new Application(new Application(program.body, UPLCConst.data(seedData)), UPLCConst.data(nameData));
  const compiled = Cbor.encode(new CborBytes(compileUPLC(new UPLCProgram(program.version, body))));
  check(compiled.length <= CAPSULE_PARAMETERIZER_LIMITS.appliedScriptBytes, 'Applied script exceeds the fixed application bound.');
  const compiledCode = hex(compiled), policyId = scriptHash(compiled), baseNameHex = hex(nameBytes);
  const appliedBlueprint = JSON.parse(FIXED_BLUEPRINT_JSON);
  for (const validator of appliedBlueprint.validators) {
    delete validator.parameters;
    validator.compiledCode = compiledCode;
    validator.hash = policyId;
  }
  check(appliedBlueprint.validators.every(validator => !validator.parameters?.length && validator.compiledCode === compiledCode && validator.hash === policyId), 'Applied mint/spend/fallback identity mismatch.');
  const appliedBlueprintJson = JSON.stringify(appliedBlueprint, null, 2) + '\n';
  check(utf8.encode(appliedBlueprintJson).length <= CAPSULE_PARAMETERIZER_LIMITS.appliedBlueprintUtf8Bytes, 'Applied blueprint exceeds the export bound.');
  return freeze({
    schema: 'beacn.state-capsule.applied.v1',
    parameters: { seed: { transactionId: seed.transactionId, outputIndex: seed.outputIndex }, baseName: data.baseName, baseNameHex, seedCborHex: hex(dataToCbor(seedData)), baseNameCborHex: hex(dataToCbor(nameData)) },
    plutusVersion: 'PlutusV3', uplcVersion: '1.1.0', compiledCode, scriptBytes: compiled.length, policyId, scriptHash: policyId,
    assetNames: { baseNameHex, referenceAssetNameHex: '000643b0' + baseNameHex, userAssetNameHex: '000de140' + baseNameHex },
    appliedBlueprint, appliedBlueprintJson, appliedBlueprintSha256: sha(utf8.encode(appliedBlueprintJson)),
    source: CAPSULE_PARAMETERIZER_SOURCE,
    checks: { fixedSourceHashesVerified: true, originalUplcRoundtripExact: true, identicalHandlers: 3, parametersRemaining: 0 },
    readiness: 'experimental-parameterized-only',
    limitations: { seedExistsVerified: false, seedUnspentVerified: false, seedOwnershipVerified: false, transactionPrepared: false, nodeEvaluated: false, walletApproved: false, signed: false, submitted: false, chainInclusionVerified: false },
  });
}
