import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Lucid,Emulator,generateEmulatorAccountFromPrivateKey,getAddressDetails,Data,CML,validatorToScriptHash} from '@lucid-evolution/lucid';
import * as T from './transactions.mjs';
const snapshot=JSON.parse(readFileSync('evidence/mainnet-parameters.json','utf8'),(_,v)=>v?.$bigint?BigInt(v.$bigint):v);
assert.ok(Date.now()-Date.parse(snapshot.observedAt)<86400000,'Refresh mainnet parameters');
const accounts=Array.from({length:4},()=>generateEmulatorAccountFromPrivateKey({lovelace:3_000_000_000n})),[home,alice,bob,eve]=accounts;
const key=a=>getAddressDetails(a.address).paymentCredential.hash;
const emu=new Emulator(accounts,snapshot.parameters),lucid=await Lucid(emu,'Custom');
const choose=a=>lucid.selectWallet.fromPrivateKey(a.privateKey);choose(home);
const report={environment:'isolated emulator; synthetic funds; live mainnet parameters',parametersObservedAt:snapshot.observedAt,createdAt:new Date().toISOString(),transactions:[],rejections:[],ownership:[]};
const raw=[];
async function send(label,tx,options={}){
 const built=await tx.complete(options),signed=await built.sign.withWallet().complete(),cml=signed.toTransaction(),bytes=signed.toCBOR().length/2,fee=cml.body().fee();
 assert.ok(bytes<=snapshot.parameters.maxTxSize);
 assert.equal(cml.body().to_cbor_hex(),built.toTransaction().body().to_cbor_hex(),'Signing changed body');
 if(cml.auxiliary_data())assert.equal(CML.hash_auxiliary_data(cml.auxiliary_data()).to_hex(),cml.body().auxiliary_data_hash().to_hex());
 if(label==='existing holder can receive second card') {
  const unsigned=built.toCBOR();
  const forbidden=(await(await make(alice,[[0,eve]])).complete({localUPLCEval:false})).toCBOR();
  const ledger=Object.values(emu.ledger).filter(x=>!x.spent).map(x=>x.utxo);
  writeFileSync('evidence/evaluation-context-raw.json',JSON.stringify({unsigned,forbidden,ledger},(_,v)=>typeof v==='bigint'?{$bigint:String(v)}:v,2)+'\n');
 }
 const hash=await signed.submit();emu.awaitBlock();
 raw.push({label,cbor:signed.toCBOR()});
 report.transactions.push({label,hash,signedBytes:bytes,feeLovelace:String(fee)});console.log('PASS',label,bytes,'bytes; fee',String(fee));
 return {hash,built,signed,fee};
}
async function reject(label,make,{signed=false,pattern}={}){
 let reason;try {const built=await(await make()).complete();if(signed)await(await built.sign.withWallet().complete()).submit();}catch(e){reason=String(e);}
 assert.ok(reason,label+' unexpectedly accepted');
 assert.match(reason,pattern??(signed?/witness|signer|signature/i:/failed script execution|validator crashed/i));
 report.rejections.push({label,reason:reason.split('\n')[0]});console.log('REJECT',label);
}
let split=lucid.newTx();for(let i=0;i<7;i++)split=split.pay.ToAddress(home.address,{lovelace:150_000_000n});
const funded=await send('prepare isolated seed outputs',split);
const outputs=(await emu.getUtxos(home.address)).filter(u=>u.txHash===funded.hash).sort((a,b)=>a.outputIndex-b.outputIndex);
const seeds=Object.fromEntries(['params','template','registry','state','issue'].map((n,i)=>[n,outputs[i]]));
const reserved=new Set(Object.values(seeds).map(u=>u.txHash+'#'+u.outputIndex));
const c=T.derive({seeds,admin:key(home),network:'Custom'});report.scripts=c.ids;
async function feeInput(){return(await emu.getUtxos(home.address)).find(u=>!reserved.has(u.txHash+'#'+u.outputIndex)&&!u.scriptRef&&u.assets.lovelace>25_000_000n);}
await send('register bootstrap authority',T.registration(lucid,c,['lock']).collectFrom([await feeInput()]),{coinSelection:false});
await send('bootstrap immutable CIP-113 core',T.bootstrap(lucid,c),{coinSelection:false});
await send('create bounded ownership record',T.createState(lucid,c),{coinSelection:false});
for(const keys of [['dispatcher','delegate','transfer'],['issue','issuance']])await send('register '+keys.join('/'),T.registration(lucid,c,keys).collectFrom([await feeInput()]),{coinSelection:false});
const get=unit=>emu.getUtxoByUnit(unit),state=()=>get(c.ids.state+T.names.state),params=()=>get(c.ids.params+T.names.params),registry=()=>get(c.ids.registry+c.ids.nft);
await send('register collection policy once',T.registerPolicy(lucid,c,{state:await state(),params:await params(),template:await get(c.ids.template+T.names.template),covering:await get(c.ids.registry)}),{coinSelection:false});
// Avoid counting on a number-of-cards reduction to solve the old size overrun.
// Publish the heavy scripts in bounded transactions and measure all signed bytes.
const scriptRefs=[];
for(const k of ['state']){
 const r=await send('publish recoverable '+k+' reference',T.references(lucid,c,home.address,[k]).collectFrom([await feeInput()]),{coinSelection:false});
 scriptRefs.push(...(await emu.getUtxos(home.address)).filter(u=>u.txHash===r.hash&&u.scriptRef));
}
const refsFor=keys=>scriptRefs.filter(u=>keys.some(k=>validatorToScriptHash(u.scriptRef)===c.ids[k]));
const ctx=async()=>({state:await state(),params:await params(),registry:await registry()});
const metadata={};for(let i=1;i<=3;i++){
 const art=readFileSync(`../../experiments/three-card-circle/archive/showcase/card-0${i}.svg`);
 metadata['CARD0'+i]={name:`NFT-Studio Circle ${i}/3`,mediaType:'image/svg+xml',image:('data:image/svg+xml;base64,'+art.toString('base64')).match(/.{1,64}/g),description:['Three distinct programmable NFT-Studio cards.','Hold one or two: send to an existing holder.','Hold all three before transfer: invite a new owner.'],website:['https://beacnpool.github.io/NFT-Studio/','showcase/three-card-circle/']};
}
const mintArgs={...await ctx(),refs:refsFor(['state','issue','issuance']),metadata};
const issued=await send('issue exactly three distinct cards to creator',T.mintAll(lucid,c,mintArgs).collectFrom([await feeInput()]),{coinSelection:false});
const md=JSON.parse(CML.decode_metadatum_to_json_str(issued.signed.toTransaction().auxiliary_data().metadata().get(721n),CML.MetadataJsonSchema.NoConversions));
report.artwork=[];for(let i=1;i<=3;i++){
 const art=readFileSync(`../../experiments/three-card-circle/archive/showcase/card-0${i}.svg`),recovered=Buffer.from(md[c.ids.nft]['CARD0'+i].image.join('').split(',')[1],'base64');
 assert.deepEqual(recovered,art);report.artwork.push({name:'CARD0'+i,bytes:art.length,sha256:createHash('sha256').update(art).digest('hex')});
}
async function checkOwners(label,expected){
 const st=T.decodeState(await state());assert.deepEqual(st.owners,expected.map(key));
 for(let i=0;i<3;i++){const u=await get(c.ids.nft+T.cardNames[i]);assert.equal(u.address,c.holder(st.owners[i]));assert.equal(u.assets[c.ids.nft+T.cardNames[i]],1n);}
 report.ownership.push({label,revision:String(st.revision),owners:st.owners});
}
await checkOwners('issued',[home,home,home]);
report.cardBackingLovelace=String((await Promise.all(T.cardNames.map(n=>get(c.ids.nft+n)))).reduce((sum,u)=>sum+u.assets.lovelace,0n));
const make=async(sender,entries,options={})=>T.transfer(lucid,c,{...await ctx(),cards:await Promise.all(entries.map(([i])=>get(c.ids.nft+T.cardNames[i]))),moves:Object.fromEntries(entries.map(([i,to])=>[T.cardNames[i],key(to)])),signers:[key(sender)],refs:refsFor(['state','delegate']),...options});
await reject('transfer cannot omit consumed ownership record',()=>make(home,[[0,alice]],{omitState:true}));
await reject('record cannot lie about recipient',()=>make(home,[[0,alice]],{mutateOwners:[key(eve),key(home),key(home)]}));
await reject('cards cannot escape to a normal address',()=>make(home,[[0,alice]],{normalAddress:alice.address}));
await send('all-three owner introduces two new owners atomically',await make(home,[[0,alice],[1,bob]]));
await checkOwners('first distribution',[alice,bob,home]);
choose(alice);
await reject('one-card owner cannot introduce outsider',()=>make(alice,[[0,eve]]));
await reject('ownership cannot be authorized by reference alone',()=>make(alice,[[0,bob]],{omitState:true}));
await reject('forged signer list is caught by ledger',()=>make(bob,[[1,alice]]),{signed:true});
await send('existing holder can receive second card',await make(alice,[[0,bob]]));
await checkOwners('two held by Bob',[bob,bob,home]);
choose(bob);await reject('two-card owner cannot introduce outsider',()=>make(bob,[[0,eve]]));
// A holder gaining the third in this transaction cannot already send to a new
// owner: both moves must use the same authenticated pre-transaction vector.
await reject('cannot become all-three and invite in same transaction',()=>make(bob,[[0,eve],[2,bob]],{signers:[key(bob),key(home)]}));
choose(home);await send('holder of two can receive the third',await make(home,[[2,bob]]));
await checkOwners('all three held by Bob',[bob,bob,bob]);
choose(bob);
const staleState=await state(),staleCard=await get(c.ids.nft+T.cardNames[2]);
const concurrent=await(await make(bob,[[2,eve]])).complete();
await send('all-three owner transfers whole set to a new owner',await make(bob,[[0,alice],[1,alice],[2,alice]]));
let concurrentError;try{await(await concurrent.sign.withWallet().complete()).submit();}catch(e){concurrentError=String(e);}
assert.match(concurrentError??'',/UTxO|spent|input/i);report.rejections.push({label:'concurrent transaction loses spent state',reason:concurrentError.split('\n')[0]});
assert.ok(!(await emu.getUtxosByOutRef([staleState,staleCard])).length);
await checkOwners('whole set moved',[alice,alice,alice]);
choose(home);await reject('issuance cannot repeat',async()=>T.mintAll(lucid,c,{...await ctx(),refs:refsFor(['state','issue','issuance']),metadata}));
report.registrationDepositsLovelace=String(BigInt(snapshot.parameters.keyDeposit)*6n);
report.referenceReserveLovelace=String(scriptRefs.reduce((n,u)=>n+u.assets.lovelace,0n));
report.permanentProtocolLovelace=String((await Promise.all(['params','fail','registry'].map(n=>emu.getUtxos(c.address(n))))).flat().reduce((n,u)=>n+u.assets.lovelace,0n));
report.stateBackingLovelace=String((await state()).assets.lovelace);
const issueIndex=report.transactions.findIndex(t=>t.label.startsWith('issue exactly'));
report.activationFeesLovelace=String(report.transactions.slice(0,issueIndex+1).reduce((n,t)=>n+BigInt(t.feeLovelace),0n));
report.activationTotalLovelace=String(['activationFeesLovelace','registrationDepositsLovelace','referenceReserveLovelace','permanentProtocolLovelace','stateBackingLovelace','cardBackingLovelace'].reduce((n,k)=>n+BigInt(report[k]),0n));
report.ok=true;
writeFileSync('evidence/emulator.json',JSON.stringify(report,null,2)+'\n');
writeFileSync('evidence/transactions-raw.json',JSON.stringify(raw,null,2)+'\n');
console.log('COMPLETE',report.transactions.length,'signed transactions;',report.rejections.length,'rejections.');
