#!/usr/bin/env python3
"""Adversarial builder tests; optional independent PyYAML SafeLoader oracle."""
from pathlib import Path
import sys,json,re,hashlib,copy
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build import extract,BASE
from retrieve import verify_trees,RejectRedirects

def must_fail(data):
    try:extract(data,'CIP-0026')
    except (ValueError,UnicodeError):return
    raise AssertionError('Expected extraction to reject')

source=(BASE/'sources/CIP-0026.README.source.txt').read_bytes()
for invalid in [source.replace(b'CIP: 26',b'CIP: 27'),source.replace(b'Title: ',b'Title: "',1),source.replace(b'Title: Cardano Off-Chain Metadata',b'Title: |\n  Cardano Off-Chain Metadata'),source.replace(b'Status: Active',b'Status: Active\nStatus: Proposed'),source.replace(b'License: CC-BY-4.0',b'License: unknown'),source.replace(b'Status: Active',b'Status: Executed'),source.replace(b'Authors:',b'Unknown:'),source[4:],source.replace(b'---',b'***'),b'\xef\xbb\xbf'+source,b'\xff'+source,source.replace(b'Title: Cardano Off-Chain Metadata',b'Title: Value # comment'),source.replace(b'Title: Cardano Off-Chain Metadata',b'Title: value: nested'),b'x'*524289,source.replace(b'Title: Cardano Off-Chain Metadata',b'Title: null'),source.replace(b'Title: Cardano Off-Chain Metadata',b'Title: 42')]:must_fail(invalid)
# Supported whitespace variants preserve exact byte spans; selected plain scalar is unchanged.
for variant in [source,source.replace(b'\n',b'\r\n'),source.replace(b'License: CC-BY-4.0\n---',b'License: CC-BY-4.0\n\n---')]:
    parsed=extract(variant,'CIP-0026');assert parsed['title']=='Cardano Off-Chain Metadata'
    assert variant[:parsed['frontmatter']['endOffsetBytes']]==parsed['frontmatter']['rawText'].encode()
index=json.loads((BASE/'index.json').read_bytes())
for entry in index['entries']:
    body=(BASE/entry['localPath']).read_bytes();info=extract(body,entry['id'])
    for field in ['title','status','license','frontmatter','attribution']:assert info[field]==entry[field]
tree=json.loads((BASE/'evidence/tree-recursive.json').read_bytes());root=json.loads((BASE/'evidence/tree-root.json').read_bytes())
verify_trees(tree,root)
mutated=copy.deepcopy(tree);mutated['tree'][0]['sha']='0'*40
try:verify_trees(mutated,root)
except ValueError:pass
else:raise AssertionError('Changed Git entry must reject')
mutated=copy.deepcopy(tree);mutated['tree'].append(mutated['tree'][0])
try:verify_trees(mutated,root)
except ValueError:pass
else:raise AssertionError('Duplicate tree path must reject')
try:RejectRedirects().redirect_request(None,None,302,'redirect',{},'https://not-contacted.invalid')
except ValueError:pass
else:raise AssertionError('Redirect must reject before following')
receipt={'redirectHandlerRejectsBeforeFollow':True,'treeMutationRejections':2,'invalidProfilesRejected':16,'whitespaceRoundtrips':3,'pinnedExtractions':148,'runtimeNeedsPyYaml':False}
if '--yaml-oracle' in sys.argv[1:]:
    import yaml
    for entry in index['entries']:
        raw=entry['frontmatter']['rawText'];front=raw.split('---',2)[1]
        independent=yaml.safe_load(front)
        assert independent['CIP']==entry['number']
        for field in ['Title','Status','License']:assert independent[field]==entry[field.lower()]
        assert 'Authors' in independent
    receipt['independentYamlOracle']={'library':'PyYAML','version':yaml.__version__,'documents':148,'selectedFieldsCompared':592,'loader':'SafeLoader; pinned source only'}
print(json.dumps(receipt,indent=2))
