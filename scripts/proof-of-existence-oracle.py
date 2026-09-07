"""Independent oracle: CPython hashlib and cbor2, not the JavaScript implementation.
Requires cbor2==5.6.5. Run from any directory; writes only the named fixture.
"""
import hashlib,json,pathlib
import cbor2
ROOT=pathlib.Path(__file__).resolve().parents[1]
FIXTURES=ROOT/'tests/fixtures/proof-of-existence'
def digest(data):
    return {'sha2-256':hashlib.sha256(data).digest(),'blake2b-256':hashlib.blake2b(data,digest_size=32).digest()}
checked=0
for name,algorithm in [('sha256-kat.json','sha2-256'),('blake2b256-kat.json','blake2b-256')]:
    for vector in json.loads((FIXTURES/name).read_text())['vectors']:
        assert digest(bytes.fromhex(vector['input_hex']))[algorithm].hex()==vector['expected_hex'],vector['name']
        checked+=1
vectors=json.loads((FIXTURES/'dual-hash-equivalence.json').read_text())['vectors']
for vector in vectors:
    hashes=digest(bytes.fromhex(vector['input_hex']))
    assert hashes['sha2-256'].hex()==vector['expected_sha256_hex'],vector['name']
    assert hashes['blake2b-256'].hex()==vector['expected_blake2b256_hex'],vector['name']
    checked+=1
selected=[]
for vector in vectors[:12]:
    data=bytes.fromhex(vector['input_hex']);all_hashes=digest(data)
    for algorithms in [['sha2-256'],['blake2b-256'],['sha2-256','blake2b-256']]:
        hashes={key:all_hashes[key] for key in algorithms}
        record={'v':1,'items':[{'hashes':hashes}]}
        body=cbor2.dumps(record,canonical=True)
        chunks=[body[i:i+64] for i in range(0,len(body),64)]
        selected.append({'name':vector['name']+'-'+str(len(algorithms))+'-'+algorithms[0],
            'input_hex':vector['input_hex'],'algorithms':algorithms,
            'record_cbor_hex':body.hex(),'label_value_cbor_hex':cbor2.dumps(chunks,canonical=True).hex(),
            'metadata_cbor_hex':cbor2.dumps({309:chunks},canonical=True).hex(),
            'record_sha256':hashlib.sha256(body).hexdigest()})
result={'oracle':'CPython hashlib + cbor2==5.6.5 canonical=True','primary_hash_vectors_independently_verified':checked,'vectors':selected}
(FIXTURES/'independent-oracle.json').write_text(json.dumps(result,indent=2)+'\n')
print(f'Independent oracle verified {checked} hash vectors and generated {len(selected)} canonical record/transport fixtures.')
