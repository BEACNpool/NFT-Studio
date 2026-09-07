import * as z from 'zod/v4';
import {applyCapsuleParameters,CAPSULE_PARAMETERIZER_SOURCE,CAPSULE_PARAMETERIZER_LIMITS} from '@capsule/index.mjs';
const utf8=new TextEncoder();
export const CAPSULE_MCP_LIMITS=Object.freeze({argumentJsonBytes:1024,resultJsonBytes:80*1024,...CAPSULE_PARAMETERIZER_LIMITS});
export const CAPSULE_MCP_CAPABILITIES=Object.freeze({
  tool:'apply_state_capsule_parameters',status:'experimental-parameterized-only',
  source:CAPSULE_PARAMETERIZER_SOURCE,limits:CAPSULE_MCP_LIMITS,
  fixedBlueprintOnly:true,remoteServerReceivesSeedReferenceAndName:true,
  networkContext:'Not consulted; parameterization does not establish which chain contains the seed.',
  walletAccess:false,networkRequestsByTool:false,transactionPreparation:false,nodeEvaluation:false,chainVerification:false,signing:false,submission:false,
});
export const capsuleParameterSchema=z.strictObject({
  seed:z.strictObject({
    transactionId:z.string().length(64).regex(/^[0-9a-f]{64}$/).describe('Exact 32-byte lowercase transaction hash; existence is not checked.'),
    outputIndex:z.number().int().min(0).max(65535).refine(value=>!Object.is(value,-0)),
  }),
  baseName:z.string().min(1).max(28).refine(value=>value.length<=28&&value.isWellFormed()&&utf8.encode(value).length<=28,'Base name must be well-formed Unicode of 1–28 UTF-8 bytes.').describe('Exact 1–28 UTF-8 bytes. No trimming or Unicode normalization.'),
});
export function applyStateCapsuleParameters(input){
  const args=capsuleParameterSchema.parse(input);
  if(utf8.encode(JSON.stringify(args)).length>CAPSULE_MCP_LIMITS.argumentJsonBytes)throw new Error('Capsule parameters exceed the 1 KiB argument bound.');
  const result={application:applyCapsuleParameters(args),processing:{
    serverReceived:'The supplied seed transaction reference and base name.',
    networkRequestsByTool:false,inputPersistedByTool:false,
    privacy:'Remote MCP receives this reference and name. Use the browser-only adapter when those inputs must stay on the caller device. Hosting infrastructure may retain operational metadata.',
    status:'Parameterized script and blueprint only; no wallet access, seed lookup, transaction preparation, node evaluation, signing or submission.',
  }};
  if(utf8.encode(JSON.stringify(result)).length>CAPSULE_MCP_LIMITS.resultJsonBytes)throw new Error('Capsule result exceeds the 80 KiB export bound.');
  return result;
}
export function registerCapsuleTools(register){
  register('apply_state_capsule_parameters',
    'Apply a seed transaction reference and exact 1–28 UTF-8 byte base name to the one pinned experimental PlutusV3 State Capsule program. Returns Aiken-compatible compiled bytes, policy/script hash and applied blueprint. This server receives the reference/name; it performs no wallet access, provider/seed lookup, transaction preparation, node evaluation, signing or submission. A result does not establish seed existence, ownership, unspent state or a live capsule mint flow. No uploaded blueprint/script/CBOR/URL is accepted. Limits: index 0–65535, 1 KiB argument JSON, 80 KiB result JSON.',
    capsuleParameterSchema,applyStateCapsuleParameters,
    {readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false});
}
