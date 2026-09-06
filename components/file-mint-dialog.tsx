'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Wallet,
  Download,
  CheckCircle2,
  RefreshCw,
  LoaderCircle,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import {
  ada,
  assertFreshReview,
  assertWalletUnchanged,
  errorText,
  fetchProtocol,
  findWallets,
  loadCSL,
  mergeAndCheckSignatures,
  readWallet,
  type WalletAPI,
} from '@/lib/cardano';
import {
  buildStudioTransaction,
  type StudioTransaction,
} from '@/lib/studio-transaction';
import { verifyPayloadBundle, type PayloadBundle } from '@/lib/studio-payload';
import {
  submitTransactionOnce,
  checkTransaction,
  type ChainObservation,
} from '@/lib/studio-submission';
import { saveReceipt, type StudioReceipt } from '@/lib/studio-receipts';
import { download, filename, jsonBlob } from '@/lib/export';
export function FileMintDialog({
  bundle,
  mode,
}: {
  bundle: PayloadBundle;
  mode: 'nft' | 'data';
}) {
  const [open, setOpen] = useState(false),
    [wallets, setWallets] = useState<ReturnType<typeof findWallets>>([]),
    [api, setApi] = useState<WalletAPI | null>(null),
    [walletName, setWalletName] = useState('');
  const [prepared, setPrepared] = useState<StudioTransaction | null>(null),
    [receipt, setReceipt] = useState<StudioReceipt | null>(null),
    [observation, setObservation] = useState<ChainObservation | null>(null),
    [approved, setApproved] = useState(false),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const lock = useRef(false),
    identity = bundle.sha256 + '|' + mode,
    latest = useRef(identity);
  latest.current = identity;
  useEffect(() => {
    setPrepared(null);
    setApproved(false);
  }, [identity]);
  useEffect(() => {
    if (!open) return;
    setWallets(findWallets());
    const t = setInterval(() => setWallets(findWallets()), 5000);
    return () => clearInterval(t);
  }, [open]);
  useEffect(() => {
    if (
      !open ||
      !receipt ||
      receipt.state === 'signed' ||
      receipt.state === 'confirmed'
    )
      return;
    const controller = new AbortController();
    let cancelled = false;
    let count = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await checkTransaction(receipt.hash, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15000),
          ]),
        });
        if (cancelled) return;
        setObservation(result);
        if (result.state === 'confirmed') {
          const confirmed = {
            ...receipt,
            state: 'confirmed',
            checkedAt: result.checkedAt,
            blocksAfterInclusion: result.blocksAfterInclusion,
          };
          setReceipt(confirmed);
          try {
            saveReceipt(confirmed);
          } catch {
            setError(
              'Confirmed on chain. Export your receipt because browser storage could not be updated.',
            );
          }
          return;
        }
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      }
      if (!cancelled && ++count < 30) timer = setTimeout(poll, 10000);
    };
    void poll();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [receipt?.hash, receipt?.state, open]);
  const run = async (label: string, action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy('');
    }
  };
  const connect = (id: string) =>
    run('Connecting…', async () => {
      const w = wallets.find((w) => w.id === id);
      if (!w) throw new Error('Refresh your wallet list.');
      const next = await w.provider.enable();
      await readWallet(next);
      setApi(next);
      setWalletName(w.provider.name);
      setPrepared(null);
      setApproved(false);
    });
  const prepare = () =>
    run('Building your exact transaction…', async () => {
      if (!api) return;
      setPrepared(null);
      setApproved(false);
      const snapshot = latest.current;
      const [C, w, p] = await Promise.all([
        loadCSL(),
        readWallet(api),
        fetchProtocol(),
      ]);
      const tx = await buildStudioTransaction(C, bundle, mode, w, p);
      if (snapshot !== latest.current)
        throw new Error('Your content changed. Review again.');
      setPrepared(tx);
    });
  const sign = () =>
    run('Approve in your wallet…', async () => {
      if (!api || !prepared || !approved || receipt) return;
      const snapshot = latest.current;
      const [C, live, wallet] = await Promise.all([
        loadCSL(),
        fetchProtocol(),
        readWallet(api),
      ]);
      assertFreshReview(prepared, live);
      assertWalletUnchanged(C, prepared, wallet);
      await verifyPayloadBundle(bundle);
      if (
        snapshot !== latest.current ||
        prepared.bundle.sha256 !== bundle.sha256
      )
        throw new Error('Content changed. Review again.');
      if (!mounted.current)
        throw new Error('The creator was closed. Nothing was signed.');
      const witness = await api.signTx(prepared.unsignedHex, true);
      const [after, state] = await Promise.all([
        fetchProtocol(),
        readWallet(api),
      ]);
      assertWalletUnchanged(C, prepared, state);
      if (snapshot !== latest.current)
        throw new Error(
          'Content changed while signing. Nothing was submitted.',
        );
      const signed = mergeAndCheckSignatures(C, prepared, witness, after);
      if (!mounted.current)
        throw new Error('The creator was closed. Nothing was submitted.');
      const record: StudioReceipt = {
        schema: 'nft-studio.receipt.v1',
        hash: signed.hash,
        kind: mode,
        name: bundle.name,
        createdAt: Date.now(),
        state: 'signed',
        metadata: prepared.metadata,
        bytes: signed.hex.length / 2,
        signedHex: signed.hex,
        prepared,
      };
      setReceipt(record);
      saveReceipt(record);
      setBusy('Submitting once…');
      const result = await submitTransactionOnce({
        hash: signed.hash,
        submit: () => {
          if (!mounted.current) throw new Error('Creator closed.');
          return api.submitTx(signed.hex);
        },
      });
      const finished = { ...record, state: result.attempt.state };
      setReceipt(finished);
      try {
        saveReceipt(finished);
      } catch {
        setError(
          'Export this receipt now. Local receipt storage could not be updated.',
        );
      }
    });
  return (
    <>
      <Button className="ns-primary" onClick={() => setOpen(true)}>
        <Wallet size={18} />
        Review with my wallet
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!lock.current) setOpen(value);
        }}
      >
        <DialogContent
          className="mint-dialog ns-file-mint"
          showCloseButton={!busy}
        >
          <DialogTitle>
            {receipt ? 'Your transaction receipt' : 'The final review'}
          </DialogTitle>
          <DialogDescription>
            {receipt
              ? 'Keep the transaction ID. Check its status before creating another copy.'
              : 'Your files stay exact. Your wallet signs only after you review the complete transaction.'}
          </DialogDescription>
          {error && (
            <p role="alert" className="ns-error">
              {error}
            </p>
          )}
          {receipt ? (
            <div className="ns-receipt">
              <CheckCircle2 size={36} />
              <h3>
                {observation?.state === 'confirmed'
                  ? 'Confirmed on chain'
                  : receipt.state === 'submitted'
                    ? 'Submitted · awaiting inclusion'
                    : receipt.state === 'signed'
                      ? 'Signed · submission not completed'
                      : 'Submission response unclear'}
              </h3>
              <p>
                {observation?.state === 'confirmed'
                  ? `Observed in a block, with ${observation.blocksAfterInclusion} subsequent blocks. Chain inclusion can still change.`
                  : 'Check the saved ID. An unavailable reader or slow wallet response does not prove rejection.'}
              </p>
              <code>{receipt.hash}</code>
              <div className="ns-button-row">
                <Button
                  onClick={() =>
                    download(
                      jsonBlob(receipt),
                      filename(bundle.name) + '.receipt.json',
                    )
                  }
                >
                  <Download size={16} />
                  Save receipt
                </Button>
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() =>
                    run('Checking chain…', async () => {
                      const result = await checkTransaction(receipt.hash);
                      setObservation(result);
                      if (result.state === 'confirmed') {
                        const confirmed = {
                          ...receipt,
                          state: 'confirmed',
                          checkedAt: result.checkedAt,
                          blocksAfterInclusion: result.blocksAfterInclusion,
                        };
                        setReceipt(confirmed);
                        saveReceipt(confirmed);
                      }
                    })
                  }
                >
                  <RefreshCw size={16} />
                  Check status
                </Button>
                <a
                  className="ns-text-link"
                  href={'https://cardanoscan.io/transaction/' + receipt.hash}
                  target="_blank"
                  rel="noreferrer"
                >
                  Explorer
                  <ArrowUpRight size={16} />
                </a>
              </div>
            </div>
          ) : !api ? (
            <div className="ns-wallet-options">
              {wallets.length ? (
                wallets.map((w) => (
                  <Button
                    variant="outline"
                    key={w.id}
                    disabled={!!busy}
                    onClick={() => connect(w.id)}
                  >
                    <Wallet size={17} />
                    {w.provider.name}
                  </Button>
                ))
              ) : (
                <p>
                  Open this site in a Cardano wallet browser, or use a desktop
                  browser with a CIP-30 wallet extension. Your work is ready to
                  export while you set that up.
                </p>
              )}
              <Button variant="ghost" onClick={() => setWallets(findWallets())}>
                <RefreshCw size={16} />
                Refresh wallets
              </Button>
            </div>
          ) : (
            <>
              <p className="ns-connected">
                <Wallet size={16} />
                {walletName} · mainnet
              </p>
              {prepared ? (
                <>
                  <dl className="ns-tx-facts">
                    <div>
                      <dt>Creation</dt>
                      <dd>{bundle.name}</dd>
                    </div>
                    <div>
                      <dt>Action</dt>
                      <dd>
                        {mode === 'nft'
                          ? 'Mint one token'
                          : 'Publish a data record · no token'}
                      </dd>
                    </div>
                    <div>
                      <dt>Network fee</dt>
                      <dd>{ada(prepared.fee)} ADA</dd>
                    </div>
                    <div>
                      <dt>ADA kept with NFT</dt>
                      <dd>{ada(prepared.minimumAda)} ADA</dd>
                    </div>
                    <div>
                      <dt>Complete signed estimate</dt>
                      <dd>
                        {prepared.signedEstimate.toLocaleString()} /{' '}
                        {Math.min(
                          prepared.protocol.maxTx,
                          16384,
                        ).toLocaleString()}{' '}
                        bytes
                      </dd>
                    </div>
                    <div>
                      <dt>Destination</dt>
                      <dd className="ns-break">{prepared.address}</dd>
                    </div>
                  </dl>
                  {mode === 'nft' && (
                    <p className="ns-fineprint">
                      This transaction mints one token. The wallet-controlled
                      policy closes about one hour after preparation; it can
                      mint more before closing and cannot mint or burn
                      afterward. This is not an enforced lifetime supply cap.
                    </p>
                  )}
                  <details className="ns-metadata">
                    <summary>Exact transaction metadata & files</summary>
                    <pre>{JSON.stringify(prepared.metadata, null, 2)}</pre>
                  </details>
                  <div className="ns-button-row">
                    <Button
                      variant="outline"
                      onClick={() =>
                        download(
                          jsonBlob({
                            schema: 'nft-studio.review.v1',
                            ...prepared,
                          }),
                          filename(bundle.name) + '.review.json',
                        )
                      }
                    >
                      <Download size={16} />
                      Export review
                    </Button>
                    <Button variant="ghost" disabled={!!busy} onClick={prepare}>
                      Refresh quote
                    </Button>
                  </div>
                  <label className="ns-check">
                    <input
                      type="checkbox"
                      checked={approved}
                      onChange={(e) => setApproved(e.target.checked)}
                      disabled={!!busy}
                    />
                    I reviewed the exact files, destination, fee and publishing
                    rules. This content will be public.
                  </label>
                  <Button
                    className="ns-primary"
                    disabled={!approved || !!busy}
                    onClick={sign}
                  >
                    <Wallet size={17} />
                    Sign & submit
                  </Button>
                </>
              ) : (
                <>
                  <p>
                    Build against your current wallet inputs and live network
                    parameters. Building does not request a signature.
                  </p>
                  <Button
                    className="ns-primary"
                    disabled={!!busy}
                    onClick={prepare}
                  >
                    Build the review
                  </Button>
                </>
              )}
            </>
          )}
          {busy && (
            <p role="status" className="ns-busy">
              <LoaderCircle size={16} className="spin" />
              {busy}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
