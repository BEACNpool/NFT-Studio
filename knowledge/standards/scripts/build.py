#!/usr/bin/env python3
"""Deterministically derive a source inventory; no generated summaries or YAML execution."""
from pathlib import Path
import hashlib,json,re,sys,collections
sys.dont_write_bytecode=True
from retrieve import COMMIT,BASE,identity,PATTERN,verify_trees

TREE_SHA='f4c9712aa121707f1df1ebb0cc4ca247aa3ef6d3'
LIC_URL={'CC-BY-4.0':'https://creativecommons.org/licenses/by/4.0/legalcode','Apache-2.0':'https://www.apache.org/licenses/LICENSE-2.0.txt'}


def extract(data, cip_id):
    if len(data)>512*1024:raise ValueError('Source too large')
    text=data.decode('utf-8')
    # A deliberately narrow extraction profile, NOT a general YAML parser. Every
    # selected scalar in this pinned inventory uses exactly this plain form.
    lines=text.splitlines(keepends=True)
    if not lines or lines[0] not in ('---\n','---\r\n'):raise ValueError('Missing opening frontmatter delimiter')
    end=next((i for i,l in enumerate(lines[1:],1) if l in ('---\n','---\r\n')),None)
    if end is None:raise ValueError('Missing closing frontmatter delimiter')
    raw=''.join(lines[:end+1])
    if len(raw.encode())>16384:raise ValueError('Frontmatter cap')
    blocks={};key=None
    for line in lines[1:end]:
        m=re.match(r'^([A-Za-z][A-Za-z0-9_ -]*):(?:[ \t]*(.*?))?\r?\n$',line)
        if m:
            key=m[1]
            if key in blocks:raise ValueError('Duplicate frontmatter key '+key)
            blocks[key]=[line]
        elif line.startswith((' ','\t','- ')) or not line.strip():
            if key is None:raise ValueError('Unattached continuation')
            blocks[key].append(line)
        else:raise ValueError('Unsupported frontmatter line')
    def scalar(k):
        if k not in blocks or len([l for l in blocks[k] if l.strip()])!=1:raise ValueError('Missing/multiline selected scalar '+k)
        value=blocks[k][0].split(':',1)[1].strip()
        if not value or value[0] in '\"\'|>&*!{[' or re.search(r'\s#|:\s',value):raise ValueError('Unsupported YAML selected scalar '+k)
        if k != 'CIP' and (value.lower() in ('null','true','false','yes','no','on','off','~') or re.fullmatch(r'[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?', value)):
            raise ValueError('Ambiguous non-string YAML selected scalar '+k)
        return value
    declared=scalar('CIP')
    if not declared.isascii() or not declared.isdigit() or int(declared)!=int(cip_id[4:]):raise ValueError('Path/frontmatter CIP mismatch')
    title,status,license_=scalar('Title'),scalar('Status'),scalar('License')
    if license_ not in LIC_URL:raise ValueError('Unreviewed license')
    if status not in ('Active','Proposed') and not re.fullmatch(r'Inactive \([^\n]{1,128}\)',status):raise ValueError('Unreviewed status')
    if len(title.encode())>512:raise ValueError('Title too long')
    if 'Authors' not in blocks:raise ValueError('Missing original author attribution')
    authors=''.join(blocks['Authors'])
    copyright_matches=list(re.finditer(r'^#{1,6} Copyright\s*$',text,re.M))
    if len(copyright_matches)!=1:raise ValueError('Copyright section count')
    cstart=copyright_matches[0].start()
    next_heading=re.search(r'^#{1,6} ',text[copyright_matches[0].end():],re.M)
    cend=copyright_matches[0].end()+next_heading.start() if next_heading else len(text)
    copyright_text=text[cstart:cend]
    # Retain original notice in full, including original author statements and
    # reference definitions. Declared license remains verbatim, never reconciled.
    notes=[]
    retain=[license_]
    if cip_id=='CIP-0115':
        retain.append('Apache-2.0');notes.append('Copyright section additionally licenses code samples and reference material under Apache 2.0; frontmatter declares CC-BY-4.0.')
    if cip_id=='CIP-0121':
        retain.append('Apache-2.0');notes.append('Frontmatter declares CC-BY-4.0 but Copyright section declares Apache-2.0. Both notices/licenses are preserved; no single-license interpretation is asserted.')
    return {'title':title,'status':status,'license':license_,'licenseUrl':LIC_URL[license_],
            'retainedLicenses':retain,'licenseNotes':notes,
            'frontmatter':{'offsetBytes':0,'endOffsetBytes':len(raw.encode()),'rawText':raw,'fields':list(blocks)},
            'attribution':{'authorsRawText':authors,'copyrightOffsetBytes':len(text[:cstart].encode()),'copyrightEndOffsetBytes':len(text[:cend].encode()),'copyrightRawText':copyright_text}}


