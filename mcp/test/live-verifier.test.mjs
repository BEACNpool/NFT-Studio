import test from 'node:test';
import {readFile} from 'node:fs/promises';
const resourceCount=JSON.parse(await readFile(new URL('../../knowledge/catalog.json',import.meta.url),'utf8')).entries.length+3;
import assert from 'node:assert/strict';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {verifyLiveEndpoint,parseLiveOptions} from '../integration/verify-live-endpoint.mjs';
import {syntheticNativeFixture,assertSyntheticIntent,assertSyntheticUnsigned} from '../integration/verify-synthetic-native.mjs';
import {createPublicMcpHandler} from './workerd-helper.mjs';
const origin='https://release-verifier.example.org',endpoint=new URL(origin+'/api/mcp');
const checked=r=>{assert.ok(!r.isError,r.content?.[0]?.text);return r.structuredContent||JSON.parse(r.content[0].text);};

test('Explicit eight/nine/ten/twelve/thirteen parser preserves default and rejects ambiguous/unsafe options',()=>{
  assert.equal(parseLiveOptions([endpoint.href]).expectedTools,8);assert.equal(parseLiveOptions([endpoint.href]).expectedResources,55);
  assert.equal(parseLiveOptions([endpoint.href,'--expected-resources','56']).expectedResources,56);assert.equal(parseLiveOptions([endpoint.href,'--expected-resources','61']).expectedResources,61);
  for(const value of ['54','57','0',''])assert.throws(()=>parseLiveOptions([endpoint.href,'--expected-resources',value]));
  assert.throws(()=>parseLiveOptions([endpoint.href,'--expected-resources','55','--expected-resources','56']));
  assert.equal(parseLiveOptions(['--expected-tools','9',endpoint.href]).expectedTools,9);assert.equal(parseLiveOptions(['--expected-tools','10',endpoint.href]).expectedTools,10);assert.equal(parseLiveOptions(['--expected-tools','12',endpoint.href]).expectedTools,12);assert.equal(parseLiveOptions(['--expected-tools','13',endpoint.href]).expectedTools,13);assert.equal(parseLiveOptions(['--expected-tools','15',endpoint.href]).expectedTools,15);
  for(const args of [[endpoint.href,'--expected-tools','11'],[endpoint.href,'--expected-tools','9','--expected-tools','8'],[endpoint.href,'--unknown','9'],[endpoint.href,endpoint.href],['http://release-verifier.example.org/api/mcp'],[endpoint.href+'?wallet=x'],['https://u:p@release-verifier.example.org/api/mcp'],[]])assert.throws(()=>parseLiveOptions(args));
});

test('Fifteen-tool release verifier passes modern/legacy real Workerd with only local synthetic reads',async()=>{
  const handler=await createPublicMcpHandler({publicOrigin:origin,endpointPath:'/api/mcp'});
  try{
    const result=await verifyLiveEndpoint({endpoint,expectedTools:15,expectedResources:resourceCount,fetchImpl:(url,init)=>handler.dispatchFetch(url,init)});
    assert.equal(result.status,'pass');assert.ok(result.checks.every(c=>c.sourceCorpus?.independentChunkChecks===2));assert.ok(result.checks.every(c=>c.unsignedMusic.exactFilesAndCredits&&c.unsignedMusic.valueConservation&&!c.unsignedMusic.chainStateVerified));assert.ok(result.checks.every(c=>c.musicPackages.canonicalRoundtrip&&c.musicPackages.packageOnly));assert.ok(result.checks.every(c=>c.capsuleParameters.fixtures===5&&c.capsuleParameters.parameterizedOnly));assert.equal(result.expectedResources,resourceCount);assert.ok(result.checks.every(c=>c.implementations.registerJsonValidated&&c.implementations.researchEntriesUnchanged));assert.equal(result.syntheticWalletDataSent,true);assert.equal(result.walletAccess,false);assert.equal(result.chainSubmission,false);
    assert.deepEqual(result.checks.map(c=>c.protocolEra),['modern','legacy']);
    assert.ok(result.checks.every(c=>c.unsigned.length===2&&c.unsigned.every(u=>u.bodyHashVerified&&u.valueConservation&&u.localBundleBytesMatch&&!u.chainStateVerified)));
    assert.equal(handler.calls.length,12);assert.ok(handler.calls.every(c=>c.method==='GET'&&c.body===''&&c.authorization===null));
  }finally{await handler.close();}
});

