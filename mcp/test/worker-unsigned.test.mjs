import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {createUnsignedPreparer} from '../dist/public-unsigned.mjs';
import {createPublicMcpHandler} from './workerd-helper.mjs';
import {address,utxo,payload} from './wallet-fixtures.mjs';
const origin='https://candidate.example.org',config={publicOrigin:origin,endpointPath:'/api/mcp'};
const unpack=raw=>{assert.equal(raw.isError,undefined,raw.content?.[0]?.text);return raw.structuredContent||JSON.parse(raw.content[0].text);};
const parity=value=>{const copy=structuredClone(value);delete copy.preparedAt;delete copy.protocol.fetchedAt;return copy;};
async function connect(mode='auto'){
  const handler=await createPublicMcpHandler(config),client=new Client({name:'workerd-native-integration',version:'1.0.0'},{versionNegotiation:{mode}});
  await client.connect(new StreamableHTTPClientTransport(new URL(origin+'/api/mcp'),{fetch:(url,init)=>handler.dispatchFetch(url,init)}));
  return {handler,client,close:async()=>{await client.close();await handler.close();}};
}
const call=(client,name,args={})=>client.callTool({name,arguments:args});
const mintRequest=async(client,mode='nft')=>({intent:unpack(await call(client,'create_mint_intent',{...payload,mode})).intent,wallet:{changeHex:address().to_hex(),utxos:[utxo(1,{tokens:3})]}});
function fixedReads(calls){assert.ok(calls.every(item=>item.method==='GET'&&item.authorization===null&&item.body===''&&['https://koios.beacn.workers.dev/api/v1/tip','https://koios.beacn.workers.dev/api/v1/epoch_params?order=epoch_no.desc&limit=1'].includes(item.url)));}
async function reject(client,name,value,pattern){
  const raw=await call(client,'prepare_unsigned_transaction',value);
  assert.equal(raw.isError,true,name);const text=raw.content.map(item=>item.text||'').join(' ');
  if(pattern)assert.match(text,pattern,name);
  return text;
}

test('Modern and legacy SDKs prepare real stateless native NFT/data CBOR in Workerd with exact Node parity',async()=>{
  for(const mode of ['auto','legacy']){
    const ctx=await connect(mode);
    try{
      const tools=(await ctx.client.listTools()).tools;assert.equal(tools.length,9);
      const added=tools.find(item=>item.name==='prepare_unsigned_transaction');assert.deepEqual(added.annotations,{readOnlyHint:true,destructiveHint:false,idempotentHint:false,openWorldHint:true});
      assert.ok(!tools.some(item=>['sign_transaction','submit_transaction','verify_signed_transaction'].includes(item.name)));
      const caps=unpack(await call(ctx.client,'studio_capabilities'));assert.equal(caps.unsignedPreparation.chainUnspentVerified,false);assert.equal(caps.unsignedPreparation.serverState,'none');assert.match(caps.privacy,/wallet addresses and UTxO CBOR/);
      const first=await mintRequest(ctx.client),data=await mintRequest(ctx.client,'data');
      assert.equal(ctx.handler.calls.length,0);
      const requests=[first,data,{...first,wallet:{changeHex:address().to_hex(),utxos:[utxo(2,{coin:1500000}),utxo(3,{coin:1500000,key:'cd'})]}}];
      const node=createUnsignedPreparer(C,{protocolProvider:async()=>structuredClone(ctx.handler.quote)});
      for(const request of requests){
        const expected=await node(request),actual=unpack(await call(ctx.client,'prepare_unsigned_transaction',request));
        assert.deepEqual(parity(actual),parity(expected));assert.equal(actual.signed,false);assert.equal(actual.submitted,false);assert.equal(Object.hasOwn(actual,'packetId'),false);
        assert.match(actual.checks.walletInputs,/caller assertions/);assert.match(actual.checks.signedSize,/estimate/);
        const tx=C.Transaction.from_hex(actual.unsignedHex);assert.equal(tx.witness_set().vkeys(),undefined);
        assert.equal(C.FixedTransaction.from_hex(actual.unsignedHex).transaction_hash().to_hex(),actual.transactionHash);
        if(request===requests[2])assert.equal(actual.requiredPaymentKeyHashes.length,2);
      }
      assert.equal(ctx.handler.calls.length,6);fixedReads(ctx.handler.calls);
      // Existing proof and intent tools still perform no public fetch after the new tool is used.
      const proof=unpack(await call(ctx.client,'create_proof_record',{files:[{name:'empty',base64:''}]}));
      const verified=unpack(await call(ctx.client,'verify_proof_record',{recordCborHex:proof.artifact.recordCborHex,file:{name:'empty',base64:''}}));
      assert.equal(verified.verification.status,'match');assert.equal(verified.chainInclusionChecked,false);assert.equal(ctx.handler.calls.length,6);
    }finally{await ctx.close();}
  }
});

