'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, Wallet } from 'lucide-react';
import { assetPath } from '@/lib/paths';

const REPO = 'https://github.com/BEACNpool/NFT-Studio';
const INSTALL = `Clone ${REPO} and follow START_HERE.md to set up the NFT-Studio skill for this agent. Then use it to help me create an NFT from my idea.`;
const FEATURES = [
  'Art',
  'Games',
  'Music',
  'Interactive NFTs',
  'Apps & utility',
];

export function AgentLanding() {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const prompt = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (manual) {
      prompt.current?.focus();
      prompt.current?.select();
    }
  }, [manual]);
  async function copyInstall() {
    try {
      await navigator.clipboard.writeText(INSTALL);
      setCopied(true);
      setManual(false);
    } catch {
      setCopied(false);
      setManual(true);
    }
  }
  return (
    <div className="agent-landing">
      <header className="al-header">
        <a
          className="al-brand"
          href={assetPath('/')}
          aria-label="NFT-Studio home"
        >
          <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path
              d="M5 26V6h5l12 15V6h5v20h-5L10 11v15H5Z"
              fill="currentColor"
            />
          </svg>
          NFT<span>—</span>Studio
        </a>
        <a className="al-source" href={REPO}>
          <span aria-hidden="true">〈/〉</span> <span>Open source</span>
          <ArrowUpRight size={14} />
        </a>
      </header>
      <main id="studio-main">
        <section className="al-content" aria-labelledby="al-title">
          <div className="al-intro">
            <p className="al-eyebrow">
              <span /> A new skill for your imagination
            </p>
            <h1 id="al-title">
              Imagine it.
              <br />
              <em>Mint it.</em>
            </h1>
            <p className="al-description">
              Give Codex or Claude Code the NFT-Studio skill.
              <br className="al-desktop-break" /> Describe your idea. Your agent
              builds your NFT.
            </p>
            <ul className="al-features" aria-label="What you can create">
              {FEATURES.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>
          <div className="al-install" id="install">
            <div className="al-install-heading">
              <span className="al-number">01</span>
              <h2>Copy. Paste. Create.</h2>
            </div>
            <p>
              Paste the install directions into your agent.
              <br />
              It sets up NFT-Studio. Then tell it what to build.
            </p>
            <button className="al-copy" onClick={copyInstall}>
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied
                ? 'Copied — paste into your agent'
                : 'Copy install directions'}
              <span aria-hidden="true">↗</span>
            </button>
            <output className="al-sr-only">
              {copied ? 'Install directions copied.' : ''}
            </output>
            {manual && (
              <div className="al-manual">
                <label htmlFor="al-prompt">
                  Clipboard unavailable. Copy this text:
                </label>
                <textarea
                  id="al-prompt"
                  ref={prompt}
                  readOnly
                  value={INSTALL}
                  rows={4}
                />
              </div>
            )}
          </div>
          <div className="al-wallet">
            <Wallet size={21} aria-hidden="true" />
            <div>
              <strong>Mint with a browser wallet.</strong>
              <p>
                Your agent creates. You review and sign.
                <span>
                  {' '}
                  On mobile, open the mint link in VESPR’s dApp browser.
                </span>
              </p>
            </div>
          </div>
        </section>
        <figure className="al-sculpture">
          <div className="al-art-label">
            <span>Made with NFT-Studio</span>
            <span>Mintable artwork</span>
          </div>
          <a
            className="al-art-link"
            href={assetPath('/showcase/make-your-own/')}
            aria-label="View and mint Make Your Own by BEACN"
          >
            <img
              src={assetPath('/showcase/make-your-own/artwork.svg')}
              alt="Make Your Own by BEACN: a luminous question mark above a mint and gold creative cube."
              width="1200"
              height="1200"
              fetchPriority="high"
            />
          </a>
          <figcaption>
            <span>Make Your Own · BEACN</span>
            <a href={assetPath('/showcase/make-your-own/')}>
              View &amp; mint this NFT ↗
            </a>
          </figcaption>
        </figure>
      </main>
      <footer className="al-footer">
        <span>
          <a href={assetPath('/showcase/make-your-own/')}>
            Mint the example NFT ↗
          </a>
        </span>
        <span>
          On Cardano <i /> 0 ADA studio fee
          <span className="al-network"> · Network fees apply</span>
        </span>
      </footer>
    </div>
  );
}
