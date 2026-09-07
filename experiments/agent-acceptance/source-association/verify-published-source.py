#!/usr/bin/env python3
"""Check public source against the pinned association receipt. Read-only; no private archive needed."""
from pathlib import Path
import hashlib,json,sys
if len(sys.argv)!=2:raise SystemExit('Usage: verify-published-source.py NFT_STUDIO_CHECKOUT')
repo=Path(sys.argv[1]).resolve();here=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
raw=(here/'source-association.json').read_bytes()
assert sha(raw)=='8c7c1fd16ca5ebaf6684d72daf9f3ace9186a05a8b72fa9b3d4c15b5c9cc23fd','Association receipt changed.'
receipt=json.loads(raw)
added=("    reviewHandoff:{transport:'url-fragment',schema:'nft-studio.intent.v1',maxFragmentCharacters:106700,openingConnectsWallet:false},\n"
       "    fees:{studioLovelace:'0',network:'Cardano network fees apply; minimum ADA stays in the user output.'},\n").encode()
for row in receipt['pendingFiles']:
 b=(repo/row['path']).read_bytes();assert sha(b)==row['currentSha256'],f"Source differs: {row['path']}"
 if row['association']=='byte-identical':assert sha(b)==row['testedSha256']
 else:
  assert row['path'] in ['mcp/src/server.mjs','mcp/src/worker.mjs']
  assert b.count(added)==1 and sha(b.replace(added,b'',1))==row['testedSha256']
for row in receipt['unchangedSupportingFiles']:assert sha((repo/row['path']).read_bytes())==row['sha256'],f"Support differs: {row['path']}"
print(json.dumps({'status':'pass','pendingFiles':len(receipt['pendingFiles']),'supportingFiles':len(receipt['unchangedSupportingFiles']),'byteIdenticalPending':7,'exactCapabilitiesOnlyDelta':2,'privateArchiveRequired':False,'walletOrNetworkCalls':False}))
