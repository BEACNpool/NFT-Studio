'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, FileSignature, FlaskConical, Upload } from 'lucide-react';
import { Button } from './ui/button';
import { assetPath } from '@/lib/paths';
import './music-seal-lab.css';

type SealModule =
  typeof import('@/experiments/music-schnorr-seal/snapshot/dist/seal.mjs');
type Inspection = Awaited<ReturnType<SealModule['inspectSeal']>>;
type Challenge = Awaited<ReturnType<SealModule['prepareChallenge']>>;
type InputKind = 'package' | 'seal' | 'trust';
const EMPTY_TRUST = '{"schema":"beacn.music-schnorr-trust.v1","bindings":[]}';
const limits: Record<InputKind, number> = {
  package: 80000,
  seal: 1024,
  trust: 4096,
};
const encoder = new TextEncoder();
const messages: Record<Inspection['verdict'], string> = {
  'no-seal': 'Release checked. No signature supplied.',
  'valid-untrusted': 'Signature verifies. No matching trust rule selected.',
  'trusted-exact-release':
    'Signature and exact release match your selected rules.',
  'different-release': 'Signature verifies, but covers a different release.',
  'invalid-signature': 'Signature does not verify.',
  'unsupported-signature': 'Signature is outside this supported profile.',
};
function bounded(text: string, kind: InputKind) {
  if (
    text.length > limits[kind] ||
    !text.isWellFormed() ||
    encoder.encode(text).length > limits[kind]
  )
    throw new Error(
      `Use well-formed ${kind} JSON within ${limits[kind].toLocaleString()} UTF-8 bytes. The previous input was kept.`,
    );
  return text;
}
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const explainError = (e: unknown) =>
  e instanceof Error
    ? e.message
    : 'Local inspection failed. Check the supplied JSON.';

