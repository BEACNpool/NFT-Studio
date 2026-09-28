'use client';
import { useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Copy,
  Plus,
  Sparkles,
} from 'lucide-react';
import { assetPath } from '@/lib/paths';

const REPO = 'https://github.com/BEACNpool/NFT-Studio';
const examples = [
  {
    type: 'Art',
    text: 'Create an NFT of a little world inside a glass marble. Make it feel like a memory from the future.',
    title: 'A world only you could imagine.',
    detail: 'Original art, shaped through conversation.',
    className: 'world',
  },
  {
    type: 'Games',
    text: 'Create a tiny playable space game that lives inside my NFT. Give it a neon-green CRT look.',
    title: 'Something you can actually play.',
    detail: 'Small, self-contained games with real code.',
    className: 'game',
  },
  {
    type: 'Music',
    text: 'Make an interactive pocket synthesizer NFT. Eight notes, warm colors, and sounds I can play.',
    title: 'An idea with a sound of its own.',
    detail: 'Interactive instruments and credited releases.',
    className: 'music',
  },
  {
    type: 'Useful things',
    text: 'Create a beautiful breathing timer NFT. A circle that expands and contracts, with a gentle four-second rhythm.',
    title: 'A collectible that does something.',
    detail: 'Working tools, embedded apps, and exact files.',
    className: 'utility',
  },
];
function Mark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M5 26V6h5l12 15V6h5v20h-5L10 11v15H5Z" fill="currentColor" />
      <path d="M5 6h5l17 20h-5L5 6Z" fill="currentColor" opacity=".35" />
    </svg>
  );
}
function CopyButton({
  value,
  label = 'Copy',
  className = '',
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setError(false);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setError(true);
    }
  }
  return (
    <span className="al-copy-wrap">
      <button
        type="button"
        onClick={copy}
        className={'al-copy ' + className}
        aria-label={copied ? 'Copied to clipboard' : label}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
        <span>{copied ? 'Copied' : label}</span>
      </button>
      <output className="al-sr">
        {copied
          ? 'Copied to clipboard.'
          : error
            ? 'Clipboard unavailable. Select the text and copy it manually.'
            : ''}
      </output>
      {error && (
        <small className="al-copy-error">Select the text to copy it.</small>
      )}
    </span>
  );
}
export function AgentLanding() {
  const [agent, setAgent] = useState<'Codex' | 'Claude Code' | 'Other agents'>(
    'Codex',
  );
  const [example, setExample] = useState(0);
  const launch = agent === 'Claude Code' ? 'claude' : 'codex';
  const clone = `git clone https://github.com/BEACNpool/NFT-Studio.git\ncd NFT-Studio${agent === 'Other agents' ? '' : '\n' + launch}`;
  const prompt =
    'Read START_HERE.md and set up NFT-Studio. Then help me create and mint an NFT from my idea.';
  return (
    <div className="agent-landing">
      <a className="al-skip" href="#studio-main">
        Skip to content
      </a>
      <header className="al-header">
        <a
          className="al-brand"
          href={assetPath('/')}
          aria-label="NFT-Studio home"
        >
          <Mark />
          <span>
            NFT<span className="al-brand-hyphen">—</span>STUDIO
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#possibilities">Imagine</a>
          <a href={REPO} target="_blank" rel="noreferrer">
            GitHub <ArrowUpRight size={14} />
          </a>
          <a href="#install" className="al-nav-install">
            Get the skill <ArrowUpRight size={15} />
          </a>
        </nav>
      </header>
      <main id="studio-main">
        <section className="al-hero" aria-labelledby="al-title">
          <div className="al-hero-copy">
            <p className="al-eyebrow">
              <span className="al-live-dot" /> A NEW WAY TO CREATE ON CARDANO
            </p>
            <h1 id="al-title">
              Your imagination.
              <br />
              Your agent.
              <br />
              <em>On-chain.</em>
            </h1>
            <p className="al-intro">
              Teach your AI how to mint.
              <br />
              Then tell it what’s on your mind.
            </p>
            <p className="al-hero-description">
              NFT-Studio is a skill for your creative agent. You bring the idea.
              It makes the art, writes the code, and prepares the mint.
            </p>
            <div className="al-hero-actions">
              <a className="al-button" href="#install">
                Give your agent the skill <ArrowUpRight size={19} />
              </a>
              <span>
                Open source.
                <br />
                Yours to imagine.
              </span>
            </div>
            <div className="al-agent-line">
              <span>MADE FOR</span>
              <strong>Codex</strong>
              <i />
              <strong>Claude Code</strong>
              <i />
              <span className="al-more">&amp; your next agent</span>
            </div>
          </div>
          <div className="al-hero-art">
            <div className="al-art-label">
              <span>IDEAS DON’T HAVE TO STAY IDEAS.</span>
              <span>001 / ∞</span>
            </div>
            <div className="al-sculpture">
              <img
                src={assetPath('/agent/imagination.webp')}
                width="1024"
                height="1024"
                alt="A flowing silver and chartreuse glass sculpture, folded into an impossible loop"
                fetchPriority="high"
              />
              <span className="al-orbit-tag">
                <Sparkles size={13} /> MADE OF POSSIBILITY
              </span>
            </div>
            <div className="al-art-footer">
              <span>A THOUGHT. A CONVERSATION. A CREATION.</span>
              <svg viewBox="0 0 40 40" aria-hidden="true">
                <path
                  d="M8 10h22v22M30 10 8 32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </div>
        </section>
        <section className="al-manifesto" aria-label="How it works">
          <span className="al-section-label">THE STUDIO IS YOUR AGENT.</span>
          <p>
            No new interface to learn.
            <br />
            Just a conversation
            <br />
            <span>with a little more possibility.</span>
          </p>
          <div className="al-manifesto-note">
            <span className="al-asterisk" aria-hidden="true">
              ✳
            </span>
            <p>
              Keep creating where you already think.
              <br />
              NFT-Studio gives your agent the knowledge and tools to take an
              idea all the way to a mint.
            </p>
          </div>
        </section>
        <section
          id="possibilities"
          className="al-possibilities"
          aria-labelledby="al-imagine-title"
        >
          <div className="al-section-top">
            <div>
              <p className="al-section-label">START WITH “WHAT IF…”</p>
              <h2 id="al-imagine-title">
                More than a picture.
                <br />
                Anything starts with an idea.
              </h2>
            </div>
            <p>
              Art. Play. Sound. Something useful.
              <br />
              Your agent can help you find the form.
            </p>
          </div>
          <div className="al-example">
            <div
              className={
                'al-example-art al-example-' + examples[example].className
              }
              aria-hidden="true"
            >
              <div className="al-example-grid" />
              <div className="al-example-object">
                <div />
                <div />
                <div />
              </div>
              <span className="al-example-number">0{example + 1}</span>
              <span className="al-example-caption">
                A PROMPT IS ONLY THE BEGINNING.
              </span>
            </div>
            <div className="al-example-copy">
              <fieldset className="al-example-tabs" aria-label="Example ideas">
                {examples.map((e, i) => (
                  <button
                    key={e.type}
                    type="button"
                    aria-pressed={i === example}
                    onClick={() => setExample(i)}
                  >
                    {e.type}
                  </button>
                ))}
              </fieldset>
              <h3>{examples[example].title}</h3>
              <p className="al-example-detail">{examples[example].detail}</p>
              <div className="al-prompt">
                <span>YOU, TO YOUR AGENT</span>
                <p>“{examples[example].text}”</p>
                <CopyButton
                  value={'Use NFT-Studio. ' + examples[example].text}
                  label="Copy this idea"
                />
              </div>
              <p className="al-example-footnote">
                Example prompts, not pre-minted products. Your agent creates the
                actual files and checks what fits.
              </p>
            </div>
          </div>
        </section>
        <section
          id="install"
          className="al-install"
          aria-labelledby="al-install-title"
        >
          <div className="al-install-head">
            <p className="al-section-label">
              ONE REPO. A WHOLE NEW CREATIVE CAPABILITY.
            </p>
            <h2 id="al-install-title">
              Clone it.
              <br />
              Tell your agent.
              <br />
              <span>Make it yours.</span>
            </h2>
            <p>
              Start with your favorite coding agent.
              <br />
              Let it handle the setup from there.
            </p>
            <div className="al-install-tags">
              <span>Git + Node.js 22.13+</span>
              <span>Your signed-in agent</span>
            </div>
          </div>
          <div className="al-install-steps">
            <fieldset className="al-agent-tabs" aria-label="Choose your agent">
              {(['Codex', 'Claude Code', 'Other agents'] as const).map((a) => (
                <button
                  type="button"
                  key={a}
                  aria-pressed={a === agent}
                  onClick={() => setAgent(a)}
                >
                  {a}
                </button>
              ))}
            </fieldset>
            <div className="al-step">
              <div className="al-step-heading">
                <span>01</span>
                <h3>Clone. Open your agent.</h3>
                <CopyButton value={clone} label="Copy commands" />
              </div>
              <pre aria-label={'Clone and open ' + agent}>
                <code>{clone}</code>
              </pre>
              {agent === 'Other agents' && (
                <p className="al-step-note">
                  Open this folder in an agent that can read files and run local
                  commands.
                </p>
              )}
            </div>
            <div className="al-step">
              <div className="al-step-heading">
                <span>02</span>
                <h3>Hand it the instructions.</h3>
              </div>
              <div className="al-start-prompt">
                <p>{prompt}</p>
                <CopyButton value={prompt} label="Copy first prompt" />
              </div>
              <p className="al-step-note">
                Your agent reads the skill, installs the minting tools, and
                checks the setup. Keep the conversation going with your idea.
              </p>
            </div>
            <div className="al-install-end">
              <Check size={17} />
              <p>
                No Studio account. No extra model API key.
                <br />
                <span>Use your existing agent subscription or provider.</span>
              </p>
            </div>
          </div>
        </section>
        <section
          className="al-principles"
          aria-label="What stays in your hands"
        >
          <div>
            <span>01 / CREATIVE FREEDOM</span>
            <h3>You describe. It creates.</h3>
            <p>
              Talk through an idea. Change the colors. Rewrite the rules. Ask
              for something nobody has made before.
            </p>
          </div>
          <div>
            <span>02 / REAL CAPABILITIES</span>
            <h3>Working files. Real utility.</h3>
            <p>
              Agents build and verify the actual content. A game should play. A
              tool should work. A description alone isn’t a capability.
            </p>
          </div>
          <div>
            <span>03 / YOUR AUTHORITY</span>
            <h3>Your NFT. Your approval.</h3>
            <p>
              Your agent handles the technical work. You approve the final
              transaction through your wallet or authorized signer. Network fees
              apply.
            </p>
          </div>
        </section>
        <section className="al-faq" aria-labelledby="al-faq-title">
          <div>
            <p className="al-section-label">A FEW THINGS WORTH KNOWING</p>
            <h2 id="al-faq-title">
              Simple by design.
              <br />
              Open about the details.
            </h2>
            <a href={REPO + '/blob/main/START_HERE.md'}>
              Read the agent’s starting guide <ArrowUpRight size={16} />
            </a>
          </div>
          <div className="al-questions">
            <details>
              <summary>
                Is NFT-Studio an app I have to learn?
                <Plus size={17} />
              </summary>
              <p>
                No. The primary workflow lives in your agent. The repository
                includes a reusable skill, Cardano knowledge, and MCP tools. You
                describe the result; your agent selects the tools and creates
                it. A preview or wallet approval can still open in your browser.
              </p>
            </details>
            <details>
              <summary>
                Can I really create anything?
                <Plus size={17} />
              </summary>
              <p>
                Start with any idea. Your agent works out what can be built and
                how it can be minted. Fully embedded creations have size limits;
                complex utility may need a contract or service. The skill
                teaches your agent to check those limits and explain the
                workable path.
              </p>
            </details>
            <details>
              <summary>
                Does cloning connect everything automatically?
                <Plus size={17} />
              </summary>
              <p>
                Cloning gives your agent the skill and source. Ask it to read
                START_HERE.md: it installs the pinned tools and verifies them.
                For native MCP access it can register the server in Codex or
                Claude Code; a new agent session may be needed. It can also use
                the included local helper in the current session.
              </p>
            </details>
            <details>
              <summary>
                Who signs the mint, and what does it cost?
                <Plus size={17} />
              </summary>
              <p>
                You control signing through your wallet or an explicitly
                authorized signer. NFT-Studio charges 0 ADA platform fee.
                Cardano transaction fees and the minimum ADA accompanying the
                NFT still apply. Your agent’s subscription is separate.
              </p>
            </details>
            <details>
              <summary>
                Can I ask for royalties, access, or a limited collection?
                <Plus size={17} />
              </summary>
              <p>
                Yes—describe what you need. Your agent must distinguish a
                working implementation from a plan. Holder access, redemption
                and guaranteed supply limits need the appropriate enforcing
                service or policy; putting a promise in metadata does not make
                it work.
              </p>
            </details>
          </div>
        </section>
        <section className="al-final">
          <p className="al-section-label">THE NEXT ONE STARTS WITH YOU.</p>
          <h2>
            What’s on
            <br />
            <em>your mind?</em>
            <span aria-hidden="true">↗</span>
          </h2>
          <a className="al-button" href="#install">
            Let’s make it <ArrowRight size={18} />
          </a>
        </section>
      </main>
      <footer className="al-footer">
        <a className="al-brand" href={assetPath('/')}>
          <Mark />
          <span>NFT—STUDIO</span>
        </a>
        <p>Built for imagination. Minted on Cardano.</p>
        <div>
          <a href={REPO}>
            Source <ArrowUpRight size={12} />
          </a>
          <a href={REPO + '/blob/main/docs/MCP.md'}>Technical docs</a>
          <a href={REPO + '/blob/main/LICENSE'}>Apache 2.0</a>
        </div>
      </footer>
    </div>
  );
}
