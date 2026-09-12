'use client';
import { CreationControls } from './creation-controls';
import {
  isPayloadQrFragment,
  parsePayloadQrFragment,
} from '@/lib/studio-payload-qr';
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
import { PayloadPreview } from './file-workbench';
import {
  isPhoneTransferFragment,
  receivePhoneTransfer,
  type PhoneTransfer,
} from '@/lib/studio-handoff';
import {
  parseMintIntent,
  MAX_MINT_INTENT_BYTES,
  type MintIntent,
} from '@/lib/studio-intent';
import { errorText } from '@/lib/cardano';
import { download, jsonBlob } from '@/lib/export';
import {
  isMintReviewFragment,
  parseMintReviewFragment,
} from '@/lib/studio-review-link';

const MCP_SETUP_URL = 'https://beacnpool.github.io/NFT-Studio/mcp/';
const PHONE_SESSION = 'nft-studio.phone-transfer.v1';
type OpenedRequest = { intent: MintIntent | null; transfer?: PhoneTransfer };
const MCP_CONFIG = {
  mcpServers: {
    'beacn-nft-studio': {
      command: 'node',
      args: ['/absolute/path/NFT-Studio/mcp/dist/cli.mjs'],
    },
  },
};

export function AgentMintPanel() {
  const [text, setText] = useState('');
  const [intent, setIntent] = useState<MintIntent | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(0);
  const [phoneTransfer, setPhoneTransfer] = useState<PhoneTransfer | null>(
    null,
  );
  const [connectionStatus, setConnectionStatus] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const pendingLink = useRef<Promise<OpenedRequest> | null>(null);
  useEffect(() => {
    const lifecycle = generation;
    const openLink = (resumePending = false) => {
      let hash = location.hash;
      // The relay remains the source of the request. Keep only its temporary
      // capability in this tab so reloading can repeat integrity verification.
      if (!hash && resumePending && !pendingLink.current) {
        try {
          const saved = JSON.parse(
            sessionStorage.getItem(PHONE_SESSION) || 'null',
          );
          if (saved?.expiresAt > Date.now() && typeof saved.hash === 'string')
            hash = saved.hash;
          else sessionStorage.removeItem(PHONE_SESSION);
        } catch {
          /* Browser storage is optional. */
        }
      }
      const isPhone = isPhoneTransferFragment(hash);
      const isPayload = isPayloadQrFragment(hash);
      const hasLink = isPhone || isPayload || isMintReviewFragment(hash);
      if (!hasLink && !(resumePending && pendingLink.current)) return;
      const current = ++lifecycle.current;
      setBusy(true);
      setIntent(null);
      setPhoneTransfer(null);
      setError('');
      setText('');
      // Remove content from the current history entry before parsing it. No
      // URL parameters, wallet state or receipt are trusted as authorization.
      if (hasLink) {
        try {
          history.replaceState(
            history.state,
            '',
            location.pathname + location.search,
          );
        } catch {
          pendingLink.current = null;
          setBusy(false);
          setError(
            'The review link could not be cleared from this browser. Open the request JSON instead.',
          );
          return;
        }
        pendingLink.current = isPhone
          ? receivePhoneTransfer(hash)
          : (isPayload
              ? parsePayloadQrFragment(hash)
              : parseMintReviewFragment(hash)
            ).then((intent) => ({ intent }));
      }
      // StrictMode replays effects after clearing the URL. Reattach to the same
      // verification promise while keeping stale results invalidated on cleanup.
      void pendingLink.current!.then(
        (result) => {
          if (current !== lifecycle.current) return;
          pendingLink.current = null;
          setIntent(result.intent);
          setPhoneTransfer(result.transfer || null);
          try {
            if (result.transfer)
              sessionStorage.setItem(
                PHONE_SESSION,
                JSON.stringify({
                  hash: new URL(result.transfer.url).hash,
                  expiresAt: result.transfer.expiresAt,
                }),
              );
            else sessionStorage.removeItem(PHONE_SESSION);
          } catch {
            /* The current view still works without tab storage. */
          }
          setSelected(0);
          setBusy(false);
        },
        (cause) => {
          if (current !== lifecycle.current) return;
          pendingLink.current = null;
          setError(errorText(cause));
          try {
            sessionStorage.removeItem(PHONE_SESSION);
          } catch {
            /* Optional. */
          }
          setBusy(false);
        },
      );
    };
    openLink(true);
    const onHashChange = () => openLink();
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      ++lifecycle.current;
    };
  }, []);
  async function inspect(source: string, current = ++generation.current) {
    if (current !== generation.current) return;
    pendingLink.current = null;
    setBusy(true);
    setError('');
    setIntent(null);
    setPhoneTransfer(null);
    try {
      sessionStorage.removeItem(PHONE_SESSION);
    } catch {
      /* Optional. */
    }
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
    pendingLink.current = null;
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
        <h2>
          {intent ? 'Review your agent’s creation.' : 'Mint with your agent.'}
        </h2>
        <p>
          {intent
            ? 'Inspect the files, connect your wallet, then review and approve the mint.'
            : 'Open your agent’s review link or import its request, then approve with your wallet.'}
        </p>
        {busy && <p role="status">Opening and verifying your creation…</p>}
        {error && (
          <p className="ns-error" role="alert">
            {error}
          </p>
        )}
      </div>
      {!intent && !busy && !error && (
        <section className="ns-panel ns-mcp-connect">
          <span className="ns-lab-kicker">OPEN-SOURCE MCP</span>
          <h3>Run NFT-Studio with your agent.</h3>
          <p>
            Tools for Cardano research, exact file packages, music releases,
            proof records, capsule contract identities and unsigned NFT/data
            transactions. Install the server from the NFT-Studio repository and
            connect your agent locally. No model-provider API key is needed.
          </p>
          <code className="ns-mcp-url">{MCP_SETUP_URL}</code>
          <div className="ns-button-row">
            <Button
              variant="outline"
              render={
                <a
                  href={MCP_SETUP_URL}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open MCP setup guide"
                />
              }
              nativeButton={false}
            >
              <ExternalLink size={16} /> Open setup guide
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(MCP_SETUP_URL).then(
                  () => setConnectionStatus('Setup link copied.'),
                  () =>
                    setConnectionStatus(
                      'Select and copy the setup link above.',
                    ),
                );
              }}
            >
              <Copy size={16} /> Copy setup link
            </Button>
            <Button
              variant="outline"
              onClick={() => download(jsonBlob(MCP_CONFIG), 'beacn-mcp.json')}
            >
              <Download size={16} /> Download config template
            </Button>
          </div>
          {connectionStatus && <output>{connectionStatus}</output>}
          <p className="ns-lab-muted">
            This link is a setup guide, not an HTTP MCP endpoint. Replace the
            template path with your local checkout. Ask your bot for its mint
            review link. You can also open its request JSON below. Wallet review
            and signing happen here in your browser. Music packages open in the
            Music release lab.
          </p>
          <p className="ns-lab-muted">
            Unsigned preparation uses your supplied wallet snapshot and queries
            public Cardano parameters. Signing and submission remain with the
            wallet.
          </p>
        </section>
      )}
      <div className={intent ? 'ns-agent-ready' : 'ns-lab-columns'}>
        {!intent && (
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
            <details className="ns-lab-details">
              <summary>Full service and setup details</summary>
              <p>
                The repo-local Node server prepares content, answers Cardano
                questions, builds unsigned transactions and checks external
                wallet signatures. Connect over local stdio, or operate its
                authenticated HTTP service on your own host. It never holds a
                signing key or submits transactions.
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
        )}
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
                    pendingLink.current = null;
                    setIntent(null);
                    setPhoneTransfer(null);
                    try {
                      sessionStorage.removeItem(PHONE_SESSION);
                    } catch {
                      /* Optional. */
                    }
                    setBusy(false);
                    setError('');
                  }}
                >
                  <X size={18} />
                </Button>
              </div>
              <h3>{intent.bundle.name}</h3>
              <p className="ns-lab-muted">
                No Studio fee. Review the network fee and the ADA kept with your
                NFT before you approve. Your wallet controls signing.
              </p>
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
                <span>Imported request SHA-256</span>
                <code>{intent.intentHash}</code>
              </div>
              <CreationControls
                key={intent.intentHash}
                initialIntent={intent}
                phoneUrl={phoneTransfer?.url}
                phoneExpiresAt={phoneTransfer?.expiresAt}
              />
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
