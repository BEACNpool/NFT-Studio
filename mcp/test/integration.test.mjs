import {NODE_TOOL_NAMES} from '../integration/tool-names.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyImplementationResources} from '../integration/verify-implementation-resource.mjs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { request as nodeRequest } from 'node:http';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
import { createService } from '../dist/server.mjs';
import { createHttpService, validateHttpOptions } from '../dist/http.mjs';
const TOKEN='synthetic-integration-only-token-00000000000000000000000000';
const title='SDK integration 🦾';
const file=(name,text,mediaType='text/plain')=>({name,mediaType,base64:Buffer.from(text).toString('base64')});
const cover=file('cover.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#5633aa"/><text x="10" y="50">MCP</text></svg>','image/svg+xml');
const args={name:title,description:'Exact bytes, external signing.',files:[cover,file('hello.html','<!doctype html><button onclick="this.textContent=\'Done\'">Try me</button>','text/html'),file('data.json','{"gain":0.5,"on":true}','application/json')],coverIndex:0};
const bn=x=>C.BigNum.from_str(String(x));
// Fresh synthetic keys exist only for isolated fixtures. No real wallets or chain submission.
const keyA=C.PrivateKey.generate_ed25519(),keyB=C.PrivateKey.generate_ed25519();
const address=(key,network=1)=>C.BaseAddress.new(network,C.Credential.from_keyhash(key.to_public().hash()),C.Credential.from_keyhash(key.to_public().hash())).to_address();
const addr=address(keyA), otherPolicy=C.ScriptHash.from_hex('ab'.repeat(28)), otherAsset=C.AssetName.new(Buffer.from('KEEP'));
const live=()=>({epoch:653,slot:197151000,blockTime:Math.floor(Date.now()/1000)-15,fetchedAt:Date.now(),maxTx:16384,maxValue:5000,feeA:44,feeB:155381,coinsPerByte:'4310',keyDeposit:'2000000',poolDeposit:'500000000'});
function utxo(n,{coin=20000000,key=keyA,network=1,tokens=false,special=''}={}) {
  const value=C.Value.new(bn(coin));
  if(tokens){const ma=C.MultiAsset.new(),assets=C.Assets.new();assets.insert(otherAsset,bn(7));ma.insert(otherPolicy,assets);value.set_multiasset(ma);}
  const out=C.TransactionOutput.new(address(key,network),value);
  if(special==='datum')out.set_data_hash(C.DataHash.from_hex('cd'.repeat(32)));
  if(special==='inline')out.set_plutus_data(C.PlutusData.new_integer(C.BigInt.from_str('1')));
  if(special==='ref')out.set_script_ref(C.ScriptRef.new_native_script(C.NativeScript.new_script_pubkey(C.ScriptPubkey.new(keyA.to_public().hash()))));
  return C.TransactionUnspentOutput.new(C.TransactionInput.new(C.TransactionHash.from_hex(n.toString(16).padStart(64,'0')),n),out).to_hex();
}
const wallet={changeHex:addr.to_hex(),utxos:[utxo(1,{tokens:true})]};
function witnesses(packet,keys=[keyA]) {const set=C.TransactionWitnessSet.new(),v=C.Vkeywitnesses.new();for(const key of keys)v.add(C.make_vkey_witness(C.TransactionHash.from_hex(packet.transactionHash),key));set.set_vkeys(v);return set.to_hex();}
const result=raw=>{assert.equal(raw.isError,undefined,JSON.stringify(raw));return raw.structuredContent||JSON.parse(raw.content[0].text);};
const call=async(client,name,arguments_={})=>result(await client.callTool({name,arguments:arguments_}));
const rejected=async(client,name,arguments_)=>{let r;try{r=await client.callTool({name,arguments:arguments_});}catch{return;}assert.equal(r.isError,true,JSON.stringify(r));};
async function httpClient(service,era='auto',extra={}) {
  const http=createHttpService({port:0,token:TOKEN,service,...extra});
  const address=await http.listen(),url=new URL(`http://127.0.0.1:${address.port}/mcp`);
  const client=new Client({name:'nft-studio-integration',version:'1.0.0'},{versionNegotiation:{mode:era}});
  await client.connect(new StreamableHTTPClientTransport(url,{requestInit:{headers:{Authorization:`Bearer ${TOKEN}`}}}));
  return {client,http,url,async close(){await client.close();await http.close();}};
}

