"""Explicit fixed-source re-verification; no caller URL, no private columns persisted."""
from pathlib import Path
from urllib.request import Request, build_opener, HTTPRedirectHandler
import sys,json,hashlib,csv,io,datetime
if sys.argv[1:] != ['--online']: raise SystemExit('Usage: python3 scripts/verify-online.py --online')
root=Path(__file__).resolve().parents[1]
class NoRedirect(HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs): raise ValueError('Redirect refused')
opener=build_opener(NoRedirect())
source=json.loads((root/'upstream/SOURCES.json').read_text())
allowed={('bitcoin/bips','09e21036a4001fe6c9ba65c1d3a39b737768132f','bip-0340.mediawiki'),('bitcoin/bips','09e21036a4001fe6c9ba65c1d3a39b737768132f','bip-0340/LICENSE'),('bitcoin/bips','09e21036a4001fe6c9ba65c1d3a39b737768132f','bip-0340/test-vectors.csv'),('paulmillr/noble-curves','656c4364dffa44c64aa0c49914b8000b278b67a9','src/secp256k1.ts'),('paulmillr/noble-curves','656c4364dffa44c64aa0c49914b8000b278b67a9','LICENSE'),('aiken-lang/aiken','8949565a9969278846ffefe30bc3b892029dd318','crates/uplc/src/machine/runtime.rs'),('aiken-lang/aiken','8949565a9969278846ffefe30bc3b892029dd318','LICENSE')}
assert len(source['sources'])==len(allowed)
assert {(r['repository'],r['commit'],r['path']) for r in source['sources']}==allowed
checked=[]
for row in source['sources']:
 url=f"https://raw.githubusercontent.com/{row['repository']}/{row['commit']}/{row['path']}"
 assert row['url']==url
 with opener.open(Request(url,headers={'User-Agent':'BEACN-Labs-Schnorr-Review/1'}),timeout=20) as response:
  assert response.status==200
  data=response.read(512001)
 assert len(data)<=512000 and len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']
 if row['path']=='bip-0340/test-vectors.csv':
  projected=[{'index':int(r['index']),'publicKeyHex':r['public key'].lower(),'messageHex':r['message'].lower(),'signatureHex':r['signature'].lower(),'expected':r['verification result']=='TRUE','comment':r['comment']} for r in csv.DictReader(io.StringIO(data.decode('utf-8')))]
  assert projected==json.loads((root/'fixtures/bip340-verification.json').read_text())
 else: assert data==(root/row['local']).read_bytes()
 checked.append({'url':url,'bytes':len(data),'sha256':row['sha256']})
receipt={'status':'PASS','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':checked,'officialProjectedVectors':19,'redirectsAllowed':False,'originalCsvPersisted':False}
(root/'evidence/online-source-verification.json').write_text(json.dumps(receipt,indent=2)+'\n')
print('PASS: seven immutable source identities and all 19 verification-only vectors')
