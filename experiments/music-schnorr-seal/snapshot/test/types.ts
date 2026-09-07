import { prepareChallenge,inspectSeal,SCHEMA,PROFILE,TRUST_SCHEMA,type MusicSeal,type MusicSealTrust,type MusicSealInspection } from '../dist/seal.mjs';
async function consume(packet:string,seal:MusicSeal,trust:MusicSealTrust):Promise<string>{const c=await prepareChallenge(packet);const result:MusicSealInspection=await inspectSeal(packet,JSON.stringify(seal),JSON.stringify(trust));return result.seal?.publicKeyHex??c.messageHex;}
const seal:MusicSeal={schema:SCHEMA,profile:PROFILE,packageHash:'0'.repeat(64),publicKeyHex:'0'.repeat(64),signatureHex:'0'.repeat(128)};
const trust:MusicSealTrust={schema:TRUST_SCHEMA,bindings:[]};void consume;void seal;void trust;
