'use client';
import { useEffect, useRef, useState, useId } from 'react';
import QRCode from 'qrcode';
import { Download, Copy, Printer, QrCode, Check, Share2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { PhoneHandoff } from './phone-handoff';
import { FileMintDialog } from './file-mint-dialog';
import { WalletBrowserHelp } from './studio-wallet';
import { createMintIntent, type MintIntent } from '@/lib/studio-intent';
import { createPayloadQr } from '@/lib/studio-payload-qr';
import { createMintReviewUrl } from '@/lib/studio-review-link';
import {
  DEFAULT_MINT_OPTIONS,
  verifyMintOptions,
  UTILITY_CHOICES,
} from '@/lib/studio-mint-options';
import { type PayloadBundle } from '@/lib/studio-payload';
import { download, filename, jsonBlob } from '@/lib/export';
import { errorText } from '@/lib/cardano';

export function FileCreationControls({
  bundle,
  mode,
}: {
  bundle: PayloadBundle;
  mode: 'nft' | 'data';
}) {
  const [intent, setIntent] = useState<MintIntent | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setIntent(null);
    void createMintIntent(bundle, mode).then(
      (v) => {
        if (active) setIntent(v);
      },
      (e) => {
        if (active) setError(errorText(e));
      },
    );
    return () => {
      active = false;
    };
  }, [bundle, mode]);
  return intent ? (
    <CreationControls initialIntent={intent} />
  ) : (
    <p role="status">{error || 'Preparing creation options…'}</p>
  );
}
export function CreationControls({
  initialIntent,
  phoneUrl,
  phoneExpiresAt,
}: {
  initialIntent: MintIntent;
  phoneUrl?: string;
  phoneExpiresAt?: number;
}) {
  const controlId = useId();
  const [intent, setIntent] = useState(initialIntent);
  const defaults = intent.mintOptions || DEFAULT_MINT_OPTIONS;
  const [quantity, setQuantity] = useState(String(defaults.quantity));
  const [hours, setHours] = useState(String(defaults.mintWindowHours));
  const [traits, setTraits] = useState(
    Object.entries(defaults.traits).map(([name, value]) => ({ name, value })),
  );
  const [message, setMessage] = useState(defaults.message);
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [qrOpen, setQrOpen] = useState(false),
    [qr, setQr] = useState<{
      url: string;
      png: string;
      svg: string;
      bytes: number;
    } | null>(null);
  const [notice, setNotice] = useState(''),
    [reviewUrl, setReviewUrl] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    const n = ++generation.current;
    setQr(null);
    setReviewUrl('');
    setNotice('');
    void createPayloadQr(intent)
      .then(
        (v) => v.url,
        () =>
          createMintReviewUrl(
            intent,
            'https://beacnpool.github.io/NFT-Studio/',
          ),
      )
      .then((url) => {
        if (n === generation.current) setReviewUrl(url);
      });
    return () => {
      ++generation.current;
    };
  }, [intent]);
  const changed = () => {
    ++generation.current;
    setDirty(true);
    setError('');
    setQr(null);
    setNotice('');
  };
  async function apply() {
    const current = ++generation.current;
    setBusy(true);
    setError('');
    try {
      if (
        traits.some((t) => !t.name.trim()) ||
        new Set(traits.map((t) => t.name)).size !== traits.length
      )
        throw Error('Give every trait a unique name.');
      const options = verifyMintOptions({
        quantity: Number(quantity),
        mintWindowHours: Number(hours),
        traits: Object.fromEntries(traits.map((t) => [t.name, t.value])),
        message,
      });
      const next = await createMintIntent(intent.bundle, intent.mode, options);
      if (current !== generation.current) return;
      setIntent(next);
      setDirty(false);
      setNotice('Options applied to this request and all new share codes.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function makeQr() {
    const current = ++generation.current;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await createPayloadQr(intent);
      const segments = [
        { data: new TextEncoder().encode(result.url), mode: 'byte' as const },
      ];
      const code = QRCode.create(segments, { errorCorrectionLevel: 'M' });
      const opts = {
        errorCorrectionLevel: 'M' as const,
        margin: 4,
        width: (code.modules.size + 8) * 6,
        color: { dark: '#000000', light: '#ffffff' },
      };
      const [png, svg] = await Promise.all([
        QRCode.toDataURL(segments, opts),
        QRCode.toString(segments, { ...opts, type: 'svg' }),
      ]);
      if (current !== generation.current) return;
      setQr({ url: result.url, png, svg, bytes: result.encodedBytes });
      setQrOpen(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(
        'Link copied. Anyone with it can read and forward this creation.',
      );
    } catch {
      setNotice('Copy the complete link from the field below.');
    }
  }
  useEffect(() => {
    document.body.classList.toggle('ns-print-payload', qrOpen);
    return () => document.body.classList.remove('ns-print-payload');
  }, [qrOpen]);
  const same = intent.intentHash === initialIntent.intentHash;
  const walletUrl = same && phoneUrl ? phoneUrl : reviewUrl;
  return (
    <div className="ns-creation-controls">
      <details className="ns-lab-details ns-utility-picker">
        <summary>Add a useful capability</summary>
        <p className="ns-lab-muted">
          Utility comes from a working program, service or contract. Choose the
          route that delivers the action.
        </p>
        <div className="ns-utility-grid">
          {UTILITY_CHOICES.map((x) => (
            <article key={x.id}>
              <span className="ns-lab-kicker">{x.status}</span>
              <h4>{x.title}</h4>
              <p>{x.detail}</p>
              <a
                href={
                  x.route === 'apps'
                    ? '?create=utility'
                    : `?view=labs&lab=${x.route === 'capsules' ? 'capsule' : x.route}`
                }
                target="_blank"
                rel="noreferrer"
              >
                Open {x.title.toLowerCase()} ↗
              </a>
            </article>
          ))}
        </div>
      </details>
      {intent.mode === 'nft' && (
        <details className="ns-lab-details ns-mint-options">
          <summary>
            Mint options · {defaults.quantity}{' '}
            {defaults.quantity === 1 ? 'copy' : 'copies'} ·{' '}
            {defaults.mintWindowHours}h policy
          </summary>
          <div className="ns-options-grid">
            <label className="ns-field" htmlFor={controlId+'-quantity'}>
              Copies in this transaction
              <Input
                id={controlId+'-quantity'}
                aria-label="Copies in this transaction"
                type="number"
                min={1}
                max={1000}
                step={1}
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  changed();
                }}
              />
            </label>
            <label className="ns-field" htmlFor={controlId+'-window'}>
              Policy closes after preparation
              <Select
                value={hours}
                onValueChange={(v) => {
                  if (v) {
                    setHours(v);
                    changed();
                  }
                }}
              >
                <SelectTrigger id={controlId+'-window'} aria-label="Policy closes after preparation">
                  <SelectValue>{({'1':'1 hour','24':'24 hours','168':'7 days','720':'30 days'} as Record<string,string>)[hours]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[
                    ['1', '1 hour'],
                    ['24', '24 hours'],
                    ['168', '7 days'],
                    ['720', '30 days'],
                  ].map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <p className="ns-lab-muted">
            All copies go to your wallet and share one asset identity. This is not a lifetime cap. The policy clock starts at preparation; each wallet mints its own asset.
          </p>
          <div className="ns-trait-header">
            <h4>
              Public traits <small>CIP-25</small>
            </h4>
            <Button
              size="sm"
              variant="outline"
              disabled={traits.length >= 12}
              onClick={() => {
                setTraits([...traits, { name: '', value: '' }]);
                changed();
              }}
            >
              Add trait
            </Button>
          </div>
          {traits.map((t, i) => (
            <div className="ns-trait-row" key={i}>
              <Input
                aria-label={`Trait ${i + 1} name`}
                placeholder="Trait name"
                value={t.name}
                maxLength={64}
                onChange={(e) => {
                  setTraits(
                    traits.map((v, j) =>
                      j === i ? { ...v, name: e.target.value } : v,
                    ),
                  );
                  changed();
                }}
              />
              <Input
                aria-label={`Trait ${i + 1} value`}
                placeholder="Value"
                value={t.value}
                maxLength={64}
                onChange={(e) => {
                  setTraits(
                    traits.map((v, j) =>
                      j === i ? { ...v, value: e.target.value } : v,
                    ),
                  );
                  changed();
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove trait ${i + 1}`}
                onClick={() => {
                  setTraits(traits.filter((_, j) => j !== i));
                  changed();
                }}
              >
                Remove
              </Button>
            </div>
          ))}
          <label className="ns-field" htmlFor={controlId+'-message'}>
            Public transaction message · CIP-20
            <Input
              id={controlId+'-message'}
              value={message}
              maxLength={64}
              onChange={(e) => {
                setMessage(e.target.value);
                changed();
              }}
              placeholder="Optional message · up to 64 UTF-8 bytes"
            />
          </label>
          <p className="ns-lab-muted">
            Traits and messages are public descriptions. They do not enforce
            holder access, royalties or ticket redemption. After the policy
            closes, ordinary transfers still work; minting and burning stop.
          </p>
          <Button disabled={!dirty || busy} onClick={() => void apply()}>
            <Check size={16} /> Apply mint options
          </Button>
        </details>
      )}
      {dirty && (
        <p role="status" className="ns-lab-muted">
          Apply your changes before sharing or opening wallet review.
        </p>
      )}
      {error && (
        <p role="alert" className="ns-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="ns-lab-muted">
          {notice}
        </p>
      )}
      {!dirty && !busy && (
        <>
          <div className="ns-share-choices">
            <div>
              <h4>Continue privately</h4>
              <p>Encrypted phone handoff · expires in 15 minutes.</p>
              <PhoneHandoff key={intent.intentHash} intent={intent} />
            </div>
            <div>
              <h4>Print & pass it on</h4>
              <p>Small public payload inside the QR · no transfer expiry.</p>
              <Button variant="outline" onClick={() => void makeQr()}>
                <QrCode size={18} /> Print & share payload QR
              </Button>
            </div>
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
              <Download size={17} /> Save request
            </Button>
            <FileMintDialog
              key={intent.intentHash}
              bundle={intent.bundle}
              mode={intent.mode}
              mintOptions={intent.mintOptions}
              walletBrowserUrl={walletUrl || undefined}
              walletBrowserExpiresAt={same ? phoneExpiresAt : undefined}
            />
          </div>
          {walletUrl && (
            <WalletBrowserHelp
              reviewUrl={walletUrl}
              expiresAt={same ? phoneExpiresAt : undefined}
            />
          )}
          {intent.mintOptions && (
            <p className="ns-lab-muted">
              Advanced options are saved in your request and full receipt. The
              original Artifact Passport profile does not support these advanced
              receipts; use Recovery for exact files.
            </p>
          )}
          <details className="ns-lab-details">
            <summary>Current request identity</summary>
            <code className="ns-wrap-code">{intent.intentHash}</code>
          </details>
        </>
      )}
      {busy && <p role="status">Preparing exact content…</p>}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="ns-phone-dialog ns-payload-qr-dialog">
          <DialogTitle>BEACN Payload QR</DialogTitle>
          <DialogDescription>
            Create. Scan. Carry. The code contains {intent.bundle.name} and its
            mint settings.
          </DialogDescription>
          {notice && <p role="status">{notice}</p>}
          {qr && (
            <>
              <img
                className="ns-phone-qr"
                src={qr.png}
                alt={`Payload QR for ${intent.bundle.name}`}
                width={320}
                height={320}
              />
              <p>
                {qr.bytes.toLocaleString()} / 2,331 encoded bytes · public · no
                transfer expiry
              </p>
              <p className="ns-lab-muted">
                Print it on a card or poster. Anyone can scan, save and forward
                the same creation. Minting is a separate wallet decision; it
                does not transfer your existing NFT.
              </p>
              <div className="ns-button-row">
                <Button onClick={() => void copy(qr.url)}>
                  <Copy size={16} /> Copy link
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    download(
                      new Blob([qr.svg], { type: 'image/svg+xml' }),
                      'payload-qr.svg',
                    )
                  }
                >
                  <Download size={16} /> SVG
                </Button>
                <Button
                  variant="outline"
                  onClick={async () =>
                    download(
                      await (await fetch(qr.png)).blob(),
                      'payload-qr.png',
                    )
                  }
                >
                  <Download size={16} /> PNG
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer size={16} /> Print
                </Button>
                {typeof navigator !== 'undefined' &&
                  typeof navigator.share === 'function' && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        void navigator
                          .share({ title: intent.bundle.name, url: qr.url })
                          .catch(() => {})
                      }
                    >
                      <Share2 size={16} /> Share
                    </Button>
                  )}
              </div>
              <label className="ns-field" htmlFor={controlId+'-payload-link'}>
                Complete payload link
                <Input
                  readOnly
                  id={controlId+'-payload-link'}
                  value={qr.url}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <p className="ns-lab-muted">
                Keep the white border. Print large and test your actual paper
                with the intended phone. The Studio reader must load; wallet
                minting requires internet. Public payloads cannot be revoked.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
