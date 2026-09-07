'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Download,
  FileCheck2,
  Upload,
  X,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { FileMintDialog } from './file-mint-dialog';
import { PayloadPreview } from './file-workbench';
import {
  parseMintIntent,
  MAX_MINT_INTENT_BYTES,
  type MintIntent,
} from '@/lib/studio-intent';
import { errorText } from '@/lib/cardano';
import { download, filename, jsonBlob } from '@/lib/export';

const PUBLIC_MCP_URL =
  'https://beacn-nft-studio.davidmjensen17.chatgpt.site/api/mcp';
const MCP_CONFIG = {
  mcpServers: { 'beacn-nft-studio': { url: PUBLIC_MCP_URL } },
};

export function AgentMintPanel() {
  const [text, setText] = useState('');
  const [intent, setIntent] = useState<MintIntent | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      ++generation.current;
    },
    [],
  );
  async function inspect(source: string, current = ++generation.current) {
    if (current !== generation.current) return;
    setBusy(true);
    setError('');
    setIntent(null);
    try {
      const result = await parseMintIntent(source);
      if (current !== generation.current) return;
      setIntent(result);
      setSelected(0);
      setText('');
    } catch (e) {
      if (current === generation.current) setError(errorText(e));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  async function openFile(file?: File) {
    if (!file) return;
    const current = ++generation.current;
    setBusy(true);
    setIntent(null);
    setError('');
    if (file.size > MAX_MINT_INTENT_BYTES) {
      setBusy(false);
      setError('Choose an agent request smaller than 80 KB.');
      return;
    }
    try {
      await inspect(await file.text(), current);
    } catch (e) {
      if (current === generation.current) {
        setError(errorText(e));
        setBusy(false);
      }
    }
  }
  return (
    <div className="ns-lab-agent">
      <div className="ns-lab-intro">
        <span className="ns-lab-kicker">
          <Bot size={18} /> AGENT MINTING
        </span>
        <h2>Mint with your agent.</h2>
        <p>
          Import its request, inspect the exact files, then approve with your
          wallet.
        </p>
      </div>
      <section className="ns-panel ns-mcp-connect">
        <span className="ns-lab-kicker">PUBLIC MCP · LIVE</span>
        <h3>Point your bot here.</h3>
        <p>
          Tools for Cardano research, exact file packages, music releases, proof
          records, capsule contract identities and unsigned NFT/data
          transactions. Connect with Streamable HTTP; no API key is needed.
        </p>
        <code className="ns-mcp-url">{PUBLIC_MCP_URL}</code>
        <div className="ns-button-row">
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(PUBLIC_MCP_URL).then(
                () => setConnectionStatus('Endpoint copied.'),
                () =>
                  setConnectionStatus('Select and copy the endpoint above.'),
              );
            }}
          >
            <Copy size={16} /> Copy endpoint
          </Button>
          <Button
            variant="outline"
            onClick={() => download(jsonBlob(MCP_CONFIG), 'beacn-mcp.json')}
          >
            <Download size={16} /> Download config
          </Button>
        </div>
        {connectionStatus && <output>{connectionStatus}</output>}
        <p className="ns-lab-muted">
          Your bot sends the content you give it to this public service. Ask it
          to save the returned mint request as JSON, then open that file below.
          Wallet review and signing happen here in your browser. Music packages
          open in the Music release lab.
        </p>
        <p className="ns-lab-muted">
          Advanced clients can also supply an authorized wallet snapshot for
          unsigned preparation. The service receives that snapshot; signing and
          submission remain with the wallet.
        </p>
      </section>
      <div className="ns-lab-columns">
        <section className="ns-panel">
          <h3>Open a mint request</h3>
          <p className="ns-lab-muted">
            The request stays in this browser. Opening it does not connect a
            wallet or publish anything.
          </p>
          <Button
            variant="outline"
            onClick={() => input.current?.click()}
            disabled={busy}
          >
            <Upload size={18} /> Choose request JSON
          </Button>
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              void openFile(e.target.files?.[0]).catch((e) =>
                setError(errorText(e)),
              );
              e.target.value = '';
            }}
          />
          <label className="ns-field" htmlFor="agent-request">
            Or paste the request
            <Textarea
              id="agent-request"
              value={text}
              maxLength={MAX_MINT_INTENT_BYTES}
              onChange={(e) => setText(e.target.value)}
              placeholder='{"schema":"nft-studio.intent.v1",…}'
              spellCheck={false}
              className="ns-code-input"
            />
          </label>
          <Button
            onClick={() => void inspect(text)}
            disabled={busy || !text.trim()}
          >
            <FileCheck2 size={18} />{' '}
            {busy ? 'Checking files…' : 'Inspect request'}
          </Button>
          {error && (
            <p className="ns-error" role="alert">
              {error}
            </p>
          )}
          <details className="ns-lab-details">
            <summary>Full service and setup details</summary>
            <p>
              The public endpoint prepares content and answers Cardano
              questions. The separate open-source Node service also builds
              unsigned transactions and checks external wallet signatures. It
              supports local stdio and authenticated Streamable HTTP. Neither
              service holds a signing key.
            </p>
            <a
              className="ns-text-link"
              href="https://github.com/BEACNpool/NFT-Studio/blob/main/docs/MCP.md"
              target="_blank"
              rel="noreferrer"
            >
              Setup and tools <ExternalLink size={16} />
            </a>
          </details>
        </section>
        <section className="ns-panel ns-payload-review" aria-live="polite">
          {intent ? (
            <>
              <div className="ns-lab-row">
                <span className="ns-lab-status">Content hashes verified</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Clear agent request"
                  onClick={() => {
                    ++generation.current;
                    setIntent(null);
                    setBusy(false);
                    setError('');
                  }}
                >
                  <X size={18} />
                </Button>
              </div>
              <h3>{intent.bundle.name}</h3>
              <p className="ns-lab-muted">
                {intent.mode === 'nft'
                  ? 'NFT with files'
                  : 'Data record · no token'}{' '}
                · {intent.bundle.bytes.toLocaleString()} raw bytes ·{' '}
                {intent.bundle.files.length} files
              </p>
              {intent.bundle.description && (
                <p className="ns-lab-description">
                  {intent.bundle.description}
                </p>
              )}
              <div className="ns-file-tabs" aria-label="Request files">
                {intent.bundle.files.map((f, i) => (
                  <button
                    key={f.name}
                    aria-pressed={selected === i}
                    onClick={() => setSelected(i)}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
              <PayloadPreview file={intent.bundle.files[selected]} />
              <p className="ns-lab-muted">
                Imported code stays inert in this preview. A matching hash
                detects changes; it does not establish who made the request or
                whether you trust its content.
              </p>
              <div className="ns-hash">
                <span>Request SHA-256</span>
                <code>{intent.intentHash}</code>
              </div>
              <div className="ns-button-row">
                <Button
                  variant="outline"
                  onClick={() =>
                    download(
                      jsonBlob(intent),
                      filename(intent.bundle.name) + '.intent.json',
                    )
                  }
                >
                  <Download size={16} /> Save request
                </Button>
                <FileMintDialog
                  key={intent.intentHash}
                  bundle={intent.bundle}
                  mode={intent.mode}
                />
              </div>
            </>
          ) : (
            <div className="ns-preview-empty">
              <Bot size={44} strokeWidth={1} />
              <h3>Inspect before you sign.</h3>
              <p>
                Your agent’s exact files, description and content hash will
                appear here. Fees and destination are reviewed with your wallet.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