test('Modern and legacy official SDK clients discover tools and read fixed resources across repeated stateless HTTP calls',async()=>{
  for(const era of ['auto','legacy']) {
    const ctx=await httpClient(createService({protocol:live}),era);
    try{
      assert.equal(ctx.client.getProtocolEra(),era==='auto'?'modern':'legacy');
      const list=await ctx.client.listTools();assert.deepEqual(list.tools.map(t=>t.name).sort(),NODE_TOOL_NAMES);
      assert.ok(list.tools.every(tool=>!['sign_transaction','submit_transaction'].includes(tool.name)));
      const caps=await call(ctx.client,'studio_capabilities');assert.equal(caps.publicEndpoint,null);assert.equal(caps.policy.lifetimeSupplyCap,false);assert.equal(caps.formats.length,8);
      assert.equal((await call(ctx.client,'studio_capabilities')).knowledge.entries,caps.knowledge.entries);
      const resources=await ctx.client.listResources();assert.equal(resources.resources.length,caps.knowledge.entries+4);
      const implementations=await verifyImplementationResources(ctx.client,resources.resources);assert.equal(implementations.researchEntriesUnchanged,true);
      await assert.rejects(ctx.client.readResource({uri:'nft-studio://implementations/../../secret'}));
      const resource=await ctx.client.readResource({uri:'nft-studio://capabilities'});assert.equal(JSON.parse(resource.contents[0].text).serverVersion,'0.5.0');
      await assert.rejects(ctx.client.readResource({uri:'file:///etc/passwd'}));
      const search=await call(ctx.client,'search_knowledge',{query:'CIP-68',limit:3});assert.ok(search.results.length>0&&search.results.length<=3);
      await rejected(ctx.client,'read_knowledge',{id:'../../etc/passwd'});
      await rejected(ctx.client,'studio_capabilities',{ignored:'reject extra arguments'});
    }finally{await ctx.close();}
  }
});

test('Actual stdio child process supports both protocol eras with protocol-only stdout',async()=>{
  for(const era of ['auto','legacy']){
    const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../dist/cli.mjs',import.meta.url))],stderr:'pipe'});
    let errors='';transport.stderr?.on('data',chunk=>{errors+=chunk;});
    const client=new Client({name:'stdio-integration',version:'1.0.0'},{versionNegotiation:{mode:era}});
    try{await client.connect(transport);assert.equal(client.getProtocolEra(),era==='auto'?'modern':'legacy');assert.deepEqual((await client.listTools()).tools.map(t=>t.name).sort(),NODE_TOOL_NAMES);assert.equal((await call(client,'studio_capabilities')).serverVersion,'0.5.0');assert.equal(errors,'');}
    finally{await client.close();}
  }
});

