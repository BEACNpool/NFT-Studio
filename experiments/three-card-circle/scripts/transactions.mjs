/** NFT-Studio THREE-CARD CIRCLE transaction builders. No signing, submission or key loading. */
import blueprint from '../contracts/plutus.json' with {type:'json'};
import {applyParamsToScript,applySingleCborEncoding,Constr,Data,validatorToScriptHash as hash,validatorToAddress,validatorToRewardAddress,credentialToAddress,credentialToRewardAddress,fromText,CML,calculateMinLovelaceFromUTxO,fromHex} from '@lucid-evolution/lucid';
export const d=(i,...fields)=>new Constr(i,fields),sc=h=>d(1,h),vk=h=>d(0,h),unit=Data.void();
export const names={state:fromText('CIRCLE_STATE'),params:fromText('ProtocolParams'),template:fromText('IssuanceCborHex')};
export const outref=u=>d(0,u.txHash,BigInt(u.outputIndex));
export function script(title,params=[]){const v=blueprint.validators.find(v=>v.title===title);if(!v)throw Error(`Unknown script ${title}`);return {type:'PlutusV3',script:params.length?applyParamsToScript(v.compiledCode,params):v.compiledCode};}
export function derive({seeds,admin,network='Preview'}){
 if(!/^[a-f0-9]{56}$/.test(admin))throw Error('Expected admin payment key hash');
 const s={};s.fail=script('always_fail.always_fail.spend',[0n]);
 s.lock=script('circle_scripts.bootstrap_only.withdraw',[outref(seeds.params)]);
 s.params=script('protocol_params.protocol_params.mint',[outref(seeds.params)]);
 s.template=script('issuance_cbor_hex_mint.issuance_cbor_hex_mint.mint',[outref(seeds.template),hash(s.fail)]);
 s.registry=script('registry.registry.mint',[outref(seeds.registry),hash(s.template)]);
 s.plb=script('programmable_logic_base.programmable_logic_base.spend',[hash(s.params)]);
 const p=[sc(hash(s.plb)),hash(s.registry),256n];
 s.delegate=script('transfer.transfer.withdraw',p);s.third=script('third_party.third_party.withdraw',p);s.unfracking=script('unfracking.unfracking.withdraw',p);
 s.dispatcher=script('programmable_logic_global.programmable_logic_global.withdraw',[hash(s.delegate),hash(s.third),hash(s.unfracking)]);
 s.issuance=script('issuance_logic.issuance_logic.withdraw',[sc(hash(s.plb)),hash(s.registry),hash(s.params),256n]);
 s.state=script('circle_scripts.state.mint',[outref(seeds.state),admin,sc(hash(s.plb))]);
 s.denied=script('circle_scripts.denied.withdraw');
 s.transfer=script('circle_scripts.transfer.withdraw',[hash(s.state)]);
 s.issue=script('circle_scripts.issue.withdraw',[outref(seeds.issue),admin,hash(s.state),hash(s.registry),sc(hash(s.denied))]);
 s.nft=script('issuance_mint.issuance_mint.mint',[sc(hash(s.issue)),hash(s.params)]);
 const ids=Object.fromEntries(Object.entries(s).map(([k,v])=>[k,hash(v)]));

 const address=k=>validatorToAddress(network,s[k]);const reward=k=>validatorToRewardAddress(network,s[k]);
 const holder=key=>credentialToAddress(network,{type:'Script',hash:ids.plb},{type:'Key',hash:key});
 const single=applySingleCborEncoding(s.nft.script),split=single.split(ids.issue);if(split.length!==2)throw Error('Issuance template hash must appear exactly once');
 const templateDatum=Data.to(d(0,...split));
 const paramsDatum=Data.to(d(0,sc(ids.dispatcher),sc(ids.issuance),sc(ids.delegate),sc(ids.third),sc(ids.lock),d(1)));
 const node=(key,next,issue=vk(''),transfer=vk(''),third=vk(''),state='')=>Data.to(d(0,key,next,issue,transfer,third,vk(''),state));
 const sentinel='ff'.repeat(30);
 return {network,seeds,admin,s,ids,address,reward,holder,templateDatum,paramsDatum,node,sentinel,adminReward:credentialToRewardAddress(network,{type:'Key',hash:admin})};
}
export const sorted=refs=>[...refs].sort((a,b)=>a.txHash.localeCompare(b.txHash)||a.outputIndex-b.outputIndex);
const idx=(refs,u)=>BigInt(sorted(refs).findIndex(x=>x.txHash===u.txHash&&x.outputIndex===u.outputIndex));
const inline=datum=>({kind:'inline',value:datum});
export function registration(lucid,c,keys){let tx=lucid.newTx();for(const key of keys)tx=tx.register.Stake(c.reward(key),unit).attach.CertificateValidator(c.s[key]);return tx;}
export function bootstrap(lucid,c){return lucid.newTx().collectFrom([c.seeds.params,c.seeds.registry,c.seeds.template])
 .withdraw(c.reward('lock'),0n,unit).attach.WithdrawalValidator(c.s.lock).addSignerKey(c.admin)
 .mintAssets({[c.ids.params+names.params]:1n},unit).attach.MintingPolicy(c.s.params)
 .mintAssets({[c.ids.template+names.template]:1n},unit).attach.MintingPolicy(c.s.template)
 .mintAssets({[c.ids.registry]:1n},Data.to(d(0))).attach.MintingPolicy(c.s.registry)
 .pay.ToContract(c.address('params'),inline(c.paramsDatum),{lovelace:0n,[c.ids.params+names.params]:1n})
 .pay.ToContract(c.address('fail'),inline(c.templateDatum),{lovelace:0n,[c.ids.template+names.template]:1n})
 .pay.ToContract(c.address('registry'),inline(c.node('',c.sentinel)),{lovelace:0n,[c.ids.registry]:1n});}
