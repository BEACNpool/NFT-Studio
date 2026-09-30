/** Owner-controlled CIP-30 transfer. Uses the exact tested contract builders. */
import {Lucid,CML,Koios,coreToUtxo,getAddressDetails,validatorToScriptHash,applyDoubleCborEncoding,applySingleCborEncoding} from '@lucid-evolution/lucid';
import * as T from './transactions.mjs';
import {ChainReader,BEACN_KOIOS_URL} from './chain-reader.mjs';
import {verifySigned,feeCalculator,inputKeys,submitOnce} from './submission.mjs';
const check=(ok,message)=>{if(!ok)throw Error(message);};
const json=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v);
const ref=u=>u.txHash+'#'+u.outputIndex;
const parseRef=value=>{check(/^[a-f0-9]{64}#\d+$/.test(value),'Invalid output reference.');const [txHash,i]=value.split('#');return {txHash,outputIndex:Number(i)};};
const txRefs=list=>Array.from({length:list?.len()??0},(_,i)=>({txHash:list.get(i).transaction_id().to_hex(),outputIndex:Number(list.get(i).index())}));
export function contractContext(config){
 check(/^[a-f0-9]{64}$/.test(config.bootstrap?.transactionId),'Transfer setup is not published yet.');
 const seeds=Object.fromEntries(['params','template','registry','state','issue'].map((name,outputIndex)=>[name,{txHash:config.bootstrap.transactionId,outputIndex}]));
 const c=T.derive({seeds,admin:config.bootstrap.admin,network:'Mainnet'});
 for(const [a,b] of [['statePolicy','state'],['tokenPolicy','nft'],['transferHash','transfer'],['programmableHash','plb']])check(config[a]===c.ids[b],'Transfer code and deployment do not match.');
 parseRef(config.referenceOutref);return c;
}
function convert(u){
 check(u.is_spent===false,'An output was spent or its status is unknown.');
 check(typeof u.address==='string'&&/^\d+$/.test(u.value),'Malformed chain output.');
 const assets={lovelace:BigInt(u.value)};
 for(const a of u.asset_list||[]){check(/^[a-f0-9]{56}$/.test(a.policy_id)&&/^(?:[a-f0-9]{2}){0,32}$/.test(a.asset_name)&&/^\d+$/.test(a.quantity),'Malformed asset.');check(!assets[a.policy_id+a.asset_name],'Duplicate asset.');assets[a.policy_id+a.asset_name]=BigInt(a.quantity);}
 let scriptRef;if(u.reference_script){const s=u.reference_script;check(s.type==='plutusV3'&&/^[a-f0-9]+$/.test(s.bytes),'Unsupported reference script.');scriptRef={type:'PlutusV3',script:applyDoubleCborEncoding(s.bytes)};}
 return {txHash:u.tx_hash,outputIndex:u.tx_index,address:u.address,assets,datum:u.inline_datum?.bytes,datumHash:u.inline_datum?undefined:u.datum_hash||undefined,scriptRef};
}
export function transferProvider(reader){
 const p=new Koios(BEACN_KOIOS_URL);
 const parameters=p.getProtocolParameters.bind(p);p.getProtocolParameters=async()=>{try{return await parameters();}catch{throw Error('Current network parameters are unavailable. Please try again.');}};
 // Lucid 0.6.5's stock Koios implementation reads only one tx and ignores spent status.
 p.getUtxosByOutRef=async refs=>{
  if(!refs.length)return [];
  const wanted=new Set(refs.map(ref));
  const rows=await reader.request('utxo_info',{_utxo_refs:[...wanted],_extended:true});
  check(rows.every(u=>wanted.has(u.tx_hash+'#'+u.tx_index)),'Unexpected chain output.');
  check(new Set(rows.map(u=>u.tx_hash+'#'+u.tx_index)).size===rows.length,'Duplicate chain output.');
  return rows.filter(u=>u.is_spent===false).map(convert);
 };
 p.getUtxoByUnit=async unit=>{
  const rows=await reader.request('asset_utxos',{_asset_list:[[unit.slice(0,56),unit.slice(56)]],_extended:true});
  check(rows.length===1,'Cannot verify a unique protocol output.');const u=convert(rows[0]);check(u.assets[unit]===1n,'Protocol token quantity is wrong.');return u;
 };
 // All broadcasts go through the connected wallet, never the indexer.
 p.submitTx=async()=>{throw Error('Use the reviewed wallet submission.');};
 return p;
}
function addressFromWallet(hex){return CML.Address.from_hex(hex).to_bech32();}
export async function walletIdentity(api){
 check(await api.getNetworkId()===1,'Switch your wallet to Cardano mainnet.');
 const change=addressFromWallet(await api.getChangeAddress());
 const addresses=[change,...(await api.getUsedAddresses()).map(addressFromWallet),...(await api.getUnusedAddresses()).map(addressFromWallet)];
 const keys=[...new Set(addresses.map(a=>getAddressDetails(a)).filter(d=>d.networkId===1&&d.paymentCredential?.type==='Key').map(d=>d.paymentCredential.hash))].sort();
 check(keys.length>0,'A mainnet payment key is required.');return {change,keys};
}
export function destinationKey(address,c){
 const d=getAddressDetails(address.trim());check(d.networkId===1,'The destination must be a Cardano mainnet address.');
 if(d.paymentCredential?.type==='Key')return d.paymentCredential.hash;
 check(d.paymentCredential?.type==='Script'&&d.paymentCredential.hash===c.ids.plb&&d.stakeCredential?.type==='Key','Use an ordinary receiving address or this collection’s programmable address.');
 return d.stakeCredential.hash;
}
export function validateMovement(snapshot,keys,indices,destination){
 check(snapshot.active,'No NFTs have been issued.');
 check(indices.length>0&&new Set(indices).size===indices.length&&indices.every(i=>Number.isInteger(i)&&i>=0&&i<3),'Select at least one card.');
 for(const i of indices){const owner=snapshot.owners[i];check(keys.includes(owner),'Your wallet does not control every selected card.');check(owner!==destination,'Choose a different owner.');check(snapshot.owners.every(k=>k===owner)||snapshot.owners.includes(destination),'With split ownership, send only to an address that already owns a card.');}
}
export async function connectTransfer(api,config){
 const reader=new ChainReader(config),c=contractContext(config),provider=transferProvider(reader);
 const identity=await walletIdentity(api),snapshot=await reader.snapshot();
 return {api,config,reader,c,provider,identity,snapshot};
}
export async function prepareTransfer(session,{indices,destination}){
 const {api,config,c,reader,provider}=session;
 const identity=await walletIdentity(api),snapshot=await reader.snapshot(),destinationOwner=destinationKey(destination,c);
 validateMovement(snapshot,identity.keys,indices,destinationOwner);
 const parameters=await provider.getProtocolParameters();
 const lucid=await Lucid(provider,'Mainnet',{presetProtocolParameters:parameters});lucid.selectWallet.fromAPI(api);
 const wallet=(await api.getUtxos()||[]).map(hex=>coreToUtxo(CML.TransactionUnspentOutput.from_cbor_hex(hex)));
 const simple=wallet.filter(u=>Object.keys(u.assets).length===1&&!u.datum&&!u.datumHash&&!u.scriptRef&&getAddressDetails(u.address).paymentCredential?.type==='Key').sort((a,b)=>a.assets.lovelace<b.assets.lovelace?-1:1);
 const collateral=simple.find(u=>u.assets.lovelace>=5_000_000n);
 check(collateral,'Keep a separate ADA-only output of at least 5 ADA for collateral in your wallet.');
 const feeInput=simple.find(u=>ref(u)!==ref(collateral)&&u.assets.lovelace>=3_000_000n);
 check(feeInput,'A separate ADA-only output of at least 3 ADA is needed to pay the fee.');
 const state=await provider.getUtxoByUnit(config.statePolicy+T.names.state);check(ref(state)===snapshot.ref,'Ownership changed. Refresh and review again.');
 const cards=await provider.getUtxosByOutRef(indices.map(i=>parseRef(snapshot.cards[i].ref)));check(cards.length===indices.length,'A selected card moved.');
 const params=await provider.getUtxoByUnit(c.ids.params+T.names.params),registry=await provider.getUtxoByUnit(c.ids.registry+c.ids.nft);
 const refs=await provider.getUtxosByOutRef([parseRef(config.referenceOutref)]);
 check(refs.length===1&&refs[0].scriptRef&&validatorToScriptHash(refs[0].scriptRef)===c.ids.state,'The contract reference is unavailable.');
 const moves=Object.fromEntries(indices.map(i=>[T.cardNames[i],destinationOwner]));
 const expiresAt=Date.now()+5*60_000;
 const tx=await T.transfer(lucid,c,{state,params,registry,cards,moves,signers:[...new Set(indices.map(i=>snapshot.owners[i]))],refs})
  .collectFrom([feeInput]).validTo(expiresAt).complete({coinSelection:false,changeAddress:identity.change,presetWalletInputs:[collateral],setCollateral:3_000_000n});
 const unsigned=tx.toCBOR(),body=CML.Transaction.from_cbor_hex(unsigned).body();
 check(body.fee()<=1_500_000n,'Fee exceeds the 1.5 ADA limit.');
 const inputRefs=txRefs(body.inputs()),referenceRefs=txRefs(body.reference_inputs()),collateralRefs=txRefs(body.collateral_inputs());
 check(collateralRefs.length===1&&ref(collateralRefs[0])===ref(collateral)&&body.total_collateral()===3_000_000n,'Unexpected collateral.');
 const referenceBytes=applySingleCborEncoding(refs[0].scriptRef.script).length/2;
 const packet={unsigned,hash:CML.hash_transaction(body).to_hex(),scope:config.tokenPolicy+':'+snapshot.ref,stateOutref:snapshot.ref,expiresAt,parameters,inputRefs,referenceRefs,collateralRefs,requiredKeys:inputKeys([feeInput,collateral]),referenceBytes,identity,indices,destination:c.holder(destinationOwner),feeLovelace:String(body.fee()),collateralLovelace:'3000000',revision:snapshot.revision};
 const preflight=async()=>{
  check(Date.now()<expiresAt-30000,'This review expired. Prepare a fresh transfer.');
  check(json(await walletIdentity(api))===json(identity),'The connected wallet changed.');
  check(json(await provider.getProtocolParameters())===json(parameters),'Network parameters changed. Review again.');
  const latest=await reader.snapshot();check(latest.ref===snapshot.ref,'Ownership changed. Review again.');
  const wanted=[...inputRefs,...referenceRefs,...collateralRefs],live=await provider.getUtxosByOutRef(wanted),found=new Set(live.map(ref));
  check(wanted.every(u=>found.has(ref(u))),'An input or reference was spent. Review again.');
 };
 await preflight();return {packet,preflight,lucid};
}
export async function signAndSubmit(session,prepared,{storage=localStorage,locks=navigator.locks}={}){
 const {packet,preflight,lucid}=prepared,{api}=session;
 return submitOnce({scope:packet.scope,packet,storage,locks,preflight,
  sign:async unsigned=>{const witness=await api.signTx(unsigned,true);return (await lucid.fromTx(unsigned).assemble([witness]).complete()).toCBOR();},
  inspect:(_,signed)=>verifySigned({unsigned:packet.unsigned,signed,parameters:packet.parameters,feeCapLovelace:1_500_000n,requiredKeys:packet.requiredKeys,minimumFee:feeCalculator(packet.parameters,packet.referenceBytes)}),
  submit:signed=>api.submitTx(signed)});
}
