/** Independent local release assertions. Synthetic fixtures only; never signs or submits. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
import {preflightCbor} from '../src/cbor-preflight.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bn=n=>C.BigNum.from_str(String(n));
const hex=bytes=>Buffer.from(bytes).toString('hex');
const ref=u=>u.input().transaction_id().to_hex()+'#'+u.input().index();
const file=(name,mediaType,text)=>({name,mediaType,base64:Buffer.from(text).toString('base64')});
export function syntheticNativeFixture(mode){
  assert.ok(['nft','data'].includes(mode));
  const key=C.Ed25519KeyHash.from_hex('ab'.repeat(28));
  const address=C.EnterpriseAddress.new(1,C.Credential.from_keyhash(key)).to_address();
  const value=C.Value.new(bn(20000000)),multi=C.MultiAsset.new(),assets=C.Assets.new();
  assets.insert(C.AssetName.new(Buffer.from('KEEP')),bn(7));assets.insert(C.AssetName.new(Buffer.from('KEEP2')),bn(11));
  multi.insert(C.ScriptHash.from_hex('cd'.repeat(28)),assets);value.set_multiasset(multi);
  const utxo=C.TransactionUnspentOutput.new(C.TransactionInput.new(C.TransactionHash.from_hex(hash('NFT Studio synthetic release verifier: no real UTxO')),0),C.TransactionOutput.new(address,value));
  const args={mode,name:'Public synthetic '+mode+' check',description:'No real wallet, signature or submission.',files:[file('hello.txt','text/plain','Hello, Cardano!')]};
  if(mode==='nft'){args.files.unshift(file('cover.svg','image/svg+xml','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#7cf"/></svg>'));args.coverIndex=0;}
  return {args,wallet:{changeHex:address.to_hex(),utxos:[utxo.to_hex()]}};
}
/** Recreate the v1 byte/identity contract from local fixture inputs, not server verdicts. */
export function assertSyntheticIntent(intent,args){
  const files=args.files.map(f=>{
    const bytes=Buffer.from(f.base64,'base64'),binary=`data:${f.mediaType};base64,${f.base64}`;
    const text=`data:${f.mediaType},${encodeURIComponent(bytes.toString('utf8'))}`;
    return {name:f.name,mediaType:f.mediaType,bytes:bytes.length,sha256:hash(bytes),uri:!f.mediaType.startsWith('image/')&&text.length<binary.length?text:binary};
  });
  const core={schema:'nft-studio.payload.v1',name:args.name,description:args.description||'',cover:args.coverIndex===0,files:files.map(({name,mediaType,bytes,sha256})=>({name,mediaType,bytes,sha256}))};
  const bundle={schema:core.schema,name:core.name,description:core.description,cover:core.cover,bytes:files.reduce((n,f)=>n+f.bytes,0),files,sha256:hash(JSON.stringify(core))};
  const packet={schema:'nft-studio.intent.v1',mode:args.mode,bundle};
  assert.deepEqual(intent,{...packet,intentHash:hash(JSON.stringify(packet))},'Intent must contain exactly the locally supplied synthetic bytes and identity.');
  return intent;
}
function chunks(text){
  if(Buffer.byteLength(text)<=64)return text;
  const parts=[];let current='';for(const char of text){if(Buffer.byteLength(current+char)>64){parts.push(current);current='';}current+=char;}if(current)parts.push(current);return parts;
}
function expectedMetadata(intent,asset){
  const b=intent.bundle,fmeta=f=>({name:f.name,mediaType:f.mediaType,src:chunks(f.uri),sha256:f.sha256,bytes:f.bytes});
  if(!asset)return {'1313231955':{schema:'nft-studio.data.v1',name:b.name,...(b.description?{description:chunks(b.description)}:{}),files:b.files.map(fmeta),content_sha256:b.sha256,cover:b.cover?1:0}};
  const image=b.files[0],assetName=Buffer.from(asset.assetNameHex,'hex').toString('utf8');
  return {'721':{[asset.policyId]:{[assetName]:{name:b.name,image:chunks(image.uri),mediaType:image.mediaType,image_name:image.name,image_sha256:image.sha256,image_bytes:image.bytes,...(b.description?{description:chunks(b.description)}:{}),files:b.files.slice(1).map(fmeta),schema:b.schema,content_sha256:b.sha256}},version:'1.0'}};
}
export function assertSyntheticUnsigned(result,intent,fixture){
  assertSyntheticIntent(intent,fixture.args);
  assert.equal(result.schema,'nft-studio.stateless-unsigned.v1');assert.equal(result.mode,intent.mode);assert.equal(result.networkId,1);
  assert.equal(result.intentHash,intent.intentHash);assert.equal(result.signed,false);assert.equal(result.submitted,false);assert.equal(Object.hasOwn(result,'packetId'),false);
  assert.match(result.checks.walletInputs,/unspent.*unverified/);assert.match(result.checks.signedSize,/estimate/);
  assert.ok(typeof result.unsignedHex==='string'&&result.unsignedHex.length<=32768);preflightCbor(result.unsignedHex);
  const tx=C.Transaction.from_hex(result.unsignedHex),fixed=C.FixedTransaction.from_hex(result.unsignedHex),body=tx.body(),witnesses=tx.witness_set();
  assert.equal(fixed.transaction_hash().to_hex(),result.transactionHash,'Independent transaction body hash');assert.equal(body.to_hex(),result.bodyHex);
  assert.equal(result.unsignedBytes,result.unsignedHex.length/2);assert.ok(result.estimatedSignedBytes>=result.unsignedBytes&&result.estimatedSignedBytes<=16384);
  assert.equal(body.fee().to_str(),result.feeLovelace);assert.ok(BigInt(result.feeLovelace)>0n&&BigInt(result.feeLovelace)<=2000000n);
  assert.equal(Number(body.ttl_bignum().to_str()),result.validUntilSlot);
  for(const field of ['required_signers','validity_start_interval','certs','withdrawals','update','script_data_hash','collateral','collateral_return','reference_inputs','total_collateral','voting_procedures','proposal_procedures','donation','current_treasury_value'])if(typeof body[field]==='function')assert.equal(body[field](),undefined,`Unexpected transaction action: ${field}`);
  for(const field of ['vkeys','bootstraps','plutus_scripts','plutus_data','redeemers'])assert.equal(witnesses[field](),undefined,'No signed or Plutus witnesses.');
  const supplied=fixture.wallet.utxos.map(raw=>C.TransactionUnspentOutput.from_hex(raw));
  assert.equal(body.inputs().len(),1);const selected=body.inputs().get(0).transaction_id().to_hex()+'#'+body.inputs().get(0).index();
  assert.equal(selected,ref(supplied[0]));assert.deepEqual(result.selectedInputRefs,[selected]);
  const change=C.Address.from_hex(fixture.wallet.changeHex),key=change.payment_cred().to_keyhash();
  assert.deepEqual(result.requiredPaymentKeyHashes,[key.to_hex()]);assert.equal(result.recipient,change.to_bech32());
  let available=supplied[0].output().amount();
  if(intent.mode==='nft'){
    const asset=result.asset;assert.ok(asset);assert.equal(asset.quantity,'1');assert.equal(asset.policyExpirySlot,result.validUntilSlot+3000);
    const expectedName='NFTS'+hash(selected+'|'+intent.bundle.sha256).slice(0,28);assert.equal(asset.assetNameHex,Buffer.from(expectedName).toString('hex'));
    const scripts=C.NativeScripts.new();scripts.add(C.NativeScript.new_script_pubkey(C.ScriptPubkey.new(key)));scripts.add(C.NativeScript.new_timelock_expiry(C.TimelockExpiry.new_timelockexpiry(bn(asset.policyExpirySlot))));
    const policy=C.NativeScript.new_script_all(C.ScriptAll.new(scripts));assert.equal(policy.to_hex(),asset.nativeScriptHex);assert.equal(policy.hash().to_hex(),asset.policyId);
    const mint=body.mint();assert.ok(mint);assert.equal(mint.keys().len(),1);assert.equal(mint.keys().get(0).to_hex(),asset.policyId);
    const groups=mint.get(mint.keys().get(0));assert.equal(groups.len(),1);const minted=groups.get(0);assert.equal(minted.len(),1);assert.equal(hex(minted.keys().get(0).name()),asset.assetNameHex);assert.equal(minted.get(minted.keys().get(0)).to_str(),'1');
    assert.equal(witnesses.native_scripts().len(),1);assert.equal(witnesses.native_scripts().get(0).to_hex(),policy.to_hex());
    const value=C.Value.zero();value.set_multiasset(mint.as_positive_multiasset());available=available.checked_add(value);
  }else{assert.equal(result.asset,null);assert.equal(body.mint(),undefined);assert.equal(witnesses.native_scripts(),undefined);}
  let consumed=C.Value.new(body.fee());assert.ok(body.outputs().len()>0);assert.equal(result.outputs.length,body.outputs().len());
  for(let i=0;i<body.outputs().len();i++){
    const out=body.outputs().get(i),reported=result.outputs[i];assert.equal(out.address().to_hex(),fixture.wallet.changeHex);assert.equal(out.has_data_hash()||out.has_plutus_data()||out.has_script_ref(),false);
    const minimum=C.min_ada_for_output(out,C.DataCost.new_coins_per_byte(bn(result.protocol.coinsPerByte))).to_str();assert.ok(BigInt(out.amount().coin().to_str())>=BigInt(minimum));
    assert.deepEqual(reported,{index:i,address:change.to_bech32(),valueCborHex:out.amount().to_hex(),lovelace:out.amount().coin().to_str(),minimumLovelace:minimum});consumed=consumed.checked_add(out.amount());
  }
  assert.equal(consumed.to_hex(),available.to_hex(),'Preserve every supplied native asset and lovelace, plus exact mint minus fee.');
  const metadata=expectedMetadata(intent,result.asset),general=C.GeneralTransactionMetadata.new();
  for(const [label,value] of Object.entries(metadata))general.insert(bn(label),C.encode_json_str_to_metadatum(JSON.stringify(value),C.MetadataJsonSchema.NoConversions));
  const expectedAux=C.AuxiliaryData.new();expectedAux.set_metadata(general);
  assert.deepEqual(result.metadata,metadata);assert.equal(tx.auxiliary_data().to_hex(),expectedAux.to_hex(),'Ledger metadata must encode the local synthetic bundle.');
  const auxiliaryHash=C.hash_auxiliary_data(expectedAux).to_hex();assert.equal(body.auxiliary_data_hash().to_hex(),auxiliaryHash);assert.equal(result.auxiliaryDataHash,auxiliaryHash);
  return {mode:intent.mode,transactionHash:result.transactionHash,unsignedBytes:result.unsignedBytes,localBundleBytesMatch:true,bodyHashVerified:true,auxiliaryCommitmentVerified:true,allOutputsToSyntheticAddress:true,valueConservation:true,chainStateVerified:false,walletOwnershipVerified:false,signed:false,submitted:false};
}
