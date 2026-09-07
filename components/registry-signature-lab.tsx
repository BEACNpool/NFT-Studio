'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, FileSignature, FlaskConical, Upload } from 'lucide-react';
import type { Inspection, InspectedEntry, TrustConfiguration } from '@/experiments/cip26-inspector/src/index.mjs';
import {
  EMPTY_REGISTRY_TRUST_JSON,
  REGISTRY_EXAMPLE_RECORD_JSON,
  REGISTRY_EXAMPLE_TRUST_JSON,
  REGISTRY_EXAMPLE_SOURCE,
} from '@/lib/registry-signature-example';
import './registry-signature-lab.css';

const RECORD_LIMIT = 96 * 1024;
const TRUST_LIMIT = 48 * 1024;
const encoder = new TextEncoder();
type InputKind = 'record' | 'trust';
type Diagnostic = {
  schema: 'nft-studio.registry-inspection-report.v1';
  generatedLocallyAt: string;
  originalRecordJson: string;
  originalTrustConfigurationJson: string;
  recordTextSha256: string;
  trustTextSha256: string;
  selectedSubjectKeys: string[];
  inspection: Inspection;
};
type Viewed = { revision: number; diagnostic: Diagnostic };
const sequenceLabels: Record<InspectedEntry['sequenceStatus'], string> = {
  unobserved: 'No saved baseline',
  newer: 'Higher sequence',
  older: 'Older than saved record',
  'same-observation': 'Matches saved record',
  conflict: 'Conflict at same sequence',
};
const errorMessage = (value: unknown) => value instanceof Error ? value.message : 'Local inspection failed. Check the JSON and try again.';
function boundedText(text: string, limit: number) {
  if (text.length > limit || !text.isWellFormed() || encoder.encode(text).length > limit) {
    throw new Error(`Use well-formed UTF-8 JSON within ${limit / 1024} KiB. The input was not truncated or replaced.`);
  }
  return text;
}
async function sha256(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
}
function signatureLabel(entry: InspectedEntry) {
  const valid = entry.signatures.filter(s => s.status === 'valid-trusted' || s.status === 'valid-untrusted').length;
  if (!entry.signatures.length) return 'No signatures';
  if (!valid) return 'Invalid signatures';
  return `${valid} valid / ${entry.signatures.length} supplied`;
}

