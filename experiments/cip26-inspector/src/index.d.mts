export type Scalar = string | number | boolean | null;
export type SignatureResult = Readonly<
  { status: 'invalid'; reason: 'encoding' } |
  { publicKey: string; status: 'valid-trusted' | 'valid-untrusted' | 'invalid'; duplicateKey: boolean }
>;
export type UnsupportedEntry = Readonly<{
  property: string; sequenceNumber: number; status: 'unsupported'; reason: string;
  signatureTrust: 'not-checked'; sequenceStatus: 'not-checked';
  eligibleForTrustedDisplay: false; eligibleAsUpdate: false;
}>;
export type InspectedEntry = Readonly<{
  property: string; value: Scalar; sequenceNumber: number; status: 'inspected';
  components: Readonly<Record<'subject'|'property'|'value'|'sequenceNumber', Readonly<{cborHex:string;blake2b256:string}>>>;
  concatenatedHashesHex: string; attestationDigestHex: string;
  signatures: readonly SignatureResult[];
  signatureTrust: 'trusted'|'untrusted'|'invalid'|'unsigned';
  sequenceStatus: 'unobserved'|'older'|'newer'|'same-observation'|'conflict';
  eligibleForTrustedDisplay: boolean; eligibleAsUpdate: boolean;
}>;
export type Inspection = Readonly<{
  schema: 'beacn.cip26.inspection.v1'; profile: 'beacn.cip26.scalar-inspector.v1';
  subject: string; trustBasis: 'explicit-local-subject-key-configuration';
  policy: Readonly<{present:boolean;authentication:'not-performed'}>;
  sequenceBasis: 'supplied-local-observations-only'; sequenceStoreUpdated: false;
  fullCip26Conformance: false; chainEvidence: false; ownershipEvidence: false; contentTruthEstablished: false;
  entries: readonly (UnsupportedEntry|InspectedEntry)[];
}>;
export type TrustConfiguration = {
  schema: 'beacn.cip26.trust.v1';
  bindings: {subject:string;publicKeys:string[]}[];
  observations: {subject:string;property:string;sequenceNumber:number;attestationDigestHex:string}[];
};
export declare const PROFILE: Readonly<{
  id:'beacn.cip26.scalar-inspector.v1';standard:'CIP-0026';standardStatus:'Active';source:string;
  localOnly:true;policyAuthentication:false;chainVerification:false;persistence:false;
  limits:Readonly<{recordBytes:98304;configBytes:49152;properties:8;signaturesPerProperty:4;subjectBytes:255;propertyNameBytes:64;scalarStringBytes:4096;trustSubjects:32;keysPerSubject:8;observations:128}>;
  supportedValues:readonly string[];unsupported:readonly string[];
}>;
/** Pass original JSON text at input boundaries. This function never invokes object getters or coerces objects. */
export declare function createCip26Inspector(trustConfigurationJson?: string): Readonly<{
  profile: typeof PROFILE;
  inspect(recordJson: string): Inspection;
}>;
