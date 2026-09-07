'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Search,
  Download,
  Upload,
  ArrowUpRight,
  CheckCircle2,
  FileCheck2,
  ScrollText,
  BookOpenCheck,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  checkTransaction,
  readTransactionMetadata,
  type ChainObservation,
} from '@/lib/studio-submission';
import {
  recoverPayloadMetadata,
  decodePayloadURI,
  payloadHash,
  DATA_LABEL,
  PAYLOAD_TYPES,
  type PayloadFile,
  type PayloadMime,
} from '@/lib/studio-payload';
import { loadReceipts, type StudioReceipt } from '@/lib/studio-receipts';
import { errorText, loadCSL } from '@/lib/cardano';
import { download, filename, jsonBlob } from '@/lib/export';
import { assetPath } from '@/lib/paths';
import { PayloadPreview } from './file-workbench';
type Recovered = { file: PayloadFile; verified: boolean; title: string };
export function RecoveryPanel() {
  const [hash, setHash] = useState(''),
    [files, setFiles] = useState<Recovered[]>([]),
    [status, setStatus] = useState<ChainObservation | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [receipts, setReceipts] = useState<StudioReceipt[]>([]),
    [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null),
    lock = useRef(false);
  useEffect(() => {
    try {
      setReceipts(loadReceipts());
    } catch {
      setError(
        'Saved receipts could not be read. Import a receipt or check a transaction ID.',
      );
    }
  }, []);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    setFiles([]);
    setStatus(null);
    setSelected(0);
    try {
      await action();
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const check = (value = hash) =>
    run(async () => {
      const id = value.trim().toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(id))
        throw new Error(
          'Enter a 64-character transaction ID. Scroll pointers and Book identities use the Ledger reader below.',
        );
      setHash(id);
      const [observation, metadata] = await Promise.all([
        checkTransaction(id),
        readTransactionMetadata(id),
      ]);
      setStatus(observation);
      if (!metadata) {
        setNotice(
          'The reader has not indexed this transaction’s metadata yet. Keep the ID and check again.',
        );
        return;
      }
      const recovered = await recoverEmbedded(metadata);
      setFiles(recovered);
      setNotice(
        recovered.length
          ? 'Embedded bytes recovered. Hash checks compare the files with their metadata commitments; they do not prove authorship.'
          : 'No supported embedded NFT files were found. For Scrolls or Books, open the Ledger reader.',
      );
    });
  const importFile = (file?: File) =>
    file &&
    run(async () => {
      if (file.size > 1500000)
        throw new Error(
          'Choose a receipt or metadata JSON smaller than 1.5 MB.',
        );
      const data = JSON.parse(await file.text());
      if (data?.schema === 'beacn.artifact-passport.v1') {
        const {
          ARTIFACT_PASSPORT_LIMITS,
          parseArtifactPassport,
          verifyArtifactPassport,
        } = await import('@/lib/artifact-passport');
        if (file.size > ARTIFACT_PASSPORT_LIMITS.passportBytes)
          throw new Error('Choose a passport smaller than 240 KB.');
        const passport = parseArtifactPassport(
          new Uint8Array(await file.arrayBuffer()),
        );
        const verification = await verifyArtifactPassport(
          await loadCSL(),
          passport,
        );
        if (verification.status !== 'verified-local-content')
          throw new Error(
            verification.error || 'Passport content verification failed.',
          );
        setFiles(
          passport.bundle.files.map((file) => ({
            file,
            verified: true,
            title: passport.bundle.name,
          })),
        );
        setHash(passport.transaction.hash);
        setNotice(
          'Passport files and metadata match locally. Transaction binding, signatures and chain inclusion were not checked. Open Labs → Artifact passport for the full evidence report.',
        );
        return;
      }
      const metadata = data.metadata || data.prepared?.metadata || data;
      if (data.bundle) {
        const { verifyPayloadBundle } = await import('@/lib/studio-payload');
        await verifyPayloadBundle(data.bundle);
        setFiles(
          data.bundle.files.map((f: PayloadFile) => ({
            file: f,
            verified: true,
            title: data.bundle.name,
          })),
        );
      } else setFiles(await recoverEmbedded(metadata));
      if (typeof data.hash === 'string' && /^[a-f0-9]{64}$/.test(data.hash))
        setHash(data.hash);
      setNotice(
        'Recovered from an imported file. Use Check chain to independently request current inclusion and metadata.',
      );
    });
  const exportPassport = async (receipt: StudioReceipt) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { createArtifactPassport, artifactPassportBytes } =
        await import('@/lib/artifact-passport');
      const passport = await createArtifactPassport(await loadCSL(), receipt);
      download(
        new Blob([new Uint8Array(artifactPassportBytes(passport))], {
          type: 'application/json',
        }),
        filename(passport.bundle.name) + '.passport.json',
      );
      setNotice(
        'Passport exported with exact files and metadata. Wallet snapshots and the transaction packet stay out of this export; keep the original receipt separately.',
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <div className="ns-heading">
        <div>
          <h1>Activity & recovery</h1>
          <p>
            Check a transaction, open a receipt, or recover your on-chain files.
          </p>
        </div>
      </div>
      <div className="ns-recovery-grid">
        <section className="ns-panel">
          <h2>Open a transaction</h2>
          <label className="ns-field" htmlFor="recovery-hash">
            Cardano transaction ID
            <Input
              id="recovery-hash"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              placeholder="64-character transaction hash"
              spellCheck={false}
            />
          </label>
          <div className="ns-button-row">
            <Button
              className="ns-primary"
              disabled={busy || !hash.trim()}
              onClick={() => check()}
            >
              <Search size={17} />
              {busy ? 'Reading…' : 'Check chain'}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <Upload size={16} />
              Import receipt or metadata
            </Button>
          </div>
          <input
            ref={input}
            type="file"
            hidden
            accept="application/json,.json"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {status && (
            <p className="ns-notice">
              <CheckCircle2 size={16} />
              {status.state === 'confirmed'
                ? `Included on chain · ${status.blocksAfterInclusion} subsequent blocks`
                : 'Not yet observed by this reader'}
            </p>
          )}
          {notice && (
            <p role="status" className="ns-fineprint">
              {notice}
            </p>
          )}
          {error && (
            <p className="ns-error" role="alert">
              {error}
            </p>
          )}
          <div className="ns-recovery-ledger">
            <ScrollText size={23} />
            <div>
              <h3>A Scroll or a Book?</h3>
              <p>
                Use its pointer or identity in the complete Ledger reader.
                Resume an interrupted Scroll from its receipt vault.
              </p>
              <div className="ns-button-row">
                <a
                  className="ns-text-link"
                  href={assetPath('/tools/ledger/index.html')}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Ledger reader
                  <ArrowUpRight size={16} />
                </a>
                <a
                  className="ns-text-link"
                  href={assetPath('/tools/ledger/calculator.html#vaultsec')}
                  target="_blank"
                  rel="noreferrer"
                >
                  Scroll receipt vault
                  <ArrowUpRight size={16} />
                </a>
              </div>
            </div>
          </div>
        </section>
        <section className="ns-panel">
          {files.length ? (
            <>
              <div className="ns-file-tabs">
                {files.map((r, i) => (
                  <button
                    aria-pressed={selected === i}
                    onClick={() => setSelected(i)}
                    key={i}
                  >
                    {r.file.name}
                  </button>
                ))}
              </div>
              <h2>{files[selected].title}</h2>
              <PayloadPreview file={files[selected].file} />
              <p className="ns-notice">
                <FileCheck2 size={17} />
                {files[selected].verified
                  ? 'Metadata hash matches'
                  : 'Recovered · no hash commitment provided'}
              </p>
              <div className="ns-hash">
                <span>
                  SHA-256 · {files[selected].file.bytes.toLocaleString()} bytes
                </span>
                <code>{files[selected].file.sha256}</code>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  const f = files[selected].file;
                  download(
                    new Blob(
                      [new Uint8Array(decodePayloadURI(f.uri, f.mediaType))],
                      { type: f.mediaType },
                    ),
                    safeDownloadName(f),
                  );
                }}
              >
                <Download size={16} />
                Save exact file
              </Button>
              <p className="ns-fineprint">
                Recovered HTML is previewed without executing its code. Open a
                downloaded program only when you trust its source.
              </p>
            </>
          ) : (
            <div className="ns-preview-empty">
              <FileCheck2 size={44} strokeWidth={1} />
              <h3>Recover. Verify. Keep.</h3>
              <p>
                Embedded images, audio, programs and data appear here. No wallet
                connection needed.
              </p>
            </div>
          )}
        </section>
      </div>
      <section className="ns-receipts-list">
        <div className="ns-heading">
          <div>
            <p className="ns-eyebrow">SAVED ON THIS BROWSER</p>
            <h2>Your transaction receipts</h2>
          </div>
        </div>
        {receipts.length ? (
          receipts.map((r) => (
            <article key={r.hash}>
              <div>
                <strong>{r.name || r.kind}</strong>
                <span>
                  {r.state} · {new Date(r.createdAt).toLocaleString()}
                </span>
                <code>{r.hash}</code>
              </div>
              <div className="ns-button-row">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => check(r.hash)}
                >
                  Check & recover
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={'Export receipt ' + r.name}
                  onClick={() =>
                    download(
                      jsonBlob(r),
                      filename(r.name || 'creation') + '.receipt.json',
                    )
                  }
                >
                  <Download size={18} />
                </Button>
                {['nft', 'data'].includes(r.kind) &&
                  typeof r.signedHex === 'string' && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void exportPassport(r)}
                    >
                      <BookOpenCheck size={17} /> Export passport
                    </Button>
                  )}
              </div>
            </article>
          ))
        ) : (
          <p className="ns-fineprint">
            No receipts saved here yet. Receipt files can move between devices;
            browser storage does not.
          </p>
        )}
      </section>
    </>
  );
}
function safeDownloadName(file: PayloadFile) {
  const ext: Record<string, string> = {
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'text/html': 'html',
    'application/json': 'json',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'text/plain': 'txt',
  };
  return (
    filename(file.name) +
    (file.name.includes('.') ? '' : '.' + (ext[file.mediaType] || 'bin'))
  );
}
const joined = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every((x) => typeof x === 'string'))
    return value.join('');
  return '';
};
async function recoverEmbedded(metadata: unknown): Promise<Recovered[]> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
    throw new Error('Invalid metadata object.');
  const map = metadata as Record<string, unknown>;
  const out: Recovered[] = [];
  if (map[DATA_LABEL]) {
    const result = await recoverPayloadMetadata(metadata);
    return result.bundle.files.map((file) => ({
      file,
      verified: true,
      title: result.bundle.name,
    }));
  }
  const cip25 = map['721'];
  if (!cip25 || typeof cip25 !== 'object') return [];
  for (const [policy, assets] of Object.entries(cip25)) {
    if (
      !/^[a-fA-F0-9]{56}$/.test(policy) ||
      !assets ||
      typeof assets !== 'object'
    )
      continue;
    for (const [asset, row] of Object.entries(assets)) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const r = row as Record<string, unknown>;
      if (r.schema === 'nft-studio.payload.v1') {
        const result = await recoverPayloadMetadata(metadata, {
          policyId: policy,
          assetName: asset,
        });
        out.push(
          ...result.bundle.files.map((file) => ({
            file,
            verified: true,
            title: result.bundle.name,
          })),
        );
        continue;
      }
      const entries: unknown[] = [
        {
          name: 'cover',
          mediaType: r.mediaType,
          src: r.image,
          sha256: r.image_sha256,
        },
        ...(Array.isArray(r.files) ? r.files.slice(0, 8) : []),
      ];
      for (let i = 0; i < entries.length; i++) {
        const rawEntry = entries[i];
        if (
          !rawEntry ||
          typeof rawEntry !== 'object' ||
          Array.isArray(rawEntry)
        )
          continue;
        const entry = rawEntry as Record<string, unknown>;
        const uri = joined(entry.src);
        if (!uri.startsWith('data:')) continue;
        const inferred = uri.slice(5).split(/[;,]/)[0];
        const mime =
          typeof entry.mediaType === 'string' ? entry.mediaType : inferred;
        if (!(PAYLOAD_TYPES as readonly unknown[]).includes(mime)) continue;
        const bytes = decodePayloadURI(uri, mime as PayloadMime);
        const hash = await payloadHash(bytes);
        const expected =
          entry.sha256 ||
          (i === 1
            ? r.sha256 ||
              (r.interactive && typeof r.interactive === 'object'
                ? (r.interactive as Record<string, unknown>).sha256
                : undefined)
            : undefined);
        if (expected && expected !== hash)
          throw new Error(
            'An embedded file does not match its metadata hash. Recovery stopped.',
          );
        out.push({
          file: {
            name: (typeof entry.name === 'string'
              ? entry.name
              : 'file-' + i
            ).slice(0, 120),
            mediaType: mime as PayloadMime,
            bytes: bytes.length,
            uri,
            sha256: hash,
          },
          verified: !!expected,
          title: joined(r.name) || asset,
        });
        if (out.length > 32)
          throw new Error(
            'This transaction has too many embedded assets for this reader.',
          );
      }
    }
  }
  return out;
}
