'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileCheck2, Fingerprint, Upload, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  buildProofOfExistenceFiles,
  decodeProofOfExistenceBody,
  verifyProofOfExistenceFile,
  type ProofArtifact,
  type ProofProgress,
} from '@/lib/proof-of-existence';
import { download, jsonBlob } from '@/lib/export';
import { errorText } from '@/lib/cardano';

export function ProofOfExistenceLab() {
  const [artifact, setArtifact] = useState<ProofArtifact | null>(null);
  const [progress, setProgress] = useState<ProofProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recordHex, setRecordHex] = useState('');
  const [items, setItems] = useState(0);
  const [item, setItem] = useState(0);
  const expectedHashes = useMemo(
    () =>
      recordHex
        ? decodeProofOfExistenceBody(recordHex).items[item]?.hashes
        : undefined,
    [recordHex, item],
  );
  const [verification, setVerification] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const filesInput = useRef<HTMLInputElement>(null),
    recordInput = useRef<HTMLInputElement>(null),
    checkInput = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      ++generation.current;
      controller.current?.abort();
    },
    [],
  );
  async function create(files: File[]) {
    if (!files.length) return;
    const current = ++generation.current;
    controller.current?.abort();
    controller.current = new AbortController();
    setBusy(true);
    setError('');
    setArtifact(null);
    setProgress(null);
    try {
      const next = await buildProofOfExistenceFiles(files, {
        signal: controller.current.signal,
        onProgress: (value) => {
          if (current === generation.current) setProgress(value);
        },
      });
      if (current !== generation.current) return;
      setArtifact(next);
      setRecordHex(next.recordCborHex);
      setItems(next.record.items.length);
      setItem(0);
      setVerification('');
      setVerifyError('');
    } catch (e) {
      if (current === generation.current) setError(errorText(e));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  async function openRecord(file?: File) {
    if (!file) return;
    const current = ++generation.current;
    controller.current?.abort();
    setBusy(true);
    setProgress(null);
    setVerification('');
    setVerifyError('');
    setRecordHex('');
    setItems(0);
    try {
      if (file.size > 400000)
        throw new Error('Choose a proof JSON file under 400 KB.');
      const imported: unknown = JSON.parse(await file.text());
      if (current !== generation.current) return;
      if (
        !imported ||
        typeof imported !== 'object' ||
        !('recordCborHex' in imported) ||
        typeof imported.recordCborHex !== 'string'
      )
        throw new Error('This file has no encoded proof record.');
      const record = decodeProofOfExistenceBody(imported.recordCborHex);
      setRecordHex(imported.recordCborHex);
      setItems(record.items.length);
      setItem(0);
    } catch (e) {
      if (current === generation.current) setVerifyError(errorText(e));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  async function checkFile(file?: File) {
    if (!file || !recordHex) return;
    const current = ++generation.current;
    controller.current?.abort();
    controller.current = new AbortController();
    setVerification('');
    setVerifyError('');
    setBusy(true);
    setProgress(null);
    try {
      const result = await verifyProofOfExistenceFile(recordHex, file, item, {
        signal: controller.current.signal,
      });
      if (current !== generation.current) return;
      if (result.matches) setVerification(result.message);
      else setVerifyError(result.message);
    } catch (e) {
      if (current === generation.current) setVerifyError(errorText(e));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  return (
    <div className="ns-proof-lab">
      <div className="ns-lab-intro">
        <span className="ns-lab-kicker">
          <Fingerprint size={18} /> PROOF OF EXISTENCE
        </span>
        <h2>A small commitment to any file.</h2>
        <p>
          Fingerprint exact local files with SHA-256 and BLAKE2b-256. Export a
          compact Cardano metadata record, then check an original against it.
        </p>
      </div>
      <p className="ns-capsule-boundary">
        <strong>CIP-190 · Proposed.</strong> This local tool prepares and
        verifies the public hash-only profile. Exporting a record does not
        publish it or prove chain inclusion.
      </p>
      <div className="ns-lab-columns">
        <section className="ns-panel">
          <h3>Commit to your originals.</h3>
          <p className="ns-lab-muted">
            Up to 16 files, 256 MiB total. The browser reads them in small
            pieces. Your files stay on this device.
          </p>
          <Button onClick={() => filesInput.current?.click()} disabled={busy}>
            <Upload size={18} /> Choose files to fingerprint
          </Button>
          <input
            ref={filesInput}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              void create(Array.from(e.target.files || []));
              e.target.value = '';
            }}
          />
          {busy && (
            <div className="ns-proof-progress">
              <output>
                {progress
                  ? `${Math.round((progress.bytesHashed / Math.max(1, progress.totalBytes)) * 100)}% · hashing locally`
                  : 'Reading local file…'}
              </output>
              <Button
                variant="ghost"
                onClick={() => controller.current?.abort()}
              >
                <X size={16} /> Cancel
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" className="ns-error">
              {error}
            </p>
          )}
          {artifact && (
            <div className="ns-proof-artifact">
              <div className="ns-lab-row">
                <span className="ns-lab-status">Digests computed locally</span>
                <span className="ns-kb-status">Label 309</span>
              </div>
              <p className="ns-lab-muted">
                {artifact.files.length}{' '}
                {artifact.files.length === 1 ? 'file' : 'files'} ·{' '}
                {artifact.recordCborHex.length / 2} record bytes ·{' '}
                {artifact.metadataCborHex.length / 2} metadata bytes
              </p>
              <ol className="ns-proof-files">
                {artifact.files.map((file, i) => (
                  <li key={i}>
                    <strong>
                      {i + 1}. {file.name}
                    </strong>
                    <span>{file.bytes.toLocaleString()} original bytes</span>
                    {Object.entries(file.hashes).map(([algorithm, digest]) => (
                      <div className="ns-hash" key={algorithm}>
                        <span>{algorithm}</span>
                        <code>{digest}</code>
                      </div>
                    ))}
                  </li>
                ))}
              </ol>
              <div className="ns-button-row">
                <Button
                  variant="outline"
                  onClick={() =>
                    download(jsonBlob(artifact), 'beacn-proof-record.json')
                  }
                >
                  <Download size={16} /> Export proof JSON
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    download(
                      new Blob([artifact.metadataCborHex], {
                        type: 'text/plain',
                      }),
                      'beacn-proof.metadata.cbor.hex',
                    )
                  }
                >
                  <Download size={16} /> Export metadata CBOR
                </Button>
              </div>
              <details className="ns-lab-details">
                <summary>What the metadata contains</summary>
                <p>
                  The metadata carries only the version, hash algorithms and raw
                  digests. File names and sizes appear in your local JSON
                  sidecar. A future transaction must put the exact byte-chunk
                  array under label 309.
                </p>
                <div className="ns-hash">
                  <span>Record SHA-256</span>
                  <code>{artifact.recordSha256}</code>
                </div>
              </details>
            </div>
          )}
        </section>
        <section className="ns-panel ns-proof-verify">
          <h3>Does the original still match?</h3>
          <p className="ns-lab-muted">
            Use the record you just created, or open an exported proof JSON. The
            encoded hashes are checked; imported names and descriptions are not
            trusted.
          </p>
          <Button
            variant="outline"
            onClick={() => recordInput.current?.click()}
            disabled={busy}
          >
            <Upload size={17} /> Open proof JSON
          </Button>
          <input
            ref={recordInput}
            data-proof-record
            type="file"
            hidden
            accept=".json,application/json"
            onChange={(e) => {
              void openRecord(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {recordHex && (
            <>
              <p className="ns-lab-status">
                Record loaded · {items} {items === 1 ? 'item' : 'items'}
              </p>
              {items > 1 && (
                <label className="ns-field" htmlFor="proof-item">
                  Item to verify (1–{items})
                  <Input
                    id="proof-item"
                    type="number"
                    min={1}
                    max={items}
                    value={item + 1}
                    onChange={(e) => {
                      setItem(
                        Math.max(
                          0,
                          Math.min(items - 1, Number(e.target.value) - 1),
                        ),
                      );
                      setVerification('');
                      setVerifyError('');
                    }}
                  />
                </label>
              )}
              <Button
                onClick={() => checkInput.current?.click()}
                disabled={busy}
              >
                <FileCheck2 size={17} /> Choose original to verify
              </Button>
            </>
          )}
          <input
            ref={checkInput}
            data-proof-original
            type="file"
            hidden
            onChange={(e) => {
              void checkFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {expectedHashes && (
            <details className="ns-lab-details">
              <summary>Expected hashes for item {item + 1}</summary>
              {Object.entries(expectedHashes).map(([algorithm, digest]) => (
                <div className="ns-hash" key={algorithm}>
                  <span>{algorithm}</span>
                  <code>{digest}</code>
                </div>
              ))}
            </details>
          )}
          {verification && (
            <output className="ns-lab-status">{verification}</output>
          )}
          {verifyError && (
            <p className="ns-error" role="alert">
              {verifyError}
            </p>
          )}
        </section>
      </div>
      <div className="ns-capsule-explain">
        <article>
          <span>01 / EXACT BYTES</span>
          <h3>One edit changes the result.</h3>
          <p>
            A changed pixel, line ending or file encoding produces different
            digests. Keep the exact original; a hash cannot recover a lost file.
          </p>
        </article>
        <article>
          <span>02 / PUBLIC COMMITMENT</span>
          <h3>A digest is not encryption.</h3>
          <p>
            Someone can test a known or guessed file against a published digest.
            Use this public profile only for commitments you intend to make
            public.
          </p>
        </article>
        <article>
          <span>03 / KNOW THE CLAIM</span>
          <h3>Matching is a narrow fact.</h3>
          <p>
            Matching hashes establish byte equality. They do not establish
            authorship, rights, truth or ownership. Timing needs separately
            verified transaction inclusion.
          </p>
        </article>
      </div>
      <p className="ns-lab-sources">
        <a
          href="https://github.com/BEACNpool/NFT-Studio/blob/main/docs/PROOF_OF_EXISTENCE.md"
          target="_blank"
          rel="noreferrer"
        >
          Encoding, test vectors and supported profile
        </a>{' '}
        ·{' '}
        <a
          href="https://cips.cardano.org/cip/CIP-0190"
          target="_blank"
          rel="noreferrer"
        >
          CIP-190 proposal
        </a>
        .
      </p>
    </div>
  );
}
