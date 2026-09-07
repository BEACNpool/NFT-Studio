from pathlib import Path
import urllib.request,hashlib,json,datetime
K=Path(__file__).resolve().parent
rev='91eba72d6e5e3b17cd49f625c9546f2c82df5a65'
cips='05ee6bb05982289dbe00c4187b9d54cf90e2e276'
tasks=[('cip26',f'https://raw.githubusercontent.com/cardano-foundation/CIPs/{cips}/CIP-0026/README.md','CC-BY-4.0','CIP-26 authors'),('schema',f'https://raw.githubusercontent.com/cardano-foundation/CIPs/{cips}/CIP-0026/schema.json','CC-BY-4.0','CIP-26 authors')]
paths=['LICENSE','token-metadata-creator/src/Cardano/Metadata/Types.hs','token-metadata-creator/test/golden-tests.hs']
for stem in ['00000002df633853f6a47465c9496721d2d5b1291b8398016c0e87ae6e7574636f696e','0000001c1f5134859ee40556e75834b9929d1b393ab94858a3d27ae0494e4359','007394e3117755fbb0558b93c54ce3bc6c85770920044ade143dc742505443','00d0f59eb1f4f37edf14b30abb0f59e11c7faa9be4e7cba23de08fa94d5354415254']:
 paths.append('token-metadata-creator/test/fixtures/'+stem+'.json')
for p in paths:tasks.append((p.replace('/','--'),f'https://raw.githubusercontent.com/input-output-hk/offchain-metadata-tools/{rev}/{p}','Apache-2.0','Offchain Metadata Tools contributors'))
records=[]
for name,url,license,author in tasks:
 b=urllib.request.urlopen(url,timeout=25).read(300000)
 p=K/'evidence'/(name+'.source.txt');p.write_bytes(b)
 records.append({'id':name,'url':url.replace('raw.githubusercontent.com/','github.com/').replace('/'+(cips if name in ['cip26','schema'] else rev)+'/', '/blob/'+(cips if name in ['cip26','schema'] else rev)+'/'),'rawUrl':url,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'path':str(p.relative_to(K)),'license':license,'attribution':author,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()})
current=urllib.request.urlopen('https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0026/README.md',timeout=25).read(300000)
assert hashlib.sha256(current).hexdigest()==records[0]['sha256'],'CIP26 drifted; reassess'
(K/'evidence/sources.json').write_text(json.dumps({'sources':records,'currentCip26MatchesPinned':True},indent=2)+'\n')
print(len(records),'sources retrieved; current CIP26 matches pinned research')
