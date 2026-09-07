'use client';
import { useRef, useState } from 'react';
import {
  ArrowRight,
  Download,
  LockKeyhole,
  Radio,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  buildDatum,
  transition,
  verifyHistory,
  assetNames,
} from '@/contracts/state-capsule/scripts/capsule-codec.mjs';
import { download, jsonBlob } from '@/lib/export';
import { errorText } from '@/lib/cardano';
type State = ReturnType<typeof buildDatum>;
const accents = ['#b89bfa', '#70d7c1', '#f1be72'];
function metadata(name: string, energy: number, accent: string, note: string) {
  const safe = name.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
  const radius = 42 + energy * 0.65;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#12101a"/><g fill="none" stroke="${accent}"><circle cx="256" cy="220" r="${radius}" stroke-width="3"/><circle cx="256" cy="220" r="${radius + 32}" opacity=".45"/><circle cx="256" cy="220" r="${radius + 64}" opacity=".2"/><path d="M48 220h416M256 48v344" opacity=".25"/></g><circle cx="256" cy="220" r="8" fill="${accent}"/><g font-family="sans-serif" fill="#eee6fa"><text x="32" y="435" font-size="21">${safe}</text><text x="32" y="474" font-size="14" fill="${accent}">BEACN / SIGNAL ${energy}</text></g></svg>`;
  return {
    name,
    image: 'data:image/svg+xml,' + encodeURIComponent(svg),
    mediaType: 'image/svg+xml',
    description: note,
    signal: { energy, accent },
  };
}
function initialState() {
  return buildDatum({
    metadata: metadata(
      'Living Signal',
      42,
      accents[0],
      'A collectible whose history is part of its identity.',
    ),
  });
}
export function StateCapsuleLab() {
  const [history, setHistory] = useState<State[]>(() => [initialState()]);
  const [name, setName] = useState('Living Signal');
  const [energy, setEnergy] = useState(42);
  const [accent, setAccent] = useState(accents[0]);
  const [note, setNote] = useState(
    'A collectible whose history is part of its identity.',
  );
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState('');
  const [verification, setVerification] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const tip = history[history.length - 1],
    viewed = history[selected];
  const names = assetNames('CAPSULE');
  function record(freeze = false) {
    setError('');
    setVerification('');
    try {
      if (history.length >= 64)
        throw new Error(
          'This demo holds up to 64 revisions. Export it before starting another.',
        );
      const next = freeze
        ? transition(tip, { action: 'freeze' })
        : transition(tip, { metadata: metadata(name, energy, accent, note) });
      verifyHistory([...history, next]);
      setHistory([...history, next]);
      setSelected(history.length);
    } catch (e) {
      setError(errorText(e));
    }
  }
  function reset() {
    setHistory([initialState()]);
    setSelected(0);
    setName('Living Signal');
    setEnergy(42);
    setAccent(accents[0]);
    setNote('A collectible whose history is part of its identity.');
    setError('');
    setVerification('');
  }
  async function verifyFile(file?: File) {
    if (!file) return;
    setVerification('');
    setVerificationError('');
    try {
      if (file.size > 1000000)
        throw new Error('Choose a capsule history under 1 MB.');
      const data = JSON.parse(await file.text());
      if (data.schema !== 'beacn.capsule-history.v1')
        throw new Error('Unsupported history file.');
      const result = verifyHistory(data.states);
      setVerification(
        `${result.states} revisions verified. ${result.frozen ? 'The final revision is frozen.' : 'The final revision is open.'} This checks local data, not chain inclusion.`,
      );
    } catch (e) {
      setVerificationError(errorText(e));
    }
  }
  return (
    <div>
      <div className="ns-lab-intro">
        <span className="ns-lab-kicker">
          <Radio size={18} /> STATE CAPSULE
        </span>
        <h2>A collectible that can evolve. Then freeze.</h2>
        <p>
          Change the signal, record a revision and inspect its history. Each
          revision commits to the previous datum. Freezing closes this history
          permanently.
        </p>
      </div>
      <p className="ns-capsule-boundary">
        <strong>Local contract demonstration.</strong> These controls generate
        real CIP-68 datum bytes and hashes. They do not mint or update an
        on-chain asset. The experimental Aiken validator is available for
        review.
      </p>
      <div className="ns-capsule-layout">
        <section className="ns-panel ns-capsule-art">
          <div className="ns-lab-row">
            <span className="ns-kb-status">Revision {viewed.sequence}</span>
            <span
              className={viewed.frozen ? 'ns-capsule-frozen' : 'ns-lab-status'}
            >
              {viewed.frozen ? 'Frozen' : 'Open'}
            </span>
          </div>
          <img
            src={viewed.metadata.image}
            alt={`${viewed.metadata.name}, recorded signal artwork`}
            width={512}
            height={512}
          />
          <p className="ns-lab-muted">
            Exact embedded image · {viewed.datumBytes.toLocaleString()} datum
            bytes
          </p>
          <div className="ns-hash">
            <span>Datum hash (BLAKE2b-256)</span>
            <code>{viewed.datumHash}</code>
          </div>
          <div className="ns-hash">
            <span>Previous datum hash</span>
            <code>
              {viewed.previousDatumHash || 'Genesis · no previous revision'}
            </code>
          </div>
        </section>
        <section className="ns-panel">
          <h3>
            {tip.frozen ? 'This history is sealed.' : 'Make the next revision.'}
          </h3>
          {tip.frozen ? (
            <p className="ns-lab-muted">
              The validator rejects further evolution after a freeze. You can
              still inspect and export every revision. Start a new demo to
              explore another history.
            </p>
          ) : (
            <>
              <label className="ns-field" htmlFor="capsule-name">
                Name
                <Input
                  id="capsule-name"
                  value={name}
                  maxLength={64}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="ns-field" htmlFor="capsule-energy">
                Signal strength · {energy}
                <input
                  id="capsule-energy"
                  type="range"
                  min={0}
                  max={100}
                  value={energy}
                  onChange={(e) => setEnergy(Number(e.target.value))}
                />
              </label>
              <div className="ns-field">
                <span>Signal color</span>
                <div className="ns-capsule-colors">
                  {accents.map((color, i) => (
                    <button
                      key={color}
                      aria-label={
                        ['Violet signal', 'Mint signal', 'Amber signal'][i]
                      }
                      aria-pressed={accent === color}
                      onClick={() => setAccent(color)}
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </div>
              <label className="ns-field" htmlFor="capsule-note">
                Revision note
                <Input
                  id="capsule-note"
                  value={note}
                  maxLength={160}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <div className="ns-button-row">
                <Button onClick={() => record()}>
                  <Radio size={17} /> Record evolution
                </Button>
                <Button variant="outline" onClick={() => record(true)}>
                  <LockKeyhole size={17} /> Freeze current state
                </Button>
              </div>
              <p className="ns-lab-muted">
                Freezing preserves the last recorded image and metadata. Record
                your edits first if you want them in the final state.
              </p>
            </>
          )}
          <div
            className="ns-capsule-chain"
            aria-label="Capsule revision history"
          >
            {history.map((state, i) => (
              <button
                key={state.datumHash}
                aria-pressed={selected === i}
                onClick={() => setSelected(i)}
              >
                <span>
                  {i === 0
                    ? 'Genesis'
                    : state.frozen
                      ? 'Frozen'
                      : `Revision ${i}`}
                </span>
                <code>{state.datumHash.slice(0, 8)}</code>
                {i < history.length - 1 && <ArrowRight size={16} />}
              </button>
            ))}
          </div>
          <div className="ns-button-row">
            <Button
              variant="outline"
              onClick={() =>
                download(
                  jsonBlob({
                    schema: 'beacn.capsule-history.v1',
                    evidence: 'local-data-only',
                    assetNames: names,
                    states: history,
                  }),
                  'beacn-capsule-history.json',
                )
              }
            >
              <Download size={16} /> Export history
            </Button>
            <Button variant="ghost" onClick={reset}>
              <RotateCcw size={16} /> New demo
            </Button>
          </div>
          {error && (
            <p className="ns-error" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
      <div className="ns-capsule-explain">
        <article>
          <span>01 / ISSUE ONCE</span>
          <h3>Two tokens. One identity.</h3>
          <p>
            A consumed seed binds one reference token and one holder token to
            the same policy. Labels 100 and 222 connect their names.
          </p>
        </article>
        <article>
          <span>02 / HOLDER CONTROL</span>
          <h3>Ownership authorizes change.</h3>
          <p>
            The validator requires the holder token in a spent input and the
            holder’s payment signature. Referencing someone else’s token does
            not authorize an update.
          </p>
        </article>
        <article>
          <span>03 / CLOSE THE HISTORY</span>
          <h3>Freeze is a final state.</h3>
          <p>
            The reference token and its ADA remain locked. A freeze cannot
            change metadata at the same time. Transferring the holder token
            remains a separate wallet transaction.
          </p>
        </article>
      </div>
      <section className="ns-panel ns-capsule-verify">
        <div>
          <h3>Verify an exported history</h3>
          <p className="ns-lab-muted">
            Recompute every datum and predecessor link. A valid local history is
            not proof that the chain accepted it.
          </p>
        </div>
        <Button variant="outline" onClick={() => input.current?.click()}>
          <Upload size={17} /> Check history JSON
        </Button>
        <input
          ref={input}
          hidden
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            void verifyFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {verification && (
          <output className="ns-lab-status">{verification}</output>
        )}
        {verificationError && (
          <p className="ns-error" role="alert">
            {verificationError}
          </p>
        )}
      </section>
      <p className="ns-lab-sources">
        <a
          href="https://github.com/BEACNpool/NFT-Studio/blob/main/docs/STATE_CAPSULES.md"
          target="_blank"
          rel="noreferrer"
        >
          Contract, lifecycle and verification evidence
        </a>{' '}
        ·{' '}
        <a
          href="https://cips.cardano.org/cip/CIP-0068"
          target="_blank"
          rel="noreferrer"
        >
          CIP-68 specification
        </a>
        .
      </p>
    </div>
  );
}
