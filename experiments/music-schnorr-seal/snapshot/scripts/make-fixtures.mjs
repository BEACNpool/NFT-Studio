/** Explicit development fixture generation. Ephemeral synthetic keys never leave process memory. */
import {randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {schnorr} from '@noble/curves/secp256k1.js';
import {prepareChallenge,SCHEMA,PROFILE,TRUST_SCHEMA} from '../dist/seal.mjs';
if(process.argv[2]!=='--generate-new-public-fixtures')throw Error('Explicit --generate-new-public-fixtures required; use a fresh working copy.');
const packet=await readFile(new URL('../fixtures/midnight-beacon.music-release.json',import.meta.url),'utf8');
const sort=x=>Array.isArray(x)?x.map(sort):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])])):x;
const changed=JSON.parse(packet);changed.tracks[0].song.producer='Changed producer declaration';delete changed.packageHash;changed.packageHash=createHash('sha256').update(JSON.stringify(sort(changed))).digest('hex');
const changedPacket=JSON.stringify(sort(changed));await prepareChallenge(changedPacket);
await writeFile(new URL('../fixtures/changed-credit.music-release.json',import.meta.url),changedPacket);
const challenge=await prepareChallenge(packet),alternate=await prepareChallenge(changedPacket);
const hex=b=>Buffer.from(b).toString('hex');const rows=[];
for(let i=0;i<32;i++){
 const secret=schnorr.utils.randomSecretKey(),key=hex(schnorr.getPublicKey(secret));
 const sig=hex(schnorr.sign(Buffer.from(challenge.messageHex,'hex'),secret,randomBytes(32)));
 const altSig=hex(schnorr.sign(Buffer.from(alternate.messageHex,'hex'),secret,randomBytes(32)));
 const wrongDomain=hex(schnorr.sign(createHash('sha256').update('Different signing purpose').digest(),secret,randomBytes(32)));
 secret.fill(0);
 rows.push({index:i,seal:{schema:SCHEMA,profile:PROFILE,packageHash:challenge.packageHash,publicKeyHex:key,signatureHex:sig},changedCreditSeal:{schema:SCHEMA,profile:PROFILE,packageHash:alternate.packageHash,publicKeyHex:key,signatureHex:altSig},wrongDomainSignatureHex:wrongDomain});
}
await writeFile(new URL('../fixtures/synthetic-seals.json',import.meta.url),JSON.stringify({challenge,changedChallenge:alternate,rows,keyHandling:'Ephemeral random synthetic keys used only to produce these public signature fixtures; no private keys persisted.'},null,2)+'\n');
await writeFile(new URL('../fixtures/example-trust.json',import.meta.url),JSON.stringify({schema:TRUST_SCHEMA,bindings:[{packageHash:rows[0].seal.packageHash,publicKeyHex:rows[0].seal.publicKeyHex}]},null,2)+'\n');
await writeFile(new URL('../fixtures/example-seal.json',import.meta.url),JSON.stringify(rows[0].seal,null,2)+'\n');console.log('Generated 32 public synthetic seal triples; no private keys written.');