def json_bytes(v):return (json.dumps(v,indent=2,ensure_ascii=False)+'\n').encode()


def write(path,data,check):
    if check:
        if not path.exists() or path.read_bytes()!=data:raise ValueError('Generated artifact drift: '+str(path.relative_to(BASE)))
    else:path.write_bytes(data)


def main():
    if sys.argv[1:] not in ([],['--check']):raise SystemExit('Usage: python3 scripts/build.py [--check]')
    check=bool(sys.argv[1:]); tree=json.loads((BASE/'evidence/tree-recursive.json').read_bytes())
    root=json.loads((BASE/'evidence/tree-root.json').read_bytes())
    if tree['sha']!=TREE_SHA or tree['truncated'] or root['sha']!=TREE_SHA or root['truncated']:raise ValueError('Bad tree')
    verify_trees(tree,root)
    candidates=sorted((x for x in tree['tree'] if PATTERN.fullmatch(x['path'])),key=lambda x:x['path'])
    inventory=[]
    for item in candidates:
        cip_id=item['path'].split('/')[0]
        data=(BASE/'sources'/(cip_id+'.README.source.txt')).read_bytes(); facts=identity(data)
        if facts['gitBlobSha1']!=item['sha'] or facts['bytes']!=item['size']:raise ValueError('Blob mismatch')
        inventory.append({'id':cip_id,'number':int(cip_id[4:]),**extract(data,cip_id),
            'sourcePath':item['path'],'sourceCommit':COMMIT,'sourceUrl':'https://github.com/cardano-foundation/CIPs/blob/'+COMMIT+'/'+item['path'],
            'rawUrl':'https://raw.githubusercontent.com/cardano-foundation/CIPs/'+COMMIT+'/'+item['path'],
            'localPath':'sources/'+cip_id+'.README.source.txt',**facts})
    ids={x['id'] for x in inventory}
    if len(ids)!=148 or sum(x['bytes'] for x in inventory)!=3425888:raise ValueError('Inventory differs')
    # Independent non-recursive Git tree directory enumeration.
    directories=sorted(x['path'] for x in root['tree'] if re.fullmatch(r'CIP-[0-9]{4}',x['path']) and x['type']=='tree')
    if directories!=sorted(ids):raise ValueError('Root directory enumeration differs')
    table=[]
    for line_no,line in enumerate((BASE/'evidence/root-README.source.txt').read_bytes().decode().splitlines(),1):
        m=re.match(r'^\| ([0-9]{4}) \| \[(.*?)\]\(\./(CIP-[0-9]{4})/?\) \| (.*?)\s*\|?$',line)
        if m:table.append({'rowId':'CIP-'+m[1],'linkedId':m[3],'title':m[2],'status':m[4].rstrip(' |'),'line':line_no})
    byid={x['id']:x for x in inventory}; differences=[]
    for row in table:
        actual=byid.get(row['rowId'])
        if not actual: differences.append({'kind':'table-row-without-source',**row});continue
        if row['rowId']!=row['linkedId']:differences.append({'kind':'row-link-id-mismatch',**row})
        for key in ['title','status']:
            if row[key]!=actual[key]:differences.append({'kind':'table-'+key+'-differs','id':row['rowId'],'line':row['line'],'tableValue':row[key],'frontmatterValue':actual[key]})
    comparison={'schema':'nft-studio.cip-enumeration.v1','commit':COMMIT,'recursiveReadmeCount':len(inventory),'rootDirectoryCount':len(directories),'rootReadmeTableRows':len(table),
        'rootReadmeUniqueRowIds':len({x['rowId'] for x in table}),'rootReadmeUniqueLinkedIds':len({x['linkedId'] for x in table}),
        'treeIdsMissingFromRootReadmeRows':sorted(ids-{x['rowId'] for x in table}),
        'treeIdsMissingFromRootReadmeLinks':sorted(ids-{x['linkedId'] for x in table}),
        'tableRows':table,'differences':differences,
        'note':'Individual README frontmatter is indexed verbatim. The root table is a separately preserved comparison, not an authority for this index.'}
    index={'schema':'nft-studio.cip-source-index.v1','repository':'https://github.com/cardano-foundation/CIPs','sourceCommit':COMMIT,'treeSha1':TREE_SHA,
        'scope':'Every exact CIP-[0-9]{4}/README.md blob at the pinned commit; source inventory, separate from curated engineering knowledge.',
        'documentCount':len(inventory),'totalBytes':sum(x['bytes'] for x in inventory),
        'statusCounts':dict(sorted(collections.Counter(x['status'] for x in inventory).items())),
        'declaredLicenseCounts':dict(sorted(collections.Counter(x['license'] for x in inventory).items())),
        'entries':inventory}
    generated=json_bytes(index);sha=hashlib.sha256(generated).hexdigest()
    write(BASE/'index.json',generated,check)
    write(BASE/'evidence/enumeration.json',json_bytes(comparison),check)
    write(BASE/'pin.mjs',('// Generated by scripts/build.py from the fixed original sources.\nexport const CORPUS_PIN = Object.freeze('+json.dumps({'commit':COMMIT,'indexSha256':sha,'indexBytes':len(generated),'documentCount':148,'totalBytes':3425888})+');\n').encode(),check)
    attribution=['# Original CIP source attribution\n','The following are unchanged original documents by their upstream authors and contributors, archived from cardano-foundation/CIPs at commit `'+COMMIT+'`. BEACN Labs authored the inventory/search tooling, not these proposals. File suffixes change for inert archival; document bytes are unchanged. Relative links in the raw documents retain upstream semantics and may refer to files outside this README-only corpus. No linked source is fetched by the runtime API.\n','Per-document license declarations and additional/conflicting notices are retained below. The original root CC-BY-4.0 license is `UPSTREAM-LICENSE.source.txt`; Apache-2.0 text is `APACHE-2.0.source.txt`. Original author lists and all copyright notices remain verbatim in every source and are carried by `index.json`. No endorsement is implied.\n']
    for e in inventory:
        attribution += ['## '+e['id']+' — '+e['title']+'\n','Original: '+e['sourceUrl']+'\n','Declared license: '+e['license']+' ('+e['licenseUrl']+').'+(' '+ ' '.join(e['licenseNotes']) if e['licenseNotes'] else '')+'\n','```text\n'+e['attribution']['authorsRawText']+'```\n']
    write(BASE/'ATTRIBUTION.md','\n'.join(attribution).encode(),check)
    print(json.dumps({'documents':len(inventory),'bytes':index['totalBytes'],'indexSha256':sha,'indexBytes':len(generated),'statuses':index['statusCounts'],'licenses':index['declaredLicenseCounts'],'tableRows':len(table),'differences':len(differences),'missingRows':comparison['treeIdsMissingFromRootReadmeRows']}))

if __name__=='__main__':main()
