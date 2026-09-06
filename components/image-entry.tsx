'use client';
// Static exports use native images and a full navigation to select the campaign.
/* oxlint-disable next/no-img-element, next/no-html-link-for-pages */
import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Paintbrush,
  Sparkles,
  Upload,
  FileJson,
} from 'lucide-react';
import { Button } from './ui/button';
import { assetPath } from '@/lib/paths';

export function ImageEntry({
  busy,
  error,
  onChoose,
  onDrop,
  onDropError,
  onBlank,
  onExplore,
  onImport,
}: {
  busy: boolean;
  error: string;
  onChoose: () => void;
  onDrop: (file: File) => void;
  onDropError: (message: string) => void;
  onBlank: () => void;
  onExplore: () => void;
  onImport: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <section className="image-entry" aria-labelledby="image-entry-title">
      <div className="image-entry-main">
        <div className="image-entry-copy">
          <p className="eyebrow">
            <span /> YOUR IMAGE → CARDANO NFT
          </p>
          <h1 id="image-entry-title">
            Your image.
            <br />
            <em>Your NFT.</em>
          </h1>
          <p className="image-entry-lead">
            A photo. Your art. That perfect PFP.
            <br />
            Turn an image you love into an on-chain NFT.
          </p>
        </div>
        <div
          className={'image-picker' + (dragging ? ' is-dragging' : '')}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes('Files')) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = busy ? 'none' : 'copy';
            if (!busy) setDragging(true);
          }}
          onDragLeave={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (busy) return;
            if (event.dataTransfer.files.length !== 1) {
              onDropError('Choose one image at a time.');
              return;
            }
            onDrop(event.dataTransfer.files[0]);
          }}
          aria-busy={busy}
        >
          <span className="image-picker-icon" aria-hidden="true">
            <ImagePlus size={40} strokeWidth={1.4} />
          </span>
          <h2>{dragging ? 'Drop your image here' : 'Start with your image'}</h2>
          <p className="image-picker-intro">
            Pick a photo or artwork from your device.
          </p>
          <Button
            className="btn primary image-upload-primary"
            disabled={busy}
            onClick={onChoose}
            aria-describedby="image-file-hint image-privacy"
          >
            {busy ? (
              <LoaderCircle className="spinner" size={20} />
            ) : (
              <Upload size={20} />
            )}
            {busy ? 'Opening your image…' : 'Choose an image'}
            {!busy && <ArrowRight size={20} />}
          </Button>
          <p className="image-drop-hint">or drag and drop it here</p>
          <p className="image-file-hint" id="image-file-hint">
            PNG, JPG or WebP · Up to 12 MB
          </p>
          {error && (
            <p className="image-upload-error" role="alert">
              {error}
            </p>
          )}
          <p className="image-privacy" id="image-privacy">
            <LockKeyhole size={15} /> Stays in your browser until you mint.
          </p>
          <p className="image-wallet-note">
            No wallet needed to start creating.
          </p>
        </div>
        <ol className="image-steps" aria-label="How to create your NFT">
          <li>
            <span>1</span>
            <div>
              <strong>Choose your image</strong>
              <p>Start with a file from your device.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Make it yours</strong>
              <p>Add text, draw or keep it as it is.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Review & mint</strong>
              <p>Check the final image. Approve in your wallet.</p>
            </div>
          </li>
        </ol>
      </div>
      <a className="kayfabe-entry" href="?mint=kayfabe">
        <img
          src={assetPath('/art/kayfabe/onchain-512.png')}
          width="72"
          height="72"
          alt="Lil Rogers with his gold grill"
        />
        <span>
          <small>BMKR × BEACN / OPEN MINT</small>
          <strong>Lil Rogers — KAYFABE</strong>
          <small>Mint the card. Play its Beat Lab. 0 BMKR fee.</small>
        </span>
        <b>
          Mint your own <ArrowUpRight size={16} />
        </b>
      </a>
      <div className="image-onchain-note">
        <Check size={17} />
        <p>
          The final image lives on Cardano. You review its size and quality
          before minting.
        </p>
      </div>
      <div className="other-starts">
        <div className="other-starts-heading">
          <h2>Another way to start</h2>
          <p>Your canvas. Your call.</p>
        </div>
        <div className="other-starts-grid">
          <button onClick={onBlank} disabled={busy}>
            <Paintbrush size={22} />
            <span>
              <strong>Start from scratch</strong>
              <small>A blank canvas for your ideas</small>
            </span>
            <ArrowUpRight size={18} />
          </button>
          <button onClick={onExplore} disabled={busy}>
            <Sparkles size={22} />
            <span>
              <strong>Explore art starters</strong>
              <small>Remix a design or generate art</small>
            </span>
            <ArrowUpRight size={18} />
          </button>
          <button onClick={onImport} disabled={busy}>
            <FileJson size={22} />
            <span>
              <strong>Open a saved project</strong>
              <small>Continue an editable PRISM file</small>
            </span>
            <ArrowUpRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
