'use client';
import { useEffect, useRef, useState } from 'react';
import { Code2, Download, Fingerprint, FlaskConical } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { download, jsonBlob } from '@/lib/export';
import { errorText } from '@/lib/cardano';
import type { AppliedCapsule } from '@/experiments/capsule-parameterizer/src/index.mjs';

export function CapsuleContractLab() {
  const [transactionId, setTransactionId] = useState('');
  const [outputIndex, setOutputIndex] = useState('0');
  const [baseName, setBaseName] = useState('CAPSULE');
  const [result, setResult] = useState<AppliedCapsule | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [example, setExample] = useState(false);
  const revision = useRef(0);
  useEffect(
    () => () => {
      revision.current++;
    },
    [],
  );
  function changed() {
    revision.current++;
    setResult(null);
    setError('');
    setBusy(false);
    setExample(false);
  }
  async function apply(useExample = false) {
    const current = ++revision.current;
    setResult(null);
    setError('');
    setBusy(true);
    setExample(useExample);
    const seedHash = useExample ? '11'.repeat(32) : transactionId;
    const index = useExample ? '0' : outputIndex;
    const name = useExample ? 'CAPSULE' : baseName;
    if (useExample) {
      setTransactionId(seedHash);
      setOutputIndex(index);
      setBaseName(name);
    }
    try {
      if (!/^(0|[1-9][0-9]{0,4})$/.test(index))
        throw new Error('Use a whole output index between 0 and 65535.');
      const { applyCapsuleParameters } =
        await import('@/experiments/capsule-parameterizer/src/index.mjs');
      const applied = applyCapsuleParameters({
        seed: { transactionId: seedHash, outputIndex: Number(index) },
        baseName: name,
      });
      if (revision.current === current) setResult(applied);
    } catch (e) {
      if (revision.current === current) setError(errorText(e));
    } finally {
      if (revision.current === current) setBusy(false);
    }
  }
  return (
    <div data-capsule-contract>
      <div className="ns-lab-intro">
        <span className="ns-lab-kicker">
          <Code2 size={18} /> CONTRACT COMPILER
        </span>
        <h2>Your capsule. Its own policy.</h2>
        <p>
          Turn a seed reference and an exact name into a State Capsule contract
          blueprint. Your browser applies the same parameters as Aiken and
          calculates the resulting policy ID.
        </p>
      </div>
      <p className="ns-capsule-boundary">
        <strong>Experimental contract preparation.</strong> This applies the
        fixed BEACN validator. It does not check the seed on chain or prepare a
        mint transaction.
      </p>
      <div className="ns-button-row ns-music-tools">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void apply(true)}
          data-contract-example
        >
          <FlaskConical size={17} /> Try an example
        </Button>
      </div>
      <div className="ns-lab-columns">
        <section className="ns-panel">
          <h3>Choose the identity.</h3>
          <p className="ns-lab-muted">
            The seed identifies one transaction output. Changing the seed or
            even one name byte creates a different policy.
          </p>
          <label className="ns-field" htmlFor="contract-seed">
            Seed transaction ID
            <Input
              id="contract-seed"
              value={transactionId}
              maxLength={64}
              spellCheck={false}
              autoCapitalize="off"
              placeholder="64 lowercase hexadecimal characters"
              onChange={(e) => {
                changed();
                setTransactionId(e.target.value);
              }}
            />
          </label>
          <label className="ns-field" htmlFor="contract-index">
            Output index
            <Input
              id="contract-index"
              value={outputIndex}
              maxLength={5}
              inputMode="numeric"
              onChange={(e) => {
                changed();
                setOutputIndex(e.target.value);
              }}
            />
          </label>
          <label className="ns-field" htmlFor="contract-name">
            Exact asset base name
            <Input
              id="contract-name"
              value={baseName}
              maxLength={28}
              onChange={(e) => {
                changed();
                setBaseName(e.target.value);
              }}
            />
            <small>
              {new TextEncoder().encode(baseName).length} / 28 UTF-8 bytes ·
              case and spacing matter
            </small>
          </label>
          <div className="ns-button-row">
            <Button
              disabled={busy}
              onClick={() => void apply()}
              data-contract-apply
            >
              <Code2 size={17} />{' '}
              {busy ? 'Applying parameters…' : 'Create contract blueprint'}
            </Button>
          </div>
          {error && (
            <p className="ns-error" role="alert">
              {error}
            </p>
          )}
        </section>
        <section className="ns-panel" aria-live="polite">
          {result ? (
            <>
              <div className="ns-lab-row">
                <h3>Blueprint ready.</h3>
                <span className="ns-kb-status">Plutus V3</span>
              </div>
              <p className="ns-lab-muted">
                {example ? 'This example uses a fabricated seed. ' : ''}The
                policy identifies this exact applied program. Successful
                parameter application is not evidence of a valid or live mint.
              </p>
              <div className="ns-hash">
                <span>Policy ID · same hash for mint and spend</span>
                <code data-contract-policy>{result.policyId}</code>
              </div>
              <div className="ns-hash">
                <span>Reference asset name · CIP-67 label 100</span>
                <code>{result.assetNames.referenceAssetNameHex}</code>
              </div>
              <div className="ns-hash">
                <span>Holder asset name · CIP-67 label 222</span>
                <code>{result.assetNames.userAssetNameHex}</code>
              </div>
              <div className="ns-contract-stats">
                <div>
                  <strong>{result.scriptBytes.toLocaleString()}</strong>
                  <span>script bytes</span>
                </div>
                <div>
                  <strong>3 identical</strong>
                  <span>validator handlers</span>
                </div>
              </div>
              <div className="ns-button-row">
                <Button
                  onClick={() =>
                    download(
                      new Blob([result.appliedBlueprintJson], {
                        type: 'application/json',
                      }),
                      'state-capsule.plutus.json',
                    )
                  }
                  data-contract-download
                >
                  <Download size={17} /> Export blueprint
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    download(jsonBlob(result), 'state-capsule.applied.json')
                  }
                >
                  Export identity record
                </Button>
              </div>
              <details className="ns-lab-details">
                <summary>Source and exact export hash</summary>
                <div className="ns-hash">
                  <span>Blueprint export SHA-256</span>
                  <code>{result.appliedBlueprintSha256}</code>
                </div>
                <p>
                  Aiken {result.source.compiler} · UPLC {result.uplcVersion}
                </p>
                <a
                  className="ns-text-link"
                  href={result.source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read the pinned original validator
                </a>
              </details>
            </>
          ) : (
            <>
              <Fingerprint size={36} className="ns-contract-mark" />
              <h3>A reproducible contract identity.</h3>
              <p className="ns-lab-muted">
                The blueprint contains one combined program for minting and
                spending. Applying the seed once avoids a circular dependency
                between the policy and its reference address.
              </p>
              <div className="ns-contract-flow">
                <span>Exact seed + name</span>
                <span aria-hidden="true">↓</span>
                <span>Fixed BEACN program</span>
                <span aria-hidden="true">↓</span>
                <span>Blueprint + policy + paired names</span>
              </div>
              <p className="ns-lab-muted">
                256 parameter combinations matched the pinned Aiken CLI output
                and independent Cardano Serialization Library hashes.
              </p>
            </>
          )}
        </section>
      </div>
      <details className="ns-lab-details">
        <summary>What a live capsule still requires</summary>
        <p>
          A live mint needs an available seed you control, fresh protocol
          parameters, full transaction evaluation and an explicit wallet review.
          This experimental contract has irreversible freezing and no recovery
          administrator. Inspect its validator and tests before using it with
          funds.
        </p>
        <a
          className="ns-text-link"
          href="https://github.com/BEACNpool/NFT-Studio/tree/main/experiments/capsule-parameterizer"
          target="_blank"
          rel="noreferrer"
        >
          Source, parity tests and reproduction guide
        </a>
      </details>
    </div>
  );
}
