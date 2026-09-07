import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync, sign, verify, createPublicKey } from 'node:crypto';
import { createCip26Inspector, PROFILE } from '../src/index.mjs';
const fixturePath = new URL('./oracle.json', import.meta.url);
const oracles = JSON.parse(readFileSync(fixturePath));
const plain = createCip26Inspector();
const record = (o, signatures = []) => ({ subject:o.subject, [o.property]:{value:o.value,sequenceNumber:o.sequenceNumber,signatures} });
const inspect = (r, c = plain) => c.inspect(typeof r === 'string' ? r : JSON.stringify(r));
const keypair = generateKeyPairSync('ed25519'); // Ephemeral synthetic key; never exported or persisted.
const publicKey = keypair.publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('hex');
const attestation = o => ({publicKey,signature:sign(null,Buffer.from(o.digest,'hex'),keypair.privateKey).toString('hex')});
const trust = (subject, keys=[publicKey], observations=[]) => createCip26Inspector(JSON.stringify({schema:'beacn.cip26.trust.v1',bindings:keys.length?[{subject,publicKeys:keys}]:[],observations}));
const o=oracles[0];const signed=record(o,[attestation(o)]);
const context=trust(o.subject);
const published=[];

test('133 independent Python/hashlib scalar CBOR + normative published digest oracles',()=>{
 assert.equal(oracles.length,133);
 for(const oracle of oracles){
  const r=inspect(record(oracle)).entries[0];assert.equal(r.attestationDigestHex,oracle.digest);
  assert.deepEqual(Object.values(r.components).map(v=>v.cborHex),oracle.cborHex);
  assert.deepEqual(Object.values(r.components).map(v=>v.blake2b256),oracle.componentHashes);
 }
});
test('published offchain-metadata-tools signatures verify independently with Node crypto',()=>{
 const dir=new URL('../evidence/',import.meta.url);
 for(const name of readdirSync(dir).filter(n=>n.includes('--fixtures--'))){
  const original=JSON.parse(readFileSync(new URL(name,dir)));
  if(Object.values(original).some(v=>v && typeof v==='object' && v.signatures?.length>4)) assert.throws(()=>inspect(original),/Signature count limit/);
  for(const [property,e] of Object.entries(original)){
   if(!e || typeof e!=='object' || property==='logo')continue;
   // Original nine-signature fixture exceeds the application cap; explicit per-signature
   // subsets test every original public attestation without pretending full import passed.
   for(const signature of e.signatures){
    const r={subject:original.subject,[property]:{...e,signatures:[signature]}};
    const result=inspect(r).entries[0];
    assert.equal(result.signatureTrust,'untrusted',name+' '+property);
    const pub=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(signature.publicKey,'hex')]),format:'der',type:'spki'});
    assert.equal(verify(null,Buffer.from(result.attestationDigestHex,'hex'),pub,Buffer.from(signature.signature,'hex')),true);
    assert.equal(inspect(r,trust(original.subject,[signature.publicKey])).entries[0].signatureTrust,'trusted');
    published.push({sourceFile:name,record:r,digest:result.attestationDigestHex});
   }
  }
 }
 assert.equal(published.length,59);
});
test('valid signature is untrusted until exact subject and public key are explicitly bound',()=>{
 assert.equal(inspect(signed).entries[0].signatureTrust,'untrusted');
 assert.equal(inspect(signed,context).entries[0].signatureTrust,'trusted');
 assert.equal(inspect(signed,trust(o.subject+'x')).entries[0].signatureTrust,'untrusted');
 const fake={...signed,trustedKeys:[publicKey]};assert.throws(()=>inspect(fake));
 assert.equal(inspect({...signed,policy:'00'},plain).entries[0].signatureTrust,'untrusted');
 assert.equal(inspect({...signed,policy:'00'},context).policy.authentication,'not-performed');
});
test('unsigned, cryptographically invalid, valid untrusted and mixed signatures remain distinct',()=>{
 assert.equal(inspect(record(o)).entries[0].signatureTrust,'unsigned');
 const invalid={...attestation(o),signature:'00'.repeat(64)};
 assert.equal(inspect(record(o,[invalid])).entries[0].signatureTrust,'invalid');
 assert.equal(inspect(record(o,[invalid,attestation(o)]),context).entries[0].signatureTrust,'trusted');
 assert.deepEqual(inspect(record(o,[invalid,attestation(o)]),context).entries[0].signatures.map(v=>v.status),['invalid','valid-trusted']);
 assert.equal(inspect(record(o,[{publicKey:'abc',signature:'ff'}])).entries[0].signatures[0].reason,'encoding');
});
test('every attested component and signature byte is bound; CBOR truncation digest cannot verify',()=>{
 for(const r of [record({...o,subject:o.subject+'x'},signed[o.property].signatures),record({...o,property:'different'},signed[o.property].signatures),record({...o,value:'changed'},signed[o.property].signatures),record({...o,sequenceNumber:1},signed[o.property].signatures)])assert.equal(inspect(r).entries[0].signatureTrust,'invalid');
 const s=attestation(o);
 for(let i=0;i<64;i++){
  const b=Buffer.from(s.signature,'hex');b[i]^=1;assert.equal(inspect(record(o,[{...s,signature:b.toString('hex')}])).entries[0].signatureTrust,'invalid');
 }
 const wrong=sign(null,Buffer.from(o.cborHex[2].slice(0,-2),'hex'),keypair.privateKey).toString('hex');
 assert.equal(inspect(record(o,[{publicKey,signature:wrong}])).entries[0].signatureTrust,'invalid');
});
test('sequence compares only trusted supplied observations and exposes same-sequence conflicts',()=>{
 const baseline={subject:o.subject,property:o.property,sequenceNumber:0,attestationDigestHex:o.digest};
 const c=trust(o.subject,[publicKey],[baseline]);
 let e=inspect(signed,c).entries[0];assert.equal(e.sequenceStatus,'same-observation');assert.equal(e.eligibleAsUpdate,false);assert.equal(e.eligibleForTrustedDisplay,true);
 e=inspect(signed,trust(o.subject,[publicKey],[{...baseline,sequenceNumber:1}])).entries[0];assert.equal(e.sequenceStatus,'older');assert.equal(e.eligibleForTrustedDisplay,false);
 e=inspect(signed,trust(o.subject,[publicKey],[{...baseline,attestationDigestHex:'00'.repeat(32)}])).entries[0];assert.equal(e.sequenceStatus,'conflict');assert.equal(e.eligibleAsUpdate,false);assert.equal(e.eligibleForTrustedDisplay,false);
 const n=oracles.find(v=>v.sequenceNumber===24);e=inspect(record(n,[attestation(n)]),trust(n.subject,[publicKey],[{...baseline,subject:n.subject,property:n.property}])).entries[0];assert.equal(e.sequenceStatus,'newer');assert.equal(e.eligibleAsUpdate,true);
 assert.equal(inspect(signed,context).sequenceStoreUpdated,false);
});
test('unsupported objects, arrays, floating representations, logo and preimage do not gain trust',()=>{
 for(const [p,v]of [['contact',{}],['contact',[]],['contact',1.5],['logo','iVBORw0KGgo='],['preimage',{alg:'blake2b',msg:'00'}],['contact','x'.repeat(4097)],['decimals',20],['name',''],['url','not a uri'],['url','javascript:alert(1)'],['url','https://example.test/%zz'],['url','https://example.test/{x}'],['url','https://user:pass@example.test/']]){
  const e=inspect({subject:o.subject,[p]:{value:v,sequenceNumber:0,signatures:signed[o.property].signatures}},context).entries[0];assert.equal(e.status,'unsupported');assert.equal(e.eligibleForTrustedDisplay,false);assert.equal('attestationDigestHex'in e,false);
 }
 for(const number of ['1e0','1.0','-0','9007199254740992'])assert.equal(inspect('{"subject":"x","a":{"value":'+number+',"sequenceNumber":0}}').entries[0].status,'unsupported');
});
test('Unicode stays exact including BOM, normalization differences and code point limits',()=>{
 const result=inspect(record(oracles.find(v=>v.value==='\ufeffbytes'))).entries[0];assert.equal(result.value.charCodeAt(0),0xfeff);
 const a=inspect({subject:'s',a:{value:'é',sequenceNumber:0}}).entries[0];const b=inspect({subject:'s',a:{value:'e\u0301',sequenceNumber:0}}).entries[0];assert.notEqual(a.attestationDigestHex,b.attestationDigestHex);
 assert.equal(inspect({subject:'s',name:{value:'🎶'.repeat(50),sequenceNumber:0}}).entries[0].status,'inspected');
 assert.equal(inspect({subject:'s',name:{value:'🎶'.repeat(51),sequenceNumber:0}}).entries[0].status,'unsupported');
 assert.throws(()=>inspect('{"subject":"\\ud800","a":{"value":"x","sequenceNumber":0}}'));
});
test('URL profile checks original component delimiters without normalization or authority repair',()=>{
 const invalid = ['https://example.com/a[b]','https://example.com/?x=[v]','https://example.com/#a#b','https://@example.com/','https://user@example.com/','https:///example.com/a','https:////example.com/x','https://example.com/#[]'];
 for(const value of invalid) assert.equal(inspect({subject:'s',url:{value,sequenceNumber:0}}).entries[0].status,'unsupported',value);
 const valid = ['https://[2001:db8::1]:443/a%5Bb%5D?x=%23#frag%23one','https://example.com/?next=/a?b=c#f?/a','HTTPS://EXAMPLE.COM:443/%2f','https://example.com/#','https://example.com/a;b:c@d!$&()*+,=._~-'];
 for(const value of valid) {const e=inspect({subject:'s',url:{value,sequenceNumber:0}}).entries[0];assert.equal(e.status,'inspected',value);assert.equal(e.value,value);assert.equal(e.signatureTrust,'unsigned');}
});
test('strict low-order/noncanonical keys and scalar overflow signatures reject',()=>{
 const identity='01'+'00'.repeat(31);const signature=identity+'00'.repeat(32);
 assert.equal(inspect(record(o,[{publicKey:identity,signature}])).entries[0].signatureTrust,'invalid');
 assert.throws(()=>trust(o.subject,[identity]));
 const s=attestation(o);assert.equal(inspect(record(o,[{...s,signature:s.signature.slice(0,64)+'ff'.repeat(32)}])).entries[0].signatureTrust,'invalid');
 assert.equal(inspect(record(o,[{...s,publicKey:'ff'.repeat(32)}])).entries[0].signatureTrust,'invalid');
 assert.equal(inspect(record(o,[{...s,signature:identity+s.signature.slice(64)}])).entries[0].signatureTrust,'invalid');
});
test('JSON boundaries reject duplicate keys, escaped aliases, pollution, depth, huge input and getters',()=>{
 for(const bad of ['{"subject":"a","subject":"b"}','{"subject":"a","\\u0073ubject":"b"}','{"__proto__":{}}',JSON.stringify(signed)+' trailing','['.repeat(12)+'0'+']'.repeat(12),'x'.repeat(PROFILE.limits.recordBytes+1)])assert.throws(()=>inspect(bad));
 assert.throws(()=>inspect('{"subject":"s","x":{"value":1,"value":2,"sequenceNumber":0}}'));
 let calls=0;const obj={get subject(){calls++;return'x';},toString(){calls++;return'{}';}};
 assert.throws(()=>plain.inspect(obj));assert.throws(()=>createCip26Inspector(obj));assert.equal(calls,0);
 const proxy=new Proxy({}, {get(){calls++;throw Error('invoked');}});assert.throws(()=>plain.inspect(proxy));assert.equal(calls,0);
 for(let i=0;i<JSON.stringify(signed).length;i++)assert.throws(()=>plain.inspect(JSON.stringify(signed).slice(0,i)));
 assert.throws(()=>plain.inspect(' '.repeat(100)+'\"'+'🎶'.repeat(25000)+'\"'));
});
test('shape/count bounds reject excess work and null signatures; trust is a separate exact schema',()=>{
 const e=signed[o.property];
 assert.throws(()=>inspect({...signed,[o.property]:{...e,signatures:[...e.signatures,...e.signatures,...e.signatures,...e.signatures,...e.signatures]}}));
 assert.throws(()=>inspect({...signed,[o.property]:{...e,signatures:null}}));
 const r={subject:'s'};for(let i=0;i<9;i++)r['p'+i]={value:i,sequenceNumber:0};assert.throws(()=>inspect(r));
 assert.throws(()=>inspect({subject:'x'.repeat(257),a:{value:1,sequenceNumber:0}}));
 assert.throws(()=>inspect({subject:'s',a:{value:1,sequenceNumber:-1}}));
 assert.throws(()=>inspect({subject:'s',a:{value:1,sequenceNumber:0,extra:true}}));
 assert.throws(()=>trust(o.subject,[publicKey,publicKey]));
 assert.throws(()=>createCip26Inspector('{"schema":"beacn.cip26.trust.v1","bindings":[],"observations":[],"policy":"00"}'));
});
test('detached frozen result and maximum-work repeated calls have no cached trust mutation',()=>{
 const r=inspect(signed,context);assert.equal(Object.isFrozen(r.entries[0].components.value),true);assert.throws(()=>{r.entries[0].signatureTrust='fake';});
 const max={subject:o.subject};for(let i=0;i<8;i++)max['p'+i]={value:'x',sequenceNumber:0,signatures:Array.from({length:4},()=>attestation(o))};
 const start=performance.now();for(let i=0;i<8;i++)assert.equal(inspect(max,context).entries.length,8);
 const elapsed=performance.now()-start;assert.ok(elapsed<10000);
 const receipt={checkedAt:new Date().toISOString(),oracleCases:oracles.length,publishedAttestations:published.length,signatureByteMutations:64,maxWorkRepeatedCalls:8,maxWorkTotalSignatures:256,maxWorkElapsedMs:Math.round(elapsed),runtimeApiSigns:false,syntheticTestSigning:true,privateKeysPersisted:false,networkInRuntime:false,chainQueries:false};
 writeFileSync(new URL('../evidence/test-receipt.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
 writeFileSync(new URL('./browser-vectors.json',import.meta.url),JSON.stringify({oracles,published,synthetic:{record:signed,publicKey},receipt},null,2)+'\n');
});
