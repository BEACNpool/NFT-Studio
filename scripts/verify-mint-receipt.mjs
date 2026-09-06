// Saved-packet recovery uses synthetic keys/UTxOs only; no network or wallet API.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
const root=resolve(process.env.STUDIO_TEST_ROOT||'.'),temp=await mkdtemp(join(tmpdir(),'mint-receipt-'));
try {
  await build({absWorkingDir:root,entryPoints:['lib/cardano.ts','lib/art.ts','lib/mint-receipt.ts'],bundle:true,platform:'node',format:'esm',outdir:temp,outExtension:{'.js':'.mjs'},external:['@emurgo/cardano-serialization-lib-browser-inlined'],logLevel:'error'});
  const core=await import(pathToFileURL(join(temp,'cardano.mjs'))),saved=await import(pathToFileURL(join(temp,'mint-receipt.mjs'))),{INITIAL}=await import(pathToFileURL(join(temp,'art.mjs')));
  const key=C.PrivateKey.generate_ed25519(),bn=n=>C.BigNum.from_str(String(n));
  const addr=C.EnterpriseAddress.new(1,C.Credential.from_keyhash(key.to_public().hash())).to_address();
  const u=C.TransactionUnspentOutput.new(C.TransactionInput.new(C.TransactionHash.from_hex('01'.repeat(32)),0),C.TransactionOutput.new(addr,C.Value.new(bn(20000000))));
  const p=core.parseProtocol({epoch_no:653,abs_slot:197151000,block_time:Math.floor(Date.now()/1000)},{epoch_no:653,min_fee_a:44,min_fee_b:155381,max_tx_size:16384,max_val_size:5000,coins_per_utxo_size:'4310',key_deposit:'2000000',pool_deposit:'500000000'});
  const image={uri:'data:image/webp;base64,UklGRgAAAABXRUJQ',mediaType:'image/webp',bytes:12,width:128,quality:50,sha256:'00'.repeat(32)};
  const prepared=await core.buildMint(C,INITIAL,image,{changeHex:addr.to_hex(),utxos:[u.to_hex()]},p),ws=C.TransactionWitnessSet.new(),v=C.Vkeywitnesses.new();
  v.add(C.make_vkey_witness(C.TransactionHash.from_hex(prepared.hash),key));ws.set_vkeys(v);
  const signed=core.mergeAndCheckSignatures(C,prepared,ws.to_hex(),p);
  const receipt={schema:'nft-studio.receipt.v1',hash:signed.hash,kind:'art',name:prepared.artworkName,createdAt:Date.now(),state:'submitted',metadata:prepared.metadata,prepared,signedHex:signed.hex,bytes:signed.bytes,broadcastAttempted:true};
  const entries=new Map(),storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
  saved.persistMintReceipt(receipt,true,storage);
  assert.equal(saved.activeMintReceiptHash(storage),signed.hash);
  const restored=saved.restoreMintReceipt(C,signed.hash,storage);assert.equal(restored.restored,true);assert.equal(restored.signedHex,signed.hex);
  saved.dismissMintReceipt(signed.hash,storage);assert.equal(saved.activeMintReceiptHash(storage),null);assert.ok(storage.getItem(saved.MINT_RECEIPT_PREFIX+signed.hash));
  for(const alter of [r=>{r.bytes++},r=>{r.metadata={'721':{bad:'changed'}}},r=>{r.prepared.image.uri='data:image/webp;base64,YWJj'},r=>{r.prepared.address='changed'},r=>{r.prepared.hash='ff'.repeat(32)},r=>{r.signedHex='bad'}]){
    const changed=structuredClone(receipt);alter(changed);storage.setItem(saved.MINT_RECEIPT_PREFIX+signed.hash,JSON.stringify(changed));assert.throws(()=>saved.restoreMintReceipt(C,signed.hash,storage));
  }
  assert.throws(()=>saved.persistMintReceipt(receipt,true,{...storage,setItem:()=>{throw Error('quota')}}),/quota/);
  console.log('PASS signed receipt exact recovery; metadata/preview/signature-packet/destination corruption rejected; dismissal archives packet; storage failure fails closed');
} finally { await rm(temp,{recursive:true,force:true}); }