test('Public SDK rejects schema overrides, unsafe inputs and hostile CBOR before any protocol lookup',async()=>{
  const ctx=await connect();
  try{
    const standard=await mintRequest(ctx.client);
    for(const [name,extra] of [['protocol-override',{protocol:ctx.handler.quote}],['destination-override',{destination:address('cd').to_hex()}],['URL-override',{url:'https://attacker.invalid/'}],['blueprint-override',{blueprint:{}}]])await reject(ctx.client,name,{...standard,...extra});
    await reject(ctx.client,'unknown-wallet-field',{...standard,wallet:{...standard.wallet,path:'/tmp/input'}});
    await reject(ctx.client,'tampered-intent',{...standard,intent:{...standard.intent,intentHash:'0'.repeat(64)}},/hash/);
    await reject(ctx.client,'empty-inputs',{...standard,wallet:{...standard.wallet,utxos:[]}});
    await reject(ctx.client,'too-many-inputs',{...standard,wallet:{...standard.wallet,utxos:Array.from({length:33},(_,i)=>utxo(100+i))}});
    await reject(ctx.client,'testnet-change',{...standard,wallet:{...standard.wallet,changeHex:address('ab',0).to_hex()}},/mainnet key/);
    await reject(ctx.client,'script-change',{...standard,wallet:{...standard.wallet,changeHex:address('ab',1,true).to_hex()}},/mainnet key/);
    await reject(ctx.client,'malformed-change',{...standard,wallet:{...standard.wallet,changeHex:'zz'}});
    for(const [name,options] of [['testnet-input',{network:0}],['script-input',{script:true}],['datum-hash-input',{special:'datum'}],['inline-datum-input',{special:'inline'}],['reference-script-input',{special:'reference'}]])await reject(ctx.client,name,{...standard,wallet:{...standard.wallet,utxos:[utxo(4,options)]}},/Only mainnet key outputs/);
    await reject(ctx.client,'duplicate-reference',{...standard,wallet:{...standard.wallet,utxos:[utxo(7),utxo(7,{coin:21000000})]}},/Duplicate/);
    const compact=utxo(8);
    await reject(ctx.client,'noncanonical-CBOR',{...standard,wallet:{...standard.wallet,utxos:['9802'+compact.slice(2)]}},/canonical/);
    for(const [name,bad] of [['CBOR-huge-declared-array','9bffffffffffffffff'],['CBOR-truncated-string','5a7fffffff'],['CBOR-deep-tags','c0'.repeat(20)+'00'],['CBOR-trailing-data',compact+'00'],['CBOR-unexpected-break','ff'],['CBOR-wrong-type','00']])await reject(ctx.client,name,{...standard,wallet:{...standard.wallet,utxos:[bad]}});
    await reject(ctx.client,'oversized-one-UTxO',{...standard,wallet:{...standard.wallet,utxos:['00'.repeat(16385)]}});
    await reject(ctx.client,'argument-byte-limit',{...standard,wallet:{...standard.wallet,utxos:Array(3).fill('00'.repeat(15300))}},/88 KiB/);
    await reject(ctx.client,'aggregate-wallet-bytes',{...standard,wallet:{...standard.wallet,utxos:Array.from({length:4},(_,i)=>utxo(30+i,{tokens:1,policies:127,assetBytes:32}))}},/32 KiB/);
    await reject(ctx.client,'too-many-native-assets',{...standard,wallet:{...standard.wallet,utxos:[utxo(50,{tokens:513})]}},/512/);
    assert.equal(ctx.handler.calls.length,0,'No malformed request may trigger network access');
    await reject(ctx.client,'insufficient-ADA',{...standard,wallet:{...standard.wallet,utxos:[utxo(60,{coin:500000})]}},/fund|ADA|change/i);
    fixedReads(ctx.handler.calls);
  }finally{await ctx.close();}
});

test('Fixed public feed rejects stale/invalid/oversized/redirected/malformed results; no snapshot leaves in a request',async()=>{
  const ctx=await connect();
  try{
    const standard=await mintRequest(ctx.client);
    for(const [scenario,pattern] of [['stale',/stale/i],['epoch',/parameters are changing/],['invalid-parameter',/parameter/i],['low-max-tx',/limit|size/i],['high-fee',/2 ADA/],['unavailable',/unavailable/],['redirect',undefined],['oversize',/bound/],['declared-oversize',/bound/],['invalid-utf8',undefined],['malformed',/Malformed/]]){
      ctx.handler.setScenario(scenario);await reject(ctx.client,scenario,standard,pattern);
    }
    fixedReads(ctx.handler.calls);
    ctx.handler.setScenario('normal');assert.equal(unpack(await call(ctx.client,'prepare_unsigned_transaction',standard)).submitted,false);
  }finally{await ctx.close();}
});

test('Provider timeout and two-preparation concurrency are bounded across stateless SDK requests and recover',async()=>{
  const ctx=await connect();
  try{
    const standard=await mintRequest(ctx.client);ctx.handler.setScenario('delay');
    const before=ctx.handler.calls.length;
    const pending=await Promise.all([call(ctx.client,'prepare_unsigned_transaction',standard),call(ctx.client,'prepare_unsigned_transaction',standard),call(ctx.client,'prepare_unsigned_transaction',standard)]);
    assert.equal(pending.filter(item=>!item.isError).length,2);assert.equal(pending.filter(item=>item.isError&&/concurrency/.test(item.content[0].text)).length,1);
    assert.equal(ctx.handler.calls.length-before,4);
    ctx.handler.setScenario('timeout');const start=Date.now();await reject(ctx.client,'timeout',standard,/timed out|timeout|aborted/i);assert.ok(Date.now()-start<15000);
    ctx.handler.setScenario('normal');unpack(await call(ctx.client,'prepare_unsigned_transaction',standard));
    fixedReads(ctx.handler.calls);
  }finally{await ctx.close();}
});
