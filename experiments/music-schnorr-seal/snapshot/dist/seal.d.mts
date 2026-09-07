export declare const SCHEMA: 'beacn.music-schnorr-seal.v1';
export declare const TRUST_SCHEMA: 'beacn.music-schnorr-trust.v1';
export declare const PROFILE: 'bip340-sha256-release-nonzero-rs-v1';
export declare const DOMAIN: string;
export declare const EMPTY_TRUST: string;
export declare const LIMITS: Readonly<{packageUtf8Bytes:80000;sealUtf8Bytes:1024;trustUtf8Bytes:4096;trustBindings:16;publicKeyBytes:32;signatureBytes:64;signedMessageBytes:32}>;
export interface MusicSeal {
 readonly schema: typeof SCHEMA; readonly profile: typeof PROFILE;
 readonly packageHash: string; readonly publicKeyHex: string; readonly signatureHex: string;
}
export interface MusicSealTrust {
 readonly schema: typeof TRUST_SCHEMA;
 readonly bindings: readonly Readonly<{packageHash:string;publicKeyHex:string}>[];
}
export interface MusicSealChallenge {
 readonly schema: typeof SCHEMA; readonly profile: typeof PROFILE;
 readonly purpose: 'endorse-exact-music-package'; readonly packageHash: string;
 readonly domain: string; readonly preimageHex: string; readonly messageHex: string;
 readonly messageBytes: 32; readonly explanation: string;
}
export interface PreparedMusicSealChallenge extends MusicSealChallenge { readonly packageJsonSha256: string; }
export interface MusicSealInspection {
 readonly schema: 'beacn.music-schnorr-inspection.v1'; readonly profile: typeof PROFILE;
 readonly packageHash: string; readonly packageJsonSha256: string;
 readonly sealJsonSha256: string|null; readonly trustJsonSha256: string;
 readonly signingPerformed: false; readonly networkRequests: false;
 readonly identityVerified: false; readonly rightsVerified: false;
 readonly walletAuthorityVerified: false; readonly chainEvidence: false;
 readonly limitations: readonly string[];
 readonly cryptography: 'absent'|'valid'|'invalid'|'unsupported';
 readonly packageBinding: 'absent'|'match'|'mismatch';
 readonly trust: 'matched'|'unmatched';
 readonly verdict: 'no-seal'|'valid-untrusted'|'trusted-exact-release'|'different-release'|'invalid-signature'|'unsupported-signature';
 readonly trustedExactRelease: boolean;
 readonly seal?: MusicSeal; readonly challenge?: MusicSealChallenge;
 readonly trustScopePackageHash?: string;
}
export declare function prepareChallenge(packetJson: string): Promise<PreparedMusicSealChallenge>;
export declare function inspectSeal(packetJson: string, sealJson?: string|null, trustJson?: string): Promise<MusicSealInspection>;
