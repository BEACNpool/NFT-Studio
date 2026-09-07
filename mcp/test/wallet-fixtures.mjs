import * as C from '@emurgo/cardano-serialization-lib-nodejs';
const bn=n=>C.BigNum.from_str(String(n));
export const address=(which='ab',network=1,script=false)=>C.EnterpriseAddress.new(network,script?C.Credential.from_scripthash(C.ScriptHash.from_hex(which.repeat(28))):C.Credential.from_keyhash(C.Ed25519KeyHash.from_hex(which.repeat(28)))).to_address();
export function utxo(id,{coin=20000000,key='ab',network=1,script=false,special='',tokens=0,policies=1,assetBytes=2}={}){
  const amount=C.Value.new(bn(coin));
  if(tokens){const multi=C.MultiAsset.new();for(let i=0;i<policies;i++){const assets=C.Assets.new();for(let j=0;j<tokens;j++)assets.insert(C.AssetName.new(Buffer.from(j.toString(16).padStart(assetBytes*2,'0'),'hex')),bn(7));multi.insert(C.ScriptHash.from_hex((1000+i).toString(16).padStart(56,'0')),assets);}amount.set_multiasset(multi);}
  const output=C.TransactionOutput.new(address(key,network,script),amount);
  if(special==='datum')output.set_data_hash(C.DataHash.from_hex('cd'.repeat(32)));
  if(special==='inline')output.set_plutus_data(C.PlutusData.new_integer(C.BigInt.from_str('1')));
  if(special==='reference')output.set_script_ref(C.ScriptRef.new_native_script(C.NativeScript.new_script_pubkey(C.ScriptPubkey.new(C.Ed25519KeyHash.from_hex('ef'.repeat(28))))));
  return C.TransactionUnspentOutput.new(C.TransactionInput.new(C.TransactionHash.from_hex(id.toString(16).padStart(64,'0')),0),output).to_hex();
}
export const payload={name:'Workerd MCP fixture',description:'Synthetic unsigned preparation only.',coverIndex:0,files:[
  {name:'cover.svg',mediaType:'image/svg+xml',base64:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#7cf"/></svg>').toString('base64')},
  {name:'hello.html',mediaType:'text/html',base64:Buffer.from('<!doctype html><button onclick="this.textContent=\'Hello\'">Cardano</button>').toString('base64')}
]};