export function registerPolicy(lucid,c,{state,params,template,covering}){
 const old=Data.from(covering.datum),[key,next]=old.fields;if(!(key<c.ids.nft&&c.ids.nft<next))throw Error('Wrong registry covering node');
 const updated=d(0,...old.fields);updated.fields[1]=c.ids.nft;
 return lucid.newTx().collectFrom([c.seeds.issue]).collectFrom([covering],unit).readFrom([state,params,template]).addSignerKey(c.admin)
 .mintAssets({[c.ids.registry+c.ids.nft]:1n},Data.to(d(1,c.ids.nft,sc(c.ids.issue)))).attach.MintingPolicy(c.s.registry).attach.SpendingValidator(c.s.registry)
 .withdraw(c.reward('issue'),0n,Data.to(d(0))).attach.WithdrawalValidator(c.s.issue)
 .pay.ToContract(c.address('registry'),inline(Data.to(updated)),covering.assets)
 .pay.ToContract(c.address('registry'),inline(c.node(c.ids.nft,next,sc(c.ids.issue),sc(c.ids.transfer),sc(c.ids.denied),c.ids.state)),{lovelace:0n,[c.ids.registry+c.ids.nft]:1n});
}

export const cardNames = ['CARD01','CARD02','CARD03'].map(fromText);
export const stateDatum = (c,{owners=[c.admin,c.admin,c.admin],active=false,revision=0n}={}) => {
 if(owners.length!==3||owners.some(k=>!/^[a-f0-9]{56}$/.test(k)))throw Error('Three owner key hashes required');
 return Data.to(d(0,1n,c.ids.nft,c.ids.transfer,owners,d(active?1:0),BigInt(revision)));
};
export const decodeState = u => {const [version,policy,transfer,owners,active,revision]=Data.from(u.datum).fields;return {version,policy,transfer,owners,active:active.index===1,revision};};
export function createState(lucid,c){return lucid.newTx().collectFrom([c.seeds.state]).addSignerKey(c.admin)
 .mintAssets({[c.ids.state+names.state]:1n},unit).attach.MintingPolicy(c.s.state)
 .pay.ToContract(c.address('state'),inline(stateDatum(c)),{lovelace:0n,[c.ids.state+names.state]:1n});}
