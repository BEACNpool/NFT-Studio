'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Search,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import type {
  StandardsCorpus,
  SourceChunk,
  SourceEntry,
} from '@/knowledge/standards/lib.mjs';
import './cip-sources-panel.css';
const bytes = new TextEncoder();
export function CipSourcesPanel() {
  const [corpus, setCorpus] = useState<StandardsCorpus | null>(null),
    [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState(''),
    [status, setStatus] = useState('all'),
    [limit, setLimit] = useState(12);
  const [selected, setSelected] = useState<SourceEntry | null>(null),
    [chunk, setChunk] = useState<SourceChunk | null>(null),
    [history, setHistory] = useState<number[]>([]);
  const [inputError, setInputError] = useState('');
  const [licenseTexts, setLicenseTexts] = useState<Readonly<
    Record<string, string>
  > | null>(null);
  const readerTitle = useRef<HTMLHeadingElement>(null),
    reader = useRef<HTMLPreElement>(null);
  useEffect(() => {
    let active = true;
    void import('@/knowledge/standards/bundled.mjs')
      .then(async (m) => ({
        corpus: await m.getBundledCorpus(),
        licenses: m.SOURCE_LICENSE_TEXTS,
      }))
      .then((value) => {
        if (active) {
          setCorpus(value.corpus);
          setLicenseTexts(value.licenses);
        }
      })
      .catch(() => {
        if (active)
          setLoadError(
            'The packaged source snapshot could not be verified. Reload to try again.',
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const result = useMemo(() => {
    if (!corpus) return null;
    try {
      return corpus.search({
        query,
        status: status === 'all' ? undefined : status,
        limit,
      });
    } catch {
      return null;
    }
  }, [corpus, query, status, limit]);
  const clearSelection = () => {
    setSelected(null);
    setChunk(null);
    setHistory([]);
  };
  const choose = (entry: SourceEntry) => {
    if (!corpus) return;
    setSelected(entry);
    setChunk(corpus.getChunk({ id: entry.id, limitBytes: 8192 }));
    setHistory([]);
  };
  useEffect(() => {
    if (chunk) {
      reader.current?.scrollTo({ top: 0 });
      readerTitle.current?.focus({ preventScroll: true });
      readerTitle.current?.scrollIntoView({ block: 'start' });
    }
  }, [chunk]);
  const changeQuery = (value: string) => {
    clearSelection();
    setLimit(12);
    if (
      !value.isWellFormed() ||
      bytes.encode(value).length > 256 ||
      Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ||
      value.trim().split(/\s+/).filter(Boolean).length > 12
    ) {
      setInputError('Use up to 256 UTF-8 bytes and 12 search words.');
      return;
    }
    setInputError('');
    setQuery(value);
  };
  const next = () => {
    if (!corpus || !chunk || chunk.nextOffsetBytes === null) return;
    setHistory([...history, chunk.offsetBytes]);
    setChunk(
      corpus.getChunk({
        id: chunk.id,
        offsetBytes: chunk.nextOffsetBytes,
        limitBytes: 8192,
      }),
    );
  };
  const previous = () => {
    if (!corpus || !chunk || history.length === 0) return;
    setChunk(
      corpus.getChunk({
        id: chunk.id,
        offsetBytes: history[history.length - 1],
        limitBytes: 8192,
      }),
    );
    setHistory(history.slice(0, -1));
  };
  return (
    <div data-cip-sources>
      <div className="ns-lab-intro">
        <span className="ns-lab-kicker">
          <BookOpen size={18} /> ORIGINAL CIP SOURCES
        </span>
        <h2>Read the original proposal.</h2>
        <p>
          148 original README documents at one pinned commit. Search their
          titles, ids and declared statuses. These are the authors’ source
          documents; proposal status does not establish adoption or Studio
          support.
        </p>
      </div>
      <p className="ns-cip-scope">
        README snapshot only · annexes, CPS and linked files excluded ·{' '}
        <a
          href="https://github.com/cardano-foundation/CIPs/tree/05ee6bb05982289dbe00c4187b9d54cf90e2e276"
          target="_blank"
          rel="noreferrer"
        >
          Commit 05ee6bb <ArrowUpRight size={14} />
        </a>
      </p>
      {!corpus && !loadError && (
        <p role="status" className="ns-cip-loading">
          Loading and verifying the packaged original documents…
        </p>
      )}
      {loadError && (
        <p role="alert" className="ns-cip-error">
          {loadError}
        </p>
      )}
      <div className="ns-cip-search">
        <label htmlFor="cip-source-query">
          <Search size={18} />
          <Input
            id="cip-source-query"
            aria-label="Search original CIP sources"
            value={query}
            maxLength={256}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="CIP-26, music, reference inputs…"
            disabled={!corpus}
          />
        </label>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value || 'all');
            setLimit(12);
            clearSelection();
          }}
          disabled={!corpus}
        >
          <SelectTrigger aria-label="Original proposal status">
            <SelectValue>
              {status === 'all' ? 'All original statuses' : status}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="ns-cip-status-options">
            <SelectItem value="all">All original statuses</SelectItem>
            {Object.keys(corpus?.index.statusCounts || {}).map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {inputError && (
        <p role="alert" className="ns-cip-error">
          {inputError}
        </p>
      )}
      <div className="ns-kb-topics" aria-label="Original source shortcuts">
        {[
          ['CIP26', 'Off-chain metadata'],
          ['CIP60', 'Music'],
          ['CIP190', 'Proof of existence'],
          ['Inactive', 'Inactive proposals'],
        ].map(([value, label]) => (
          <button
            key={value}
            disabled={!corpus}
            onClick={() => {
              setStatus('all');
              changeQuery(value);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {corpus && (
        <p className="ns-lab-muted" aria-live="polite">
          {result?.totalMatches
            ? `${result.results.length} of ${result.totalMatches} original documents shown`
            : 'No matching originals. Try a CIP number or a shorter title.'}
        </p>
      )}
      <div className="ns-cip-results">
        {result?.results.map((entry) => (
          <button
            className="ns-cip-card"
            key={entry.id}
            onClick={() => choose(entry)}
            aria-pressed={selected?.id === entry.id}
          >
            <span className="ns-cip-card-top">
              <strong>{entry.id}</strong>
              <span>{entry.status}</span>
            </span>
            <h3>{entry.title}</h3>
            <span className="ns-cip-card-bottom">
              {entry.license} · {entry.bytes.toLocaleString()} bytes{' '}
              <ArrowUpRight size={16} />
            </span>
          </button>
        ))}
      </div>
      {result && result.totalMatches > result.results.length && limit < 25 && (
        <Button
          className="ns-cip-more"
          variant="outline"
          onClick={() => setLimit(Math.min(25, limit + 12))}
        >
          Show more originals
        </Button>
      )}
      {selected && chunk && (
        <section
          className="ns-cip-reader"
          aria-label="Selected original CIP document"
        >
          <div className="ns-cip-reader-heading">
            <div>
              <span className="ns-lab-kicker">
                {selected.id} · ORIGINAL SOURCE
              </span>
              <h3 ref={readerTitle} tabIndex={-1}>
                {selected.title}
              </h3>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                clearSelection();
                const input = document.getElementById('cip-source-query');
                input?.focus({ preventScroll: true });
                input?.scrollIntoView({ block: 'center' });
              }}
            >
              Close reader
            </Button>
          </div>
          <p className="ns-cip-status">
            Declared status: <strong>{selected.status}</strong>
          </p>
          <p className="ns-cip-reader-note">
            Original Markdown and examples are shown as text. Nothing here is
            executed. {selected.licenseNotes.join(' ')}
          </p>
          <a
            className="ns-cip-source-link"
            href={selected.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Read this exact upstream revision <ArrowUpRight size={16} />
          </a>
          <div className="ns-cip-pages">
            <Button
              variant="outline"
              disabled={!history.length}
              onClick={previous}
            >
              <ArrowLeft size={16} /> Previous chunk
            </Button>
            <p aria-live="polite">
              Bytes{' '}
              <strong>
                {chunk.offsetBytes.toLocaleString()}–
                {chunk.endOffsetBytes.toLocaleString()}
              </strong>{' '}
              of {chunk.totalBytes.toLocaleString()}
              <span>
                UTF-8 · end offset excluded ·{' '}
                {chunk.nextOffsetBytes === null
                  ? 'end of original'
                  : 'more follows'}
              </span>
            </p>
            <Button
              variant="outline"
              disabled={chunk.nextOffsetBytes === null}
              onClick={next}
            >
              Next chunk <ArrowRight size={16} />
            </Button>
          </div>
          {/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Keyboard users need focus to scroll the original source region. */}
          <pre
            role="region"
            ref={reader}
            tabIndex={0}
            aria-label="Original source text"
            className="ns-cip-original"
          >
            {chunk.text}
          </pre>
          {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
          <details className="ns-cip-provenance">
            <summary>Original authorship and byte identity</summary>
            <p>
              {selected.license} · commit {selected.sourceCommit}
            </p>
            <p>
              Whole original SHA-256 <code>{selected.sha256}</code>
            </p>
            <p>
              Git blob SHA-1 <code>{selected.gitBlobSha1}</code>
            </p>
            <pre>
              {
                corpus?.index.entries.find((entry) => entry.id === selected.id)
                  ?.attribution.authorsRawText
              }
            </pre>
            <p>
              Original author and copyright notices remain in the archived
              document. The hash identifies the complete original, not only this
              visible chunk. Unchanged source text is separately licensed from
              Studio’s code.
            </p>
            {selected.retainedLicenses.map((name) => (
              <details key={name}>
                <summary>Retained {name} license text</summary>
                <pre>{licenseTexts?.[name]}</pre>
              </details>
            ))}
          </details>
        </section>
      )}
    </div>
  );
}