async function eightFixture({missingCors=false,hideUnsigned=true,keepCapsule=false,keepMusic=false,keepImplementations=false,keepUnsignedMusic=false}={}){
  const handler=await createPublicMcpHandler({publicOrigin:origin,endpointPath:'/api/mcp'});
  const fetchImpl=async(url,init)=>{
    const request=init.body?JSON.parse(init.body):null;
    if(!keepCapsule)assert.notEqual(request?.params?.name,'apply_state_capsule_parameters','Older tool mode must not call the new capsule tool.');
    if(!keepUnsignedMusic)assert.notEqual(request?.params?.name,'prepare_unsigned_music_transaction','Older release modes must not prepare a music transaction.');
    for(const name of (keepMusic?[]:['create_music_release','verify_music_release']))assert.notEqual(request?.params?.name,name,'Older tool mode must not call music tools.');
    if(hideUnsigned)assert.notEqual(request?.params?.name,'prepare_unsigned_transaction','Default tool mode must never send a wallet snapshot.');
    if(!keepImplementations)assert.notEqual(request?.params?.uri,'nft-studio://implementations','Default resource mode must not read the new implementation register.');
    const response=await handler.dispatchFetch(url,init);
    if(init.method==='OPTIONS'&&missingCors){const headers=new Headers(response.headers);headers.set('access-control-allow-headers','Content-Type, MCP-Protocol-Version');return new Response(null,{status:204,headers});}
    if(!['tools/list','resources/list'].includes(request?.method))return response;
    const replace=text=>{const body=JSON.parse(text);if(request.method==='tools/list'){assert.ok(Array.isArray(body.result.tools));body.result.tools=body.result.tools.filter(t=>!['search_cip_sources','get_cip_source_chunk',...(!keepUnsignedMusic?['prepare_unsigned_music_transaction']:[])].includes(t.name));if(!keepMusic)body.result.tools=body.result.tools.filter(t=>!['create_music_release','verify_music_release'].includes(t.name));if(!keepCapsule)body.result.tools=body.result.tools.filter(t=>t.name!=='apply_state_capsule_parameters');if(hideUnsigned)body.result.tools=body.result.tools.filter(t=>t.name!=='prepare_unsigned_transaction');}else{assert.ok(Array.isArray(body.result.resources));if(!keepImplementations)body.result.resources=body.result.resources.filter(r=>r.uri!=='nft-studio://implementations').slice(0,55);}return JSON.stringify(body);};
    const text=await response.text(),headers=new Headers(response.headers);headers.delete('content-length');
    const body=headers.get('content-type')?.includes('text/event-stream')?text.split('\n').map(line=>line.startsWith('data: ')?'data: '+replace(line.slice(6)):line).join('\n'):replace(text);
    return new Response(body,{status:response.status,headers});
  };
  return {handler,fetchImpl};
}
test('Default eight-tool compatibility path sends no wallet snapshot and enforces modern browser preflight headers',async()=>{
  const ctx=await eightFixture();try{const result=await verifyLiveEndpoint({endpoint,fetchImpl:ctx.fetchImpl});assert.equal(result.expectedTools,8);assert.equal(result.expectedResources,55);assert.equal(result.syntheticWalletDataSent,false);assert.equal(ctx.handler.calls.length,0);}finally{await ctx.handler.close();}
  const bad=await eightFixture({missingCors:true});try{await assert.rejects(verifyLiveEndpoint({endpoint,fetchImpl:bad.fetchImpl}),/Missing browser SDK preflight header: mcp-method/);}finally{await bad.handler.close();}
});

test('Nine tools can still explicitly verify the current 55-resource release without reading the next resource',async()=>{
  const ctx=await eightFixture({hideUnsigned:false});try{const result=await verifyLiveEndpoint({endpoint,expectedTools:9,expectedResources:55,fetchImpl:ctx.fetchImpl});assert.equal(result.expectedResources,55);assert.ok(result.checks.every(c=>!c.implementations&&c.unsigned.length===2));assert.equal(ctx.handler.calls.length,8);}finally{await ctx.handler.close();}
});

test('Ten-tool compatibility explicitly retains capsules without sending music files',async()=>{
  const ctx=await eightFixture({hideUnsigned:false,keepCapsule:true});try{const result=await verifyLiveEndpoint({endpoint,expectedTools:10,expectedResources:55,fetchImpl:ctx.fetchImpl});assert.equal(result.expectedTools,10);assert.ok(result.checks.every(c=>c.capsuleParameters&&!c.musicPackages));assert.equal(ctx.handler.calls.length,8);}finally{await ctx.handler.close();}
});

test('Twelve-tool compatibility keeps music packages without sending a music wallet snapshot',async()=>{
  const ctx=await eightFixture({hideUnsigned:false,keepCapsule:true,keepMusic:true,keepImplementations:true});
  try{const result=await verifyLiveEndpoint({endpoint,expectedTools:12,expectedResources:resourceCount,fetchImpl:ctx.fetchImpl});assert.equal(result.expectedTools,12);assert.ok(result.checks.every(c=>c.musicPackages&&!c.unsignedMusic&&c.implementations));assert.equal(ctx.handler.calls.length,8);}finally{await ctx.handler.close();}
});

