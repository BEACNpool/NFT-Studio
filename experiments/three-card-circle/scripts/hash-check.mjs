import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {execFileSync} from 'node:child_process';
import {Data,validatorToScriptHash,applySingleCborEncoding,applyParamsToScript} from '@lucid-evolution/lucid';
import {derive,outref,sc} from './transactions.mjs';
const seeds=Object.fromEntries(['params','template','registry','state','issue'].map((n,i)=>[n,{txHash:'ab'.repeat(32),outputIndex:i}]));
const c=derive({seeds,admin:'11'.repeat(28)}),temp=mkdtempSync(join(tmpdir(),'circle-hashes-'));
const checks=[['state','circle_scripts','state',[outref(seeds.state),c.admin,sc(c.ids.plb)]],['transfer','circle_scripts','transfer',[c.ids.state]],['issue','circle_scripts','issue',[outref(seeds.issue),c.admin,c.ids.state,c.ids.registry,sc(c.ids.denied)]],['nft','issuance_mint','issuance_mint',[sc(c.ids.issue),c.ids.params]]];
const pythonHash = script => execFileSync('python3',['-c','import hashlib,sys;print(hashlib.blake2b(bytes.fromhex("03"+sys.argv[1]),digest_size=28).hexdigest())',applySingleCborEncoding(script)],{encoding:'utf8'}).trim();
const report=[];
for(const [key,module,validator,params] of checks){
  let input=resolve('contracts/plutus.json');
  for(let i=0;i<params.length;i++){
    const output=join(temp,key+'-'+i+'.json');
    execFileSync(resolve('tools/aiken-x86_64-unknown-linux-musl/aiken'),['blueprint','apply','-i',input,'-o',output,'-m',module,'-v',validator,Data.to(params[i])],{stdio:'pipe'});
    input=output;
  }
  const v=JSON.parse(readFileSync(input)).validators.find(v=>v.title.startsWith(module+'.'+validator+'.')&&!v.title.endsWith('.else'));
  assert.equal(v.parameters?.length??0,0);
  assert.equal(pythonHash(v.compiledCode),v.hash,`${key}: Aiken's own bytes and hash`);
  assert.equal(validatorToScriptHash({type:'PlutusV3',script:v.compiledCode}),v.hash);
  // Lucid parses/re-encodes the whole UPLC program, changing embedded Data maps
  // from definite to indefinite CBOR. This preserves Data semantics but changes
  // bytes/hash. Compare independently applied programs in the same encoding.
  const normalized=applySingleCborEncoding(applyParamsToScript(v.compiledCode,[]));
  const actual=applySingleCborEncoding(c.s[key].script);
  assert.equal(normalized,actual,`${key}: independently applied program`);
  const independent=pythonHash(actual);
  assert.equal(independent,c.ids[key]);assert.equal(validatorToScriptHash(c.s[key]),independent);
  report.push({validator:key,aikenHash:v.hash,builderHash:independent,sameBytes:v.compiledCode===actual,independentParameterApplication:true,normalizedProgramsIdentical:true,pythonBlake2b224:true,lucidCml:true});
}
writeFileSync('evidence/hash-check.json',JSON.stringify({ok:true,note:'Aiken and Lucid encode embedded Data maps differently. Both hashes are verified against their own bytes; independently parameterized programs match after identical encoding. Transactions use builder hashes.',checks:report},null,2)+'\n');
console.log('PASS: independent parameter application and both script encodings/hashes verified.');
