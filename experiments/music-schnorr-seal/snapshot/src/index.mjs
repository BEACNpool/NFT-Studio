/** Exact-release endorsement only. Pure explicit-text input, no signing/network/wallet. */
import {schnorr} from '@noble/curves/secp256k1.js';
import {sha256} from '@noble/hashes/sha2.js';
import {parseMusicRelease} from '@studio/music-release';
import {parseJson} from '../studio/strict-json.mjs';
const encoder=new TextEncoder();
export const SCHEMA='beacn.music-schnorr-seal.v1';
export const TRUST_SCHEMA='beacn.music-schnorr-trust.v1';
export const PROFILE='bip340-sha256-release-nonzero-rs-v1';
export const DOMAIN='BEACN Labs\0music-release-endorsement\0beacn.music-schnorr-seal.v1\0';
export const EMPTY_TRUST=JSON.stringify({schema:TRUST_SCHEMA,bindings:[]});
export const LIMITS=Object.freeze({packageUtf8Bytes:80000,sealUtf8Bytes:1024,trustUtf8Bytes:4096,trustBindings:16,publicKeyBytes:32,signatureBytes:64,signedMessageBytes:32});
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const digest=text=>hex(sha256(encoder.encode(text)));
function text(value,max,label){if(typeof value!=='string'||value.length>max||!value.isWellFormed()||encoder.encode(value).length>max)throw new TypeError('Expected bounded '+label+' text');return value;}
function exactHex(value,bytes,label){if(typeof value!=='string'||value.length!==bytes*2||!/^[0-9a-f]+$/.test(value))throw new TypeError('Expected exact lowercase '+label+' hex');return Uint8Array.from(value.match(/../g),x=>Number.parseInt(x,16));}
function fields(value,names,label){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==names.length||names.some(k=>!Object.hasOwn(value,k)))throw new TypeError('Invalid '+label+' fields');return value;}
function freeze(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
function challengeFor(packageHash){const h=exactHex(packageHash,32,'package hash');const prefix=encoder.encode(DOMAIN);const preimage=new Uint8Array(prefix.length+h.length);preimage.set(prefix);preimage.set(h,prefix.length);return {schema:SCHEMA,profile:PROFILE,purpose:'endorse-exact-music-package',packageHash,domain:DOMAIN,preimageHex:hex(preimage),messageHex:hex(sha256(preimage)),messageBytes:32,explanation:'Endorse the exact files and credits committed by this Music package. This is not a transaction, login, rights certificate or mint authorization.'};}
function trustFrom(value){text(value,LIMITS.trustUtf8Bytes,'trust');const row=fields(parseJson(value,LIMITS.trustUtf8Bytes),['schema','bindings'],'trust');if(row.schema!==TRUST_SCHEMA||!Array.isArray(row.bindings)||row.bindings.length>LIMITS.trustBindings)throw new TypeError('Unsupported trust configuration');const seen=new Set();for(const b of row.bindings){fields(b,['packageHash','publicKeyHex'],'trust binding');exactHex(b.packageHash,32,'trust package hash');exactHex(b.publicKeyHex,32,'trust public key');const key=b.packageHash+':'+b.publicKeyHex;if(seen.has(key))throw new TypeError('Duplicate trust binding');seen.add(key);}return row;}
async function packageFrom(value){text(value,LIMITS.packageUtf8Bytes,'canonical music package');return parseMusicRelease(value);}
export async function prepareChallenge(packetJson){const pkg=await packageFrom(packetJson);return freeze({...challengeFor(pkg.packageHash),packageJsonSha256:digest(packetJson)});}
export async function inspectSeal(packetJson,sealJson=null,trustJson=EMPTY_TRUST){
 // Capture only primitive text before awaits; no caller getters/coercions or mutable views.
 text(packetJson,LIMITS.packageUtf8Bytes,'canonical music package');if(sealJson!==null)text(sealJson,LIMITS.sealUtf8Bytes,'seal');const trust=trustFrom(trustJson);
 let seal=null;if(sealJson!==null){seal=fields(parseJson(sealJson,LIMITS.sealUtf8Bytes),['schema','profile','packageHash','publicKeyHex','signatureHex'],'seal');if(seal.schema!==SCHEMA||seal.profile!==PROFILE)throw new TypeError('Unsupported seal schema/profile');exactHex(seal.packageHash,32,'seal package hash');exactHex(seal.publicKeyHex,32,'public key');exactHex(seal.signatureHex,64,'signature');}
 const pkg=await packageFrom(packetJson);const base={schema:'beacn.music-schnorr-inspection.v1',profile:PROFILE,packageHash:pkg.packageHash,packageJsonSha256:digest(packetJson),sealJsonSha256:sealJson===null?null:digest(sealJson),trustJsonSha256:digest(trustJson),signingPerformed:false,networkRequests:false,identityVerified:false,rightsVerified:false,walletAuthorityVerified:false,chainEvidence:false,limitations:['Valid signatures establish an endorsement by the checked key only. Explicit key trust is caller configuration, not issuer discovery.','Static endorsement replay for the same package is intentional; this profile is unsuitable for login, session authorization or one-time redemption.','No Bitcoin address derivation, wallet signing compatibility or chain holdings verification.','BIP-340 r=0 or s=0 encodings are outside this narrow application profile. Aiken native evaluation supports only 32-byte messages.']};
 if(seal===null)return freeze({...base,cryptography:'absent',packageBinding:'absent',trust:'unmatched',verdict:'no-seal',trustedExactRelease:false});
 const key=exactHex(seal.publicKeyHex,32,'public key'),signature=exactHex(seal.signatureHex,64,'signature');const challenge=challengeFor(seal.packageHash);
 const nonzero=signature.subarray(0,32).some(x=>x!==0)&&signature.subarray(32).some(x=>x!==0);
 const cryptography=!nonzero?'unsupported':schnorr.verify(signature,exactHex(challenge.messageHex,32,'message'),key)?'valid':'invalid';
 const packageBinding=seal.packageHash===pkg.packageHash?'match':'mismatch';const matched=trust.bindings.some(b=>b.packageHash===seal.packageHash&&b.publicKeyHex===seal.publicKeyHex);
 const trustedExactRelease=cryptography==='valid'&&packageBinding==='match'&&matched;
 const verdict=cryptography==='unsupported'?'unsupported-signature':cryptography==='invalid'?'invalid-signature':packageBinding==='mismatch'?'different-release':matched?'trusted-exact-release':'valid-untrusted';
 return freeze({...base,seal,challenge,cryptography,packageBinding,trust:matched?'matched':'unmatched',trustScopePackageHash:seal.packageHash,verdict,trustedExactRelease});
}
