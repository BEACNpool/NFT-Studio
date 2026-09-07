from pathlib import Path
import sys
from urllib.request import Request,build_opener,HTTPRedirectHandler
import json,hashlib,csv,io,datetime
BASE=Path(__file__).resolve().parents[1]
if sys.argv[1:] != ['--online']: raise SystemExit('Usage: python3 scripts/retrieve.py --online (fixed reviewed commits only; writes only a working copy)')
class NoRedirect(HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):raise ValueError('Redirect refused')
opener=build_opener(NoRedirect())
def get(url):
 with opener.open(Request(url,headers={'User-Agent':'BEACN-Labs-Schnorr-Review/1'}),timeout=20) as r:
  b=r.read(512001)
  if len(b)>512000:raise ValueError('Source size cap')
  return b
pins={'bips': '09e21036a4001fe6c9ba65c1d3a39b737768132f', 'noble': '656c4364dffa44c64aa0c49914b8000b278b67a9', 'aiken': '8949565a9969278846ffefe30bc3b892029dd318'}
rows=[]
def source(repo,commit,path,dest=None):
 url=f'https://raw.githubusercontent.com/{repo}/{commit}/{path}';b=get(url);rec={'repository':repo,'commit':commit,'path':path,'url':url,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 if dest:(BASE/'upstream'/dest).write_bytes(b);rec['local']='upstream/'+dest
 rows.append(rec);return b
source('bitcoin/bips',pins['bips'],'bip-0340.mediawiki','bip-0340.mediawiki.source.txt')
source('bitcoin/bips',pins['bips'],'bip-0340/LICENSE','BIP340-LICENSE.source.txt')
b=source('bitcoin/bips',pins['bips'],'bip-0340/test-vectors.csv')
vectors=[]
for row in csv.DictReader(io.StringIO(b.decode())):
 vectors.append({'index':int(row['index']),'publicKeyHex':row['public key'].lower(),'messageHex':row['message'].lower(),'signatureHex':row['signature'].lower(),'expected':row['verification result']=='TRUE','comment':row['comment']})
(BASE/'fixtures/bip340-verification.json').write_text(json.dumps(vectors,indent=2)+'\n')
rows[-1]['transformation']='Verification-only projection: index, public key, message, signature, verification result, comment; secret key and aux_rand columns omitted. Original bytes never persisted.'
source('paulmillr/noble-curves',pins['noble'],'src/secp256k1.ts','noble-secp256k1.ts.source.txt')
source('paulmillr/noble-curves',pins['noble'],'LICENSE','NOBLE-LICENSE.source.txt')
source('aiken-lang/aiken',pins['aiken'],'crates/uplc/src/machine/runtime.rs','aiken-runtime.rs.source.txt')
source('aiken-lang/aiken',pins['aiken'],'LICENSE','AIKEN-LICENSE.source.txt')
(BASE/'upstream/SOURCES.json').write_text(json.dumps({'pins':pins,'sources':rows},indent=2)+'\n')
print(json.dumps({'pins':pins,'vectors':len(vectors),'sources':len(rows)}))
