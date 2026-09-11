'use client';
import { useEffect, useState } from 'react';
import {
  Wallet,
  ArrowUpRight,
  Check,
  Copy,
  RefreshCw,
  Smartphone,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { findWallets, errorText } from '@/lib/cardano';

export function WalletBrowserHelp({
  reviewUrl,
  expiresAt,
}: { reviewUrl?: string; expiresAt?: number } = {}) {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [hasWallet, setHasWallet] = useState(false);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    setUrl(reviewUrl || location.href);
    const refresh = () => {
      setHasWallet(findWallets().length > 0);
      setExpired(Boolean(expiresAt && expiresAt <= Date.now()));
    };
    refresh();
    const timer = setInterval(refresh, 1500);
    return () => clearInterval(timer);
  }, [reviewUrl, expiresAt]);
  if (reviewUrl && hasWallet)
    return (
      <p className="ns-lab-muted">
        Your wallet browser is ready. Check this creation, then choose Review
        with my wallet below.
      </p>
    );
  if (reviewUrl && expired)
    return (
      <p className="ns-lab-muted">
        The phone link has expired. You can still review these loaded files
        here. To open them in another browser, create a fresh QR code on your
        computer.
      </p>
    );
  return (
    <div className="ns-browser-help">
      <span className="ns-note-icon">
        <Smartphone size={24} />
      </span>
      <h3>
        {reviewUrl
          ? 'Continue in your mobile wallet.'
          : 'Creating on your phone?'}
      </h3>
      <p>
        {reviewUrl
          ? 'Open this same creation in VESPR’s browser to review and sign.'
          : 'Open this link in VESPR’s browser to create and sign in one place.'}
      </p>
      <a
        className="ns-primary"
        href={
          url
            ? 'web+cardano://browse/v1?uri=' + encodeURIComponent(url)
            : undefined
        }
      >
        Open in wallet browser <ArrowUpRight size={16} />
      </a>
      <Button
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setError('');
          } catch {
            setError(
              reviewUrl
                ? 'Clipboard unavailable. Open your original QR link inside VESPR’s browser.'
                : 'Copy the address from your browser’s address bar.',
            );
          }
        }}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
        {copied
          ? 'Link copied'
          : reviewUrl
            ? 'Copy creation link'
            : 'Copy app link'}
      </Button>
      <small>
        {reviewUrl
          ? 'Choose VESPR if Android asks. If the button does not open your wallet, copy the creation link and paste it into VESPR’s browser.'
          : 'Your phone chooses the wallet app. Start there before uploading; drafts stay in the browser where you create them.'}
      </small>
      {error && <p role="status">{error}</p>}
    </div>
  );
}
export function StudioWallet() {
  const [open, setOpen] = useState(false);
  const [wallets, setWallets] = useState<ReturnType<typeof findWallets>>([]);
  const [connected, setConnected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    const refresh = () => setWallets(findWallets());
    refresh();
    const timer = setInterval(refresh, 1500);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [open]);
  return (
    <>
      <button
        className={'ns-wallet-button' + (connected ? ' is-connected' : '')}
        onClick={() => setOpen(true)}
        aria-label={connected ? `Wallet: ${connected}` : 'Connect wallet'}
      >
        <Wallet size={17} />
        <span>{connected || 'Wallet'}</span>
        {connected && <span className="ns-wallet-dot" />}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="ns-wallet-dialog">
          <DialogTitle>
            {connected
              ? 'Wallet access approved'
              : 'Your wallet, your signature'}
          </DialogTitle>
          <DialogDescription>
            Connect now or keep creating. You’ll review the content and cost
            before approving any transaction.
          </DialogDescription>
          {connected && (
            <p className="ns-wallet-approved">
              <Check size={18} />
              {connected} approved this studio. Your account and network are
              checked again at mint review.
            </p>
          )}
          {wallets.length > 0 ? (
            <div className="ns-wallet-choices">
              {wallets.map((w) => (
                <Button
                  variant="outline"
                  key={w.id}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError('');
                    try {
                      const api = await w.provider.enable();
                      if ((await api.getNetworkId()) !== 1)
                        throw Error(
                          'Switch to Cardano mainnet, then connect again.',
                        );
                      setConnected(w.provider.name);
                    } catch (e) {
                      setError(errorText(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Wallet size={20} />
                  <span>{busy ? 'Waiting for wallet…' : w.provider.name}</span>
                  <ArrowUpRight size={16} />
                </Button>
              ))}
            </div>
          ) : (
            <WalletBrowserHelp />
          )}
          {error && (
            <p className="ns-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="ns-refresh-wallet"
            onClick={() => setWallets(findWallets())}
          >
            <RefreshCw size={15} /> Refresh wallets
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
