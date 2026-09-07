'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Search, ArrowUpRight, Download } from 'lucide-react';
import { Input } from './ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { CipSourcesPanel } from './cip-sources-panel';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog';
import rawCatalog from '@/knowledge/catalog.json';
import {
  searchKnowledge,
  getEntry,
  validateCatalog,
  type KnowledgeEntry,
} from '@/knowledge/lib.mjs';
import { download, jsonBlob } from '@/lib/export';
import {
  ImplementationEvidence,
  evidenceForEntry,
} from './implementation-evidence';
const catalog = validateCatalog(rawCatalog);
type Entry = KnowledgeEntry;
export function KnowledgePanel() {
  return (
    <Tabs defaultValue="curated">
      <TabsList className="ns-cip-modes" aria-label="Knowledge collection">
        <TabsTrigger value="curated">
          Curated research · {catalog.entries.length}
        </TabsTrigger>
        <TabsTrigger value="originals">Original CIPs · 148</TabsTrigger>
      </TabsList>
      <TabsContent value="curated" keepMounted>
        <CuratedKnowledgePanel />
      </TabsContent>
      <TabsContent value="originals">
        <CipSourcesPanel />
      </TabsContent>
    </Tabs>
  );
}
function CuratedKnowledgePanel() {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | Entry['kind']>('all');
  const [status, setStatus] = useState('all');
  const [limit, setLimit] = useState(12);
  const [selected, setSelected] = useState<Entry | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (selected) {
      dialog.current?.scrollTo({ top: 0 });
      title.current?.focus({ preventScroll: true });
    }
  }, [selected]);
  const results = useMemo(
    () =>
      searchKnowledge(catalog, query, {
        limit,
        kind: kind === 'all' ? undefined : kind,
        status: status === 'all' ? undefined : status,
      }) as Entry[],
    [query, kind, status, limit],
  );
  const sources = (entry: Entry) =>
    catalog.sources.filter((s) => entry.sourceIds.includes(s.id));
  const select = (id: string) => setSelected(getEntry(catalog, id));
  const reset = (value: string) => {
    setQuery(value);
    setKind('all');
    setStatus('all');
    setLimit(12);
  };
  return (
    <div>
      <div className="ns-lab-intro">
        <span className="ns-lab-kicker">
          <BookOpen size={18} /> OPEN KNOWLEDGE
        </span>
        <h2>Know what the chain can actually do.</h2>
        <p>
          {catalog.entries.length} research entries with sources, enforcement
          rules and implementation limits. Reviewed {catalog.asOf}. Proposal
          status and Studio support are separate.
        </p>
      </div>
      <div className="ns-kb-search">
        <label className="ns-kb-query" htmlFor="knowledge-query">
          <Search size={20} />
          <Input
            id="knowledge-query"
            aria-label="Search Cardano knowledge"
            value={query}
            maxLength={256}
            placeholder="CIP-68, music, ownership, metadata…"
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(12);
            }}
          />
        </label>
        <Select
          value={kind}
          onValueChange={(v) => {
            setKind(v as typeof kind);
            setLimit(12);
          }}
        >
          <SelectTrigger aria-label="Knowledge type">
            <SelectValue>
              {
                (
                  {
                    all: 'All types',
                    standard: 'Standards',
                    tool: 'Tools',
                    pattern: 'Design patterns',
                  } as const
                )[kind]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="standard">Standards</SelectItem>
            <SelectItem value="tool">Tools</SelectItem>
            <SelectItem value="pattern">Design patterns</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v || 'all');
            setLimit(12);
          }}
        >
          <SelectTrigger aria-label="Proposal status">
            <SelectValue>
              {status === 'all' ? 'All statuses' : status}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Proposed">Proposed</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="ns-kb-topics" aria-label="Suggested research topics">
        {[
          ['CIP68', 'Evolving NFTs'],
          ['CIP60', 'Music'],
          ['CIP188', 'Token-owned addresses'],
          ['wallet', 'Wallets'],
          ['proof', 'Proof & provenance'],
        ].map(([q, label]) => (
          <button key={q} onClick={() => reset(q)}>
            {label}
          </button>
        ))}
      </div>
      <p className="ns-lab-muted" aria-live="polite">
        {results.length
          ? `${results.length} entries shown`
          : 'No matching entries. Try a CIP number or a shorter search.'}
      </p>
      <div className="ns-kb-results">
        {results.map((entry) => (
          <button
            key={entry.id}
            className="ns-kb-card"
            onClick={() => setSelected(entry)}
          >
            <div>
              <span className="ns-kb-type">{entry.kind}</span>
              <span className="ns-kb-status">
                {entry.maturity.standardStatus}
              </span>
            </div>
            <h3>{entry.title}</h3>
            <p>{entry.summary}</p>
            {evidenceForEntry(entry.id).length > 0 && (
              <span className="ns-kb-built">BEACN implementation evidence</span>
            )}
            <span className="ns-kb-more">
              Read evidence and limits <ArrowUpRight size={17} />
            </span>
          </button>
        ))}
      </div>
      {results.length === limit && limit < 50 && (
        <Button
          variant="outline"
          className="ns-kb-load"
          onClick={() => setLimit(Math.min(50, limit + 12))}
        >
          Show more entries
        </Button>
      )}
      <p className="ns-lab-sources">
        Open summaries and reusable data in{' '}
        <a
          href="https://github.com/BEACNpool/NFT-Studio/tree/main/knowledge"
          target="_blank"
          rel="noreferrer"
        >
          the public knowledge repository
        </a>
        . Standards remain the work of their authors.
      </p>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent
          ref={dialog}
          initialFocus={title}
          className="ns-kb-dialog"
        >
          {selected && (
            <>
              <div className="ns-lab-kicker">
                {selected.kind} · {selected.maturity.standardStatus}
              </div>
              <DialogTitle ref={title} tabIndex={-1}>
                {selected.title}
              </DialogTitle>
              <DialogDescription>{selected.summary}</DialogDescription>
              <p className="ns-kb-evidence">
                This is a research entry. It does not claim that NFT-Studio
                implements every capability described here.
              </p>
              <ImplementationEvidence entryId={selected.id} />
              <section>
                <h3>What the sources establish</h3>
                <ul>
                  {selected.facts.map((f, i) => (
                    <li key={i}>
                      {f.text}{' '}
                      {f.sourceIds.map((id) => (
                        <a
                          key={id}
                          href={catalog.sources.find((s) => s.id === id)!.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          [{id}]
                        </a>
                      ))}
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3>Where enforcement happens</h3>
                <p className="ns-lab-muted">{selected.enforcement.layer}</p>
                <ul>
                  {selected.enforcement.guarantees.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                <h4>Boundaries</h4>
                <ul>
                  {selected.enforcement.doesNotGuarantee.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </section>
              {(
                [
                  ['Design notes', selected.designNotes],
                  ['Lifecycle', selected.lifecycle],
                  ['Interoperability', selected.interoperability],
                  ['Risks and open questions', selected.risks],
                  ['What we could build', selected.opportunities],
                ] as [string, string[]][]
              ).map(([title, items]) => (
                <section key={title}>
                  <h3>{title}</h3>
                  <ul>
                    {items.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </section>
              ))}
              <section>
                <h3>Primary sources</h3>
                {sources(selected).map((source) => (
                  <details key={source.id} className="ns-kb-source">
                    <summary>{source.title}</summary>
                    <p>{source.attribution}</p>
                    <p>
                      {source.license} · accessed{' '}
                      {source.accessedAt.slice(0, 10)}
                    </p>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      Read source
                    </a>
                    {' · '}
                    <a href={source.rawUrl} target="_blank" rel="noreferrer">
                      Pinned source
                    </a>
                    <code>SHA-256 {source.sha256}</code>
                  </details>
                ))}
              </section>
              <section>
                <h3>Related entries</h3>
                <div className="ns-kb-topics">
                  {selected.relatedIds.map((id) => (
                    <button key={id} onClick={() => select(id)}>
                      {id}
                    </button>
                  ))}
                </div>
              </section>
              <Button
                variant="outline"
                onClick={() =>
                  download(
                    jsonBlob({
                      asOf: catalog.asOf,
                      entry: selected,
                      sources: sources(selected),
                      implementations: evidenceForEntry(selected.id),
                    }),
                    selected.id + '.research.json',
                  )
                }
              >
                <Download size={16} /> Export this research
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
