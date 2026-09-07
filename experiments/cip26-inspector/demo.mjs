import { readFileSync } from 'node:fs';
import { createCip26Inspector } from './src/index.mjs';
const vectors=JSON.parse(readFileSync(new URL('./test/browser-vectors.json',import.meta.url)));
const sample=vectors.published[0], property=Object.keys(sample.record).find(k=>k!=='subject');
const signature=sample.record[property].signatures[0];
const untrusted=createCip26Inspector().inspect(JSON.stringify(sample.record));
// This is an explicit demo-only trust decision for the published fixture's subject/key.
const trusted=createCip26Inspector(JSON.stringify({schema:'beacn.cip26.trust.v1',bindings:[{subject:sample.record.subject,publicKeys:[signature.publicKey]}],observations:[]})).inspect(JSON.stringify(sample.record));
console.log(JSON.stringify({subject:sample.record.subject,property,withoutLocalTrust:untrusted.entries[0].signatureTrust,withExplicitDemoTrust:trusted.entries[0].signatureTrust,attestationDigestHex:sample.digest,policyAuthentication:trusted.policy.authentication,chainEvidence:trusted.chainEvidence},null,2));
