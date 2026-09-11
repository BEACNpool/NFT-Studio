'use client';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, LoaderCircle, QrCode, Smartphone } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import {
  createPhoneTransfer,
  revokePhoneTransfer,
  type PhoneTransfer,
} from '@/lib/studio-handoff';
import { type MintIntent } from '@/lib/studio-intent';
import { errorText } from '@/lib/cardano';

export function PhoneHandoff({ intent }: { intent: MintIntent }) {
  const [open, setOpen] = useState(false);
  const [transfer, setTransfer] = useState<PhoneTransfer | null>(null);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const mounted = useRef(true);
  const locked = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!transfer || !open) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [transfer, open]);
  const remaining = transfer
    ? Math.max(0, Math.ceil((transfer.expiresAt - now) / 1000))
    : 0;
  async function create() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setCopied(false);
    try {
      const result = await createPhoneTransfer(intent);
      if (!mounted.current) {
        void revokePhoneTransfer(result).catch(() => {});
        return;
      }
      const png = await QRCode.toDataURL(result.url, {
        errorCorrectionLevel: 'M',
        margin: 4,
        width: 528,
        color: { dark: '#11111b', light: '#ffffff' },
      });
      if (!mounted.current) {
        void revokePhoneTransfer(result).catch(() => {});
        return;
      }
      setTransfer(result);
      setQr(png);
      setNow(Date.now());
    } catch (cause) {
      if (mounted.current) setError(errorText(cause));
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function end() {
    if (!transfer || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      await revokePhoneTransfer(transfer);
      setTransfer(null);
      setQr('');
      setCopied(false);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setNow(Date.now());
          setOpen(true);
        }}
      >
        <Smartphone size={18} /> Continue on phone
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="ns-phone-dialog">
          <span className="ns-lab-kicker">
            <Smartphone size={18} /> DESKTOP → PHONE
          </span>
          <DialogTitle>Same creation. Your mobile wallet.</DialogTitle>
          <DialogDescription>
            Bring {intent.bundle.name} to your phone, then review and mint in
            your wallet.
          </DialogDescription>
          {transfer && remaining > 0 ? (
            <>
              <img
                className="ns-phone-qr"
                src={qr}
                alt={`Scan to open ${intent.bundle.name} on your phone`}
                width={264}
                height={264}
              />
              <ol className="ns-phone-steps">
                <li>Scan with your phone’s camera.</li>
                <li>Open the creation in your wallet browser.</li>
                <li>Review the files and approve the mint.</li>
              </ol>
              <p className="ns-phone-expiry">
                Link expires in {Math.floor(remaining / 60)}:
                {String(remaining % 60).padStart(2, '0')}
              </p>
              <div className="ns-button-row">
                <Button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(transfer.url);
                      setCopied(true);
                      setError('');
                    } catch {
                      setError(
                        'Clipboard unavailable. Scan the QR code instead.',
                      );
                    }
                  }}
                >
                  {copied ? <Check size={17} /> : <Copy size={17} />}
                  {copied ? 'Link copied' : 'Copy phone link'}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void end()}
                >
                  End transfer
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="ns-phone-start">
                <QrCode size={58} strokeWidth={1} />
                <p>
                  {transfer
                    ? 'This QR code has expired.'
                    : 'One scan takes your creation from computer to phone.'}
                </p>
              </div>
              <Button disabled={busy} onClick={() => void create()}>
                {busy ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : (
                  <QrCode size={18} />
                )}
                {busy
                  ? 'Preparing phone link…'
                  : transfer
                    ? 'Create a fresh QR code'
                    : 'Create QR code'}
              </Button>
            </>
          )}
          <p className="ns-lab-muted ns-phone-privacy">
            Studio uploads an encrypted copy for a 15-minute transfer. Anyone
            with the link can open it until it expires. Wallet access and
            signing stay with you.
          </p>
          {error && (
            <p className="ns-error" role="alert">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
