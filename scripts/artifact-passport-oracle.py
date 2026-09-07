"""Independent standard-library byte checks; no network, Cardano library or keys."""
import hashlib
import json
from pathlib import Path

fixture = Path(__file__).resolve().parents[1] / 'tests/fixtures/artifact-passport/roundtrips.json'
cases = json.loads(fixture.read_text())['cases']
for case in cases:
    passport = case['passport']
    core = {key: value for key, value in passport.items() if key != 'passportHash'}
    canonical = json.dumps(core, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf8')
    assert hashlib.sha256(canonical).hexdigest() == passport['passportHash']
    tx = passport['transaction']
    assert hashlib.blake2b(bytes.fromhex(case['rawBodyHex']), digest_size=32).hexdigest() == tx['hash']
    assert hashlib.blake2b(bytes.fromhex(tx['auxiliaryDataHex']), digest_size=32).hexdigest() == tx['auxiliaryDataHash']
    print(f"PASS {case['mode']}: independent canonical SHA-256, transaction body and auxiliary BLAKE2b-256")
print('No signature, inclusion, ownership, authorship or build-reproduction claim.')
