'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, FileCheck2, Download } from 'lucide-react';
import { Button } from './ui/button';
import { assetPath } from '@/lib/paths';
import { download } from '@/lib/export';
import { mountLedger } from '@/lib/ledger-adapter.js';
export function LedgerWorkbench({
  kind,
  file,
}: {
  kind: 'scroll' | 'book' | 'reader';
  file?: File;
}) {
  const host = useRef<HTMLDivElement>(null),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false),
    [handed, setHanded] = useState(false),
    [busy, setBusy] = useState(false);
  const tool = useRef<{
    ready: Promise<unknown>;
    prepareFile: (f: File) => Promise<unknown>;
    destroy: () => void;
  } | null>(null);
  const path =
    kind === 'book'
      ? 'ledger-book.html?create=1'
      : kind === 'reader'
        ? 'index.html'
        : 'calculator.html';
  useEffect(() => {
    let disposed = false;
    setReady(false);
    setError('');
    setHanded(false);
    Promise.resolve()
      .then(() => {
        if (disposed || !host.current) return;
        const editor = mountLedger(host.current, {
          base: assetPath('/tools/ledger/'),
          seed: undefined,
          kind,
          onEvent: (event: { type: string; detail?: { message?: string } }) => {
            if (event.type === 'error')
              setError(
                event.detail?.message ||
                  'Open the full-page creator to continue.',
              );
          },
        });
        tool.current = editor;
        editor.ready
          .then(() => {
            if (!disposed) setReady(true);
          })
          .catch((e: Error) => {
            if (!disposed) setError(e.message);
          });
      })
      .catch((e) => setError(e.message));
    return () => {
      disposed = true;
      tool.current?.destroy();
      tool.current = null;
    };
  }, [kind]);
  const handoff = async () => {
    if (!file || !tool.current || busy) return;
    setBusy(true);
    setError('');
    try {
      await tool.current.prepareFile(file);
      setHanded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ns-ledger">
      <div className="ns-ledger-intro">
        <div>
          <span className="ns-eyebrow">
            {kind === 'book'
              ? 'LEDGER BOOK'
              : kind === 'reader'
                ? 'READ. VERIFY. KEEP.'
                : 'LEDGER SCROLL'}
          </span>
          <h2>
            {kind === 'book'
              ? 'A book with room to grow.'
              : kind === 'reader'
                ? 'Recover the original bytes.'
                : 'Some things deserve more than a thumbnail.'}
          </h2>
          <p>
            {kind === 'book'
              ? 'Create a Book and collect public entries over time.'
              : kind === 'reader'
                ? 'Open a Scroll pointer or Book identity, inspect the original content, and keep a verified local copy.'
                : 'Publish writing or files. Scrolls store data without minting a token.'}
          </p>
        </div>
        <a
          className="ns-secondary"
          href={assetPath('/tools/ledger/' + path)}
          rel="noreferrer"
        >
          Open full page
          <ArrowUpRight size={16} />
        </a>
      </div>
      {file && (
        <div className="ns-handoff">
          <FileCheck2 size={22} />
          <div>
            <strong>{file.name}</strong>
            <span>
              {file.size.toLocaleString()} bytes ·{' '}
              {handed
                ? 'Loaded into the creator below. Review its exact prepared hash.'
                : 'Your selected file is ready to transfer locally.'}
            </span>
          </div>
          <Button disabled={!ready || busy || handed} onClick={handoff}>
            {busy
              ? 'Preparing…'
              : handed
                ? 'File transferred'
                : 'Prepare this file'}
          </Button>
          <Button variant="ghost" onClick={() => download(file, file.name)}>
            <Download size={16} />
            Keep file
          </Button>
        </div>
      )}
      {error && (
        <p className="ns-error" role="alert">
          {error}
        </p>
      )}
      <details className="ns-ledger-help">
        <summary>Costs & wallet help</summary>
        <p>
          {kind === 'book'
            ? 'Book entries are public. The current holder receives each entry’s minimum-ADA anchor.'
            : 'Scrolls require network fees and permanently lock ADA in data outputs. Review the full cost before signing.'}{' '}
          If an embedded wallet connection is unavailable, open the full-page
          creator. Select your files again there and keep your receipts before
          switching browsers.
        </p>
      </details>
      <div className="ns-ledger-frame" ref={host} />
    </div>
  );
}
