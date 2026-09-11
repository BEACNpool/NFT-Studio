'use client';
/* oxlint-disable next/no-img-element, next/no-html-link-for-pages */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  Copy,
  Download,
  Sparkles,
  Share2,
  MessageCircle,
  RotateCcw,
  Play,
} from 'lucide-react';
import {
  advanceGuide,
  guideView,
  INSPIRATION,
  INITIAL_GUIDE,
  type GuideState,
  type GuideFormat,
} from '@/lib/studio-guide';
import { assetPath } from '@/lib/paths';
import './ai-creator-home.css';

export function AICreatorHome({ onExplore }: { onExplore: () => void }) {
  const [state, setState] = useState<GuideState>({ ...INITIAL_GUIDE });
  const [answer, setAnswer] = useState('');
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  const question = useRef<HTMLHeadingElement>(null);
  const prompt = useRef<HTMLTextAreaElement>(null);
  const view = guideView(state);
  const handoff = state.stage === 'brief' || state.stage === 'creating';
  const inspire = (id: string, focus = true) => {
    const item = INSPIRATION.find((x) => x.id === id);
    if (!item) return;
    setState({
      schema: 'nft-studio.guide.v1',
      stage: 'direction',
      format: item.format as GuideFormat,
      idea: item.idea,
      exampleId: item.id,
    });
    if (focus)
      requestAnimationFrame(() => {
        question.current?.focus();
        question.current?.scrollIntoView({
          block: 'center',
          behavior: 'smooth',
        });
      });
  };
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('inspire');
    if (id) inspire(id, false);
  }, []);
  const choose = (choice?: string, text?: string) => {
    const next = advanceGuide(state, { choice, answer: text });
    setState(next);
    setAnswer(next.stage === 'idea' ? next.idea || '' : '');
    setNotice('');
    requestAnimationFrame(() =>
      question.current?.focus({ preventScroll: true }),
    );
  };
  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(message);
    } catch {
      setNotice('Clipboard unavailable. Select and copy the prompt below.');
      prompt.current?.focus();
      prompt.current?.select();
    }
  }
  function downloadBrief() {
    const url = URL.createObjectURL(
      new Blob([view.prompt + '\n'], { type: 'text/plain;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nft-studio-creative-brief.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      'Your brief was saved. Paste it into your AI when you are ready.',
    );
  }
  async function share(id: string) {
    const item = INSPIRATION.find((x) => x.id === id)!;
    const url = new URL(assetPath('/'), location.origin);
    url.searchParams.set('inspire', id);
    try {
      if (navigator.share) {
        await navigator.share({
          title: item.title + ' · NFT-Studio',
          text: 'An on-chain original to spark your next idea.',
          url: url.href,
        });
        setNotice('Sharing opened.');
      } else {
        await navigator.clipboard.writeText(url.href);
        setNotice('Inspiration link copied.');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError')
        setNotice('Share link: ' + url.href);
    }
  }
  return (
    <div className="ai-home">
      <section className="ai-front" aria-labelledby="ai-title">
        <div className="ai-intro">
          <p className="ai-kicker">
            <span /> YOUR IDEA. YOUR AI. YOUR NFT.
          </p>
          <h1 id="ai-title">
            Make something
            <br />
            <em>worth minting.</em>
          </h1>
          <p className="ai-lede">
            Create with your AI, one good idea at a time. Art, music, games, and
            tiny apps—made together, kept on Cardano.
          </p>
          <div className="ai-main-actions">
            <a className="ai-button ai-primary" href={assetPath('/mcp/')}>
              <Sparkles size={18} /> Install the MCP <ArrowUpRight size={18} />
            </a>
            <a className="ai-text-link" href="#inspiration">
              Find inspiration <ArrowDown size={16} />
            </a>
          </div>
          <p className="ai-small">
            Already connected? Tell your AI:{' '}
            <strong>“Open NFT-Studio and guide me.”</strong>
          </p>
          <div className="ai-promise">
            <span>
              <Check size={15} /> 0 ADA Studio fee
            </span>
            <span>
              <Check size={15} /> You approve the mint
            </span>
          </div>
          <p className="ai-fee-note">
            Network fees apply. Minimum ADA stays with your NFT.
          </p>
        </div>
        <section className="ai-guide" aria-labelledby="guide-question">
          <div className="ai-guide-head">
            <span>
              <MessageCircle size={17} /> YOUR CREATIVE BRIEF
            </span>
            <span>
              {handoff
                ? 'Ready for your AI'
                : `Step ${Math.min(view.progress.current, 2)} of 2`}
            </span>
          </div>
          <div className="ai-guide-body">
            <h2 ref={question} tabIndex={-1} id="guide-question">
              {handoff ? 'Take your idea to your AI.' : view.question}
            </h2>
            <p className="ai-guide-note">
              {handoff
                ? 'Copy this brief into your connected AI. It creates a preview, asks what to change, and prepares your wallet review when you’re ready.'
                : 'Choose a starting point here. Your connected AI creates the work and continues the conversation.'}
            </p>
            {state.exampleId && (
              <p className="ai-inspired">
                <Sparkles size={14} /> Inspired by {view.inspiration?.title}
              </p>
            )}
            {!handoff && (
              <div
                className={
                  'ai-options' +
                  (state.stage === 'format' || state.stage === 'inspiration'
                    ? ' ai-options-grid'
                    : '')
                }
              >
                {view.options.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    data-guide-choice={item.id}
                    onClick={() => choose(item.id)}
                  >
                    <span className="ai-option-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                    <ArrowRight size={17} />
                  </button>
                ))}
              </div>
            )}
            {view.acceptsText && (
              <form
                className="ai-answer"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (answer.trim()) choose(undefined, answer.trim());
                }}
              >
                <label htmlFor="ai-idea">Your idea</label>
                <textarea
                  id="ai-idea"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  maxLength={600}
                  rows={3}
                  placeholder="A little world, a sound, a story…"
                />
                <button
                  className="ai-button ai-primary"
                  disabled={!answer.trim()}
                  type="submit"
                >
                  Continue <ArrowRight size={17} />
                </button>
              </form>
            )}
            {handoff && (
              <>
                <div className="ai-brief-summary">
                  <span>{view.summary.format}</span>
                  <p>{state.idea}</p>
                  <small>{view.summary.direction}</small>
                </div>
                <label className="ai-prompt-label" htmlFor="ai-prompt">
                  Paste into your AI
                </label>
                <textarea
                  ref={prompt}
                  id="ai-prompt"
                  className="ai-prompt"
                  readOnly
                  rows={4}
                  value={view.prompt}
                />
                <div className="ai-brief-actions">
                  <button
                    className="ai-button ai-primary"
                    onClick={() =>
                      copy(
                        view.prompt,
                        'Brief copied. Paste it into your connected AI to begin.',
                      )
                    }
                  >
                    <Copy size={16} /> Copy my brief
                  </button>
                  <button
                    className="ai-icon-button"
                    onClick={downloadBrief}
                    aria-label="Download creative brief"
                  >
                    <Download size={19} />
                  </button>
                </div>
                <a className="ai-setup-link" href={assetPath('/mcp/')}>
                  Need to connect your AI? Follow the setup guide{' '}
                  <ArrowUpRight size={14} />
                </a>
              </>
            )}
            {state.stage !== 'start' && (
              <div className="ai-guide-controls">
                <button onClick={() => choose('back')}>
                  <ArrowLeft size={14} /> Back
                </button>
                <button onClick={() => choose('start_over')}>
                  <RotateCcw size={13} /> Start over
                </button>
              </div>
            )}
          </div>
          <div className="ai-guide-foot">
            <span className="ai-live-dot" /> A brief here. A conversation in
            your AI. A mint in your wallet.
          </div>
        </section>
      </section>
      <ol className="ai-journey" aria-label="How AI creation works">
        <li>
          <span>01</span>
          <div>
            <strong>Connect your AI</strong>
            <p>Install the open-source MCP once.</p>
          </div>
        </li>
        <li>
          <span>02</span>
          <div>
            <strong>Create together</strong>
            <p>Choose, preview, and ask for changes.</p>
          </div>
        </li>
        <li>
          <span>03</span>
          <div>
            <strong>Make it yours</strong>
            <p>Review the files. Approve with your wallet.</p>
          </div>
        </li>
      </ol>
      <section
        id="inspiration"
        className="ai-inspiration"
        aria-labelledby="inspiration-title"
      >
        <div className="ai-section-head">
          <div>
            <p className="ai-kicker">MINTED HERE. MADE TO INSPIRE.</p>
            <h2 id="inspiration-title">Small files. Whole worlds.</h2>
            <p>
              Play an original, mint a separate copy where available, or take
              the idea somewhere new.
            </p>
          </div>
          <button className="ai-text-link" onClick={onExplore}>
            Explore the full collection <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="ai-gallery">
          {(expanded
            ? INSPIRATION
            : [INSPIRATION[0], INSPIRATION[1], INSPIRATION[2], INSPIRATION[6]]
          ).map((item) => (
            <article className="ai-original" key={item.id}>
              <a
                className="ai-original-art"
                href={assetPath(item.playPath)}
                target="_blank"
                rel="noreferrer"
                aria-label={'Play ' + item.title}
              >
                <img
                  className={
                    item.imageNote.startsWith('Exact')
                      ? 'ai-exact-cover'
                      : undefined
                  }
                  src={assetPath(item.image)}
                  alt={
                    item.title +
                    (item.imageNote.startsWith('Gallery')
                      ? ' gallery illustration'
                      : ' original cover')
                  }
                  loading="lazy"
                  width={560}
                  height={420}
                />
                <span className="ai-play">
                  <Play size={15} fill="currentColor" /> Play & explore
                </span>
              </a>
              <div className="ai-original-body">
                <div className="ai-original-meta">
                  <span>
                    {item.format === 'utility'
                      ? 'INTERACTIVE APP'
                      : item.format.toUpperCase()}
                  </span>
                  <a
                    href={item.original.viewer}
                    target="_blank"
                    rel="noreferrer"
                    title="View the original on chain"
                  >
                    <CheckCheck size={14} /> Minted <ArrowUpRight size={12} />
                  </a>
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <div className="ai-original-actions">
                  <button onClick={() => inspire(item.id)}>
                    <Sparkles size={15} /> Make something like this
                  </button>
                  <button
                    className="ai-share"
                    aria-label={'Share inspiration: ' + item.title}
                    onClick={() => share(item.id)}
                  >
                    <Share2 size={17} />
                  </button>
                </div>
                {item.copyPath ? (
                  <a
                    className="ai-copy-link"
                    href={assetPath(item.copyPath)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Review & mint a separate copy <ArrowUpRight size={13} />
                  </a>
                ) : (
                  <span className="ai-copy-note">
                    Original instrument · inspiration only
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
        <button
          className="ai-more"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show fewer originals' : 'More minted inspiration'}{' '}
          <ArrowDown size={16} />
        </button>
        <p className="ai-gallery-note">
          Original links identify the minted editions. New copies use your own
          wallet policy. Gallery illustrations may differ from the compact
          embedded cover; the mint review shows the exact files.
        </p>
      </section>
      <output className="ai-notice" aria-live="polite">
        {notice}
      </output>
    </div>
  );
}
