#!/usr/bin/env python3
"""Recreate only the pinned source fixture; never install or run it automatically."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys

PIN = '7b3ff81a57a55f4ccbeed2177870ab5c6e2579dd'
HERE = Path(__file__).resolve().parent
REPOSITORY = HERE.parents[2]

def main():
    if len(sys.argv) != 2:
        raise SystemExit('Pass one new, nonexistent output directory.')
    output = Path(sys.argv[1]).expanduser().absolute()
    if output.exists() or output.is_symlink():
        raise SystemExit('Output already exists; choose a new directory.')
    manifest_bytes = (HERE / 'SOURCE_INPUTS.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    provenance = json.loads((HERE / 'PROVENANCE.json').read_bytes())
    expected = next(x['sha256'] for x in provenance['unchangedEvidence'] if x['path'] == 'SOURCE_INPUTS.json')
    if hashlib.sha256(manifest_bytes).hexdigest() != expected:
        raise SystemExit('Published source inventory hash differs.')
    files = manifest['files']
    if len(files) != 189:
        raise SystemExit('Expected the complete 189-input observation.')
    copied = {}
    for item in files:
        name = item['path']
        if not re.fullmatch(r'(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+', name) or any(p in ('.', '..') for p in PurePosixPath(name).parts) or name in copied:
            raise SystemExit('Invalid or duplicate pinned input path.')
        data = subprocess.run(['git', 'show', f'{PIN}:{name}'], cwd=REPOSITORY, check=True, capture_output=True).stdout
        if len(data) != item['bytes'] or hashlib.sha256(data).hexdigest() != item['sha256']:
            raise SystemExit(f'Pinned input does not match observation: {name}')
        copied[name] = data
    harness = (HERE / 'harness.source.txt').read_bytes()
    if hashlib.sha256(harness).hexdigest() != provenance['portableHarnessSha256']:
        raise SystemExit('Portable harness hash differs.')
    output.mkdir(mode=0o700, parents=False, exist_ok=False)
    for name, data in copied.items():
        path = output / 'fixture' / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    (output / 'SOURCE_INPUTS.json').write_bytes(manifest_bytes)
    (output / 'fixture/mcp/integration/verify-mixed-soak.mjs').write_bytes(harness)
    print(json.dumps({'sourceCommit': PIN, 'verifiedInputs': len(copied), 'installedPackages': False, 'benchmarkRun': False, 'fixture': str(output / 'fixture')}))

if __name__ == '__main__':
    main()