test('Payload, ledger metadata and canonical browser intent validations reject malformed and hostile inputs',async()=>{
  const ctx=await httpClient(createService({protocol:live}));
  try {
    const packed=await call(ctx.client,'validate_payload',args);assert.equal(packed.bundle.files.length,3);assert.ok(packed.dataMeasurement.auxiliaryBytes>0);
    const bomText='\ufeff'+'Hello'.repeat(40);
    const bom=await call(ctx.client,'create_mint_intent',{mode:'data',name:'Lossless BOM',files:[file('bom.txt',bomText)]});
    const bomUri=bom.intent.bundle.files[0].uri;
    const recoveredBom=bomUri.includes(';base64,')?Buffer.from(bomUri.split(',')[1],'base64'):Buffer.from(decodeURIComponent(bomUri.slice(bomUri.indexOf(',')+1)));
    assert.deepEqual(recoveredBom,Buffer.from(bomText));
    assert.equal((await call(ctx.client,'verify_mint_intent',{intent:bom.intent})).intent.intentHash,bom.intent.intentHash);

    const first=await call(ctx.client,'create_mint_intent',{...args,mode:'nft'}), second=await call(ctx.client,'create_mint_intent',{...args,mode:'nft'});
    assert.equal(first.intent.intentHash,second.intent.intentHash);assert.equal(JSON.parse(first.packetJson).intentHash,first.intent.intentHash);assert.equal(first.review.baseUrl,'https://beacnpool.github.io/NFT-Studio/?view=labs&lab=agents');assert.equal(new URL(first.review.url).hash,'#mint=v1.'+Buffer.from(JSON.stringify(first.intent)).toString('base64url'));
    const reordered={intentHash:first.intent.intentHash,bundle:first.intent.bundle,mode:'nft',schema:'nft-studio.intent.v1'};
    assert.equal((await call(ctx.client,'verify_mint_intent',{intent:reordered})).intent.intentHash,first.intent.intentHash);
    for(const change of [{bundle:{...first.intent.bundle,name:'Tampered'}},{ignored:true},{intentHash:'0'.repeat(64)}]) await rejected(ctx.client,'verify_mint_intent',{intent:{...first.intent,...change}});
    for(const files of [[file('../secret.txt','x')],[file('CON.txt','x')],[file('x.txt','x'),file('X.txt','y')],[{...cover,mediaType:'image/png'}],[{...cover,base64:'https://example.org/'}],[{name:'x.txt',mediaType:'text/plain',base64:'/w=='}],[file('bad.json','{','application/json')],[{name:'x.txt',mediaType:'text/plain',base64:'Zh=='}],[file('large.bin','x'.repeat(12001),'application/octet-stream')]]) await rejected(ctx.client,'validate_payload',{name:'test',files});
    await rejected(ctx.client,'create_mint_intent',{mode:'nft',name:'Missing cover',files:[file('x.txt','x')]});
    await rejected(ctx.client,'validate_payload',{...args,path:'/etc/passwd'});
    await call(ctx.client,'validate_metadata',{metadata:{'721':{description:['🦾'.repeat(16),'safe'],count:1}}});
    for(const metadata of [{'1':{bad:true}},{'1':{bad:null}},{'1':{bad:0.5}},{'1':{bad:'🦾'.repeat(17)}},{'01':{}},{'18446744073709551616':{}},{'1':{bad:'\ud800'}}]) await rejected(ctx.client,'validate_metadata',{metadata});
    let deep='x';for(let i=0;i<18;i++)deep=[deep];await rejected(ctx.client,'validate_metadata',{metadata:{'1':deep}});
  }finally{await ctx.close();}
});

test('NFT/data unsigned CBOR and external signer roundtrip preserve all outputs, tokens, body, metadata and exact signed fees',async()=>{
  const ctx=await httpClient(createService({protocol:live}));
  try{
    for(const mode of ['nft','data']){
      const {intent}=await call(ctx.client,'create_mint_intent',{...args,mode});
      const packet=await call(ctx.client,'prepare_unsigned_transaction',{intent,wallet});
      assert.equal(packet.checks.signed,false);assert.equal(packet.checks.submitted,false);
      const unsigned=C.Transaction.from_hex(packet.unsignedHex),body=unsigned.body();
      assert.equal(packet.transactionHash,C.FixedTransaction.from_hex(packet.unsignedHex).transaction_hash().to_hex());
      assert.equal(!!body.mint(),mode==='nft');
      if(mode==='nft'){assert.equal(body.mint().get(C.ScriptHash.from_hex(packet.asset.policyId)).get(0).get(C.AssetName.new(Buffer.from(packet.asset.assetName))).to_str(),'1');assert.equal(unsigned.witness_set().native_scripts().len(),1);assert.equal(packet.asset.assetNameHex.length,64);}
      let coin=0n,old=0n;for(let i=0;i<body.outputs().len();i++){const out=body.outputs().get(i);assert.equal(out.address().to_hex(),wallet.changeHex);coin+=BigInt(out.amount().coin().to_str());old+=BigInt(out.amount().multiasset()?.get(otherPolicy)?.get(otherAsset)?.to_str()||0);}
      assert.equal(coin+BigInt(packet.fees.lovelace),20000000n);assert.equal(old,7n);
      const signed=await call(ctx.client,'verify_signed_transaction',{packetId:packet.packetId,witnessSetHex:witnesses(packet),wallet});
      const tx=C.Transaction.from_hex(signed.signedHex);assert.equal(tx.body().to_hex(),body.to_hex());assert.equal(tx.auxiliary_data().to_hex(),unsigned.auxiliary_data().to_hex());assert.equal(C.hash_auxiliary_data(tx.auxiliary_data()).to_hex(),tx.body().auxiliary_data_hash().to_hex());
      assert.equal(signed.transactionHash,packet.transactionHash);assert.equal(signed.signedBytes,packet.fees.estimatedSignedBytes);assert.equal(signed.submitted,false);assert.ok(BigInt(signed.feeLovelace)>=44n*BigInt(signed.signedBytes)+155381n);
      await rejected(ctx.client,'verify_signed_transaction',{packetId:packet.packetId,witnessSetHex:witnesses(packet,[keyB]),wallet});
      await rejected(ctx.client,'verify_signed_transaction',{packetId:packet.packetId,witnessSetHex:witnesses(packet,[keyA,keyB]),wallet});
      await rejected(ctx.client,'verify_signed_transaction',{packetId:packet.packetId,witnessSetHex:witnesses(packet),wallet:{...wallet,utxos:[utxo(1,{coin:21000000,tokens:true})]}});
      await rejected(ctx.client,'verify_signed_transaction',{packetId:packet.packetId,witnessSetHex:witnesses(packet),wallet:{...wallet,utxos:[utxo(2)]}});
    }
    const {intent}=await call(ctx.client,'create_mint_intent',{...args,mode:'nft'});
    const many={changeHex:wallet.changeHex,utxos:[utxo(3,{coin:1300000}),utxo(4,{coin:1300000,key:keyB})]};
    const packet=await call(ctx.client,'prepare_unsigned_transaction',{intent,wallet:many});assert.equal(packet.requiredPaymentKeyHashes.length,2);
    await rejected(ctx.client,'verify_signed_transaction',{packetId:packet.packetId,witnessSetHex:witnesses(packet),wallet:many});
    await call(ctx.client,'verify_signed_transaction',{packetId:packet.packetId,witnessSetHex:witnesses(packet,[keyA,keyB]),wallet:many});
  }finally{await ctx.close();}
});

