# Independent scalar CBOR + hashlib implementation for public input fixtures.
import hashlib,json,struct
from pathlib import Path
K=Path(__file__).resolve().parent.parent

def cbor(v):
 def h(major,n):
  if n<24:return bytes([(major<<5)|n])
  for maximum,extra,fmt in [(255,24,'>B'),(65535,25,'>H'),(4294967295,26,'>I'),(2**64-1,27,'>Q')]:
   if n<=maximum:return bytes([(major<<5)|extra])+struct.pack(fmt,n)
 if v is None:return bytes([246])
 if isinstance(v,bool):return bytes([245 if v else 244])
 if isinstance(v,str):
  b=v.encode('utf-8');return h(3,len(b))+b
 if isinstance(v,int):return h(0,v) if v>=0 else h(1,-1-v)
 raise ValueError('unsupported fixture')

def fixture(subject,prop,value,sequence):
 parts=[cbor(v) for v in [subject,prop,value,sequence]]
 hashes=[hashlib.blake2b(p,digest_size=32).digest() for p in parts]
 return dict(subject=subject,property=prop,value=value,sequenceNumber=sequence,cborHex=[p.hex() for p in parts],componentHashes=[p.hex() for p in hashes],digest=hashlib.blake2b(b''.join(hashes),digest_size=32).hexdigest())
rows=[fixture('a5408d0db0d942fd80374','contact','Cid Kramer',0)]
values=['','a'*23,'b'*24,'c'*255,'d'*256,'\ufeffbytes','é','e\u0301','龘🎶','line\nend',True,False,None,0,23,24,255,256,65535,65536,4294967295,4294967296,9007199254740991,-1,-24,-25,-256,-257,-65536,-65537,-4294967296,-4294967297,-9007199254740991]
for i,v in enumerate(values):
 for seq in [0,24,65536,9007199254740991]:rows.append(fixture('public-oracle-'+str(i),'custom🎶',v,seq))
assert rows[0]['digest']=='cd731afcc904c521e0c6b3cc0b560b8157ee29c3e41cd15f8dc8984edf600029'
(K/'test/oracle.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print(len(rows),'independent scalar fixtures')
