'use client';
import { useEffect, useRef, useState } from 'react';
import { BookOpenCheck, Download, FileCheck2, Upload, X } from 'lucide-react';
import { Button } from './ui/button';
import { PayloadPreview } from './file-workbench';
import { loadCSL, errorText } from '@/lib/cardano';
import { download, filename, jsonBlob } from '@/lib/export';
import {
  ARTIFACT_PASSPORT_LIMITS,
  artifactPassportBytes,
  createArtifactPassport,
  parseArtifactPassport,
  verifyArtifactPassport,
  type ArtifactPassport,
  type PassportVerification,
} from '@/lib/artifact-passport';

export function ArtifactPassportLab() {
  const [passport, setPassport] = useState<ArtifactPassport | null>(null);
  const [report, setReport] = useState<PassportVerification | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(0);
  const receiptInput = useRef<HTMLInputElement>(null);
  const passportInput = useRef<HTMLInputElement>(null);
  const transactionInput = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      ++generation.current;
    },
    [],
  );

  async function open(
    file: File | undefined,
    mode: 'receipt' | 'passport' | 'transaction',
  ) {
    if (!file) return;
    const current = ++generation.current;
    setBusy(true);
    setError('');
    setReport(null);
    if (mode !== 'transaction') {
      setPassport(null);
      setSelected(0);
    }
    try {
      const limit =
        mode === 'passport'
          ? ARTIFACT_PASSPORT_LIMITS.passportBytes
          : ARTIFACT_PASSPORT_LIMITS.receiptBytes;
      if (file.size > limit)
        throw new Error(
          `Choose a file smaller than ${Math.round(limit / 1000)} KB.`,
        );
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength > limit)
        throw new Error('This file exceeds the import limit.');
      const C = await loadCSL();
      if (current !== generation.current) return;
      let next: ArtifactPassport;
      let transactionCborHex: string | undefined;
      if (mode === 'passport') {
        next = parseArtifactPassport(bytes);
      } else {
        const receipt = JSON.parse(
          new TextDecoder('utf-8', { fatal: true }).decode(bytes),
        );
        if (typeof receipt?.signedHex !== 'string')
          throw new Error(
            'Choose an original Studio receipt containing its transaction packet.',
          );
        transactionCborHex = receipt.signedHex;
        if (mode === 'transaction') {
          if (!passport) throw new Error('Open a passport first.');
          next = passport;
        } else next = await createArtifactPassport(C, receipt);
      }
      const result = await verifyArtifactPassport(
        C,
        next,
        transactionCborHex ? { transactionCborHex } : {},
      );
      if (current !== generation.current) return;
      setReport(result);
      if (result.status !== 'verified-local-content') {
        setError(
          result.error || 'The supplied evidence does not match this passport.',
        );
        return;
      }
      setPassport(next);
    } catch (e) {
      if (current === generation.current) setError(errorText(e));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }

  return (
    <div className="ns-passport-lab">
      <div className="ns-lab-intro">
        <span className="ns-lab-kicker">
          <BookOpenCheck size={18} /> ARTIFACT PASSPORT
        </span>
        <h2>Take the evidence with the artifact.</h2>
        <p>
          Package exact files, metadata commitments and a clear record of what
          can be verified. Check it again offline.
        </p>
      </div>
      <div className="ns-lab-columns">
        <section className="ns-panel">
          <h3>Make or check a passport</h3>
          <p className="ns-lab-muted">
            Create one from a Studio file-package NFT or data receipt. Or open a
            passport someone shared. All checks run in this browser.
          </p>
          <div className="ns-button-row">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => receiptInput.current?.click()}
            >
              <FileCheck2 size={17} /> Make from receipt
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => passportInput.current?.click()}
            >
              <Upload size={17} /> Open passport
            </Button>
          </div>
          <input
            ref={receiptInput}
            data-passport-receipt
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              void open(e.target.files?.[0], 'receipt');
              e.target.value = '';
            }}
          />
          <input
            ref={passportInput}
            data-passport-file
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              void open(e.target.files?.[0], 'passport');
              e.target.value = '';
            }}
          />
          <input
            ref={transactionInput}
            data-passport-transaction
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              void open(e.target.files?.[0], 'transaction');
              e.target.value = '';
            }}
          />
          {busy && (
            <output className="ns-lab-muted">Checking exact bytes…</output>
          )}
          {error && (
            <p className="ns-error" role="alert">
              {error}
            </p>
          )}
          <div className="ns-passport-boundary">
            Matching bytes do not establish authorship, ownership or chain
            inclusion. A receipt’s reported confirmation stays an unverified
            claim here.
          </div>
          {passport && (
            <>
              <div className="ns-hash">
                <span>Passport SHA-256</span>
                <code>{passport.passportHash}</code>
              </div>
              <div className="ns-hash">
                <span>Transaction identity</span>
                <code>{passport.transaction.hash}</code>
              </div>
              <div className="ns-button-row">
                <Button
                  disabled={busy || report?.status !== 'verified-local-content'}
                  onClick={() =>
                    download(
                      new Blob(
                        [new Uint8Array(artifactPassportBytes(passport))],
                        { type: 'application/json' },
                      ),
                      filename(passport.bundle.name) + '.passport.json',
                    )
                  }
                >
                  <Download size={17} /> Export passport
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => transactionInput.current?.click()}
                >
                  Check original receipt
                </Button>
              </div>
              <p className="ns-lab-muted">
                The passport includes the artifact’s files and metadata. It
                excludes wallet snapshots and the transaction packet. Keep the
                original receipt separately to check transaction binding.
              </p>
            </>
          )}
        </section>
        <section className="ns-panel ns-payload-review">
          {passport ? (
            <>
              <div className="ns-lab-row">
                <span className="ns-lab-status">
                  {report?.status === 'verified-local-content'
                    ? 'Local content verified'
                    : 'Evidence needs attention'}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Clear passport"
                  onClick={() => {
                    ++generation.current;
                    setPassport(null);
                    setReport(null);
                    setError('');
                    setBusy(false);
                  }}
                >
                  <X size={18} />
                </Button>
              </div>
              <h3>{passport.bundle.name}</h3>
              <p className="ns-lab-muted">
                {passport.identity.kind === 'nft'
                  ? 'NFT file package'
                  : 'Data record'}{' '}
                · {passport.bundle.bytes.toLocaleString()} bytes ·{' '}
                {passport.bundle.files.length} files
              </p>
              <div className="ns-file-tabs" aria-label="Passport files">
                {passport.bundle.files.map((file, index) => (
                  <button
                    key={file.name}
                    aria-pressed={selected === index}
                    onClick={() => setSelected(index)}
                  >
                    {file.name}
                  </button>
                ))}
              </div>
              <PayloadPreview file={passport.bundle.files[selected]} />
              <p className="ns-lab-muted">
                Imported programs stay inert in this preview.
              </p>
            </>
          ) : (
            <div className="ns-preview-empty">
              <BookOpenCheck size={44} strokeWidth={1} />
              <h3>Portable, inspectable evidence.</h3>
              <p>
                The exact content and its verification report appear here. No
                wallet connection is needed.
              </p>
            </div>
          )}
        </section>
      </div>
      {report && (
        <section className="ns-panel ns-passport-report" aria-live="polite">
          <div className="ns-lab-row">
            <h3>What was checked</h3>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                download(jsonBlob(report), 'passport-verification.json')
              }
            >
              <Download size={16} /> Save report
            </Button>
          </div>
          <ul>
            {report.checks.map((check) => (
              <li
                key={check.id}
                data-passport-check={check.id}
                data-status={check.status}
              >
                <div>
                  <strong>{check.id.replaceAll('-', ' ')}</strong>
                  <span
                    className={
                      check.status === 'match'
                        ? 'ns-lab-status'
                        : 'ns-passport-unverified'
                    }
                  >
                    {check.status.replaceAll('-', ' ')}
                  </span>
                </div>
                <p>{check.message}</p>
                <small>{check.evidence.replaceAll('-', ' ')}</small>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="ns-lab-sources">
        <a
          className="ns-text-link"
          href="https://github.com/BEACNpool/NFT-Studio/blob/main/docs/ARTIFACT_PASSPORT.md"
          target="_blank"
          rel="noreferrer"
        >
          Read the Artifact Passport format and verification evidence
        </a>
      </p>
    </div>
  );
}