test('Preparations reject unsafe wallet inputs, wrong network, malformed CBOR, tampering, stale network and expired packet state',async()=>{
  const service=createService({protocol:live}),ctx=await httpClient(service);
  try {
    const {intent}=await call(ctx.client,'create_mint_intent',{...args,mode:'nft'});
    for(const w of [{changeHex:address(keyA,0).to_hex(),utxos:[utxo(1,{network:0})]},{...wallet,utxos:[utxo(1,{special:'datum'})]},{...wallet,utxos:[utxo(1,{special:'inline'})]},{...wallet,utxos:[utxo(1,{special:'ref'})]},{...wallet,utxos:[wallet.utxos[0],wallet.utxos[0]]},{...wallet,utxos:['00']},{...wallet,utxos:[]}]) await rejected(ctx.client,'prepare_unsigned_transaction',{intent,wallet:w});
    await rejected(ctx.client,'prepare_unsigned_transaction',{intent:{...intent,mode:'data'},wallet});
    const over=await call(ctx.client,'create_mint_intent',{mode:'data',name:'Too much auxiliary data',files:[file('large.bin','x'.repeat(12000),'application/octet-stream')]});
    await rejected(ctx.client,'prepare_unsigned_transaction',{intent:over.intent,wallet});
    const packet=await call(ctx.client,'prepare_unsigned_transaction',{intent,wallet});
    const original=Date.now;try{Date.now=()=>original()+241000;assert.equal(service.packetCount(),0);}finally{Date.now=original;}
    await rejected(ctx.client,'verify_signed_transaction',{packetId:packet.packetId,witnessSetHex:witnesses(packet),wallet});
  }finally{await ctx.close();}
  const stale=await httpClient(createService({protocol:async()=>({...live(),fetchedAt:Date.now()-121000})}));
  try{const {intent}=await call(stale.client,'create_mint_intent',{...args,mode:'nft'});await rejected(stale.client,'prepare_unsigned_transaction',{intent,wallet});}finally{await stale.close();}
});

