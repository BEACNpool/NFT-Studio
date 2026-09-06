'use client';
/* oxlint-disable next/no-img-element, next/no-html-link-for-pages */
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  Music2,
  Smartphone,
} from 'lucide-react';
import { assetPath } from '@/lib/paths';
import { useEffect, useMemo, useState } from 'react';
import { MintDialog } from './mint-dialog';
import { findWallets } from '@/lib/cardano';
import { interactiveHTML } from '@/lib/interactive';
import type { Artwork } from '@/lib/art';
import type { OnchainImage } from '@/lib/onchain-art';
import campaign from '@/lib/kayfabe.json';

function WalletBrowserNotice() {
  const [walletAvailable, setWalletAvailable] = useState<boolean | null>(null);
  const checkWallet = () => setWalletAvailable(findWallets().length > 0);
  useEffect(() => {
    const check = () => setWalletAvailable(findWallets().length > 0);
    // Give mobile browsers and extensions time to inject their wallet provider.
    const initial = window.setTimeout(check, 600);
    const poll = window.setInterval(check, 1000);
    const stop = window.setTimeout(() => window.clearInterval(poll), 15000);
    const visible = () => {
      if (document.visibilityState === 'visible') check();
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.clearTimeout(initial);
      window.clearTimeout(stop);
      window.clearInterval(poll);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  return (
    <div aria-live="polite">
      {walletAvailable === false && (
        <aside
          className="kayfabe-wallet-notice"
          aria-label="Minting browser required"
        >
          <Smartphone size={22} aria-hidden="true" />
          <div>
            <strong>
              You can view here. Open your wallet’s dApp browser to mint.
            </strong>
            <p>
              View the artwork and play Beat Lab in this browser. To mint, open
              this page in VESPR or Eternl’s dApp browser. On desktop, a Cardano
              wallet extension also works.
            </p>
            <button type="button" onClick={checkWallet}>
              Wallet ready? Check again
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}

export function Kayfabe() {
  const image = campaign.image as OnchainImage;
  const art = useMemo(
    () => ({ ...campaign.artwork, customImage: image.uri }) as Artwork,
    [image],
  );
  const html = useMemo(
    () => interactiveHTML(art.interactive!, art.name),
    [art],
  );
  return (
    <main className="kayfabe-page">
      <header className="kayfabe-header">
        <a href="?" className="creation-brand">
          BMKR <span>BY BEACN</span>
        </a>
        <a href="?" className="text-link">
          <ArrowLeft size={16} /> Make your own
        </a>
      </header>
      <WalletBrowserNotice />
      <div className="kayfabe-layout">
        <figure className="kayfabe-card">
          <img
            src={assetPath('/art/kayfabe/master.jpg')}
            width={1408}
            height={1408}
            alt="Lil Rogers KAYFABE: gold grill, Chicago skyline and holographic gold card"
          />
          <figcaption>GOLD GRILL / GENESIS ARTWORK</figcaption>
        </figure>
        <section className="kayfabe-controls">
          <p className="eyebrow">CHICAGO / OPEN MINT</p>
          <h1>
            It’s a beautiful day
            <br />
            to start <em>something.</em>
          </h1>
          <p className="kayfabe-intro">
            Lil Rogers. KAYFABE. A gold-grill collectible with a beat machine
            inside. From BMKR × BEACN, for anyone ready to make something.
          </p>
          <div className="kayfabe-price">
            <strong>0 ADA</strong>
            <span>
              BMKR fee
              <br />
              <small>Cardano network costs still apply.</small>
            </span>
          </div>
          <div id="kayfabe-mint">
            <MintDialog
              art={art}
              pinnedImage={image}
              triggerLabel="Mint your own copy"
            />
            <small className="kayfabe-mint-cost">
              0 BMKR fee · Cardano network costs apply
            </small>
          </div>
          <a className="btn secondary" href="?utility=beats">
            Make your own with Beat Lab <ArrowUpRight size={17} />
          </a>
          <p className="kayfabe-note">
            No allowlist. No scheduled end. Connect your Cardano wallet to mint
            your own copy. Your wallet shows the network fee and the ADA that
            stays with your NFT before you sign.
          </p>
          <details className="kayfabe-details">
            <summary>What you’re minting</summary>
            <p>
              One copy goes to your connected wallet. The exact 512px image
              shown in mint review, all 15 card traits and the complete Beat Lab
              program are embedded on Cardano. The larger image here is the
              source artwork.
            </p>
            <p>
              This is an open creator mint: copies have their own wallet-signed
              policy, rather than one shared collection policy. There is no
              capped edition. Each policy closes after one hour; this page
              remains available for new mints.
            </p>
            <p>
              Use a Cardano wallet extension on desktop, or open this link in
              VESPR or Eternl’s mobile dApp browser. Some NFT viewers show only
              the cover; download the HTML attachment to play and export beats.
            </p>
          </details>
        </section>
      </div>
      <section className="kayfabe-lab">
        <div>
          <p className="eyebrow">
            <Music2 size={16} /> THIS CARD MAKES BEATS
          </p>
          <h2>
            Play it.
            <br />
            <em>Make it yours.</em>
          </h2>
          <p>
            Tap a groove. Change the drums and tempo. Save four bars as a WAV.
            The complete app travels with your collectible and works offline.
          </p>
          <a
            href={assetPath('/art/kayfabe/beat-lab.html')}
            className="text-link"
            download
          >
            <Download size={16} /> Download Beat Lab
          </a>
          <p className="kayfabe-note">
            This is a public tool. You can try it here without a wallet or a
            mint.
          </p>
        </div>
        <iframe
          id="kayfabe-demo"
          title="KAYFABE Beat Lab"
          sandbox="allow-scripts allow-downloads"
          referrerPolicy="no-referrer"
          srcDoc={html}
        />
      </section>
      <footer className="kayfabe-footer">
        <a href="?">
          Bring your own image. Build your own NFT. <ArrowUpRight size={16} />
        </a>
        <span>BMKR × BEACN / CHICAGO</span>
      </footer>
    </main>
  );
}