export function MusicSealLab() {
  const [packet, setPacket] = useState('');
  const [seal, setSeal] = useState('');
  const [trust, setTrust] = useState(EMPTY_TRUST);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [viewed, setViewed] = useState<{
    revision: number;
    result: Inspection;
    packet: string;
    seal: string;
    trust: string;
  } | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const revision = useRef(0),
    mounted = useRef(true);
  const packageFile = useRef<HTMLInputElement>(null),
    sealFile = useRef<HTMLInputElement>(null),
    trustFile = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      revision.current++;
    };
  }, []);
  useEffect(() => {
    if (!viewed) return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: 'start' });
  }, [viewed]);
  const current = (id: number) => mounted.current && revision.current === id;
  function invalidate(note = '') {
    const id = ++revision.current;
    setViewed(null);
    setChallenge(null);
    setBusy(false);
    setError('');
    setNotice(note);
    return id;
  }
  function assign(kind: InputKind, value: string) {
    if (kind === 'package') setPacket(value);
    else if (kind === 'seal') setSeal(value);
    else setTrust(value);
  }
  function edit(kind: InputKind, value: string) {
    invalidate('Inputs changed. Inspect again for current results.');
    try {
      assign(kind, bounded(value, kind));
    } catch (e) {
      setError(explainError(e));
    }
  }
  async function importFile(kind: InputKind, file?: File) {
    if (!file) return;
    const id = invalidate('Reading local file…');
    setBusy(true);
    try {
      if (file.size > limits[kind])
        throw new Error(
          `The file exceeds the ${limits[kind].toLocaleString()}-byte limit. The previous input was kept.`,
        );
      const bytes = await file.arrayBuffer();
      if (!current(id)) return;
      if (bytes.byteLength > limits[kind])
        throw new Error('The file exceeds its byte limit.');
      assign(
        kind,
        bounded(
          new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
            bytes,
          ),
          kind,
        ),
      );
      setNotice('Original file loaded. Inspect to check these inputs.');
    } catch (e) {
      if (current(id)) setError(explainError(e));
    } finally {
      if (current(id)) setBusy(false);
    }
  }
  async function fixedExample(path: string, kind: InputKind) {
    const response = await fetch(assetPath(`/labs/music-seal/${path}`), {
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
    if (!response.ok)
      throw new Error('The fixed demonstration file could not be loaded.');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('The demonstration response has no body.');
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > limits[kind])
          throw new Error('The demonstration exceeds its byte limit.');
        chunks.push(value);
      }
    } finally {
      void reader.cancel().catch(() => {});
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const part of chunks) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }
    return bounded(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes),
      kind,
    );
  }
  async function inspectInputs(p = packet, s = seal, t = trust) {
    const id = invalidate();
    setBusy(true);
    try {
      if (!p.trim())
        throw new Error(
          'Import a Music release package or try the signed example.',
        );
      bounded(p, 'package');
      bounded(s, 'seal');
      bounded(t, 'trust');
      const sealApi =
        await import('@/experiments/music-schnorr-seal/snapshot/dist/seal.mjs');
      if (!current(id)) return;
      const result = await sealApi.inspectSeal(p, s.trim() ? s : null, t);
      if (!current(id)) return;
      setViewed({ revision: id, result, packet: p, seal: s, trust: t });
      setNotice(
        'Local checks complete. Signature, release binding and selected trust are separate.',
      );
    } catch (e) {
      if (current(id)) setError(explainError(e));
    } finally {
      if (current(id)) setBusy(false);
    }
  }
  async function example() {
    const id = invalidate();
    setBusy(true);
    try {
      const [p, s] = await Promise.all([
        fixedExample('midnight-beacon.music-release.json', 'package'),
        fixedExample('example-seal.json', 'seal'),
      ]);
      if (!current(id)) return;
      setPacket(p);
      setSeal(s);
      setTrust(EMPTY_TRUST);
      await inspectInputs(p, s, EMPTY_TRUST);
    } catch (e) {
      if (current(id)) {
        setError(explainError(e));
        setBusy(false);
      }
    }
  }
  async function selectFixture(kind: 'changed' | 'trust') {
    const id = invalidate();
    setBusy(true);
    try {
      const text = await fixedExample(
        kind === 'changed'
          ? 'changed-credit.music-release.json'
          : 'example-trust.json',
        kind === 'changed' ? 'package' : 'trust',
      );
      if (!current(id)) return;
      if (kind === 'changed') setPacket(text);
      else setTrust(text);
      setNotice(
        kind === 'changed'
          ? 'A credit changed and the package hash was rebuilt. Inspect against the original signature.'
          : 'Fixed demonstration trust rules selected. Inspect again to compare them.',
      );
    } catch (e) {
      if (current(id)) setError(explainError(e));
    } finally {
      if (current(id)) setBusy(false);
    }
  }
  async function exportChallenge() {
    const id = invalidate();
    setBusy(true);
    try {
      bounded(packet, 'package');
      const sealApi =
        await import('@/experiments/music-schnorr-seal/snapshot/dist/seal.mjs');
      if (!current(id)) return;
      const value = await sealApi.prepareChallenge(packet);
      if (!current(id)) return;
      setChallenge(value);
      download(value, 'music-release-endorsement-challenge.json');
      setNotice(
        'Challenge exported for an external signer. No signature or transaction was created.',
      );
    } catch (e) {
      if (current(id)) setError(explainError(e));
    } finally {
      if (current(id)) setBusy(false);
    }
  }
  const result = viewed?.result;
  return (
    <div data-music-seal>
      <div className="ns-lab-intro">
        <span className="ns-lab-kicker">
          <FileSignature size={18} /> RELEASE SEAL
        </span>
        <h2>Which exact release did this key endorse?</h2>
        <p>
          Check a Schnorr signature over the recording, artwork and credits
          together. Choose your trust rules separately. Everything is inspected
          in this browser.
        </p>
      </div>
      <div className="ns-seal-example">
        <div>
          <strong>An endorsement that travels with the music.</strong>
          <p>
            Try Midnight Beacon with a synthetic demonstration signature. It
            starts with no trusted keys.
          </p>
        </div>
        <Button
          disabled={busy}
          onClick={() => void example()}
          data-seal-example
        >
          <FlaskConical size={18} /> Try signed example
        </Button>
      </div>
      {result && (
        <Button
          variant="outline"
          className="ns-seal-shortcut"
          onClick={() => {
            heading.current?.scrollIntoView({ block: 'start' });
            heading.current?.focus({ preventScroll: true });
          }}
        >
          View inspection ↓
        </Button>
      )}
      <div className="ns-seal-editors">
        <section
          className="ns-seal-panel"
          aria-labelledby="seal-package-heading"
        >
          <span className="ns-seal-step">01 / EXACT RELEASE</span>
          <h3 id="seal-package-heading">Music package</h3>
          <p>
            Import the canonical package exported by Music release. Its complete
            file and credit hashes are checked before inspection.
          </p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => packageFile.current?.click()}
          >
            <Upload size={17} /> Import music package
          </Button>
          <label htmlFor="seal-package">Original package JSON</label>
          <textarea
            id="seal-package"
            value={packet}
            onChange={(e) => edit('package', e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            aria-describedby="seal-package-limit"
          />
          <p id="seal-package-limit" className="ns-seal-caption">
            {encoder.encode(packet).length.toLocaleString()} / 80,000 UTF-8
            bytes
          </p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void selectFixture('changed')}
            data-seal-changed
          >
            Try a changed credit
          </Button>
          <input
            ref={packageFile}
            type="file"
            accept=".json,application/json,text/plain"
            hidden
            data-seal-package-file
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void importFile('package', file);
            }}
          />
        </section>
        <section
          className="ns-seal-panel"
          aria-labelledby="seal-signature-heading"
        >
          <span className="ns-seal-step">02 / SUPPLIED SIGNATURE</span>
          <h3 id="seal-signature-heading">Endorsement seal</h3>
          <p>
            The seal names the signed package and public key. It grants no
            wallet access, ownership or rights.
          </p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => sealFile.current?.click()}
          >
            <Upload size={17} /> Import seal
          </Button>
          <label htmlFor="seal-json">Original seal JSON · optional</label>
          <textarea
            id="seal-json"
            value={seal}
            onChange={(e) => edit('seal', e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            aria-describedby="seal-json-limit"
          />
          <p id="seal-json-limit" className="ns-seal-caption">
            {encoder.encode(seal).length.toLocaleString()} / 1,024 UTF-8 bytes
          </p>
          <input
            ref={sealFile}
            type="file"
            accept=".json,application/json,text/plain"
            hidden
            data-seal-signature-file
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void importFile('seal', file);
            }}
          />
        </section>
      </div>
      <section
        className="ns-seal-panel ns-seal-trust"
        aria-labelledby="seal-trust-heading"
      >
        <span className="ns-seal-step">03 / YOUR SELECTED RULES</span>
        <h3 id="seal-trust-heading">Trust is an explicit choice</h3>
        <p>
          A rule pairs a public key with an exact package hash. Imported seals
          never add their own key to these rules.
        </p>
        <div className="ns-button-row">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void selectFixture('trust')}
            data-seal-example-trust
          >
            Use example trust rules
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => trustFile.current?.click()}
          >
            <Upload size={17} /> Import your rules
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              invalidate('Trust rules cleared. Inspect again.');
              setTrust(EMPTY_TRUST);
            }}
            data-seal-clear-trust
          >
            Clear rules
          </Button>
        </div>
        <p className="ns-seal-caption">
          Example rules use a fixed synthetic fixture key. They establish no
          real person or organization.
        </p>
        <details>
          <summary>Inspect or edit the selected rules</summary>
          <label htmlFor="seal-trust">Local trust JSON</label>
          <textarea
            id="seal-trust"
            value={trust}
            onChange={(e) => edit('trust', e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
          />
          <p className="ns-seal-caption">
            {encoder.encode(trust).length.toLocaleString()} / 4,096 UTF-8 bytes
            · up to 16 bindings
          </p>
        </details>
        <input
          ref={trustFile}
          type="file"
          accept=".json,application/json,text/plain"
          hidden
          data-seal-trust-file
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            void importFile('trust', file);
          }}
        />
      </section>
      <div className="ns-button-row ns-seal-actions">
        <Button
          disabled={busy || !packet.trim()}
          onClick={() => void inspectInputs()}
          data-seal-inspect
        >
          <FileSignature size={17} />{' '}
          {busy ? 'Checking locally…' : 'Inspect endorsement'}
        </Button>
        <Button
          variant="outline"
          disabled={busy || !packet.trim()}
          onClick={() => void exportChallenge()}
          data-seal-challenge
        >
          <Download size={17} /> Export signing challenge
        </Button>
      </div>
      <div aria-live="polite" aria-atomic="true" className="ns-seal-feedback">
        {notice && <p>{notice}</p>}
      </div>
      {error && (
        <p role="alert" className="ns-seal-error">
          {error}
        </p>
      )}
      {challenge && (
        <section className="ns-seal-panel">
          <h3>Challenge for this exact release</h3>
          <p>{challenge.explanation}</p>
          <div className="ns-seal-hash">
            <span>SHA-256 message · exactly 32 bytes</span>
            <code data-seal-challenge-hash>{challenge.messageHex}</code>
          </div>
          <p className="ns-seal-caption">
            The exported domain and preimage define the message. External
            signing compatibility must be checked separately.
          </p>
        </section>
      )}
      {result && (
        <section className="ns-seal-results" data-seal-results>
          <h3 ref={heading} tabIndex={-1}>
            Inspection
          </h3>
          <p className="ns-seal-verdict" data-seal-verdict>
            {messages[result.verdict]}
          </p>
          <dl className="ns-seal-checks">
            <div>
              <dt>Cryptographic signature</dt>
              <dd data-seal-cryptography>{result.cryptography}</dd>
            </div>
            <div>
              <dt>Matches this exact release</dt>
              <dd data-seal-binding>{result.packageBinding}</dd>
            </div>
            <div>
              <dt>Rules for the signed package</dt>
              <dd data-seal-trust-status>{result.trust}</dd>
            </div>
          </dl>
          <div className="ns-seal-hash">
            <span>Current release package hash</span>
            <code data-seal-package-hash>{result.packageHash}</code>
          </div>
          {result.seal && result.seal.packageHash !== result.packageHash && (
            <div className="ns-seal-hash">
              <span>Different package named by the signature</span>
              <code data-seal-signed-package-hash>
                {result.seal.packageHash}
              </code>
            </div>
          )}
          {'seal' in result && result.seal && (
            <div className="ns-seal-hash">
              <span>Public key in the supplied seal · x-only secp256k1</span>
              <code>{result.seal.publicKeyHex}</code>
            </div>
          )}
          <p>
            These checks describe a key&apos;s endorsement and your selected
            rules. They do not establish identity, copyright, Bitcoin holdings,
            minting authority or chain inclusion.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              if (viewed && current(viewed.revision))
                download(
                  {
                    schema: 'nft-studio.music-seal-report.v1',
                    generatedLocallyAt: new Date().toISOString(),
                    originalPackageJson: viewed.packet,
                    originalSealJson: viewed.seal || null,
                    originalTrustJson: viewed.trust,
                    inspection: viewed.result,
                  },
                  'music-release-seal-report.json',
                );
            }}
            data-seal-export
          >
            <Download size={17} /> Export inspection report
          </Button>
        </section>
      )}
      <details className="ns-seal-profile">
        <summary>Signature profile and evidence</summary>
        <p>
          This experimental profile uses a domain-separated SHA-256 challenge
          and a Schnorr/secp256k1 signature. It is a static endorsement, so
          replay for the same release is intentional. It is unsuitable for login
          or one-time redemption.
        </p>
        <p>
          Published vectors and the fixed 32-byte message profile are compared
          with Aiken&apos;s evaluator. Zero-r or zero-s signatures are outside
          this supported profile. No wallet signing compatibility or on-chain
          transaction evaluation is claimed.
        </p>
        <a
          href="https://github.com/BEACNpool/NFT-Studio/tree/main/experiments/music-schnorr-seal"
          target="_blank"
          rel="noreferrer"
        >
          Read the exact profile, sources and evidence ↗
        </a>
      </details>
    </div>
  );
}