test('Node parser boundaries reject hostile UTxO and witness CBOR before CSL, then valid preparation and signatures still work',async()=>{
  let reads=0;const ctx=await httpClient(createService({protocol:()=>{reads++;return live();}}));
  try{
    const {intent}=await call(ctx.client,'create_mint_intent',{...args,mode:'nft'});
    const bad=['c0'.repeat(17)+'00','9bffffffffffffffff','5a7fffffff','ff',wallet.utxos[0]+'00'];
    for(const hex of bad){
      const result=await ctx.client.callTool({name:'prepare_unsigned_transaction',arguments:{intent,wallet:{...wallet,utxos:[hex]}}});
      assert.equal(result.isError,true);assert.match(result.content[0].text,/CBOR/);
    }
    assert.equal(reads,0,'Hostile CBOR never reaches the protocol provider or CSL builder.');
    const packet=await call(ctx.client,'prepare_unsigned_transaction',{intent,wallet}),initialReads=reads;
    for(const witnessSetHex of bad){
      const result=await ctx.client.callTool({name:'verify_signed_transaction',arguments:{packetId:packet.packetId,witnessSetHex,wallet}});
      assert.equal(result.isError,true);assert.match(result.content[0].text,/CBOR/);
    }
    assert.equal(reads,initialReads);
    assert.equal((await call(ctx.client,'verify_signed_transaction',{packetId:packet.packetId,witnessSetHex:witnesses(packet),wallet})).submitted,false);
  }finally{await ctx.close();}
});

test('HTTP authentication, DNS rebinding, exact origins, content/body bounds and rate limits fail closed',async()=>{
  assert.throws(()=>validateHttpOptions({token:TOKEN,host:'0.0.0.0'}));assert.throws(()=>validateHttpOptions({token:'short'}));assert.throws(()=>validateHttpOptions({token:TOKEN,allowedOrigins:['https://example.org/path']}));
  const http=createHttpService({port:0,token:TOKEN,allowedOrigins:['https://example.org'],service:createService({protocol:live})});const at=await http.listen(),url=`http://127.0.0.1:${at.port}/mcp`;
  const headers={authorization:`Bearer ${TOKEN}`,'content-type':'application/json',accept:'application/json, text/event-stream'};
  const req=(extra={},body='{}',method='POST')=>fetch(url,{method,headers:{...headers,...extra},...(method==='GET'?{}:{body})});
  try{
    assert.equal((await req({authorization:'Bearer wrong'})).status,401);
    const badHost=await new Promise((resolve,reject)=>{const r=nodeRequest(url,{method:'POST',headers:{...headers,host:'attacker.example'}},s=>{s.resume();resolve(s.statusCode);});r.on('error',reject);r.end('{}');});assert.equal(badHost,403);
    for(const origin of ['null','https://example.org.evil','http://example.org','https://example.org:444'])assert.equal((await req({origin})).status,403);
    assert.equal((await req({'content-type':'text/plain'})).status,415);
    assert.equal((await req({'content-encoding':'gzip'})).status,415);
    assert.equal((await req({},'{bad')).status,400);
    assert.equal((await req({},Buffer.from([255]))).status,400);
    assert.equal((await req({},'[]')).status,400);
    assert.equal((await req({},'x'.repeat(524289))).status,413);
    assert.equal((await req({},undefined,'GET')).status,405);
    const preflight=await req({authorization:'',origin:'https://example.org','access-control-request-method':'POST'},'', 'OPTIONS');assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://example.org');for(const header of ['mcp-method','mcp-name','mcp-protocol-version'])assert.ok(preflight.headers.get('access-control-allow-headers').toLowerCase().includes(header));
  }finally{await http.close();}
  const low=createHttpService({port:0,token:TOKEN,rateLimit:1,service:createService({protocol:live})});const port=(await low.listen()).port;
  try{await fetch(`http://127.0.0.1:${port}/mcp`);const blocked=await fetch(`http://127.0.0.1:${port}/mcp`);assert.equal(blocked.status,429);assert.equal(blocked.headers.get('retry-after'),'60');}finally{await low.close();}
});

test('Stdio transport terminates an oversized message without executing or writing payload contents to stdout/stderr',async()=>{
  const child=spawn(process.execPath,[fileURLToPath(new URL('../dist/cli.mjs',import.meta.url))],{stdio:['pipe','pipe','pipe']});let output='',errors='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>errors+=b);child.stdin.on('error',()=>{});
  const closed=new Promise(resolve=>child.once('exit',resolve));child.stdin.end(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'validate_payload',arguments:{privateMarker:'NEVER_LOG_THIS',oversized:'x'.repeat(524288)}}})+'\n');
  const timer=setTimeout(()=>child.kill('SIGTERM'),5000);await closed;clearTimeout(timer);assert.ok(!output.includes('NEVER_LOG_THIS'));assert.ok(!errors.includes('NEVER_LOG_THIS'));
});


