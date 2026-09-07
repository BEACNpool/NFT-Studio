export interface CapsuleParameters {
  readonly seed: { readonly transactionId: string; readonly outputIndex: number };
  readonly baseName: string;
}
type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
export interface AppliedBlueprint {
  readonly preamble: { readonly [key: string]: Json };
  readonly validators: readonly { readonly title: string; readonly compiledCode: string; readonly hash: string; readonly datum?: Json; readonly redeemer?: Json }[];
  readonly definitions: { readonly [key: string]: Json };
}
export interface CapsuleSource {
  readonly repository: string;
  readonly commit: string;
  readonly path: string;
  readonly url: string;
  readonly blueprintSha256: string;
  readonly compiledCodeSha256: string;
  readonly unappliedScriptHash: string;
  readonly compiler: 'v1.1.23+8949565';
  readonly plutusVersion: 'PlutusV3';
  readonly uplcVersion: '1.1.0';
  readonly applicator: { readonly package: '@harmoniclabs/uplc'; readonly version: '2.0.7'; readonly commit: string };
}
export const CAPSULE_PARAMETERIZER_SOURCE: CapsuleSource;
export const CAPSULE_PARAMETERIZER_LIMITS: Readonly<{outputIndex:65535;baseNameUtf8Bytes:28;baseNameCodeUnits:28;appliedScriptBytes:3200;appliedBlueprintUtf8Bytes:32768}>;
export interface AppliedCapsule {
  readonly schema: 'beacn.state-capsule.applied.v1';
  readonly parameters: CapsuleParameters & Readonly<{baseNameHex:string;seedCborHex:string;baseNameCborHex:string}>;
  readonly plutusVersion: 'PlutusV3';
  readonly uplcVersion: '1.1.0';
  readonly compiledCode: string;
  readonly scriptBytes: number;
  readonly policyId: string;
  readonly scriptHash: string;
  readonly assetNames: Readonly<{baseNameHex:string;referenceAssetNameHex:string;userAssetNameHex:string}>;
  readonly appliedBlueprint: AppliedBlueprint;
  readonly appliedBlueprintJson: string;
  readonly appliedBlueprintSha256: string;
  readonly source: CapsuleSource;
  readonly checks: Readonly<{fixedSourceHashesVerified:true;originalUplcRoundtripExact:true;identicalHandlers:3;parametersRemaining:0}>;
  readonly readiness: 'experimental-parameterized-only';
  readonly limitations: Readonly<{seedExistsVerified:false;seedUnspentVerified:false;seedOwnershipVerified:false;transactionPrepared:false;nodeEvaluated:false;walletApproved:false;signed:false;submitted:false;chainInclusionVerified:false}>;
}
/** Throws TypeError on unsupported shape or bounds. Returns a deeply frozen result. */
export function applyCapsuleParameters(input: CapsuleParameters): AppliedCapsule;
