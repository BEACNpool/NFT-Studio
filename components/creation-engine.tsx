'use client';
// Exact NFT bytes must not be optimized; full navigation resets query/fragment-driven studio state.
/* oxlint-disable next/no-img-element, next/no-html-link-for-pages */
import { useMemo, useState } from 'react';
import { ArrowUpRight, Download, Palette, ArrowLeft } from 'lucide-react';
import { MintDialog } from './mint-dialog';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { assetPath } from '@/lib/paths';
import type { Artwork } from '@/lib/art';
import type { OnchainImage } from '@/lib/onchain-art';
import campaign from '@/lib/creation-engine.json';
import { verifyHandleDestination } from '@/lib/handle';

async function verifyDestination() {
  await verifyHandleDestination(campaign.handle, campaign.recipient);
}

export function CreationEngine() {
  const [choice, setChoice] = useState('detail');
  const profile = campaign.profiles.find((p) => p.id === choice)!;
  const image = profile.image as OnchainImage;
  const art = useMemo(
    () => ({ ...campaign.artwork, customImage: image.uri }) as Artwork,
    [image],
  );
  return (
    <main className="creation-engine">
      <header className="creation-header">
        <a href="?" className="creation-brand">
          BMKR <span>BY BEACN</span>
        </a>
        <a className="text-link" href="?">
          <ArrowLeft size={16} /> Back to studio
        </a>
      </header>
      <div className="creation-layout">
        <figure className="creation-image">
          <img
            src={image.uri}
            width={image.width}
            height={image.width}
            alt="BMKR Creation Engine: cyan and violet glass loops surrounding a gold core, with YOUR ART. ON CHAIN. lettering"
          />
          <figcaption>
            <span>EXACT IMAGE FOR THIS MINT</span>
            <span>
              {image.width} × {image.width} · {image.bytes.toLocaleString()}{' '}
              bytes
            </span>
          </figcaption>
        </figure>
        <section className="creation-controls">
          <p className="eyebrow">BMKR / CREATION ENGINE</p>
          <h1>
            Beauty, inside
            <br />
            the transaction.
          </h1>
          <p className="creation-lead">
            The ad becomes the artwork. Its image, color palette and editable
            starter link travel with the NFT.
          </p>
          <RadioGroup
            className="creation-formats"
            value={choice}
            onValueChange={setChoice}
            aria-label="Artwork encoding"
          >
            {campaign.profiles.map((p) => (
              <label
                key={p.id}
                htmlFor={'format-' + p.id}
                className={choice === p.id ? 'selected' : ''}
              >
                <RadioGroupItem value={p.id} id={'format-' + p.id} />
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.image.width}px ·{' '}
                    {p.image.mediaType === 'image/avif' ? 'AVIF' : 'WebP'} ·{' '}
                    {(p.image.bytes / 1024).toFixed(2)} KiB
                  </small>
                </span>
              </label>
            ))}
          </RadioGroup>
          <p className="creation-format-note">
            AVIF keeps more detail in this image. Wallet thumbnail support
            varies; WebP uses the same format as the confirmed BEACN PFP.
          </p>
          <div className="creation-mint">
            <span className="eyebrow">PREPARED FOR $BEACNLEAKS</span>
            <p>
              Connect that wallet to prepare the exact size, fee and
              destination. The full transaction stays below 16,384 bytes.
            </p>
            <MintDialog
              art={art}
              pinnedImage={image}
              requiredAddress={campaign.recipient}
              destinationLabel="$BEACNLEAKS"
              verifyDestination={verifyDestination}
            />
            <p className="creation-wallet-note">
              Mobile: open this page in VESPR or Eternl’s dApp browser. Desktop:
              use your wallet extension. Signing happens in your wallet.
            </p>
          </div>
          <details className="creation-details">
            <summary>What this mint contains</summary>
            <p>
              One token, the complete{' '}
              {image.mediaType === 'image/avif' ? 'AVIF' : 'WebP'} image,
              palette and public remix link. No external image storage. No extra
              service fee. The normal network fee and the ADA held with the NFT
              are shown before you sign.
            </p>
            <p>
              The minting policy requires your signature and expires after one
              hour. It does not guarantee a lifetime supply of one; after expiry
              it permits neither minting nor burning.
            </p>
            <p className="creation-address">
              Destination: {campaign.recipient}
            </p>
          </details>
        </section>
      </div>
      <section className="creation-utility">
        <div>
          <p className="eyebrow">
            <Palette size={16} /> UTILITY YOU CAN USE NOW
          </p>
          <h2>
            Start with a spark.
            <br />
            Make something yours.
          </h2>
          <p>
            Open an editable BMKR canvas with gold typography, cyan corners and
            a violet backdrop. Change the words, draw your own marks and export
            your creation. The recipe is carried in the remix link embedded with
            the NFT.
          </p>
          <div className="creation-actions">
            <a className="btn primary" href={campaign.remixUrl}>
              Open the remix starter <ArrowUpRight size={17} />
            </a>
            <a
              className="btn secondary"
              href={assetPath(
                '/art/creation-engine/BMKR-remix-starter.prism.json',
              )}
              download
            >
              <Download size={17} /> Editable project
            </a>
          </div>
          <p className="creation-format-note">
            Public creative utility: anyone can use it. No holder gate,
            membership promise or redemption required.
          </p>
        </div>
        <img
          className="creation-starter"
          src={assetPath('/art/creation-engine/BMKR-remix-starter.png')}
          width="1024"
          height="1024"
          alt="Editable gold MAKE IT ON CHAIN text, violet backdrop and cyan frame"
        />
      </section>
      <footer className="creation-footer">
        <a
          href={assetPath(
            `/art/creation-engine/BMKR-ONCHAIN-${image.width}.png`,
          )}
          download
        >
          <Download size={16} /> Download this {image.width}px image for your
          post
        </a>
        <a href="?">
          Create your own NFT <ArrowUpRight size={16} />
        </a>
      </footer>
    </main>
  );
}
