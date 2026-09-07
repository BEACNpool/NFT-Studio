"""Maintainer-only public provenance capture; the runtime parameterizer never imports or runs this."""
from pathlib import Path
import urllib.request, hashlib, json, datetime
root=Path(__file__).resolve().parent.parent
sources=[
 ('aiken-apply','https://raw.githubusercontent.com/aiken-lang/aiken/8949565a9969278846ffefe30bc3b892029dd318/crates/aiken-project/src/blueprint/validator.rs','Aiken validates the next schema, applies Data, and removes the next parameter.'),
 ('aiken-program','https://raw.githubusercontent.com/aiken-lang/aiken/8949565a9969278846ffefe30bc3b892029dd318/crates/uplc/src/ast.rs','Program.apply_data constructs Apply(Constant(Data)); PlutusV3 hashes the CBOR-serialized program.'),
 ('harmonic-uplc-encoder','https://raw.githubusercontent.com/HarmonicLabs/uplc/3e10e46e89c184b92886f38c39e9057063dffd9f/src/UPLCEncoder/UPLCEncoder.ts','The maintained UPLC library performs Flat serialization; adapter has no Flat encoder.'),
 ('harmonic-uplc-decoder','https://raw.githubusercontent.com/HarmonicLabs/uplc/3e10e46e89c184b92886f38c39e9057063dffd9f/src/UPLCDecoder/UPLCDecoder.ts','Library parser for the pinned known program.'),
 ('lucid-example','https://raw.githubusercontent.com/Anastasia-Labs/lucid-evolution/8a379c3bc579e623a1efb5f444bf54e78979d4e6/packages/utils/src/scripts.ts','Current Lucid applies parameters with Harmonic UPLC Application and UPLCConst.data. Its package uses v1; this adapter directly tests pinned v2 API.'),
 ('ledger-cddl','https://raw.githubusercontent.com/IntersectMBO/cardano-ledger/dae069780697449fbd9cda47f03fb72745b0b8c0/eras/conway/impl/cddl/data/conway.cddl','Transaction input index uint .size 2 supports the chosen 0..65535 profile bound.'),
 ('capsule-blueprint','https://raw.githubusercontent.com/BEACNpool/NFT-Studio/d2003bec53b944c7b71bd50caa2a14002008c7ea/contracts/state-capsule/plutus.json','Exact trusted Capsule blueprint, locally frozen before any parser.'),
]
items=[]
for sid,url,note in sources:
    with urllib.request.urlopen(url,timeout=20) as response:
        raw=response.read(2_000_001)
    assert len(raw)<=2_000_000
    if sid=='capsule-blueprint':assert raw==(root/'trusted/plutus.json').read_bytes()
    if sid=='ledger-cddl':
        text=raw.decode(); start=text.index('transaction_input =');print(text[start:start+200])
    items.append({'id':sid,'url':url,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'accessedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'note':note})
(root/'evidence/sources.json').write_text(json.dumps({'schema':'beacn.capsule-parameter-sources.v1','sources':items},indent=2)+'\n')
# Pin registry release metadata too; never a runtime fetch.
packages=[]
for package,version in [('@harmoniclabs/uplc','2.0.7'),('@harmoniclabs/plutus-data','2.0.1'),('@harmoniclabs/cbor','2.0.2'),('@noble/hashes','2.4.0')]:
    url='https://registry.npmjs.org/'+package.replace('/','%2f')+'/'+version
    with urllib.request.urlopen(url,timeout=20) as response:raw=response.read(300_001)
    assert len(raw)<=300_000;obj=json.loads(raw)
    packages.append({'name':package,'version':version,'url':url,'metadataSha256':hashlib.sha256(raw).hexdigest(),'repository':obj.get('repository'),'gitHead':obj.get('gitHead'),'distIntegrity':obj['dist']['integrity'],'license':obj.get('license')})
(root/'evidence/packages.json').write_text(json.dumps({'packages':packages},indent=2)+'\n')
print('Pinned '+str(len(items))+' primary sources and '+str(len(packages))+' direct runtime package records.')