// Reference scripts are held in explicitly designated issuer-key outputs. Their
// removal does not change authority; the identical script can be republished.
export function references(lucid,c,address,keys){let tx=lucid.newTx();for(const k of keys)tx=tx.pay.ToAddressWithData(address,undefined,{lovelace:0n},c.s[k]);return tx;}
function attach(tx,c,refs,key,purpose){return refs.some(u=>u.scriptRef&&hash(u.scriptRef)===c.ids[key])?tx:tx.attach[purpose](c.s[key]);}
export function mintAll(lucid,c,{state,params,registry,refs=[],metadata}){
 const context=[params,registry,...refs];
 let tx=lucid.newTx().collectFrom([state],unit).readFrom(context).addSignerKey(c.admin)
 .mintAssets(Object.fromEntries(cardNames.map(n=>[c.ids.nft+n,1n])),Data.to(d(0,idx(context,params)))).attach.MintingPolicy(c.s.nft)
 .withdraw(c.reward('issue'),0n,Data.to(d(1)))
 .withdraw(c.reward('issuance'),0n,Data.to(new Map([[c.ids.nft,d(0,idx(context,registry))]])))
 .pay.ToContract(c.address('state'),inline(stateDatum(c,{active:true,revision:decodeState(state).revision+1n})),state.assets);
 for(const [key,purpose] of [['state','SpendingValidator'],['issue','WithdrawalValidator'],['issuance','WithdrawalValidator']])tx=attach(tx,c,refs,key,purpose);
 for(const name of cardNames)tx=tx.pay.ToAddress(c.holder(c.admin),{lovelace:0n,[c.ids.nft+name]:1n});
 if(metadata)tx=tx.attachMetadata(721,{[c.ids.nft]:metadata,version:'1.0'});
 return tx;
}
export function transfer(lucid,c,{state,params,registry,cards,moves,signers,refs=[],mutateOwners,omitState=false,normalAddress}){
 const before=decodeState(state),owners=[...before.owners];
 const context=[params,registry,...refs,...(omitState?[state]:[])];
 const withdrawals=['dispatcher','delegate','transfer'].sort((a,b)=>c.ids[a].localeCompare(c.ids[b]));
 let tx=lucid.newTx().readFrom(context)
 .withdraw(c.reward('dispatcher'),0n,Data.to(d(0)))
 .withdraw(c.reward('delegate'),0n,Data.to(d(0,[d(0,idx(context,registry))])))
 .withdraw(c.reward('transfer'),0n,unit);
 if(!omitState)tx=tx.collectFrom([state],unit);
 for(const u of cards){
  const token=Object.keys(u.assets).find(n=>n.startsWith(c.ids.nft)),name=token?.slice(56),i=cardNames.indexOf(name);
  if(i<0||!moves[name])throw Error('Every selected card needs a destination');
  owners[i]=moves[name];
  tx=tx.collectFrom([u],Data.to(d(0,idx(context,params),BigInt(withdrawals.indexOf('dispatcher')))))
   .pay.ToAddress(normalAddress??c.holder(moves[name]),u.assets);
 }
 if(!omitState)tx=tx.pay.ToContract(c.address('state'),inline(stateDatum(c,{owners:mutateOwners??owners,active:true,revision:before.revision+1n})),state.assets);
 for(const k of signers)tx=tx.addSignerKey(k);
 for(const key of ['dispatcher','delegate','transfer'])tx=attach(tx,c,refs,key,'WithdrawalValidator');
 tx=attach(tx,c,refs,'plb','SpendingValidator');
 if(!omitState)tx=attach(tx,c,refs,'state','SpendingValidator');
 return tx;
}
