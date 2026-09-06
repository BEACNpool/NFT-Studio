// Synthetic keys only. No wallets, secrets, network calls, or chain submissions.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
import * as B from '@emurgo/cardano-serialization-lib-browser-inlined';
const root = resolve(process.env.STUDIO_TEST_ROOT || '.');
const temp = await mkdtemp(join(tmpdir(), 'nft-studio-verify-'));
try {
  await build({ absWorkingDir: root,
    entryPoints: ['lib/studio-payload.ts','lib/studio-transaction.ts','lib/studio-submission.ts','lib/cardano.ts'],
    bundle: true, platform: 'node', format: 'esm', outdir: temp,
    outExtension: { '.js': '.mjs' }, external: ['@emurgo/cardano-serialization-lib-browser-inlined'], logLevel: 'error' });
  const mod = async name => import(pathToFileURL(join(temp, name + '.mjs')));
  const payload = await mod('studio-payload'), txs = await mod('studio-transaction');
  const core = await mod('cardano'), sub = await mod('studio-submission');
  const enc = new TextEncoder(), bn = n => C.BigNum.from_str(String(n));
  let groups = 0;
  const test = async (name, action) => { await action(); console.log('PASS', name); groups++; };
  const textFile = (name, text, mediaType='text/plain') => ({name,mediaType,bytes:enc.encode(text)});
  const cover = textFile('cover.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#234"/><text x="10" y="50" fill="white">NFT</text></svg>','image/svg+xml');
  const config = textFile('settings.json','{"title":"こんにちは","enabled":true,"optional":null,"gain":0.5}','application/json');
  const html = textFile('app.html','<!doctype html><button onclick="this.textContent=\'Done\'">Try me</button>','text/html');
  const makeBundle = (extra={}) => payload.preparePayloadBundle({name:'Studio 🦾',description:'A fully embedded fixture.',files:[cover,html,config],coverIndex:0,...extra});
  const keyA=C.PrivateKey.generate_ed25519(),keyB=C.PrivateKey.generate_ed25519();
  const address = key => C.BaseAddress.new(1,C.Credential.from_keyhash(key.to_public().hash()),C.Credential.from_keyhash(key.to_public().hash())).to_address();
  const addr=address(keyA), addrB=address(keyB), policy=C.ScriptHash.from_hex('ab'.repeat(28)), oldAsset=C.AssetName.new(enc.encode('KEEPME'));
  const params={epoch_no:653,min_fee_a:44,min_fee_b:155381,max_tx_size:16384,max_val_size:5000,coins_per_utxo_size:'4310',key_deposit:'2000000',pool_deposit:'500000000'};
  const live=()=>core.parseProtocol({epoch_no:653,abs_slot:197151000,block_time:Math.floor(Date.now()/1000)-15},params);
  function utxo(n, coin=20000000, at=addr, tokens=false, special='') {
    const value=C.Value.new(bn(coin));
    if(tokens){const ma=C.MultiAsset.new(),assets=C.Assets.new();assets.insert(oldAsset,bn(7));ma.insert(policy,assets);value.set_multiasset(ma);}
    const out=C.TransactionOutput.new(at,value);
    if(special==='datum')out.set_data_hash(C.DataHash.from_hex('cd'.repeat(32)));
    if(special==='inline')out.set_plutus_data(C.PlutusData.new_integer(C.BigInt.from_str('1')));
    if(special==='ref')out.set_script_ref(C.ScriptRef.new_native_script(C.NativeScript.new_script_pubkey(C.ScriptPubkey.new(keyA.to_public().hash()))));
    return C.TransactionUnspentOutput.new(C.TransactionInput.new(C.TransactionHash.from_hex(n.toString(16).padStart(64,'0')),n),out).to_hex();
  }
  const wallet={changeHex:addr.to_hex(),utxos:[utxo(1)]};
  function witnesses(prepared,keys=[keyA]) {const set=C.TransactionWitnessSet.new(),v=C.Vkeywitnesses.new();for(const key of keys)v.add(C.make_vkey_witness(C.TransactionHash.from_hex(prepared.hash),key));set.set_vkeys(v);return set.to_hex();}
  function metadataFrom(hex) {const all=C.Transaction.from_hex(hex).auxiliary_data().metadata();const out={};for(let i=0;i<all.keys().len();i++){const label=all.keys().get(i);out[label.to_str()]=JSON.parse(C.decode_metadatum_to_json_str(all.get(label),C.MetadataJsonSchema.NoConversions));}return out;}
  function sumCoin(hex) {const outputs=C.Transaction.from_hex(hex).body().outputs();let coin=0n;for(let i=0;i<outputs.len();i++){assert.equal(outputs.get(i).address().to_hex(),addr.to_hex());assert.ok(BigInt(outputs.get(i).amount().coin().to_str())>=BigInt(C.min_ada_for_output(outputs.get(i),C.DataCost.new_coins_per_byte(bn(params.coins_per_utxo_size))).to_str()));coin+=BigInt(outputs.get(i).amount().coin().to_str());}return coin;}
  let bundle,nft,data;
  await test('Exact multipart files, Unicode metadata chunks, JSON values and immutable identity recover',async()=>{
    bundle=await makeBundle(); assert.ok(Object.isFrozen(bundle)); assert.ok(Object.isFrozen(bundle.files));
    assert.equal(bundle.files.length,3); await payload.verifyPayloadBundle(bundle);
    for(const [mint,meta] of [[{policyId:'cd'.repeat(28),assetName:'TEST'},payload.payloadMetadata(bundle,{policyId:'cd'.repeat(28),assetName:'TEST'})],[undefined,payload.payloadMetadata(bundle)]]) {
      const check=x=>{if(typeof x==='string')assert.ok(Buffer.byteLength(x)<=64);else if(Array.isArray(x))x.forEach(check);else if(x&&typeof x==='object')Object.entries(x).forEach(([k,v])=>{check(k);check(v);});};check(meta);
      const recovered=await payload.recoverPayloadMetadata(meta,mint);assert.equal(recovered.bundle.sha256,bundle.sha256);assert.equal(Buffer.from(recovered.files[2].bytes).toString(),Buffer.from(config.bytes).toString());
    }
    const chunks=payload.metadataChunks('🦾'.repeat(80));assert.equal(chunks.join(''),'🦾'.repeat(80));assert.ok(chunks.every(x=>Buffer.byteLength(x)<=64));
  });
  await test('MIME signatures, traversal, duplicate names, corrupt UTF-8 and hash tampering fail closed',async()=>{
    for(const files of [[{...cover,name:'../x.svg'}],[{...cover,name:'CON.svg'}],[cover,{...cover,name:'COVER.svg'}],[{...cover,mediaType:'image/png'}],[textFile('bad.json','{bad','application/json')],[{name:'bad.txt',mediaType:'text/plain',bytes:Uint8Array.of(255)}]])
      await assert.rejects(makeBundle({files,coverIndex:undefined}));
    await assert.rejects(makeBundle({name:'🦾'.repeat(17)}));
    await assert.rejects(makeBundle({files:[{name:'x.bin',mediaType:'application/octet-stream',bytes:new Uint8Array(12001)}],coverIndex:undefined}));
    await assert.rejects(payload.verifyPayloadBundle({...bundle,files:[{...bundle.files[0],sha256:'0'.repeat(64)},...bundle.files.slice(1)]}));
    assert.throws(()=>payload.decodePayloadURI('https://example.com/a','text/plain'));
    const broken=structuredClone(payload.payloadMetadata(bundle));broken[payload.DATA_LABEL].files[1].sha256='0'.repeat(64);await assert.rejects(payload.recoverPayloadMetadata(broken));
  });
  await test('NFT signs with native policy, own-wallet outputs, exact recovered attachments and browser parity',async()=>{
    nft=await txs.buildStudioTransaction(C,bundle,'nft',wallet,live());
    const signed=core.mergeAndCheckSignatures(C,nft,witnesses(nft),live());assert.equal(signed.bytes,nft.signedEstimate);
    assert.equal(core.mergeAndCheckSignatures(B,nft,witnesses(nft),live()).hex,signed.hex);
    const browser=await txs.buildStudioTransaction(B,bundle,'nft',wallet,nft.protocol);assert.equal(browser.signedEstimate,nft.signedEstimate);
    const tx=C.Transaction.from_hex(signed.hex), mint=tx.body().mint();assert.equal(mint.get(C.ScriptHash.from_hex(nft.policyId)).get(0).get(C.AssetName.new(enc.encode(nft.assetName))).to_str(),'1');
    assert.equal(Buffer.byteLength(nft.assetName),32);assert.equal(sumCoin(signed.hex)+BigInt(nft.fee),20000000n);
    assert.equal(tx.body().to_hex(),C.Transaction.from_hex(nft.unsignedHex).body().to_hex());assert.equal(tx.auxiliary_data().to_hex(),C.Transaction.from_hex(nft.unsignedHex).auxiliary_data().to_hex());assert.equal(C.hash_auxiliary_data(tx.auxiliary_data()).to_hex(),tx.body().auxiliary_data_hash().to_hex());assert.equal(tx.witness_set().native_scripts().len(),1);assert.equal(tx.body().ttl_bignum().to_str(),String(nft.validUntilSlot));
    assert.ok(nft.expirySlot>nft.validUntilSlot);assert.ok(BigInt(nft.minimumAda)>0n);
    const recovered=await payload.recoverPayloadMetadata(metadataFrom(signed.hex),{policyId:nft.policyId,assetName:nft.assetName});assert.equal(recovered.bundle.sha256,bundle.sha256);
    console.log('MEASURE NFT',signed.bytes,'signed bytes',nft.fee,'lovelace');
  });
  await test('Data-only transaction has no minted token or native script and preserves all ADA except fee',async()=>{
    const only=await makeBundle({files:[config],coverIndex:undefined});
    data=await txs.buildStudioTransaction(C,only,'data',wallet,live());
    const signed=core.mergeAndCheckSignatures(C,data,witnesses(data),live()),tx=C.Transaction.from_hex(signed.hex);
    assert.equal(signed.bytes,data.signedEstimate);assert.ok(!tx.body().mint());assert.ok(!tx.witness_set().native_scripts());
    assert.equal(tx.body().to_hex(),C.Transaction.from_hex(data.unsignedHex).body().to_hex());assert.equal(tx.auxiliary_data().to_hex(),C.Transaction.from_hex(data.unsignedHex).auxiliary_data().to_hex());assert.equal(data.minimumAda,'0');assert.equal(data.policyId,undefined);assert.equal(sumCoin(signed.hex)+BigInt(data.fee),20000000n);
    assert.equal((await payload.recoverPayloadMetadata(metadataFrom(signed.hex))).bundle.sha256,only.sha256);
    assert.equal(core.mergeAndCheckSignatures(B,data,witnesses(data),live()).hex,signed.hex);
    console.log('MEASURE data',signed.bytes,'signed bytes',data.fee,'lovelace');
  });
  await test('Both modes preserve existing token change; multiple input payment keys must sign',async()=>{
    for(const mode of ['nft','data']) {
      const w={changeHex:addr.to_hex(),utxos:[utxo(2,20000000,addr,true)]};
      const p=await txs.buildStudioTransaction(C,bundle,mode,w,live());
      const signed=core.mergeAndCheckSignatures(C,p,witnesses(p),live()),outputs=C.Transaction.from_hex(signed.hex).body().outputs();let old=0n;
      for(let i=0;i<outputs.len();i++){const a=outputs.get(i).amount().multiasset()?.get(policy)?.get(oldAsset);if(a)old+=BigInt(a.to_str());}
      assert.equal(old,7n);assert.equal(sumCoin(signed.hex)+BigInt(p.fee),20000000n);
    }
    const many={changeHex:addr.to_hex(),utxos:[utxo(3,1300000),utxo(4,1300000,addrB)]};
    const p=await txs.buildStudioTransaction(C,bundle,'nft',many,live());assert.equal(p.inputRefs.length,2);
    assert.throws(()=>core.mergeAndCheckSignatures(C,p,witnesses(p),live()),/all input/);
    const signed=core.mergeAndCheckSignatures(C,p,witnesses(p,[keyA,keyB]),live());assert.equal(signed.bytes,p.signedEstimate);
  });
  await test('Full signed cap, extra/missing signatures, stale review and spent/wrong-network inputs reject',async()=>{
    const large=await makeBundle({files:[cover,{name:'large.bin',mediaType:'application/octet-stream',bytes:new Uint8Array(11700)}]});
    await assert.rejects(txs.buildStudioTransaction(C,large,'nft',wallet,live()),/limit|bytes/);
    assert.throws(()=>core.mergeAndCheckSignatures(C,nft,witnesses(nft,[keyB]),live()),/all input/);
    assert.throws(()=>core.mergeAndCheckSignatures(C,nft,witnesses(nft,[keyA,keyB]),live()),/fee/);
    assert.throws(()=>core.mergeAndCheckSignatures(C,{...nft,hash:'01'.repeat(32)},witnesses(nft),live()),/integrity/);
    assert.throws(()=>core.assertFreshReview({...nft,createdAt:Date.now()-240001},live()),/expired/);
    assert.throws(()=>core.assertWalletUnchanged(C,nft,{...wallet,utxos:[utxo(44)]}),/spent|changed/);
    assert.throws(()=>core.assertWalletUnchanged(C,nft,{...wallet,changeHex:addrB.to_hex()}),/account changed/);

    const original=C.Transaction.from_hex(nft.unsignedHex), alteredMeta=C.GeneralTransactionMetadata.new();alteredMeta.insert(bn(721),C.TransactionMetadatum.new_text('altered'));const alteredAux=C.AuxiliaryData.new();alteredAux.set_metadata(alteredMeta);
    const altered=C.Transaction.new(original.body(),original.witness_set(),alteredAux);
    assert.throws(()=>core.mergeAndCheckSignatures(C,{...nft,unsignedHex:altered.to_hex()},witnesses(nft),live()),/metadata integrity/);
    const testnet=C.EnterpriseAddress.new(0,C.Credential.from_keyhash(keyA.to_public().hash())).to_address();
    for(const special of ['datum','inline','ref'])await assert.rejects(txs.buildStudioTransaction(C,bundle,'nft',{changeHex:addr.to_hex(),utxos:[utxo(7,20000000,addr,false,special)]},live()),/No regular/);
    await assert.rejects(txs.buildStudioTransaction(C,bundle,'data',{changeHex:testnet.to_hex(),utxos:[utxo(7,20000000,testnet)]},live()),/mainnet/);
    await assert.rejects(txs.buildStudioTransaction(C,bundle,'data',wallet,{...live(),fetchedAt:Date.now()-120001}),/expired/);
  });
  const memory=()=>{const items=new Map();return{getItem:k=>items.get(k)??null,setItem:(k,v)=>items.set(k,v)};};
  const locks=()=>{let tail=Promise.resolve();return{request:(_name,fn)=>{const pending=tail.then(fn);tail=pending.catch(()=>{});return pending;}};};
  await test('Concurrent/reloaded attempts submit exactly once, with persistence observed before submit',async()=>{
    const storage=memory(),gate=locks();let calls=0;
    const options={hash:nft.hash,storage,locks:gate,submit:async()=>{calls++;assert.equal(sub.readSubmissionAttempt(nft.hash,storage).state,'submitting');return nft.hash;}};
    const results=await Promise.all([sub.submitTransactionOnce(options),sub.submitTransactionOnce(options)]);
    assert.equal(calls,1);assert.deepEqual(results.map(x=>x.alreadyAttempted),[false,true]);assert.equal(results[0].attempt.state,'submitted');
    await sub.submitTransactionOnce({...options,locks:locks()});assert.equal(calls,1);
  });
  await test('Ambiguous/mismatched responses never retry; storage failure prevents submission',async()=>{
    for(const response of ['throw','bad-hash']) {const storage=memory();let calls=0;const options={hash:nft.hash,storage,locks:locks(),submit:async()=>{calls++;if(response==='throw')throw Error('timeout');return 'ef'.repeat(32);}};
      const result=await sub.submitTransactionOnce(options);assert.equal(result.attempt.state,'unknown');await sub.submitTransactionOnce(options);assert.equal(calls,1);}
    let calls=0;await assert.rejects(sub.submitTransactionOnce({hash:nft.hash,locks:locks(),storage:{getItem:()=>null,setItem:()=>{throw Error('quota');}},submit:async()=>{calls++;return nft.hash;}}));assert.equal(calls,0);
  });
  await test('Confirmation distinguishes null from zero blocks and rejects mismatched hash/invalid responses',async()=>{
    const feed=(row)=>async()=>new Response(JSON.stringify(row),{status:200});
    for(const rows of [[],[{tx_hash:nft.hash,num_confirmations:null}]])assert.equal((await sub.checkTransaction(nft.hash,{fetcher:feed(rows)})).state,'pending');
    for(const count of [0,1,20]){const result=await sub.checkTransaction(nft.hash,{fetcher:feed([{tx_hash:nft.hash,num_confirmations:count}])});assert.equal(result.state,'confirmed');assert.equal(result.blocksAfterInclusion,count);}
    await assert.rejects(sub.checkTransaction(nft.hash,{fetcher:feed([{tx_hash:'ff'.repeat(32),num_confirmations:2}])}),/different/);
    await assert.rejects(sub.checkTransaction(nft.hash,{fetcher:feed([{tx_hash:nft.hash,num_confirmations:'0'}])}),/invalid/);
    assert.equal(await sub.readTransactionMetadata(nft.hash,{fetcher:feed([])}),null);
    const meta=payload.payloadMetadata(bundle);assert.deepEqual(await sub.readTransactionMetadata(nft.hash,{fetcher:feed([{tx_hash:nft.hash,metadata:meta}])}),meta);
  });
  console.log(`PASS ${groups} NFT Studio engine groups (synthetic signing only)`);
} finally { await rm(temp,{recursive:true,force:true}); }
