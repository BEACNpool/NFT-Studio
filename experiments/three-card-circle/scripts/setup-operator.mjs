/** Explicit mainnet preparation/execution CLI. No background service or automatic activation. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,openSync,closeSync,fsyncSync,renameSync,unlinkSync,existsSync,lstatSync,realpathSync,rmdirSync,readdirSync} from 'node:fs';
import {createHash,randomUUID,randomBytes} from 'node:crypto';
import {hostname} from 'node:os';
import {dirname,join,resolve,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Lucid,CML,credentialToAddress,getAddressDetails} from '@lucid-evolution/lucid';
import {limits,labels,encode,decode,validatePlan,context,buildStep,executePacket,outputs} from './setup-workflow.mjs';
import {makeProvider} from './setup-provider.mjs';
import * as T from './transactions.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const repo=resolve(root,'../..');
const sha=x=>createHash('sha256').update(x).digest('hex');
export function privatePath(path,kind='file'){
 const st=lstatSync(path);
 assert.ok(kind==='directory'?st.isDirectory():st.isFile(),'Protected path has the wrong type (symlinks are forbidden)');
 assert.equal(st.uid,process.getuid(),'Protected path belongs to another user');
 assert.equal(st.mode&0o777,kind==='directory'?0o700:0o600,'Protected path permissions are too broad');
}
export function createDirectory(directory){
 // Never follow a final-component symlink or let two prepare processes share a wallet.
 assert.equal(realpathSync(dirname(directory)),dirname(directory),'Use the canonical private parent path');
 mkdirSync(directory,{mode:0o700});syncDir(dirname(directory));privatePath(directory,'directory');
}
export function fingerprint(){
 const paths=['scripts/setup-operator.mjs','scripts/setup-workflow.mjs','scripts/setup-provider.mjs','scripts/transactions.mjs','scripts/submission.mjs','contracts/plutus.json','package-lock.json'];
 return sha(paths.map(p=>p+':'+sha(readFileSync(join(root,p)))).join('\n')+'\n'+[1,2,3].map(i=>sha(readFileSync(join(repo,`public/showcase/three-card-circle/card-0${i}.svg`)))).join('\n'));
}
const syncDir=dir=>{const fd=openSync(dir,'r');try{fsyncSync(fd);}finally{closeSync(fd);}};
export function createFile(path,text){
 const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,text);fsyncSync(fd);}finally{closeSync(fd);}syncDir(dirname(path));
}
export function persistJournal(directory,journal){
 privatePath(directory,'directory');
 const text=encode(journal)+'\n',versions=join(directory,'journal-revisions');mkdirSync(versions,{recursive:true,mode:0o700});privatePath(versions,'directory');
 const version=join(versions,Date.now()+'-'+randomUUID()+'.json');createFile(version,text);
 const tmp=join(directory,'journal-'+randomUUID()+'.tmp');createFile(tmp,text);renameSync(tmp,join(directory,'journal.json'));syncDir(directory);
 assert.equal(readFileSync(join(directory,'journal.json'),'utf8'),text,'Journal readback failed');
}
export function attemptStorage(directory){
 privatePath(directory,'directory');
 const dir=join(directory,'attempts');mkdirSync(dir,{recursive:true,mode:0o700});privatePath(dir,'directory');
 return {getItem:key=>{const path=join(dir,sha(key)+'.json');return existsSync(path)?readFileSync(path,'utf8'):null;},setItem:(key,value)=>{
  const path=join(dir,sha(key)+'.json');
  if(!existsSync(path)){createFile(path,value);return;}
  const old=JSON.parse(readFileSync(path,'utf8')),next=JSON.parse(value);
  assert.equal(next.id,old.id);assert.notEqual(next.status,'attempted','An attempt marker already exists');
  createFile(join(dir,sha(key)+'-'+Date.now()+'-'+randomUUID()+'.json'),value);
 }};
}
function summary(plan){return {operation:plan.operation,network:plan.network,planHash:plan.planHash,expiresAt:plan.expiresAt,fundingAddress:plan.setupAddress,recipientAddress:plan.recipientAddress,amountADA:'55',feeCapADA:'5.5',minimumReturnedADA:'5',expectedReferenceReserveADA:'15.399630',scope:labels.map((label,index)=>index===0&&plan.fundingTokenReturn?'prepare seed outputs and return funding token':label),fundingTokenReturn:plan.fundingTokenReturn?{address:plan.recipientAddress,ada:'2',assets:Object.fromEntries(Object.entries(plan.fundingTokenReturn.assets).map(([unit,quantity])=>[unit,String(quantity)])),input:plan.fundingTokenReturn.input}:undefined,status:'prepared; no mainnet signing or submission authorized by this file'};}
export function planHash(plan){const copy={...plan};delete copy.planHash;return sha(encode(copy));}
export function loadPlan(directory){privatePath(directory,'directory');privatePath(join(directory,'plan.json'));const plan=decode(readFileSync(join(directory,'plan.json'),'utf8'));assert.equal(planHash(plan),plan.planHash,'Prepared plan was changed');validatePlan(plan);assert.equal(plan.sourceFingerprint,fingerprint(),'Reviewed source changed; preserve this wallet and renew its reviewed plan');return plan;}
export async function withRunLock(directory,run){
 const lock=join(directory,'run.lock');mkdirSync(lock,{mode:0o700});syncDir(directory);
 try{createFile(join(lock,'owner.json'),JSON.stringify({pid:process.pid,host:hostname(),startedAt:new Date().toISOString()}));return await run();}
 finally{if(existsSync(join(lock,'owner.json')))unlinkSync(join(lock,'owner.json'));rmdirSync(lock);syncDir(directory);}
}
/** Renew only an unstarted plan, retaining the existing wallet and complete prior plan. */
export async function renewUnstartedPlan(directory,previousHash,prepare){
 privatePath(directory,'directory');
 return withRunLock(directory,async()=>{
  for(const file of ['plan.json','journal.json','setup.key','funding-instruction.json'])privatePath(join(directory,file));
  const previous=decode(readFileSync(join(directory,'plan.json'),'utf8')),journal=decode(readFileSync(join(directory,'journal.json'),'utf8'));
  assert.equal(planHash(previous),previous.planHash,'Previous plan was changed');
  assert.equal(previous.planHash,previousHash,'Renewal must name the exact previous plan');
  assert.equal(previous.operatorHost,hostname());
  assert.equal(journal.planHash,previous.planHash);assert.equal(journal.steps.length,0,'Cannot renew a started plan');
  assert.ok(!existsSync(join(directory,'confirmed-receipt.json')),'Cannot renew a completed plan');
  const attempts=join(directory,'attempts');
  if(existsSync(attempts)){privatePath(attempts,'directory');assert.equal(readdirSync(attempts).length,0,'Cannot renew after any submission attempt');}
  const next=await prepare(previous);
  for(const field of ['operation','network','operatorHost','setupAddress','recipientAddress','fundingLovelace','artwork'])assert.equal(encode(next[field]),encode(previous[field]),`Renewal cannot change ${field}`);
  assert.equal(next.previousPlanHash,previous.planHash);assert.equal(next.sourceFingerprint,fingerprint());
  next.planHash=planHash(next);assert.notEqual(next.planHash,previous.planHash);validatePlan(next);
  const archives=join(directory,'plans');mkdirSync(archives,{recursive:true,mode:0o700});privatePath(archives,'directory');
  const archive=join(archives,previous.planHash);createDirectory(archive);
  for(const file of ['plan.json','journal.json','funding-instruction.json'])createFile(join(archive,file),readFileSync(join(directory,file),'utf8'));
  // Each replacement is atomic. An interrupted multi-file renewal fails closed on plan/journal mismatch.
  const replace=(name,text)=>{const tmp=join(directory,name+'-'+randomUUID()+'.tmp');createFile(tmp,text);renameSync(tmp,join(directory,name));syncDir(directory);};
  replace('plan.json',encode(next)+'\n');
  persistJournal(directory,{schema:1,planHash:next.planHash,steps:[]});
  replace('funding-instruction.json',JSON.stringify(summary(next),null,2)+'\n');
  assert.equal(loadPlan(directory).planHash,next.planHash);
  return next;
 });
}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 const [command,...args]=process.argv.slice(2),options={};
 for(let i=0;i<args.length;i+=2){assert.ok(args[i]?.startsWith('--')&&args[i+1],'Expected named option/value pairs');options[args[i].slice(2)]=args[i+1];}
 assert.ok(['prepare','inspect','renew','execute'].includes(command),'Choose prepare, inspect, renew or execute');
 assert.ok(options.host,'Pass the verified operator hostname with --host');
 assert.equal(hostname(),options.host,'This is not the reviewed operator host');
 assert.ok(options.directory&&isAbsolute(options.directory),'Pass an absolute protected credential directory');
 const directory=resolve(options.directory||'');
 assert.ok(directory!==repo&&!directory.startsWith(repo+sep),'Credentials must be outside the public repository');
 if(command==='inspect'){console.log(JSON.stringify(summary(loadPlan(directory)),null,2));return;}
 assert.ok(options.credential,'Pass the existing Blockfrost credential path');
 if(command==='renew'){
  assert.match(options.previous??'',/^[a-f0-9]{64}$/,'Name the previous plan with --previous');
  assert.match(options['return-token']??'',/^[a-f0-9]{56}(?:[a-f0-9]{2}){0,32}$/,'Name the enclosed token with --return-token');
  const transport=makeProvider(options.credential);
  const plan=await renewUnstartedPlan(directory,options.previous,async previous=>{
   await transport.verifyNetwork();const parameters=await transport.provider.getProtocolParameters();
   const test=JSON.parse(readFileSync(join(root,'evidence/setup-token-checks.json'),'utf8'));
   assert.equal(test.ok,true);assert.equal(test.transactions.length,11);assert.ok(Date.now()-Date.parse(test.createdAt)<86400000,'Refresh the token-return rehearsal');
   assert.equal(test.fundingTokenReturn.unitBytes,options['return-token'].length/2);assert.equal(test.fundingTokenReturn.lovelace,'2000000');
   const measured=decode(readFileSync(join(root,'evidence/mainnet-parameters.json'),'utf8')).parameters;
   for(const k of Object.keys(measured))assert.equal(encode(parameters[k]),encode(measured[k]),`Rehearse current parameters before renewal: ${k}`);
   const funded=await transport.provider.getUtxos(previous.setupAddress);assert.equal(funded.length,1,'Expected one funding output');
   assert.deepEqual(funded[0].assets,{lovelace:limits.funding,[options['return-token']]:1n},'Unexpected funding assets');
   assert.ok(!funded[0].datum&&!funded[0].datumHash&&!funded[0].scriptRef);
   assert.equal((await transport.status(funded[0].txHash)).status,'confirmed','Funding needs three confirmations');
   return {...previous,previousPlanHash:previous.planHash,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+12*3600000).toISOString(),sourceFingerprint:fingerprint(),parameters,fundingTokenReturn:{input:{txHash:funded[0].txHash,outputIndex:funded[0].outputIndex},lovelace:'2000000',assets:{[options['return-token']]:1n}}};
  });
  console.log(JSON.stringify(summary(plan),null,2));return;
 }
 if(command==='prepare'){
  assert.ok(options.recipient,'A reviewed VESPR recipient address is required');
  const recipient=getAddressDetails(options.recipient);assert.equal(recipient.networkId,1);assert.equal(recipient.paymentCredential?.type,'Key');
  assert.ok(!existsSync(directory),'Setup directory already exists; inspect it instead of creating another wallet');
  const transport=makeProvider(options.credential);await transport.verifyNetwork();
  const parameters=await transport.provider.getProtocolParameters();
  const test=JSON.parse(readFileSync(join(root,'evidence/setup-checks.json'),'utf8'));
  assert.equal(test.ok,true);assert.equal(test.transactions.length,11);assert.ok(Date.now()-Date.parse(test.createdAt)<86400000,'Refresh the exact setup rehearsal');
  const measured=decode(readFileSync(join(root,'evidence/mainnet-parameters.json'),'utf8')).parameters;
  for(const k of Object.keys(measured))assert.equal(encode(parameters[k]),encode(measured[k]),`Rehearse current parameters before funding: ${k}`);
  createDirectory(directory);
  const secret=CML.PrivateKey.generate_ed25519(),address=credentialToAddress('Mainnet',{type:'Key',hash:secret.to_public().hash().to_hex()});
  const keyPath=join(directory,'setup.key');createFile(keyPath,secret.to_bech32()+'\n');
  // Verify durable key control inside this process; never print key bytes.
  const recovered=CML.PrivateKey.from_bech32(readFileSync(keyPath,'utf8').trim()),challenge=randomBytes(32);
  assert.equal(recovered.to_public().hash().to_hex(),secret.to_public().hash().to_hex());
  assert.equal(recovered.to_public().verify(challenge,recovered.sign(challenge)),true);privatePath(keyPath);
  const plan={operation:'activate-three-card-circle',network:'Mainnet',operatorHost:hostname(),createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+12*3600000).toISOString(),sourceFingerprint:fingerprint(),fundingLovelace:String(limits.funding),setupAddress:address,recipientAddress:options.recipient,parameters,artwork:[1,2,3].map(i=>readFileSync(join(repo,`public/showcase/three-card-circle/card-0${i}.svg`),'utf8'))};
  plan.planHash=planHash(plan);validatePlan(plan);createFile(join(directory,'plan.json'),encode(plan)+'\n');
  persistJournal(directory,{schema:1,planHash:plan.planHash,steps:[]});
  createFile(join(directory,'funding-instruction.json'),JSON.stringify(summary(plan),null,2)+'\n');
  console.log(JSON.stringify(summary(plan),null,2));return;
 }
 const plan=loadPlan(directory);
 assert.equal(plan.operatorHost,hostname(),'Prepared plan belongs to a different operator host');
 assert.equal(options.approve,plan.planHash,'Execution requires the exact plan hash after explicit user approval');
 await withRunLock(directory,async()=>{
  const transport=makeProvider(options.credential,{canSubmit:true});await transport.verifyNetwork();
  assert.equal(encode(await transport.provider.getProtocolParameters()),encode(plan.parameters),'Protocol parameters changed since the approved plan');
  const keyPath=join(directory,'setup.key');privatePath(keyPath);privatePath(join(directory,'journal.json'));
  const secret=readFileSync(keyPath,'utf8').trim();
  assert.equal(CML.PrivateKey.from_bech32(secret).to_public().hash().to_hex(),getAddressDetails(plan.setupAddress).paymentCredential.hash,'Wrong setup signer');
  const lucid=await Lucid(transport.provider,'Mainnet');lucid.selectWallet.fromPrivateKey(secret);
  const journal=decode(readFileSync(join(directory,'journal.json'),'utf8'));assert.equal(journal.planHash,plan.planHash);
  const storage=attemptStorage(directory),locks={request:async(_,f)=>f()},save=async j=>persistJournal(directory,j);
  const confirm=async id=>{
   for(let tries=0;tries<120;tries++){
    const state=await transport.status(id);if(state.status==='confirmed')return state;
    if(tries%4===0)console.log('Awaiting three confirmations:',id,state.confirmations??0);
    await wait(10000);
   }
   throw Error('Confirmation timeout; reconcile the saved transaction ID without resubmitting');
  };
  for(let index=0;index<labels.length;index++){
   const previous=journal.steps[index],attempt=storage.getItem('nft-studio-circle-attempt:'+plan.planHash+':'+index);
   if(previous?.status==='confirmed'){
    assert.equal((await transport.status(previous.id??previous.hash)).status,'confirmed','A previously confirmed setup step is no longer confirmed');continue;
   }
   if(attempt){
    const marker=JSON.parse(attempt);assert.ok(previous&&previous.hash===marker.id,'Attempt/packet mismatch');
    const state=await transport.status(marker.id);assert.equal(state.status,'confirmed','Prior attempt remains unresolved; do not submit or replace it');
    journal.steps[index]={...previous,...marker,status:'confirmed',confirmation:state};await save(journal);continue;
   }
   // A prepared but never-attempted packet can be rebuilt after a timeout.
   if(previous){assert.equal(previous.status,'prepared');journal.steps=journal.steps.slice(0,index);}
   const packet=await buildStep({lucid,provider:transport.provider,plan,journal,index});
   journal.steps[index]={...packet,status:'prepared'};await save(journal);
   await executePacket({packet,lucid,provider:transport.provider,plan,journal,storage,locks,save,freshness:transport.freshness,confirm,evaluate:unsigned=>transport.evaluate(unsigned)});
   console.log('Confirmed:',index,labels[index],journal.steps[index].id);
  }
  const {c}=context(plan,journal),state=await transport.provider.getUtxoByUnit(c.ids.state+T.names.state),record=T.decodeState(state),recipientKey=getAddressDetails(plan.recipientAddress).paymentCredential.hash;
  assert.deepEqual(record.owners,Array(3).fill(recipientKey));assert.equal(record.active,true);assert.equal(record.revision,2n);
  for(const n of T.cardNames){const u=await transport.provider.getUtxoByUnit(c.ids.nft+n);assert.equal(u.address,c.holder(recipientKey));assert.equal(u.assets[c.ids.nft+n],1n);}
  const expectedRefs=context(plan,journal).refs,remaining=await transport.provider.getUtxos(plan.setupAddress);
  assert.equal(remaining.length,1,'Unexpected final setup-wallet outputs; reconcile before completion');
  assert.equal(remaining[0].txHash,expectedRefs[0].txHash);assert.equal(remaining[0].outputIndex,expectedRefs[0].outputIndex);
  assert.equal(remaining[0].assets.lovelace,expectedRefs[0].assets.lovelace,'Reference reserve changed');
  const refund=outputs(journal.steps[10].unsigned);assert.equal(refund.length,1);assert.equal(refund[0].address,plan.recipientAddress);
  const accounting={fundingLovelace:plan.fundingLovelace,feesLovelace:String(journal.steps.reduce((n,s)=>n+BigInt(s.feeLovelace),0n)),refundLovelace:String(refund[0].assets.lovelace),referenceReserveLovelace:String(remaining[0].assets.lovelace)};
  const fundingTokenReturn=plan.fundingTokenReturn?{transactionId:journal.steps[0].id,outputIndex:6,address:plan.recipientAddress,lovelace:plan.fundingTokenReturn.lovelace,assets:Object.fromEntries(Object.entries(plan.fundingTokenReturn.assets).map(([unit,quantity])=>[unit,String(quantity)]))}:undefined;
  const receipt={...accounting,fundingTokenReturn,totalReturnedLovelace:String(BigInt(accounting.refundLovelace)+BigInt(fundingTokenReturn?.lovelace??0)),status:'confirmed',completedAt:new Date().toISOString(),planHash:plan.planHash,recipientAddress:plan.recipientAddress,programmableOwnerAddress:c.holder(recipientKey),transactions:journal.steps.map(({label,id,feeLovelace,confirmation})=>({label,id,feeLovelace,confirmation})),deployment:{network:'Mainnet',statePolicy:c.ids.state,tokenPolicy:c.ids.nft,transferHash:c.ids.transfer,programmableHash:c.ids.plb,startBlock:journal.steps[3].confirmation.blockHeight,confirmations:3,bootstrap:{transactionId:journal.steps[0].hash,admin:c.admin},referenceOutref:T.sorted(context(plan,journal).refs).map(u=>u.txHash+'#'+u.outputIndex)[0]}};
  createFile(join(directory,'confirmed-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt,null,2));
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{
 const message=String(error.message||'Setup stopped').replace(/mainnet[A-Za-z0-9]{8,}/g,'[credential redacted]').replace(/ed25519_sk1[a-z0-9]+/g,'[key redacted]');
 console.error(message);process.exitCode=1;
});
