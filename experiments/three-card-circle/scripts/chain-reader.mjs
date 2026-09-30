import { bech32 } from '@scure/base';

export const BEACN_KOIOS_URL = 'https://koios.beacn.workers.dev/api/v1';
export const stateName = '434952434c455f5354415445';
export const cardNames = ['434152443031','434152443032','434152443033'];
const hex = bytes => Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const hash = x => typeof x==='string' && /^[a-f0-9]{56}$/.test(x);
const txHash = x => typeof x==='string' && /^[a-f0-9]{64}$/.test(x);
const requireThat = (ok,message) => { if (!ok) throw Error(message); };
const ref = u => `${u.tx_hash}#${u.tx_index}`;
const datumKey = u => JSON.stringify(u.inline_datum);
export function validateTip(tip,now=Date.now()) {
  requireThat(Number.isSafeInteger(tip?.block_no) && Number.isFinite(tip?.block_time) && now/1000-tip.block_time<600 && now/1000-tip.block_time>-60,'The chain provider is stale or unavailable.');
  return tip;
}
export async function readKoiosTip({fetcher=globalThis.fetch,base=BEACN_KOIOS_URL}={}) {
  const r=await fetcher(base+'/tip',{cache:'no-store',signal:AbortSignal.timeout(15000)});
  requireThat(r.ok,'BEACN Koios is unavailable.');
  const tips=await r.json(); requireThat(Array.isArray(tips) && tips.length===1,'Unexpected chain tip.');
  return validateTip(tips[0]);
}
// Fixed programmable payment script + owner key in the authenticated datum
// uniquely determine the full mainnet address. Wallet-wide balances are unused.
export function addressForOwner(c,owner) {
  requireThat(hash(c.programmableHash) && hash(owner),'Invalid address credential.');
  const bytes=Uint8Array.from(('11'+c.programmableHash+owner).match(/../g).map(x=>parseInt(x,16)));
  return bech32.encode('addr',bech32.toWords(bytes),150);
}
export function credentials(address) {
  const decoded = bech32.decode(address,150);
  const bytes = bech32.fromWords(decoded.words);
  requireThat(decoded.prefix==='addr' && (bytes[0]&15)===1,'Expected a mainnet address.');
  return {type:bytes[0]>>4,length:bytes.length,payment:hex(bytes.slice(1,29)),stake:hex(bytes.slice(29))};
}
export function validateConfig(c) {
  requireThat(c?.network==='Mainnet' && ['statePolicy','tokenPolicy','transferHash','programmableHash'].every(k=>hash(c[k])), 'Deployment identity is incomplete.');
  requireThat(Number.isSafeInteger(c.startBlock) && c.startBlock>0,'Deployment block is missing.');
  requireThat(c.confirmations===3,'Unexpected confirmation setting.');
  return c;
}
function singleton(u,policy,name) {
  requireThat(u && !u.is_spent && txHash(u.tx_hash) && Number.isSafeInteger(u.tx_index), 'Invalid or spent chain output.');
  requireThat(Array.isArray(u.asset_list) && u.asset_list.length===1 && u.asset_list[0].policy_id===policy && u.asset_list[0].asset_name===name && u.asset_list[0].quantity==='1','Expected exactly one authentic token.');
  requireThat(!u.reference_script,'Unexpected reference script on a collection output.');
}
function confirmed(u,tip,c) {
  requireThat(Number.isSafeInteger(u.block_height) && u.block_height>=c.startBlock && tip.block_no-u.block_height+1>=c.confirmations,'A collection update is awaiting confirmations. Refresh shortly.');
}
export function decodeState(u,c) {
  singleton(u,c.statePolicy,stateName);
  const address=credentials(u.address);
  requireThat(address.type===7 && address.length===29 && address.payment===c.statePolicy,'Ownership record is at the wrong address.');
  const datum=u.inline_datum?.value, f=datum?.fields;
  requireThat(datum?.constructor===0 && Array.isArray(f) && f.length===6,'Ownership datum is invalid.');
  requireThat(f[0]?.int===1 && f[1]?.bytes===c.tokenPolicy && f[2]?.bytes===c.transferHash,'Ownership record identity does not match the deployment.');
  const owners=f[3]?.list?.map(x=>x.bytes);
  requireThat(owners?.length===3 && owners.every(hash),'Expected three owner credentials.');
  requireThat([0,1].includes(f[4]?.constructor) && f[4].fields?.length===0 && Number.isSafeInteger(f[5]?.int) && f[5].int>=0,'Ownership revision is invalid.');
  const active=f[4].constructor===1;
  requireThat(active ? f[5].int>=1 : f[5].int===0,'Unexpected activation revision.');
  return {owners,active,revision:f[5].int,ref:ref(u)};
}
export function validateSnapshot(c,state,outputs,tip,now=Date.now()) {
  validateConfig(c);
  validateTip(tip,now);
  confirmed(state,tip,c);
  const record=decodeState(state,c);
  if (!record.active) { requireThat(outputs.length===0,'Inactive record has issued cards.'); return {...record,cards:[],addresses:[],together:false,tip}; }
  requireThat(outputs.length===3,'Cannot verify all three cards.');
  const addresses=record.owners.map(owner=>addressForOwner(c,owner));
  const cards=cardNames.map((name,i)=>{
    const matches=outputs.filter(u=>u.asset_list?.some(a=>a.policy_id===c.tokenPolicy && a.asset_name===name));
    requireThat(matches.length===1,'A card is missing or duplicated.');
    const u=matches[0]; singleton(u,c.tokenPolicy,name); confirmed(u,tip,c);
    const address=credentials(u.address);
    requireThat(address.type===1 && address.length===57 && address.payment===c.programmableHash && address.stake===record.owners[i],'Card ownership and the authenticated record disagree.');
    requireThat(u.address===addresses[i],'The NFT address differs from its ledger address.');
    requireThat(!u.inline_datum && !u.datum_hash,'Unexpected card datum.');
    return {name,owner:record.owners[i],address:addresses[i],ref:ref(u)};
  });
  return {...record,cards,addresses,together:new Set(addresses).size===1,tip,holders:new Set(addresses).size,transfers:record.revision-1};
}
export class ChainReader {
  constructor(config,{fetcher=globalThis.fetch,base=BEACN_KOIOS_URL}={}) { this.config=validateConfig(config); this.fetcher=fetcher; this.base=base; }
  async request(path,body) {
    const r=await this.fetcher(this.base+'/'+path,{method:body?'POST':'GET',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
    requireThat(r.ok,'Chain data could not be loaded. Please try again.');
    const json=await r.json(); requireThat(Array.isArray(json),'Unexpected chain response.'); return json;
  }
  async state() {
    const rows=await this.request('asset_utxos',{_asset_list:[[this.config.statePolicy,stateName]],_extended:true});
    requireThat(rows.length===1,'Cannot locate the unique ownership record.'); return rows[0];
  }
  async snapshot() {
    const state=await this.state();
    const [cards,tips]=await Promise.all([
      this.request('asset_utxos',{_asset_list:cardNames.map(n=>[this.config.tokenPolicy,n]),_extended:true}),this.request('tip'),
    ]);
    const again=await this.state();
    requireThat(ref(state)===ref(again) && datumKey(state)===datumKey(again),'The collection changed during this check. Refresh to read the latest confirmed owners.');
    requireThat(tips.length===1,'Unexpected chain tip.');
    return validateSnapshot(this.config,state,cards,tips[0]);
  }
  async history(offset=0,limit=3,anchorBlock=null) {
    requireThat(Number.isSafeInteger(offset) && offset>=0 && Number.isSafeInteger(limit) && limit>=1 && limit<=20,'Invalid history page.');
    const [tip]=await this.request('tip');
    validateTip(tip);
    const ceiling=tip.block_no-this.config.confirmations+1;
    if (anchorBlock!==null) requireThat(Number.isSafeInteger(anchorBlock) && anchorBlock<=ceiling,'History confirmation point changed. Refresh the ledger.');
    const anchor=anchorBlock??ceiling;
    const rows=await this.request(`asset_txs?limit=${limit+1}&offset=${offset}&order=block_height.desc,tx_hash.desc&block_height=lte.${anchor}`,{_asset_policy:this.config.statePolicy,_asset_name:stateName,_after_block_height:this.config.startBlock-1,_history:true});
    requireThat(rows.every(u=>txHash(u.tx_hash) && Number.isFinite(u.block_time) && Number.isSafeInteger(u.block_height) && u.block_height>=this.config.startBlock && u.block_height<=anchor),'Invalid history response.');
    requireThat(rows.length<=limit+1 && new Set(rows.map(u=>u.tx_hash)).size===rows.length,'Invalid history page.');
    return {rows:rows.slice(0,limit),more:rows.length>limit,next:offset+limit,anchorBlock:anchor};
  }
}
