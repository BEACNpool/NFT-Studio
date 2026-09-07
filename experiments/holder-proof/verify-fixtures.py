#!/usr/bin/env python3
"""Independent public-fixture verification. No key generation/signing/network.

Python CBOR handling and cryptography Ed25519 do not import the JS implementation.
This is an optional local cross-check, not a production dependency.
"""
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
import cryptography
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

root = Path(__file__).resolve().parent

def encode_head(major, value):
    if value < 24:
        return bytes([(major << 5) + value])
    for size, argument in [(1, 24), (2, 25), (4, 26), (8, 27)]:
        if value < 1 << (size * 8):
            return bytes([(major << 5) + argument]) + value.to_bytes(size, 'big')
    raise ValueError('too large')

def encode(value):
    if isinstance(value, bytes):
        return encode_head(2, len(value)) + value
    if isinstance(value, str):
        body = value.encode('utf8')
        return encode_head(3, len(body)) + body
    if isinstance(value, list):
        return encode_head(4, len(value)) + b''.join(map(encode, value))
    raise ValueError('test encoder type')

def decode(data):
    pos = 0
    def read(depth=0):
        nonlocal pos
        assert depth < 10 and pos < len(data)
        b = data[pos]
        pos += 1
        major, n = divmod(b, 32)
        if major == 7:
            return {20: False, 21: True, 22: None}[n]
        if n >= 24:
            assert n <= 27
            size = 1 << (n - 24)
            assert pos + size <= len(data)
            n = int.from_bytes(data[pos:pos + size], 'big')
            pos += size
        if major < 2:
            return n if major == 0 else -1-n
        if major in (2, 3):
            assert pos + n <= len(data)
            result = data[pos:pos + n]
            pos += n
            return result if major == 2 else result.decode('utf8')
        if major == 4:
            return [read(depth+1) for _ in range(n)]
        if major == 5:
            result = {}
            for _ in range(n):
                k, v = read(depth+1), read(depth+1)
                assert k not in result
                result[k] = v
            return result
        assert major == 6 and n == 18 and depth == 0
        return read(depth+1)
    result = read()
    assert pos == len(data)
    return result

fixtures = json.loads((root / 'fixtures/cose-positive.json').read_text())['fixtures']
for fixture in fixtures:
    protected, unprotected, payload, signature = decode(bytes.fromhex(fixture['signature']))
    key = decode(bytes.fromhex(fixture['key']))
    headers = decode(protected)
    assert unprotected == {'hashed': False}
    assert headers[1] == key[3] == -8 and key[1] == 1 and key[-1] == 6
    assert key[-2].hex() == fixture['publicKeyHex']
    assert protected.hex() == fixture['protectedHeaderHex']
    assert payload.hex() == fixture['expected']['payloadHex']
    assert headers['address'].hex() == fixture['expected']['addressHex']
    assert hashlib.blake2b(key[-2], digest_size=28).digest() == headers['address'][1:29]
    signed = encode(['Signature1', protected, b'', payload])
    assert signed.hex() == fixture['sigStructureHex']
    Ed25519PublicKey.from_public_bytes(key[-2]).verify(signature, signed)

receipt = {
    'schema': 'beacn-independent-python-cose-fixtures-v1',
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'fixturesVerified': len(fixtures),
    'cryptographyVersion': cryptography.__version__,
    'independentChecks': ['whole COSE parse', 'original protected bytes', 'Sig_structure encoding', 'Ed25519 signature', 'payment key hash'],
    'signingPerformed': False,
    'chainQueries': False,
    'scope': 'Existing synthetic public fixtures, not wallet interoperability or a security audit',
}
if '--write-receipt' in sys.argv:
    (root / 'fixtures/python-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt, indent=2))
