'use client';
import { useState } from 'react';
import { Fingerprint, Download, ExternalLink } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { inspectAssetIdentity } from '@/lib/asset-inspector';
import { errorText } from '@/lib/cardano';
import { download, jsonBlob } from '@/lib/export';
export function AssetInspector() {
  const [policy, setPolicy] = useState('');
  const [name, setName] = useState('');
  const [result, setResult] = useState<ReturnType<
    typeof inspectAssetIdentity
  > | null>(null);
  const [error, setError] = useState('');
  return (
    <div>
      <div className="ns-lab-intro">
        <span className="ns-lab-kicker">
          <Fingerprint size={18} /> ASSET IDENTITY
        </span>
        <h2>Read the bytes behind the collectible.</h2>
        <p>
          Derive the fingerprint, verify a CIP-67 label and locate the
          corresponding CIP-68 asset name. Everything runs locally.
        </p>
      </div>
      <div className="ns-lab-columns">
        <form
          className="ns-panel"
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            setResult(null);
            try {
              setResult(inspectAssetIdentity(policy, name));
            } catch (e) {
              setError(errorText(e));
            }
          }}
        >
          <label className="ns-field" htmlFor="asset-policy">
            Policy ID
            <Input
              id="asset-policy"
              value={policy}
              maxLength={56}
              spellCheck={false}
              onChange={(e) => {
                setPolicy(e.target.value);
                setResult(null);
              }}
              placeholder="56 hexadecimal characters"
            />
          </label>
          <label className="ns-field" htmlFor="asset-name">
            Asset-name bytes (hex)
            <Input
              id="asset-name"
              value={name}
              maxLength={64}
              spellCheck={false}
              onChange={(e) => {
                setName(e.target.value);
                setResult(null);
              }}
              placeholder="Exact hex, including any label prefix"
            />
          </label>
          <p className="ns-lab-muted">
            An empty name is valid. A display title is not the asset name.
          </p>
          <Button type="submit">
            <Fingerprint size={17} /> Inspect identity
          </Button>
          {error && (
            <p role="alert" className="ns-error">
              {error}
            </p>
          )}
          <details className="ns-lab-details">
            <summary>Try a synthetic CIP-68 identity</summary>
            <p>This example has no claim of existing on chain.</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPolicy('ab'.repeat(28));
                setName('000de140' + '43415053554c45');
                setResult(null);
              }}
            >
              Load example
            </Button>
          </details>
        </form>
        <section className="ns-panel" aria-live="polite">
          {result ? (
            <>
              <h3>{result.labelClass || 'Native asset identity'}</h3>
              <p>
                {result.bytes} name bytes
                {result.label !== null
                  ? ` · verified label ${result.label}`
                  : ' · no verified CIP-67 label'}
              </p>
              {result.invalidLabelChecksum && (
                <p className="ns-error">
                  The prefix has label brackets but its checksum is invalid.
                </p>
              )}
              <div className="ns-hash">
                <span>CIP-14 fingerprint</span>
                <code>{result.fingerprint}</code>
              </div>
              <div className="ns-hash">
                <span>
                  {result.label !== null
                    ? 'Name after label (UTF-8)'
                    : 'Name as UTF-8'}
                </span>
                <code>
                  {result.utf8 === null
                    ? 'Not valid UTF-8; keep the exact hex bytes.'
                    : result.utf8 || '(empty)'}
                </code>
              </div>
              {result.counterpart && (
                <>
                  <div className="ns-hash">
                    <span>Corresponding reference name (label 100)</span>
                    <code>{result.counterpart.referenceAssetNameHex}</code>
                  </div>
                  <div className="ns-hash">
                    <span>NFT form of the user name (label 222)</span>
                    <code>{result.counterpart.nftAssetNameHex}</code>
                  </div>
                </>
              )}
              <p className="ns-lab-muted">
                Labels describe an intended format. They do not prove scarcity,
                a secure update policy, ownership, or even that an asset exists.
                Matching reference names still need chain verification.
              </p>
              <div className="ns-button-row">
                <Button
                  variant="outline"
                  onClick={() =>
                    download(jsonBlob(result), 'asset-identity.json')
                  }
                >
                  <Download size={16} /> Export identity
                </Button>
                <a
                  className="ns-text-link"
                  href={result.poolPmUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Check on pool.pm <ExternalLink size={16} />
                </a>
              </div>
            </>
          ) : (
            <div className="ns-preview-empty">
              <Fingerprint size={44} strokeWidth={1} />
              <h3>Names can lie. Bytes identify.</h3>
              <p>
                Use the full policy ID and asset-name hex from a wallet or
                explorer.
              </p>
            </div>
          )}
        </section>
      </div>
      <p className="ns-lab-sources">
        Standards:{' '}
        <a
          href="https://cips.cardano.org/cip/CIP-0014"
          target="_blank"
          rel="noreferrer"
        >
          CIP-14
        </a>
        ,{' '}
        <a
          href="https://cips.cardano.org/cip/CIP-0067"
          target="_blank"
          rel="noreferrer"
        >
          CIP-67
        </a>
        ,{' '}
        <a
          href="https://cips.cardano.org/cip/CIP-0068"
          target="_blank"
          rel="noreferrer"
        >
          CIP-68
        </a>
        .
      </p>
    </div>
  );
}
