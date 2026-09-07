'use client';
/* oxlint-disable next/no-img-element, next/no-html-link-for-pages */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowUpRight,
  Download,
  Gamepad2,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import {
  ARCADE,
  arcadeArtwork,
  isArcadeId,
  loadArcade,
  type ArcadeId,
  type ArcadeMedia,
} from '@/lib/arcade';
import { assetPath } from '@/lib/paths';
import { MintDialog } from './mint-dialog';

export function PocketArcade({ compact = false }: { compact?: boolean }) {
  const [id, setId] = useState<ArcadeId>(() => {
    const value =
      typeof window === 'undefined'
        ? ''
        : new URLSearchParams(location.search).get('game') || '';
    return isArcadeId(value) ? value : 'starfall';
  });
  const [media, setMedia] = useState<ArcadeMedia | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!compact) title.current?.focus({ preventScroll: true });
  }, [compact]);
  useEffect(() => {
    let current = true;
    loadArcade(id)
      .then((value) => {
        if (current) setMedia(value);
      })
      .catch((reason) => {
        if (current) setError(reason.message || 'The game could not load.');
      });
    return () => {
      current = false;
    };
  }, [id, attempt]);
  const entry = ARCADE[id];
  const cartridge = 'cartridge' in entry ? entry.cartridge : null;
  const choose = (next: ArcadeId) => {
    if (next === id) return;
    setMedia(null);
    setError('');
    setId(next);
    const url = new URL(location.href);
    url.searchParams.set('game', next);
    history.replaceState(null, '', url);
  };
  // During a selection transition, never show or mint the previous game's payload.
  const ready = media?.id === id ? media : null;
  return (
    <section
      className="pocket-arcade"
      style={{ '--arcade-accent': entry.accent } as CSSProperties}
      aria-labelledby={compact ? undefined : 'arcade-title'}
      aria-label={compact ? 'Playable games' : undefined}
    >
      {!compact && (
        <div className="arcade-heading">
          <div>
            <p className="eyebrow">
              <span /> BEACN GAMES / 01—
              {String(Object.keys(ARCADE).length).padStart(2, '0')}
            </p>
            <h1 id="arcade-title" ref={title} tabIndex={-1}>
              Whole games.
              <br />
              <em>Stored on Cardano.</em>
            </h1>
          </div>
          <p>
            Original expeditions, Sudoku, puzzles, chess, checkers and
            solitaire.
            <br />
            Play here. Mint any game to your own wallet.
          </p>
        </div>
      )}
      <label className="arcade-mobile-picker">
        Choose a game
        <select
          value={id}
          onChange={(e) => {
            if (isArcadeId(e.target.value)) choose(e.target.value);
          }}
        >
          {(Object.keys(ARCADE) as ArcadeId[]).map((key) => (
            <option key={key} value={key}>
              {ARCADE[key].title}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="arcade-selector" aria-label="Choose a game">
        {(Object.keys(ARCADE) as ArcadeId[]).map((key) => {
          const game = ARCADE[key];
          return (
            <button
              key={key}
              data-game={key}
              aria-pressed={id === key}
              onClick={() => choose(key)}
            >
              <img
                src={assetPath('/arcade/' + key + '/cover.svg')}
                width="80"
                height="80"
                alt=""
              />
              <span>
                <small>
                  {game.number} / {game.genre}
                </small>
                <strong>{game.title}</strong>
                <small>{game.subtitle}</small>
              </span>
              <Gamepad2 size={20} aria-hidden="true" />
            </button>
          );
        })}
      </fieldset>
      <div className="arcade-layout">
        <div className="arcade-player">
          <div className="arcade-player-bar">
            <span>
              <i /> PLAY {entry.title}
            </span>
            <small>No wallet needed</small>
          </div>
          {ready ? (
            <iframe
              key={id}
              id="arcade-demo"
              title="Play the selected on-chain game"
              srcDoc={ready.program.html}
              sandbox="allow-scripts allow-downloads"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="arcade-loading" aria-live="polite">
              {error ? (
                <>
                  <p>{error}</p>
                  <button
                    className="btn secondary"
                    onClick={() => {
                      setError('');
                      setMedia(null);
                      setAttempt((n) => n + 1);
                    }}
                  >
                    Try again
                  </button>
                </>
              ) : (
                <>
                  <LoaderCircle className="spinner" />
                  <p>Opening {entry.title}…</p>
                </>
              )}
            </div>
          )}
        </div>
        <aside className="arcade-about" aria-label="About this game">
          <p className="eyebrow">{entry.genre}</p>
          <h2>{entry.subtitle}</h2>
          <p>{entry.description}</p>
          {cartridge && (
            <p>
              STARFALL reads its two on-chain memory cartridges through pool.pm.
              Keep the complete offline game below to play without a connection.
            </p>
          )}
          <div className="arcade-features">
            {entry.features.map((feature) => (
              <span key={feature}>{feature}</span>
            ))}
          </div>
          {ready && (
            <MintDialog
              key={id}
              art={arcadeArtwork(ready)}
              arcade={ready}
              triggerLabel="Mint to my wallet"
            />
          )}
          <p className="arcade-wallet-help">
            Open to everyone. No whitelist or BEACN token needed. Use your
            Cardano wallet’s dApp browser or a desktop wallet extension to mint.
            0 BMKR fee; review the network fee and ADA kept with your NFT before
            signing.
          </p>
          <a
            className="text-link"
            href={'https://pool.pm/' + entry.original.fingerprint}
            target="_blank"
            rel="noopener noreferrer"
          >
            {cartridge
              ? 'View the original on pool.pm'
              : 'Play the original on pool.pm'}{' '}
            <ArrowUpRight size={16} />
          </a>
          <p className="arcade-origin">
            Your copy goes directly to your connected wallet under its own
            policy. The original collectible remains separate. Anyone can play.
          </p>
          <div className="arcade-downloads">
            <a
              className="text-link"
              href={assetPath('/arcade/' + id + '/game.html')}
              download
            >
              <Download size={15} />{' '}
              {cartridge ? 'On-chain reader' : 'Keep the game'}
            </a>
            <a
              className="text-link"
              href={assetPath('/arcade/' + id + '/expanded.html')}
              download
            >
              <Download size={15} />{' '}
              {cartridge ? 'Complete offline game' : 'Expanded HTML'}
            </a>
            {cartridge && (
              <a
                className="text-link"
                href={assetPath('/arcade/starfall/cartridges.zip')}
                download
              >
                <Download size={15} /> Both cartridge files
              </a>
            )}
          </div>
          <details className="arcade-rules">
            <summary>How to play</summary>
            {entry.instructions.map((rule) => (
              <p key={rule}>{rule}</p>
            ))}
          </details>
          <details className="arcade-proof">
            <summary>
              <ShieldCheck size={16} /> What lives on chain?
            </summary>
            {cartridge ? (
              <p>
                The complete {cartridge.expandedBytes.toLocaleString()}-byte
                game is stored across two companion NFTs. This NFT contains the
                reader, their exact identities and SHA-256 checks, plus its
                cover. All game code, art and sound are on Cardano. The reader
                checks the data before playing; your creator copy uses the same
                public cartridges.
              </p>
            ) : (
              <p>
                The complete HTML program ({entry.programBytes.toLocaleString()}{' '}
                bytes) and SVG cover are inside the mint transaction. These
                previews use the exact recovered bytes.
              </p>
            )}
            <p>
              Gameplay and saves run locally; moves are not blockchain
              transactions.
            </p>
            <p>
              The compact game needs a browser with Compression Streams.
              Expanded HTML is included as a companion download. Some wallets
              display only the cover.
            </p>
            {cartridge ? (
              <p>
                Play here for automatic loading. On pool.pm, download and unzip
                both cartridge files above, then choose them in the NFT’s file
                picker. Its viewer blocks automatic cartridge requests.
              </p>
            ) : (
              <p>pool.pm supports playing the attachment.</p>
            )}
            <small>GAME SHA-256</small>
            <code>{entry.programSHA256}</code>
            <small>ORIGINAL POLICY</small>
            <code>{entry.original.policy}</code>
            {cartridge?.parts.map((part, index) => (
              <a
                key={part.fingerprint}
                className="text-link"
                href={'https://pool.pm/' + part.fingerprint}
                target="_blank"
                rel="noopener noreferrer"
              >
                Memory 0{index + 1} on Cardano <ArrowUpRight size={15} />
              </a>
            ))}
          </details>
        </aside>
      </div>
    </section>
  );
}
