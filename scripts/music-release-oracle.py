#!/usr/bin/env python3
"""Independent stdlib-only checks of original media, hashes and metadata CBOR.

This does not import the TypeScript codec or CSL, and does not validate player
interoperability, rights, transaction validity or chain inclusion.
"""
import base64
import hashlib
import io
import json
import pathlib
import struct
import sys
import wave

ROOT = pathlib.Path(__file__).resolve().parents[1]
EVIDENCE = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'tests/fixtures/music-release/roundtrips.json'
fixture_root = ROOT / 'tests/fixtures/music-release'


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()


def sha(value):
    return hashlib.sha256(value).hexdigest()


def head(major, n):
    assert type(n) is int and 0 <= n <= 0xffffffff
    if n < 24:
        return bytes([major << 5 | n])
    if n <= 255:
        return bytes([major << 5 | 24, n])
    if n <= 65535:
        return bytes([major << 5 | 25]) + struct.pack('>H', n)
    return bytes([major << 5 | 26]) + struct.pack('>I', n)


def metadatum(v):
    if type(v) is str:
        raw = v.encode()
        assert len(raw) <= 64
        return head(3, len(raw)) + raw
    if type(v) is int:
        return head(0, v) if v >= 0 else head(1, -1 - v)
    if type(v) is list:
        return head(4, len(v)) + b''.join(map(metadatum, v))
    assert type(v) is dict, 'No metadata Boolean, null or floating point value'
    return head(5, len(v)) + b''.join(metadatum(k) + metadatum(v[k]) for k in sorted(v))


def verify_midi(raw):
    assert raw[:4] == b'MThd'
    header_len, form, tracks, division = struct.unpack('>IHHH', raw[4:14])
    assert (header_len, form, tracks, division) == (6, 0, 1, 96)
    assert raw[14:18] == b'MTrk'
    length = struct.unpack('>I', raw[18:22])[0]
    assert len(raw) == 22 + length
    events = raw[22:]
    # Independent parsing of these deliberately simple explicit-status fixtures.
    offset, ticks, tempo = 0, 0, 500000
    notes, end = [], False
    while offset < len(events):
        delta = 0
        while True:
            byte = events[offset]
            offset += 1
            delta = delta * 128 + (byte & 127)
            if byte < 128:
                break
        ticks += delta
        status = events[offset]
        offset += 1
        if status == 0xff:
            kind, size = events[offset:offset + 2]
            offset += 2
            value = events[offset:offset + size]
            offset += size
            if kind == 0x51:
                assert ticks == 0 and size == 3
                tempo = int.from_bytes(value, 'big')
            elif kind == 0x2f:
                assert size == 0 and offset == len(events)
                end = True
            else:
                raise AssertionError('Unexpected synthetic MIDI event')
        else:
            assert status in (0x90, 0x80)
            pitch, velocity = events[offset:offset + 2]
            offset += 2
            notes.append((status, pitch, velocity, ticks))
    assert notes == [(0x90, 60, 64, 0), (0x80, 60, 0, 192)] and end
    assert ticks * tempo / division / 1_000_000 == 1


with wave.open(str(fixture_root / 'one-second.wav'), 'rb') as wav:
    assert (wav.getnchannels(), wav.getsampwidth(), wav.getframerate(), wav.getnframes()) == (1, 1, 4000, 4000)
    samples = wav.readframes(wav.getnframes())
    assert samples == bytes(128 + ((i % 40 if i % 40 < 20 else 40 - i % 40) - 10) * 6 for i in range(4000))
verify_midi((fixture_root / 'one-second.mid').read_bytes())

receipt = json.loads(EVIDENCE.read_text())
assert receipt['cslVersion'] == '17.0.0'
for case in receipt['positive']:
    package = case['package']
    core = {k: v for k, v in package.items() if k != 'packageHash'}
    assert sha(canonical(core)) == package['packageHash']
    assert sha(canonical(package)) == case['canonicalPackageSha256']
    bundle = package['bundle']
    identities = []
    for record in bundle['files']:
        prefix = 'data:' + record['mediaType'] + ';base64,'
        assert record['uri'].startswith(prefix)
        raw = base64.b64decode(record['uri'][len(prefix):], validate=True)
        assert len(raw) == record['bytes'] and sha(raw) == record['sha256']
        assert raw == (fixture_root / record['name']).read_bytes()
        identities.append({key: record[key] for key in ('name', 'mediaType', 'bytes', 'sha256')})
    identity = {key: bundle[key] for key in ('schema', 'name', 'description', 'cover')}
    identity['files'] = identities
    # Studio's bundle hash uses this explicit property insertion order.
    assert sha(json.dumps(identity, ensure_ascii=False, separators=(',', ':')).encode()) == bundle['sha256']
    assert sum(v['bytes'] for v in identities) == bundle['bytes']
    metadata = case['metadata']
    assert list(metadata) == ['721']
    raw = head(5, 1) + head(0, 721) + metadatum(metadata['721'])
    assert raw.hex() == case['metadataCborHex']
    assert len(raw) == case['metadataCborBytes'] <= 14000
    assert raw.hex() == case['auxiliaryCborHex']  # CSL selected its supported raw metadata form.
    assert hashlib.blake2b(raw, digest_size=32).hexdigest() == case['auxiliaryHash']
    policy, name = case['identity']['policyId'], case['identity']['assetName']
    row = metadata['721'][policy][name]
    assert row['music_metadata_version'] == 3 and type(row['music_metadata_version']) is int
    assert row['music_package_sha256'] == package['packageHash']
    for track in package['tracks']:
        assert track['song']['song_duration'] == 'PT1S'
    print(f"PASS {case['id']}: original media, bundle/package SHA-256, metadata CBOR, auxiliary BLAKE2b-256 ({len(raw)} bytes)")
print('PASS independent WAV and MIDI one-second fixture structure/duration')
