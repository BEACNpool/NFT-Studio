#!/usr/bin/env python3
"""Retrieve only the fixed public CIP snapshot; never run its contents.

Network host, repository, commit, path pattern, budgets and concurrency are fixed.
Existing files must match exactly. For another snapshot, review/change this source.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, build_opener, HTTPRedirectHandler
import hashlib, json, re, sys, time, datetime

BASE = Path(__file__).resolve().parents[1]
COMMIT = '05ee6bb05982289dbe00c4187b9d54cf90e2e276'
TREE_SHA = 'f4c9712aa121707f1df1ebb0cc4ca247aa3ef6d3'
API = 'https://api.github.com/repos/cardano-foundation/CIPs'
RAW = 'https://raw.githubusercontent.com/cardano-foundation/CIPs/' + COMMIT + '/'
PATTERN = re.compile(r'CIP-[0-9]{4}/README\.md\Z')
MAX_SOURCE = 512 * 1024
MAX_TREE = 4 * 1024 * 1024
CONCURRENCY = 4
LICENSE_URL = 'https://www.apache.org/licenses/LICENSE-2.0.txt'
LICENSE_SHA256 = 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30'
RUN_DEADLINE = time.monotonic() + 600


class RejectRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Redirect rejected before contacting its destination')


FIXED_OPENER = build_opener(RejectRedirects())


def get(url, cap):
    # Only internally generated immutable URLs are ever passed here.
    if time.monotonic() > RUN_DEADLINE: raise TimeoutError('Overall retrieval deadline exceeded')
    started = time.monotonic()
    req = Request(url, headers={'User-Agent':'NFT-Studio-pinned-CIP-corpus/1', 'Accept':'application/vnd.github+json' if url.startswith(API) else 'text/plain'})
    with FIXED_OPENER.open(req, timeout=25) as response:
        if response.geturl() != url: raise ValueError('Unexpected redirect')
        out = bytearray()
        while True:
            if time.monotonic() > RUN_DEADLINE or time.monotonic() - started > 45: raise TimeoutError('Per-source deadline exceeded')
            part = response.read(min(65536, cap + 1 - len(out)))
            if not part: break
            out.extend(part)
            if len(out) > cap: raise ValueError('Response size cap exceeded')
        return bytes(out)


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != data: raise ValueError('Existing artifact differs: ' + str(path.relative_to(BASE)))
    else:
        path.write_bytes(data)


def identity(data):
    return {'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest(), 'gitBlobSha1':hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()}


def blob(item, destination):
    data = get(RAW + item['path'], MAX_SOURCE)
    facts = identity(data)
    if facts['bytes'] != item['size'] or facts['gitBlobSha1'] != item['sha']: raise ValueError('Git blob mismatch: '+item['path'])
    # Fatal strict UTF-8; verify text encoding does not normalize any bytes.
    if data.decode('utf-8').encode('utf-8') != data: raise ValueError('UTF8 mismatch')
    if PATTERN.fullmatch(item['path']):
        frontmatter = data.decode('utf-8').split('---', 2)[1]
        licenses = re.findall(r'^License: (.+)$', frontmatter, re.M)
        if len(licenses) != 1 or licenses[0].strip() not in ('CC-BY-4.0', 'Apache-2.0'): raise ValueError('Unreviewed source license')
    save(destination, data)
    return {'path':item['path'],'url':RAW+item['path'],**facts}


def verify_trees(recursive, root):
    groups = {'': []}
    expected = {'': TREE_SHA}
    if len(recursive['tree']) > 20000: raise ValueError('Tree entry cap')
    seen=set()
    for entry in recursive['tree']:
        path=entry['path']
        if path in seen: raise ValueError('Duplicate tree path')
        seen.add(path)
        parent, _, name = path.rpartition('/')
        groups.setdefault(parent, []).append({**entry, 'name':name})
        if entry['type']=='tree': expected[path]=entry['sha']
    for path, entries in groups.items():
        entries.sort(key=lambda e:(e['name']+('/' if e['type']=='tree' else '')).encode())
        content=b''.join(e['mode'].lstrip('0').encode()+b' '+e['name'].encode()+b'\0'+bytes.fromhex(e['sha']) for e in entries)
        if hashlib.sha1(b'tree '+str(len(content)).encode()+b'\0'+content).hexdigest()!=expected[path]: raise ValueError('Tree object mismatch')
    root_entries=sorted((e['path'],e['mode'],e['sha']) for e in root['tree'])
    if root_entries!=sorted((e['path'],e['mode'],e['sha']) for e in recursive['tree'] if '/' not in e['path']): raise ValueError('Root/recursive tree mismatch')


def run():
    if len(sys.argv) != 2 or sys.argv[1] != '--online': raise SystemExit('Usage: python3 scripts/retrieve.py --online (fixed public snapshot only)')
    commit_bytes = get(API+'/git/commits/'+COMMIT, MAX_TREE)
    commit = json.loads(commit_bytes)
    if commit['sha'] != COMMIT: raise ValueError('Commit mismatch')
    # Reconstruct this signed commit's exact Git object from GitHub's public
    # payload/signature fields. This verifies object identity, not PGP trust.
    headers, message = commit['verification']['payload'].split('\n\n', 1)
    signed = (headers+'\ngpgsig '+commit['verification']['signature'].replace('\n','\n ')+'\n\n'+message).encode()
    if hashlib.sha1(b'commit '+str(len(signed)).encode()+b'\0'+signed).hexdigest() != COMMIT: raise ValueError('Commit object identity mismatch')
    tree_sha = commit['tree']['sha']
    if tree_sha != TREE_SHA or headers.split('\n')[0] != 'tree '+TREE_SHA: raise ValueError('Commit/tree binding mismatch')
    recursive_bytes = get(API+'/git/trees/'+tree_sha+'?recursive=1', MAX_TREE)
    recursive = json.loads(recursive_bytes)
    root_bytes = get(API+'/git/trees/'+tree_sha, MAX_TREE)
    root = json.loads(root_bytes)
    if recursive.get('truncated') is not False or root.get('truncated') is not False: raise ValueError('Truncated inventory')
    if root['sha'] != tree_sha or recursive['sha'] != tree_sha: raise ValueError('Tree identity mismatch')
    verify_trees(recursive,root)
    save(BASE/'evidence/commit.json',commit_bytes)
    save(BASE/'evidence/tree-recursive.json',recursive_bytes)
    save(BASE/'evidence/tree-root.json',root_bytes)
    sources = sorted((x for x in recursive['tree'] if PATTERN.fullmatch(x['path'])), key=lambda x:x['path'])
    if len(sources)!=148 or sum(x['size'] for x in sources)!=3425888: raise ValueError('Pinned inventory count/size mismatch')
    if len({x['path'] for x in sources}) != len(sources): raise ValueError('Duplicate path')
    if any(x['type']!='blob' or x['mode']!='100644' or x['size']>MAX_SOURCE for x in sources): raise ValueError('Unsupported source node')
    # Review LICENSING.md before redistribution. Per-file licenses differ from the root license.
    apache = get(LICENSE_URL, 32768)
    if hashlib.sha256(apache).hexdigest() != LICENSE_SHA256: raise ValueError('Apache license text changed')
    save(BASE/'APACHE-2.0.source.txt', apache)
    save(BASE/'evidence/apache-license.json',(json.dumps({'url':LICENSE_URL,'license':'Apache-2.0','bytes':len(apache),'sha256':LICENSE_SHA256},indent=2)+'\n').encode())
    notices=[]
    for upstream, local in [('LICENSE','UPSTREAM-LICENSE.source.txt'),('README.md','evidence/root-README.source.txt')]:
        item=next(x for x in recursive['tree'] if x['path']==upstream)
        notices.append(blob(item,BASE/local))
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        results=list(pool.map(lambda item:blob(item,BASE/'sources'/(item['path'].split('/')[0]+'.README.source.txt')),sources))
    receipt={'schema':'nft-studio.cip-retrieval.v1','commit':COMMIT,'treeSha1':tree_sha,'concurrency':CONCURRENCY,'perSourceMaxBytes':MAX_SOURCE,'sources':results,'notices':notices}
    # Stable receipt deliberately excludes retrieval wall time; a separate audit can date a run.
    save(BASE/'evidence/retrieval.json',(json.dumps(receipt,indent=2,ensure_ascii=False)+'\n').encode())
    print(json.dumps({'retrieved':len(results),'bytes':sum(x['bytes'] for x in results),'commit':COMMIT,'treeSha1':tree_sha,'auditedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}))

if __name__=='__main__':run()