function altered(packet,{feeDelta=0,assetDelta=0,metadata=false,signer=false}={}){
  const tx=C.Transaction.from_hex(packet.unsignedHex),original=tx.body(),outputs=C.TransactionOutputs.new();
  for(let i=0;i<original.outputs().len();i++){
    const output=original.outputs().get(i),amount=output.amount(),ma=amount.multiasset();
    if(assetDelta&&ma?.get(C.ScriptHash.from_hex('cd'.repeat(28)))){
      const policy=C.ScriptHash.from_hex('cd'.repeat(28)),assets=ma.get(policy),name=C.AssetName.new(Buffer.from('KEEP'));
      assets.insert(name,C.BigNum.from_str(String(BigInt(assets.get(name).to_str())+BigInt(assetDelta))));ma.insert(policy,assets);amount.set_multiasset(ma);
    }
    outputs.add(C.TransactionOutput.new(output.address(),amount));
  }
  const body=C.TransactionBody.new_tx_body(original.inputs(),outputs,C.BigNum.from_str(String(BigInt(original.fee().to_str())+BigInt(feeDelta))));
  body.set_ttl(original.ttl_bignum());if(original.mint())body.set_mint(original.mint());
  let aux=tx.auxiliary_data();
  if(metadata){const general=C.GeneralTransactionMetadata.new();general.insert(C.BigNum.from_str('1'),C.TransactionMetadatum.new_text('Unexpected metadata'));aux=C.AuxiliaryData.new();aux.set_metadata(general);}
  body.set_auxiliary_data_hash(C.hash_auxiliary_data(aux));
  if(signer){const keys=C.Ed25519KeyHashes.new();keys.add(C.Ed25519KeyHash.from_hex('ee'.repeat(28)));body.set_required_signers(keys);}
  const unsigned=C.Transaction.new(body,tx.witness_set(),aux),copy=structuredClone(packet);copy.unsignedHex=unsigned.to_hex();copy.unsignedBytes=copy.unsignedHex.length/2;copy.bodyHex=body.to_hex();copy.transactionHash=C.FixedTransaction.from_hex(copy.unsignedHex).transaction_hash().to_hex();copy.feeLovelace=body.fee().to_str();copy.auxiliaryDataHash=body.auxiliary_data_hash().to_hex();
  for(let i=0;i<outputs.len();i++){const out=outputs.get(i);copy.outputs[i].valueCborHex=out.amount().to_hex();copy.outputs[i].lovelace=out.amount().coin().to_str();copy.outputs[i].minimumLovelace=C.min_ada_for_output(out,C.DataCost.new_coins_per_byte(C.BigNum.from_str(packet.protocol.coinsPerByte))).to_str();}
  return copy;
}
test('Independent native verifier rejects changed byte identity, recomputed-body fee/asset theft, metadata and signer changes',async()=>{
  const handler=await createPublicMcpHandler({publicOrigin:origin,endpointPath:'/api/mcp'}),client=new Client({name:'synthetic-checker-negative',version:'1.0.0'});
  try{
    await client.connect(new StreamableHTTPClientTransport(endpoint,{fetch:(url,init)=>handler.dispatchFetch(url,init)}));
    for(const mode of ['nft','data']){
      const fixture=syntheticNativeFixture(mode),intent=checked(await client.callTool({name:'create_mint_intent',arguments:fixture.args})).intent;
      const packet=checked(await client.callTool({name:'prepare_unsigned_transaction',arguments:{intent,wallet:fixture.wallet}}));
      assertSyntheticUnsigned(packet,intent,fixture);
      assert.throws(()=>assertSyntheticIntent({...intent,bundle:{...intent.bundle,name:'Other bytes'}},fixture.args));
      assert.throws(()=>assertSyntheticUnsigned({...packet,transactionHash:'00'.repeat(32)},intent,fixture),/Independent transaction body hash/);
      assert.throws(()=>assertSyntheticUnsigned(altered(packet,{feeDelta:1}),intent,fixture),/Preserve every/);
      assert.throws(()=>assertSyntheticUnsigned(altered(packet,{assetDelta:-1}),intent,fixture),/Preserve every/);
      assert.throws(()=>assertSyntheticUnsigned(altered(packet,{metadata:true}),intent,fixture),/Ledger metadata/);
      assert.throws(()=>assertSyntheticUnsigned(altered(packet,{signer:true}),intent,fixture),/Unexpected transaction action/);
      assert.throws(()=>assertSyntheticUnsigned({...packet,unsignedHex:'c0'.repeat(17)+'00'},intent,fixture),/CBOR/);
    }
  }finally{await client.close();await handler.close();}
});

test('Thirteen-tool compatibility retains exact unsigned music without corpus tool calls',async()=>{
 const ctx=await eightFixture({hideUnsigned:false,keepCapsule:true,keepMusic:true,keepImplementations:true,keepUnsignedMusic:true});
 try{const result=await verifyLiveEndpoint({endpoint,expectedTools:13,expectedResources:resourceCount,fetchImpl:ctx.fetchImpl});assert.ok(result.checks.every(c=>c.unsignedMusic.exactFilesAndCredits&&!c.sourceCorpus));assert.equal(ctx.handler.calls.length,12);}finally{await ctx.handler.close();}
});
