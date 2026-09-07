import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=process.argv[2],kit=resolve(import.meta.dirname,'..');if(!root)throw Error('Pass trusted Studio checkout.');
const require=createRequire(resolve(root,'mcp/package.json'));
const {Client}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/client')).href),{StdioClientTransport}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/client/stdio')).href),C=await import(pathToFileURL(require.resolve('@emurgo/cardano-serialization-lib-nodejs')).href);
const sha=b=>createHash('sha256').update(b).digest('hex'),bn=n=>C.BigNum.from_str(String(n));
const log=[];const client=new Client({name:'labor-day-unminted-assets',version:'1.0.0'}),transport=new StdioClientTransport({command:process.execPath,args:[resolve(root,'mcp/dist/cli.mjs')],stderr:'pipe',env:{PATH:process.env.PATH}});
async function call(name,args){const result=await client.callTool({name,arguments:args});log.push({request:{name,arguments:args},response:result});assert(!result.isError,JSON.stringify(result));return result.structuredContent||JSON.parse(result.content.find(x=>x.type==='text').text);}
try{
 await client.connect(transport);const caps=await call('studio_capabilities',{});assert.equal((await client.listTools()).tools.length,17);
 const fileInfo=[['happy-labor-day.svg','image/svg+xml'],['original-whistle-march.ogg','audio/ogg']];const files=[];
 for(const [name,mediaType] of fileInfo){const bytes=await readFile(resolve(kit,'assets',name));files.push({name,mediaType,base64:bytes.toString('base64')});}
 const args={mode:'nft',name:'Happy Labor Day 2026',description:'To the American worker—who builds, serves, repairs, teaches, and keeps this country moving. Happy Labor Day 2026. Original whistle march by BEACN Labs.',coverIndex:0,files};
 const created=await call('create_mint_intent',args);const checked=await call('verify_mint_intent',{intent:created.intent});assert.equal(checked.valid,true);assert.deepEqual(checked.intent,created.intent);
 for(let i=0;i<files.length;i++){const b=Buffer.from(files[i].base64,'base64'),f=created.intent.bundle.files[i];assert.equal(f.sha256,sha(b));assert.equal(f.bytes,b.length);assert.equal(f.uri,`data:${f.mediaType};base64,${files[i].base64}`);}
 const url=new URL(created.review.url);assert.equal(url.hash,'#mint=v1.'+Buffer.from(JSON.stringify(created.intent)).toString('base64url'));
 await writeFile(resolve(kit,'intent.json'),created.packetJson);await writeFile(resolve(kit,'review-url.txt'),created.review.url+'\n');await writeFile(resolve(kit,'evidence/create-intent-args.json'),JSON.stringify(args,null,2)+'\n');
 // Fixed synthetic hash/address only. No wallet/provider account, private key or live UTxO lookup.
 const address=C.EnterpriseAddress.new(1,C.Credential.from_keyhash(C.Ed25519KeyHash.from_hex('ab'.repeat(28)))).to_address();
 const value=C.Value.new(bn(30000000)),multi=C.MultiAsset.new(),assets=C.Assets.new();assets.insert(C.AssetName.new(Buffer.from('KEEP')),bn(7));multi.insert(C.ScriptHash.from_hex('cd'.repeat(28)),assets);value.set_multiasset(multi);
 const input=C.TransactionInput.new(C.TransactionHash.from_hex(sha('Labor Day size fixture — no real UTxO')),0),utxo=C.TransactionUnspentOutput.new(input,C.TransactionOutput.new(address,value));
 const wallet={changeHex:address.to_hex(),utxos:[utxo.to_hex()]};
 const prepared=await call('prepare_unsigned_transaction',{intent:created.intent,wallet});
 const tx=C.Transaction.from_hex(prepared.unsignedHex),body=tx.body(),fixed=C.FixedTransaction.from_hex(prepared.unsignedHex);
 assert.equal(fixed.transaction_hash().to_hex(),prepared.transactionHash);assert.equal(body.fee().to_str(),prepared.fees.lovelace);
 assert.equal(body.inputs().len(),1);assert.equal(body.inputs().get(0).to_hex(),input.to_hex());
 assert.equal(body.auxiliary_data_hash().to_hex(),C.hash_auxiliary_data(tx.auxiliary_data()).to_hex());
 let outgoing=C.Value.new(body.fee());const outputs=[];
 for(let i=0;i<body.outputs().len();i++){const o=body.outputs().get(i);assert.equal(o.address().to_hex(),address.to_hex());assert(!o.has_data_hash()&&!o.has_plutus_data()&&!o.has_script_ref());const min=C.min_ada_for_output(o,C.DataCost.new_coins_per_byte(bn(prepared.protocol.coinsPerByte))).to_str();assert(BigInt(o.amount().coin().to_str())>=BigInt(min));outgoing=outgoing.checked_add(o.amount());outputs.push({lovelace:o.amount().coin().to_str(),minimumLovelace:min,syntheticDestination:true});}
 const minted=C.Value.zero();minted.set_multiasset(body.mint().as_positive_multiasset());assert.equal(outgoing.to_hex(),value.checked_add(minted).to_hex());
 const ws=tx.witness_set();assert.equal(ws.vkeys(),undefined);const keys=C.Vkeywitnesses.new();
 // Public RFC8032 verification key plus an all-zero NONSIGNATURE: structural size only.
 keys.add(C.Vkeywitness.new(C.Vkey.new(C.PublicKey.from_hex('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a')),C.Ed25519Signature.from_hex('00'.repeat(64))));ws.set_vkeys(keys);
 const sized=C.Transaction.new(body,ws,tx.auxiliary_data()),placeholderBytes=sized.to_bytes().length;
 assert(placeholderBytes<=16384);assert.equal(placeholderBytes,prepared.fees.estimatedSignedBytes);
 const minimumFee=C.min_fee(sized,C.LinearFee.new(bn(prepared.protocol.feeA),bn(prepared.protocol.feeB))).to_str();assert(BigInt(prepared.fees.lovelace)>=BigInt(minimumFee));
 const createResponse=log.find(x=>x.request.name==='create_mint_intent').response;
 const evidence={schema:'beacn.labor-day.synthetic-size.v1',status:'synthetic-unsigned-only',rawBytes:created.intent.bundle.bytes,files:created.intent.bundle.files.map(({name,mediaType,bytes,sha256})=>({name,mediaType,bytes,sha256})),intentHash:created.intent.intentHash,bundleHash:created.intent.bundle.sha256,packetBytes:Buffer.byteLength(created.packetJson),packetSha256:sha(created.packetJson),reviewUrlCharacters:created.review.url.length,reviewUrlSha256:sha(created.review.url),mcpCreateResponseJsonBytes:Buffer.byteLength(JSON.stringify(createResponse)),mcpCreateTextBytes:Buffer.byteLength(createResponse.content[0].text),unsignedBytes:prepared.unsignedHex.length/2,estimatedSignedBytes:prepared.fees.estimatedSignedBytes,actualPlaceholderWitnessTransactionBytes:placeholderBytes,placeholderSignatureValid:false,minimumFeeLovelace:minimumFee,preparedFeeLovelace:prepared.fees.lovelace,studioFeeLovelace:'0',protocol:prepared.protocol,protocolSources:['https://koios.beacn.workers.dev/api/v1/tip','https://koios.beacn.workers.dev/api/v1/epoch_params?order=epoch_no.desc&limit=1'],outputs,checks:{actualLocalMcp:true,actualSharedBuilder:true,bodyHash:true,auxiliaryHash:true,exactFiles:true,allOutputsToSyntheticAddress:true,adaAndTokenConservation:true},walletConnected:false,realInputs:false,signed:false,submitted:false,chainInclusion:false,warning:'Size and fees are for this synthetic input shape and observed parameters only. The actual Eternl wallet must rebuild, review, sign and confirm. The sizing transaction contains an invalid placeholder witness and must never be submitted.'};
 await writeFile(resolve(kit,'evidence/synthetic-size.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}finally{await writeFile(resolve(kit,'evidence/mcp-calls.json'),JSON.stringify(log,null,2)+'\n');await client.close();}
