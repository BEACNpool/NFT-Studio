'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Download,
  LoaderCircle,
  Wallet,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from './ui/button';
import { WalletBrowserHelp } from './studio-wallet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog';
import { ArtPreview } from './art-preview';
import type { Artwork } from '@/lib/art';
import {
  fitOnchainImage,
  verifyPreparedImage,
  type OnchainImage,
} from '@/lib/onchain-art';
import {
  ada,
  assertFreshReview,
  assertWalletUnchanged,
  buildMint,
  errorText,
  fetchProtocol,
  findWallets,
  loadCSL,
  mergeAndCheckSignatures,
  readWallet,
  SizeError,
  STUDIO_TX_CAP,
  type PreparedMint,
  type WalletAPI,
} from '@/lib/cardano';
import { download, filename, jsonBlob } from '@/lib/export';
import { poolAssetUrl } from '@/lib/asset-link';
import { verifyArcade, type ArcadeMedia } from '@/lib/arcade';

import { checkTransaction, submitTransactionOnce } from '@/lib/studio-submission';
import {
  activeMintReceiptHash, dismissMintReceipt, persistMintReceipt, restoreMintReceipt,
  type MintReceipt as Receipt,
} from '@/lib/mint-receipt';

export function MintDialog({
  art,
  disabled,
  pinnedImage,
  arcade,
  requiredAddress,
  destinationLabel,
  verifyDestination,
  triggerLabel = 'Mint on Cardano',
}: {
  art: Artwork;
  triggerLabel?: string;
  disabled?: boolean;
  pinnedImage?: OnchainImage;
  arcade?: ArcadeMedia;
  requiredAddress?: string;
  destinationLabel?: string;
  verifyDestination?: () => Promise<void>;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [open, setOpen] = useState(false),
    [wallets, setWallets] = useState<ReturnType<typeof findWallets>>([]);
  const [connection, setConnection] = useState<{
    api: WalletAPI;
    name: string;
    address: string;
  } | null>(null);
  const [prepared, setPrepared] = useState<PreparedMint | null>(null),
    [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [approved, setApproved] = useState(false),
    [now, setNow] = useState(Date.now());
  const [checking, setChecking] = useState(false),
    [confirmationNote, setConfirmationNote] = useState(''),
    [checkRound, setCheckRound] = useState(0),
    [restoring, setRestoring] = useState(false),
    [restoreError, setRestoreError] = useState('');
  const receiptRef = useRef<Receipt | null>(null);
  const updateReceipt = useCallback((value: Receipt | null) => {
    receiptRef.current = value;
    setReceipt(value);
  }, []);
  const lock = useRef(false),
    fingerprint = JSON.stringify({ art, pinnedImage, arcade }),
    latest = useRef(fingerprint);
  latest.current = fingerprint;
  const fixedImage = arcade?.image || pinnedImage;
  const hasProgram = !!arcade || !!art.interactive;
  const fresh = !!prepared && now - prepared.createdAt < 240000;
  useEffect(() => {
    setPrepared(null);
    setApproved(false);
  }, [fingerprint]);
  useEffect(() => {
    if (!open) return;
    setWallets(findWallets());
    const timer = setInterval(() => {
      setNow(Date.now());
      setWallets(findWallets());
    }, 10000);
    return () => clearInterval(timer);
  }, [open]);
  useEffect(() => {
    if (!open || receiptRef.current) return;
    let cancelled = false;
    setRestoring(true);
    setRestoreError('');
    void (async () => {
      try {
        const hash = activeMintReceiptHash();
        if (!hash) return;
        const C = await loadCSL();
        const saved = restoreMintReceipt(C, hash);
        if (cancelled || receiptRef.current) return;
        updateReceipt(saved);
        setPrepared(null);
        setApproved(false);
      } catch (error) {
        if (!cancelled) setRestoreError(errorText(error));
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, updateReceipt]);
  useEffect(() => {
    if (!open || !receipt?.hash || receipt.broadcastAttempted === false) return;
    const hash = receipt.hash, controller = new AbortController();
    let stopped = false, count = 0, timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (stopped || count >= 12) return;
      count++;
      setChecking(true);
      try {
        const observation = await checkTransaction(hash, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (stopped || receiptRef.current?.hash !== hash) return;
        const current = receiptRef.current;
        const confirmed = observation.state === 'confirmed';
        const next: Receipt = {
          ...current,
          state: confirmed ? 'confirmed' : current.state === 'confirmed' ? 'unknown' : current.state,
          checkedAt: observation.checkedAt,
          blocksAfterInclusion: confirmed ? observation.blocksAfterInclusion : undefined,
        };
        updateReceipt(next);
        try { persistMintReceipt(next); } catch {
          setError('The chain status was read, but its receipt could not be updated locally. Download the receipt now.');
        }
        if (confirmed) {
          setConfirmationNote('Observed in a Cardano block. Further blocks increase settlement confidence.');
          return;
        }
        setConfirmationNote(count >= 12
          ? 'Automatic checks paused after 12 reads. Check again when ready; this never resubmits your transaction.'
          : 'The chain reader has not reported inclusion yet. Checking again shortly.');
      } catch (error) {
        if (stopped) return;
        setConfirmationNote(count >= 12
          ? 'Automatic checks paused. The reader is unavailable; use Check status again or the explorer.'
          : errorText(error) + ' Only the status read will be retried.');
      } finally {
        if (!stopped) setChecking(false);
      }
      if (!stopped && count < 12) timer = setTimeout(poll, 15000);
    };
    void poll();
    return () => { stopped = true; controller.abort(); if (timer) clearTimeout(timer); setChecking(false); };
  }, [open, receipt?.hash, receipt?.broadcastAttempted, checkRound, updateReceipt]);
  const run = async (label: string, action: () => Promise<void>) => {
    if (lock.current || restoring || restoreError) return;
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
    run('Connecting wallet…', async () => {
      const provider = wallets.find((w) => w.id === id)?.provider;
      if (!provider)
        throw new Error(
          'This wallet is no longer available. Refresh the wallet list.',
        );
      const api = await provider.enable(),
        C = await loadCSL(),
        state = await readWallet(api);
      const address = C.Address.from_hex(state.changeHex);
      if (address.network_id() !== 1 || !address.payment_cred()?.to_keyhash())
        throw new Error('Choose a regular Cardano mainnet account.');
      if (requiredAddress && address.to_bech32() !== requiredAddress)
        throw new Error(
          `Connect the ${destinationLabel || 'intended'} account. This prepared edition cannot mint to another address.`,
        );
      setConnection({ api, name: provider.name, address: address.to_bech32() });
      setPrepared(null);
      setApproved(false);
    });
  const prepare = () =>
    run(
      arcade
        ? 'Checking the exact game and transaction…'
        : 'Fitting your artwork to the chain…',
      async () => {
        if (!connection) throw new Error('Connect a wallet first.');
        setPrepared(null);
        setApproved(false);
        const snapshot = latest.current;
        const [C, state, protocol] = await Promise.all([
          loadCSL(),
          readWallet(connection.api),
          fetchProtocol(),
        ]);
        if (
          requiredAddress &&
          C.Address.from_hex(state.changeHex).to_bech32() !== requiredAddress
        )
          throw new Error(
            `Choose the ${destinationLabel || 'intended'} account before preparing.`,
          );
        await verifyDestination?.();
        setConnection((c) =>
          c
            ? { ...c, address: C.Address.from_hex(state.changeHex).to_bech32() }
            : c,
        );
        if (arcade) {
          await verifyArcade(arcade);
          const result = await buildMint(
            C,
            art,
            arcade.image,
            state,
            protocol,
            arcade,
          );
          if (latest.current !== snapshot)
            throw new Error('The selected game changed. Prepare again.');
          setPrepared(result);
          setNow(Date.now());
          return;
        }
        if (pinnedImage) {
          await verifyPreparedImage(pinnedImage);
          const preview = new Image();
          preview.src = pinnedImage.uri;
          await preview.decode().catch(() => {
            throw new Error(
              'This browser cannot display this encoding. Choose the WebP version.',
            );
          });
          if (
            preview.naturalWidth !== pinnedImage.width ||
            preview.naturalHeight !== pinnedImage.width
          )
            throw new Error('The prepared image dimensions changed.');
          const result = await buildMint(C, art, pinnedImage, state, protocol);
          if (latest.current !== snapshot)
            throw new Error('The selected artwork changed. Prepare again.');
          setPrepared(result);
          setNow(Date.now());
          return;
        }
        let target = art.interactive ? 5600 : 8200;
        for (let attempt = 0; attempt < 6; attempt++) {
          const image = await fitOnchainImage(art, target);
          try {
            const result = await buildMint(C, art, image, state, protocol);
            if (latest.current !== snapshot)
              throw new Error(
                'Your artwork changed while preparing. Prepare it again.',
              );
            setPrepared(result);
            setNow(Date.now());
            return;
          } catch (e) {
            if (!(e instanceof SizeError)) throw e;
            target -= Math.max(
              400,
              Math.ceil((e.bytes - e.limit + 256) / 1.35),
            );
            if (target < 2500 || attempt === 5)
              throw new Error(
                'Your metadata leaves too little room for a useful image. Shorten the story or utility terms, then prepare again. No fields were silently removed.',
              );
          }
        }
      },
    );
  const mint = () =>
    run('Checking the network and wallet…', async () => {
      if (!connection || !prepared || !approved || !fresh || receipt)
        throw new Error('Prepare and review this artwork before minting.');
      const review = prepared,
        snapshot = latest.current,
        C = await loadCSL();
      const assertArt = () => {
        if (!mounted.current)
          throw new Error('This mint view was closed. Nothing was submitted.');
        if (latest.current !== snapshot)
          throw new Error(
            'Your artwork changed. Nothing was submitted; prepare again.',
          );
      };
      const [live, wallet] = await Promise.all([
        fetchProtocol(),
        readWallet(connection.api),
      ]);
      await verifyDestination?.();
      assertArt();
      assertFreshReview(review, live);
      assertWalletUnchanged(C, review, wallet);
      setBusy('Approve the transaction in your wallet…');
      const witnesses = await connection.api.signTx(review.unsignedHex, true);
      setBusy('Verifying signatures and final size…');
      const [finalProtocol, finalWallet] = await Promise.all([
        fetchProtocol(),
        readWallet(connection.api),
      ]);
      await verifyDestination?.();
      assertArt();
      assertWalletUnchanged(C, review, finalWallet);
      const signed = mergeAndCheckSignatures(
        C,
        review,
        witnesses,
        finalProtocol,
      );
      setBusy('Saving your signed receipt…');
      let record: Receipt = {
        schema: 'nft-studio.receipt.v1', hash: signed.hash, bytes: signed.bytes,
        kind: arcade ? 'game' : review.program ? 'app' : 'art',
        name: review.artworkName, createdAt: Date.now(), metadata: review.metadata,
        signedHex: signed.hex, prepared: review, state: 'unknown', broadcastAttempted: false,
      };
      // Retain the full signed packet before any wallet broadcast call.
      updateReceipt(record);
      setPrepared(null);
      setApproved(false);
      persistMintReceipt(record, true);
      setBusy('Submitting through your wallet…');
      const result = await submitTransactionOnce({
        hash: signed.hash,
        submit: async () => {
          assertArt();
          const attempted: Receipt = { ...record, broadcastAttempted: true };
          persistMintReceipt(attempted, true);
          record = attempted;
          updateReceipt(record);
          return connection.api.submitTx(signed.hex);
        },
      });
      const observed = receiptRef.current?.hash === signed.hash ? receiptRef.current : null;
      record = {
        ...record,
        broadcastAttempted: result.alreadyAttempted || record.broadcastAttempted,
        state: observed?.state === 'confirmed' ? 'confirmed'
          : result.attempt.state === 'submitted' ? 'submitted' : 'unknown',
        checkedAt: observed?.checkedAt,
        blocksAfterInclusion: observed?.blocksAfterInclusion,
      };
      updateReceipt(record);
      try { persistMintReceipt(record); } catch {
        setError('Save the receipt now. This browser could not update the saved submission result.');
      }
      if (result.attempt.state !== 'submitted')
        setConfirmationNote(result.attempt.message || 'This hash already has a saved attempt. Only its chain status will be checked.');
    });
  const reviewed = receipt?.prepared || prepared;
  return (
    <>
      <Button
        className="btn primary mint-trigger"
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          setError('');
        }}
      >
        <Wallet size={16} />
        {triggerLabel}
        <ArrowUpRight size={16} />
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (lock.current) return;
          setOpen(value);
          if (!value) {
            setPrepared(null);
            setApproved(false);
          }
        }}
      >
        <DialogContent
          className="mint-dialog"
          showCloseButton={!busy}
          initialFocus={titleRef}
        >
          <div className="eyebrow">
            <span />
            ART, WRITTEN INTO THE CHAIN
          </div>
          <DialogTitle className="mint-title" ref={titleRef} tabIndex={-1}>
            Make it <em>permanent.</em>
          </DialogTitle>
          <DialogDescription>
            {hasProgram
              ? 'Your image and interactive program live inside the Cardano transaction. Try the exact program before you sign.'
              : 'The image itself lives inside your Cardano transaction. No image host. No storage subscription.'}
          </DialogDescription>
          <div className="mint-layout">
            <div className="mint-art-column">
              <div className="mint-art">
                {reviewed || fixedImage ? (
                  <img
                    src={(reviewed?.image || fixedImage)!.uri}
                    alt={`Exact on-chain preview: ${reviewed?.artworkName || art.name}`}
                  />
                ) : (
                  <ArtPreview art={art} />
                )}
              </div>
              <div className="mint-art-caption">
                <span>
                  {reviewed || fixedImage
                    ? 'EXACT ON-CHAIN IMAGE'
                    : 'STUDIO ORIGINAL'}
                </span>
                <span>
                  {reviewed
                    ? `${reviewed.image.width} × ${reviewed.image.width} · ${reviewed.image.mediaType === 'image/svg+xml' ? 'SVG' : reviewed.image.mediaType === 'image/avif' ? 'AVIF' : 'WebP'}`
                    : 'Compact preview after preparation'}
                </span>
              </div>
              <h3>{reviewed?.artworkName || art.name}</h3>
              <p className="mint-note">
                {arcade
                  ? arcade.id === 'starfall'
                    ? 'This copy contains the STARFALL reader, cover and fixed references to its two on-chain memory cartridges. Play on BMKR for automatic loading; the pool.pm viewer requires selecting the saved cartridge files. Keep the complete offline game for independent playback. It mints under your wallet’s own policy.'
                    : 'This copy contains the exact game and cover you played. It mints under your wallet’s own policy; the original collectible remains separate.'
                  : reviewed
                    ? 'This compressed version is exactly what your token will contain. Keep your creation package for the full-resolution artwork and editable recipe.'
                    : pinnedImage
                      ? 'This edition preserves the prepared image bytes. Your wallet preparation checks the complete transaction around them.'
                      : 'We fit a rendering of your current artwork to the space left after metadata, inputs, change and wallet signatures.'}
              </p>
              <div className="mint-permanence">
                <ShieldCheck size={18} />
                <p>
                  {hasProgram
                    ? 'The interactive program is public and reusable. Anyone with a copy can run it. Some wallets display only its cover; open the HTML attachment in a compatible viewer or browser. Additional benefit plans still need their own service or contract.'
                    : 'All embedded text is public and permanent, including your utility terms and links. Utility plans describe benefits; minting does not activate them.'}
                </p>
              </div>
              {reviewed?.program && !receipt?.restored && (
                <details className="mint-program">
                  <summary>Try the exact on-chain program</summary>
                  <iframe
                    title="Exact on-chain interactive program"
                    sandbox="allow-scripts allow-downloads"
                    referrerPolicy="no-referrer"
                    srcDoc={reviewed.program.html}
                  />
                  <Button
                    className="btn secondary mint-wide"
                    onClick={() =>
                      download(
                        new Blob([reviewed.program!.html], {
                          type: 'text/html',
                        }),
                        'interactive.html',
                      )
                    }
                  >
                    <Download size={14} />
                    Download this program
                  </Button>
                </details>
              )}
            </div>
            <div className="mint-controls">
              <div className="mint-network">
                <span>
                  <i />
                  CARDANO MAINNET
                </span>
                <span>Quantity 1</span>
              </div>
              {!connection && !receipt && (
                <section className="mint-step">
                  <span className="eyebrow">01 / YOUR WALLET</span>
                  <h3>Connect to begin.</h3>
                  <p>
                    Choose an installed Cardano wallet. You approve the
                    connection and every signature in the wallet.
                  </p>
                  <div className="wallet-list">
                    {wallets.map((w) => (
                      <Button
                        key={w.id}
                        className="btn secondary"
                        disabled={!!busy || restoring || !!restoreError}
                        onClick={() => connect(w.id)}
                      >
                        <Wallet size={16} />
                        {w.provider.name}
                      </Button>
                    ))}
                  </div>
                  {!wallets.length && <WalletBrowserHelp />}
                  <button
                    className="text-link"
                    disabled={!!busy || restoring || !!restoreError}
                    onClick={() => setWallets(findWallets())}
                  >
                    <RefreshCw size={14} />
                    Refresh wallet list
                  </button>
                </section>
              )}
              {connection && !receipt && (
                <div className="wallet-connected">
                  <div>
                    <Wallet size={17} />
                    <strong>{connection.name}</strong>
                    <span>connected</span>
                  </div>
                  <button
                    className="text-link"
                    disabled={!!busy || restoring || !!restoreError}
                    onClick={() => {
                      setConnection(null);
                      setPrepared(null);
                      setApproved(false);
                    }}
                  >
                    Disconnect
                  </button>
                  <small title={connection.address}>
                    {connection.address.slice(0, 20)}…
                    {connection.address.slice(-10)}
                  </small>
                </div>
              )}
              {!receipt && (
                <section className="mint-step">
                  <span className="eyebrow">
                    02 / ARTWORK + METADATA + TRANSACTION
                  </span>
                  {!prepared ? (
                    <>
                      <h3>Beauty, within the byte budget.</h3>
                      <p>
                        The studio caps complete transactions at{' '}
                        {STUDIO_TX_CAP.toLocaleString()} bytes and also checks
                        the live network limit.{' '}
                        {arcade ? (
                          arcade.id === 'starfall' ? (
                            'The exact reader, cartridge references and cover are preserved. Its game data remains in the two public on-chain memory NFTs. Preparation checks your wallet’s full transaction before signing.'
                          ) : (
                            'Your complete game and cover are preserved. If this wallet needs too many inputs or signatures to fit, preparation stops before signing.'
                          )
                        ) : (
                          <>
                            Preparation includes your image,
                            {art.interactive
                              ? ' interactive program,'
                              : ''} and
                            every selected utility plan.
                          </>
                        )}
                      </p>
                      <Button
                        className="btn secondary mint-wide"
                        disabled={!connection || !!busy || restoring || !!restoreError}
                        onClick={prepare}
                      >
                        <ShieldCheck size={16} />
                        Prepare on-chain preview
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="byte-total">
                        <strong>
                          {prepared.signedEstimate.toLocaleString()}
                          <small> bytes</small>
                        </strong>
                        <span>
                          /{' '}
                          {Math.min(
                            STUDIO_TX_CAP,
                            prepared.protocol.maxTx,
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div
                        className="byte-meter"
                        role="meter"
                        aria-label="Estimated complete signed transaction size"
                        aria-valuenow={prepared.signedEstimate}
                        aria-valuemin={0}
                        aria-valuemax={Math.min(
                          STUDIO_TX_CAP,
                          prepared.protocol.maxTx,
                        )}
                      >
                        <span
                          style={{
                            width: `${(prepared.signedEstimate / Math.min(STUDIO_TX_CAP, prepared.protocol.maxTx)) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="mint-note">
                        Includes the expected wallet signatures. The actual
                        signed bytes are checked again before submission.
                      </p>
                      <dl className="mint-facts">
                        {prepared.program && (
                          <div>
                            <dt>Interactive program</dt>
                            <dd>{prepared.program.bytes.toLocaleString()} B</dd>
                          </div>
                        )}
                        <div>
                          <dt>Image file</dt>
                          <dd>{prepared.image.bytes.toLocaleString()} B</dd>
                        </div>
                        <div>
                          <dt>Encoded metadata, including image</dt>
                          <dd>{prepared.metadataBytes.toLocaleString()} B</dd>
                        </div>
                        <div>
                          <dt>Network fee</dt>
                          <dd>{ada(prepared.fee)} ADA</dd>
                        </div>
                        <div>
                          <dt>ADA held with your NFT</dt>
                          <dd>{ada(prepared.minimumAda)} ADA</dd>
                        </div>
                        <div>
                          <dt>PRISM fee</dt>
                          <dd>0 ADA</dd>
                        </div>
                      </dl>
                      <p className="mint-note">
                        The NFT and change return to your wallet. The ADA held
                        with the NFT remains yours.
                      </p>
                      <details className="mint-details">
                        <summary>
                          Review destination, policy and metadata
                        </summary>
                        <dl>
                          <dt>Destination / your wallet</dt>
                          <dd>{prepared.address}</dd>
                          <dt>Policy ID</dt>
                          <dd>{prepared.policyId}</dd>
                          <dt>Asset name</dt>
                          <dd>{prepared.assetName}</dd>
                          <dt>Policy expiry</dt>
                          <dd>
                            {new Date(
                              (prepared.protocol.blockTime +
                                prepared.expirySlot -
                                prepared.protocol.slot) *
                                1000,
                            ).toLocaleString()}
                          </dd>
                        </dl>
                        <p>
                          This transaction issues one token. Your wallet
                          controls further minting under this policy until it
                          expires. After expiry, minting and burning are
                          disabled. The policy does not enforce a lifetime
                          supply of one.
                        </p>
                        <Button
                          className="btn secondary mint-wide"
                          onClick={() =>
                            download(
                              jsonBlob(prepared.metadata),
                              filename(art.name) + '-onchain-metadata.json',
                            )
                          }
                        >
                          <Download size={14} />
                          Download exact metadata
                        </Button>
                      </details>
                      <p className="mint-policy-note">
                        One token now. Your wallet can issue more until the
                        policy expires in about an hour; minting and burning
                        then close permanently.
                      </p>
                      <label className="mint-consent">
                        <input
                          type="checkbox"
                          checked={approved}
                          disabled={!!busy || restoring || !!restoreError}
                          onChange={(e) => setApproved(e.target.checked)}
                        />
                        <span>
                          I reviewed the compact image, public metadata, fee and
                          minting policy.
                        </span>
                      </label>
                      {!fresh && (
                        <p className="mint-error">
                          This review expired. Prepare it again for a fresh
                          network quote.
                        </p>
                      )}
                      <Button
                        className="btn primary mint-wide"
                        disabled={!approved || !fresh || !!busy || restoring || !!restoreError}
                        onClick={mint}
                      >
                        <Wallet size={16} />
                        Sign & mint · {ada(prepared.fee)} ADA fee
                      </Button>
                      <button
                        className="text-link"
                        disabled={!!busy || restoring || !!restoreError}
                        onClick={prepare}
                      >
                        <RefreshCw size={14} />
                        Prepare again
                      </button>
                    </>
                  )}
                </section>
              )}
              {receipt && (
                <section className="mint-receipt">
                  {receipt.state === 'confirmed' ? <CheckCircle2 size={28} /> : <RefreshCw size={28} />}
                  <h3>
                    {receipt.broadcastAttempted === false ? 'Signed; not submitted.'
                      : receipt.state === 'confirmed' ? 'Confirmed on Cardano.'
                      : receipt.state === 'submitted' ? 'Submitted. Awaiting confirmation.'
                      : 'Submission status is uncertain.'}
                  </h3>
                  <p>
                    {receipt.broadcastAttempted === false
                      ? 'The wallet signed this packet, but no broadcast was attempted. Save the receipt before returning to preparation.'
                      : receipt.state === 'confirmed'
                        ? 'The chain reader reports inclusion of this exact transaction hash. The signed packet and metadata remain available below.'
                        : receipt.state === 'submitted'
                          ? 'Your wallet accepted the submission. The studio is checking the expected transaction hash for chain inclusion.'
                          : 'The wallet response was inconclusive. This transaction may have been broadcast. Only status reads are retried.'}
                  </p>
                  <dl className="mint-facts">
                    <div>
                      <dt>Actual signed transaction</dt>
                      <dd>{receipt.bytes.toLocaleString()} bytes</dd>
                    </div>
                    <div>
                      <dt>Network limit at submission</dt>
                      <dd>
                        {receipt.prepared.protocol.maxTx.toLocaleString()} bytes
                      </dd>
                    </div>
                  </dl>
                  {receipt.checkedAt && (
                    <p className="mint-note">
                      Last checked {new Date(receipt.checkedAt).toLocaleString()}
                      {receipt.blocksAfterInclusion !== undefined
                        ? ` · ${receipt.blocksAfterInclusion} block${receipt.blocksAfterInclusion === 1 ? '' : 's'} after inclusion`
                        : ''}.
                    </p>
                  )}
                  {receipt.broadcastAttempted !== false && (
                    <>
                      <Button className="btn secondary mint-wide" disabled={checking || !!busy}
                        onClick={() => { setConfirmationNote('Checking this transaction hash…'); setCheckRound(n => n + 1); }}>
                        <RefreshCw size={15} className={checking ? 'animate-spin' : ''} />
                        {checking ? 'Checking chain status…' : 'Check status again'}
                      </Button>
                      {confirmationNote && <p className="mint-note" role="status">{confirmationNote}</p>}
                    </>
                  )}
                  <code className="transaction-hash">{receipt.hash}</code>
                  <a
                    className="btn primary mint-wide"
                    href={`https://cardanoscan.io/transaction/${receipt.hash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Check on Cardanoscan
                    <ArrowUpRight size={15} />
                  </a>
                  <a
                    className="btn secondary mint-wide"
                    href={poolAssetUrl(
                      receipt.prepared.policyId,
                      receipt.prepared.assetName,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View NFT on pool.pm
                    <ArrowUpRight size={15} />
                  </a>
                  <p className="mint-note">
                    The pool.pm page appears after the transaction confirms and
                    its index updates.
                  </p>
                  <Button
                    className="btn secondary mint-wide"
                    onClick={() =>
                      download(
                        jsonBlob({
                          ...receipt,
                          status: receipt.state,
                          transactionId: receipt.hash,
                          signedBytes: receipt.bytes,
                          signedTransactionCbor: receipt.signedHex,
                          policyId: receipt.prepared.policyId,
                          nativePolicyCbor: receipt.prepared.policyScript,
                          assetName: receipt.prepared.assetName,
                          poolPmUrl: poolAssetUrl(
                            receipt.prepared.policyId,
                            receipt.prepared.assetName,
                          ),
                          metadata: receipt.prepared.metadata,
                        }),
                        'nft-studio-mint-' + receipt.hash.slice(0, 12) + '.json',
                      )
                    }
                  >
                    <Download size={15} />
                    Save mint receipt
                  </Button>
                  <p className="mint-note">
                    This browser keeps the signed packet and exact metadata for
                    Recovery. Download an independent copy before clearing site data.
                    The studio never rebroadcasts a saved attempt.
                  </p>
                  <button
                    className="text-link"
                    disabled={!!busy || (receipt.broadcastAttempted !== false && receipt.state !== 'confirmed')}
                    onClick={() => {
                      try { dismissMintReceipt(receipt.hash); } catch (error) { setError(errorText(error)); return; }
                      updateReceipt(null);
                      setPrepared(null);
                      setConfirmationNote('');
                      setError('');
                    }}
                  >
                    {receipt.broadcastAttempted === false ? 'Return to mint preparation' : 'Start another mint'}
                  </button>
                </section>
              )}
              {restoring && <p className="mint-note" role="status">Restoring the saved transaction receipt…</p>}
              {restoreError && <p className="mint-error" role="alert">{restoreError} Open Recovery before starting another mint.</p>}
              {busy && (
                <div className="mint-progress" role="status">
                  <LoaderCircle size={17} className="animate-spin" />
                  {busy}
                </div>
              )}
              {error && (
                <p className="mint-error" role="alert">
                  {error}
                </p>
              )}
              <p className="mint-footnote">
                Wallet addresses and balances stay in your browser. The public
                network feed provides fees and limits. Your wallet signs and
                broadcasts.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