test('Concurrent transaction preparation is bounded before upstream requests and releases slots after completion',async()=>{
  let release;const held=new Promise(resolve=>{release=resolve;});let started=0;
  const ctx=await httpClient(createService({protocol:async()=>{started++;await held;return live();}}));
  try{
    const {intent}=await call(ctx.client,'create_mint_intent',{...args,mode:'nft'});
    const a=call(ctx.client,'prepare_unsigned_transaction',{intent,wallet});
    const b=call(ctx.client,'prepare_unsigned_transaction',{intent,wallet});
    for(let i=0;started<2&&i<100;i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(started,2);
    await rejected(ctx.client,'prepare_unsigned_transaction',{intent,wallet});assert.equal(started,2);
    release();await Promise.all([a,b]);
    await call(ctx.client,'prepare_unsigned_transaction',{intent,wallet});assert.equal(started,3);
  }finally{release();await ctx.close();}
});

test('Proof tools expose exact Proposed CIP-190 raw-byte CBOR with privacy boundaries and fail closed on unsupported records',async()=>{
  const ctx=await httpClient(createService({protocol:()=>{throw new Error('Proof tools must not read network parameters.');}}));
  const proofFile=text=>({name:'private-display-name.txt',base64:Buffer.from(text).toString('base64')});
  try{
    const created=await call(ctx.client,'create_proof_record',{files:[proofFile('Exact proof bytes')]});
    assert.equal(created.processing.inputBytesReceivedByThisServer,true);assert.equal(created.processing.networkRequestsByTool,false);
    const artifact=created.artifact;assert.equal(artifact.specification.status,'Proposed');assert.ok(!Buffer.from(artifact.recordCborHex,'hex').includes(Buffer.from('private-display-name.txt')));
    const metadata=C.GeneralTransactionMetadata.from_bytes(Buffer.from(artifact.metadataCborHex,'hex'));
    const chunks=metadata.get(C.BigNum.from_str('309')).as_list();let record='';
    for(let n=0;n<chunks.len();n++){const bytes=chunks.get(n).as_bytes();assert.ok(bytes.length<=64);record+=Buffer.from(bytes).toString('hex');}
    assert.equal(record,artifact.recordCborHex);
    const verified=await call(ctx.client,'verify_proof_record',{recordCborHex:record,file:proofFile('Exact proof bytes')});
    assert.equal(verified.verification.status,'match');assert.equal(verified.chainInclusionChecked,false);assert.equal(verified.authorshipChecked,false);
    assert.equal((await call(ctx.client,'verify_proof_record',{recordCborHex:record,file:proofFile('Changed proof bytes')})).verification.status,'mismatch');
    const oneChanged=record.replace(artifact.files[0].hashes['blake2b-256'],'00'.repeat(32));
    assert.equal((await call(ctx.client,'verify_proof_record',{recordCborHex:oneChanged,file:proofFile('Exact proof bytes')})).verification.status,'mismatch');
    const unsupported='a3617601647369677380'+record.slice('a2617601'.length);
    assert.equal((await call(ctx.client,'verify_proof_record',{recordCborHex:unsupported,file:proofFile('Exact proof bytes')})).verification.status,'unsupported-profile');
    assert.equal((await call(ctx.client,'verify_proof_record',{recordCborHex:'a0',file:proofFile('Exact proof bytes')})).verification.status,'invalid-record');
    const empty=await call(ctx.client,'create_proof_record',{files:[proofFile('')],algorithms:['sha2-256']});assert.equal(empty.artifact.files[0].hashes['sha2-256'],'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    for(const base64 of ['AB==','https://example.org/file','data:;base64,YQ==','YQ'])await rejected(ctx.client,'create_proof_record',{files:[{name:'bad',base64}]});
    await rejected(ctx.client,'create_proof_record',{files:[{...proofFile('x'),name:'../../secret'}]});
    await rejected(ctx.client,'create_proof_record',{files:[proofFile('x')],path:'/etc/passwd'});
    await rejected(ctx.client,'create_proof_record',{files:[proofFile('x')],algorithms:['sha2-256','sha2-256']});
    await rejected(ctx.client,'create_proof_record',{files:[proofFile('x'.repeat(49152)),proofFile('x')]});
    await rejected(ctx.client,'verify_proof_record',{recordCborHex:'a1'.repeat(16384),file:proofFile('x'.repeat(49152))});
  }finally{await ctx.close();}
});