export function RegistrySignatureLab() {
  const [recordText, setRecordText] = useState('');
  const [trustText, setTrustText] = useState(EMPTY_REGISTRY_TRUST_JSON);
  const [recordLabel, setRecordLabel] = useState('Pasted or imported JSON');
  const [trustLabel, setTrustLabel] = useState('Empty rules · no keys selected');
  const [viewed, setViewed] = useState<Viewed | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState<InputKind | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const revision = useRef(0);
  const mounted = useRef(true);
  const recordFile = useRef<HTMLInputElement>(null);
  const trustFile = useRef<HTMLInputElement>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; revision.current++; };
  }, []);
  const current = (id: number) => mounted.current && revision.current === id;
  function invalidate(message = '') {
    const id = ++revision.current;
    setViewed(null); setError(''); setBusy(false); setImporting(null); setNotice(message);
    return id;
  }
  function edit(kind: InputKind, value: string) {
    invalidate('Inputs changed. Inspect again to see current results.');
    try {
      boundedText(value, kind === 'record' ? RECORD_LIMIT : TRUST_LIMIT);
      if (kind === 'record') { setRecordText(value); setRecordLabel('Edited JSON'); }
      else { setTrustText(value); setTrustLabel('Your edited rules'); }
    } catch (e) { setError(errorMessage(e)); }
  }
  async function importFile(kind: InputKind, file?: File) {
    if (!file) return;
    const id = invalidate('Reading local file…');
    setImporting(kind);
    const limit = kind === 'record' ? RECORD_LIMIT : TRUST_LIMIT;
    try {
      if (file.size > limit) throw new Error(`This file exceeds the ${limit / 1024} KiB limit. Your previous input was kept.`);
      const buffer = await file.arrayBuffer();
      if (!current(id)) return;
      if (buffer.byteLength > limit) throw new Error('The selected file exceeds its byte limit.');
      const text = boundedText(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer), limit);
      if (kind === 'record') { setRecordText(text); setRecordLabel(file.name.slice(0, 160)); }
      else { setTrustText(text); setTrustLabel(`Imported rules: ${file.name.slice(0, 160)}`); }
      setNotice('File loaded without reformatting. Inspect to check these inputs.');
    } catch (e) { if (current(id)) { setError(errorMessage(e)); setNotice(''); } }
    finally { if (current(id)) setImporting(null); }
  }
  async function inspectInputs(record = recordText, trust = trustText) {
    const id = invalidate();
    setBusy(true);
    try {
      boundedText(record, RECORD_LIMIT); boundedText(trust, TRUST_LIMIT);
      if (!record.trim()) throw new Error('Paste a metadata record or try the signed example first.');
      const { createCip26Inspector } = await import('@/experiments/cip26-inspector/src/index.mjs');
      if (!current(id)) return;
      const inspector = createCip26Inspector(trust);
      const inspection = inspector.inspect(record);
      // The inspector has already validated this exact configuration text, including duplicates.
      // This projection only explains the user's selected key matches; it grants no authority.
      const selected = (JSON.parse(trust) as TrustConfiguration).bindings.find(b => b.subject === inspection.subject);
      const selectedSubjectKeys = selected?.publicKeys.map(key => key.toLowerCase()) ?? [];
      const [recordTextSha256, trustTextSha256] = await Promise.all([sha256(record), sha256(trust)]);
      if (!current(id)) return;
      setViewed({ revision: id, diagnostic: {
        schema: 'nft-studio.registry-inspection-report.v1',
        generatedLocallyAt: new Date().toISOString(),
        originalRecordJson: record, originalTrustConfigurationJson: trust,
        recordTextSha256, trustTextSha256, selectedSubjectKeys, inspection,
      } });
      setNotice('Inspection complete. Signature checks, selected trust and sequence are shown separately.');
    } catch (e) { if (current(id)) setError(errorMessage(e)); }
    finally { if (current(id)) setBusy(false); }
  }
  function tryExample() {
    invalidate(); setRecordText(REGISTRY_EXAMPLE_RECORD_JSON); setTrustText(EMPTY_REGISTRY_TRUST_JSON);
    setRecordLabel('Published fixture · two original properties'); setTrustLabel('Empty rules · no keys selected');
    void inspectInputs(REGISTRY_EXAMPLE_RECORD_JSON, EMPTY_REGISTRY_TRUST_JSON);
  }
  function useExampleTrust() {
    invalidate('Example trust rules loaded. Inspect again to compare them with this record.');
    setTrustText(REGISTRY_EXAMPLE_TRUST_JSON); setTrustLabel('Example rules · fixed published fixture key');
  }
  function exportReport() {
    if (!viewed || !current(viewed.revision)) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(viewed.diagnostic, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'registry-signature-report.json';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  const result = viewed?.diagnostic.inspection;
  const keys = new Set(viewed?.diagnostic.selectedSubjectKeys ?? []);
  return (
    <div data-registry-signatures>
      <div className="ns-lab-intro">
        <span className="ns-lab-kicker"><FileSignature size={18} /> REGISTRY SIGNATURES</span>
        <h2>Who signed this record?</h2>
        <p>Check metadata signatures, then compare the signers with trust rules you choose. This inspector reads your JSON locally.</p>
      </div>
      <div className="ns-reg-example">
        <div><strong>Start with a real signed example.</strong><p>Two properties from a published test fixture. The example starts with no trusted keys.</p></div>
        <button type="button" disabled={busy || importing !== null} onClick={tryExample} className="ns-reg-button" data-registry-example><FlaskConical size={18} /> {busy ? 'Inspecting locally…' : 'Try signed example'}</button>
      </div>
      {result && <div className="ns-reg-shortcut"><span>{result.entries.length} properties inspected locally.</span><button type="button" className="ns-reg-button ns-reg-quiet" onClick={() => { resultsHeading.current?.scrollIntoView({ block: 'start' }); resultsHeading.current?.focus({ preventScroll: true }); }} data-registry-view-results>View results ↓</button></div>}
      <div className="ns-reg-editors">
        <section className="ns-reg-panel" aria-labelledby="registry-record-heading">
          <div className="ns-reg-heading"><div><span className="ns-reg-step">01 / RECORD</span><h3 id="registry-record-heading">Metadata to inspect</h3></div>
            <button type="button" className="ns-reg-button ns-reg-secondary" onClick={() => recordFile.current?.click()} data-registry-import-record><Upload size={17} /> Import JSON</button>
          </div>
          <p className="ns-reg-muted">Paste the original record. Values and URLs are treated as data; nothing is fetched.</p>
          <label htmlFor="registry-record" className="ns-reg-label">Record JSON</label>
          <textarea id="registry-record" value={recordText} onChange={e => edit('record', e.target.value)} spellCheck={false} autoCapitalize="off" placeholder={'{\n  "subject": "…",\n  "name": {"value": "…", "sequenceNumber": 0, "signatures": []}\n}'} aria-describedby="registry-record-help" />
          <p id="registry-record-help" className="ns-reg-caption"><span>{recordLabel}</span><span>{encoder.encode(recordText).length.toLocaleString()} / 98,304 bytes</span></p>
          <input ref={recordFile} type="file" accept=".json,application/json,text/plain" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void importFile('record', file); }} data-registry-record-file />
        </section>
        <section className="ns-reg-panel" aria-labelledby="registry-trust-heading">
          <div className="ns-reg-heading"><div><span className="ns-reg-step">02 / YOUR RULES</span><h3 id="registry-trust-heading">Choose the trust basis</h3></div>
            <button type="button" className="ns-reg-button ns-reg-secondary" onClick={() => trustFile.current?.click()} data-registry-import-trust><Upload size={17} /> Import rules</button>
          </div>
          <p className="ns-reg-muted">Keys must match an exact subject. A record&apos;s signature never adds its own key to these rules.</p>
          <label htmlFor="registry-trust" className="ns-reg-label">Local trust configuration JSON</label>
          <textarea id="registry-trust" value={trustText} onChange={e => edit('trust', e.target.value)} spellCheck={false} autoCapitalize="off" aria-describedby="registry-trust-help" />
          <p id="registry-trust-help" className="ns-reg-caption"><span>{trustLabel}</span><span>{encoder.encode(trustText).length.toLocaleString()} / 49,152 bytes</span></p>
          <div className="ns-reg-trust-actions">
            <button type="button" className="ns-reg-button ns-reg-secondary" onClick={useExampleTrust} data-registry-example-trust>Use example trust rules</button>
            <button type="button" className="ns-reg-button ns-reg-quiet" onClick={() => { invalidate('Trust rules cleared. Inspect again.'); setTrustText(EMPTY_REGISTRY_TRUST_JSON); setTrustLabel('Empty rules · no keys selected'); }} data-registry-clear-trust>Clear rules</button>
          </div>
          <p className="ns-reg-caption">Example rules select a fixed fixture key for demonstration. They do not independently establish who its publisher is.</p>
          <input ref={trustFile} type="file" accept=".json,application/json,text/plain" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void importFile('trust', file); }} data-registry-trust-file />
        </section>
      </div>
      <div className="ns-reg-run">
        <button type="button" className="ns-reg-button" disabled={busy || importing !== null || !recordText.trim()} onClick={() => void inspectInputs()} data-registry-inspect><FileSignature size={18} /> {busy ? 'Checking signatures…' : importing ? 'Reading local file…' : 'Inspect record'}</button>
        <p>Up to 8 properties and 4 signatures each. No wallet, provider or registry login.</p>
      </div>
      <div className="ns-reg-feedback" aria-live="polite" aria-atomic="true">{notice && <p>{notice}</p>}</div>
      {error && <p className="ns-reg-error" role="alert" data-registry-error>{error}</p>}
      {result && viewed && (
        <section className="ns-reg-results" aria-labelledby="registry-results-heading" data-registry-results>
          <div className="ns-reg-heading"><div><span className="ns-reg-step">03 / LOCAL RESULT</span><h3 id="registry-results-heading" ref={resultsHeading} tabIndex={-1}>Signature inspection</h3></div><button type="button" className="ns-reg-button ns-reg-secondary" onClick={exportReport} data-registry-download><Download size={17} /> Export report</button></div>
          <p className="ns-reg-muted">A valid signature binds these values to a key. Your rules define trust; this does not verify ownership or the claims themselves.</p>
          <div className="ns-reg-subject"><span>Exact subject</span><code data-registry-subject>{result.subject}</code></div>
          {result.policy.present && <p className="ns-reg-warning">This record includes a policy. Policy authentication was not performed; any key matches come only from your selected rules.</p>}
          <div className="ns-reg-properties">
            {result.entries.map(entry => {
              const supported = entry.status === 'inspected';
              const matches = supported ? new Set(entry.signatures.flatMap(s => 'publicKey' in s && keys.has(s.publicKey) ? [s.publicKey] : [])).size : 0;
              const conflict = supported && ['older', 'conflict'].includes(entry.sequenceStatus);
              return <article className="ns-reg-property" key={entry.property} data-registry-property={entry.property} data-registry-state={supported ? entry.signatureTrust : 'unsupported'}>
                <div className="ns-reg-heading"><h4>{entry.property}</h4><span className={`ns-reg-tag ${!supported || conflict || (supported && entry.signatureTrust === 'invalid') ? 'ns-reg-tag-warning' : ''}`}>{!supported ? 'Unsupported' : conflict ? 'Sequence warning' : 'Local inspection'}</span></div>
                {supported ? <>
                  <div className="ns-reg-value"><span>Supplied value · displayed as data</span><pre>{JSON.stringify(entry.value)}</pre></div>
                  <dl className="ns-reg-checks">
                    <div data-registry-signature-status><dt>Signature validity</dt><dd>{signatureLabel(entry)}</dd></div>
                    <div data-registry-trust-status><dt>Your selected trust</dt><dd>{matches ? `${matches} key match${matches === 1 ? '' : 'es'}` : 'No matching key'}</dd></div>
                    <div data-registry-sequence-status><dt>Sequence {entry.sequenceNumber}</dt><dd>{sequenceLabels[entry.sequenceStatus]}</dd></div>
                  </dl>
                  <p className={entry.signatureTrust === 'trusted' && !conflict ? 'ns-reg-outcome ns-reg-outcome-match' : 'ns-reg-outcome'} data-registry-outcome>
                    {conflict ? 'Do not use this record as an update: its sequence is older or conflicts with your saved observation.' : entry.signatureTrust === 'trusted' ? 'A valid signer matches your rules for this subject.' : entry.signatureTrust === 'untrusted' ? 'Valid signature, but the signer is not trusted by your selected rules.' : entry.signatureTrust === 'unsigned' ? 'No signature was provided for this property.' : 'No supplied signature verified for this property.'}
                  </p>
                  <details className="ns-reg-details"><summary>Signer keys and exact attestation hashes</summary>
                    <ul className="ns-reg-signers">{entry.signatures.map((signature, index) => <li key={index}>
                      {'publicKey' in signature ? <><code>{signature.publicKey}</code><span>Signature: {signature.status === 'invalid' ? 'invalid' : 'valid'} · Selected key: {keys.has(signature.publicKey) ? 'yes' : 'no'}{signature.duplicateKey ? ' · repeated key' : ''}</span></> : <span>Signature {index + 1}: malformed key or signature encoding.</span>}
                    </li>)}</ul>
                    <div className="ns-reg-hash"><span>Attestation digest · Blake2b-256</span><code>{entry.attestationDigestHex}</code></div>
                    <p>Each component has its own CBOR encoding and Blake2b-256 hash. The report includes every preimage and component hash.</p>
                  </details>
                </> : <p className="ns-reg-warning">{entry.reason} No signature or trust conclusion is made for this property.</p>}
              </article>;
            })}
          </div>
          <p className="ns-reg-caption">The report includes the original entered record and trust rules, their SHA-256 hashes and these diagnostics. Sequence history is not updated. Export only saves a local file.</p>
        </section>
      )}
      <details className="ns-reg-details ns-reg-profile"><summary>Supported profile and example source</summary>
        <p>This is a bounded CIP-26 scalar inspector. Logos, object/array values, non-integer number representations and policy authentication are unsupported. A newer sequence only compares with the local observation you supplied; it is not proof of freshness or chain inclusion.</p>
        <p>Use this result to inspect claims. Do not treat untrusted values as accepted asset names or links. This Lab does not persist your JSON or change your trust store.</p>
        <a href={REGISTRY_EXAMPLE_SOURCE} target="_blank" rel="noreferrer">Read the pinned public example fixture</a>
      </details>
    </div>
  );
}
