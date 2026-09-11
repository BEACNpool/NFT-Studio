'use client';
/* oxlint-disable next/no-img-element, next/no-html-link-for-pages */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Download,
  Gamepad2,
  Layers3,
  LoaderCircle,
  Play,
  ScanLine,
  Sparkles,
  X,
} from 'lucide-react';
import catalogJSON from '@/lib/capability-catalog.json';
import presetsJSON from '@/lib/interactive-presets.json';
import { INITIAL, type Artwork } from '@/lib/art';
import { validateInteractive, type InteractiveSpec } from '@/lib/interactive';
import { assetPath } from '@/lib/paths';
import type { CreationMode } from '@/lib/studio-modes';
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { FileSeed } from '@/components/file-workbench';
import type { PayloadMime } from '@/lib/studio-payload';
import './studio-showcase.css';

type Media = { path: string; bytes: number; sha256: string };
type Filter =
  | 'all'
  | 'games'
  | 'music'
  | 'motion'
  | 'tools'
  | 'art'
  | 'collections';
type Original = {
  policy?: string;
  assetHex?: string;
  asset?: string;
  txHash?: string;
  fingerprint?: string;
};
type Entry = {
  fileBuilderSupported?: boolean;
  id: string;
  title: string;
  description: string;
  category: string;
  capability: string;
  media?: Media[];
  original?: Original;
  originalURL?: string;
  publicURL?: string;
  accent?: string;
  limits?: string[];
  instructions?: string[];
  attribution?: string;
  manifestPointer?: string;
};
type Preset = {
  id: string;
  title: string;
  description: string;
  category: string;
  spec: InteractiveSpec;
  media: Media[];
};
type Item = Entry & {
  filter: Filter;
  label: string;
  image?: Media;
  program?: Media;
  preset?: Preset;
  poster?: string;
  legacy?: string;
};
export type ShowcaseBundle = FileSeed;
export type StudioShowcaseProps = {
  onUseArtwork: (art: Artwork) => void;
  onCreate: (mode: CreationMode) => void;
  onUseFiles?: (bundle: ShowcaseBundle) => void;
};
const originals = catalogJSON.originals as Entry[];
const creators = catalogJSON.creators as Entry[];
const presets = presetsJSON as Preset[];
const posters: Record<string, string> = {
  'light-we-leave': '/showcase/posters/light-we-leave.png',
  'keep-growing': '/showcase/posters/keep-growing.png',
  'boss-fight': '/showcase/posters/boss-fight.png',
};
const normalize = (entry: Entry): Item => ({
  ...entry,
  filter:
    entry.category === 'pixel-films' || entry.category === 'motion'
      ? 'motion'
      : entry.category === 'games'
        ? 'games'
        : entry.category === 'music'
          ? 'music'
          : 'art',
  label:
    entry.capability === 'frozen-scroll-original'
      ? 'THE ORIGINAL SCROLL'
      : entry.id === 'kayfabe'
        ? 'OPEN CREATOR EDITION'
        : entry.category === 'pixel-films'
          ? 'A FILM IN AN NFT'
          : entry.category === 'games'
            ? 'PLAYABLE / ON CHAIN'
            : entry.category === 'music'
              ? 'PRESS PLAY'
              : 'ORIGINAL / ON CHAIN',
  image: entry.media?.find((m) => /\.(svg|webp|avif|png)$/.test(m.path)),
  program: entry.media?.find((m) =>
    /\/(game|program|beat-lab)\.html$/.test(m.path),
  ),
  poster: posters[entry.id],
});
const items: Item[] = [
  ...[
    'starfall',
    'chain-pressure',
    'harmonic-atlas',
    'orbital-choir',
    'pulse-foundry',
    'keep-growing',
    'impossible-dawn',
    'afterlight',
    'ninefold',
    'light-we-leave',
    'boss-fight',
    'prismwake',
    'tidelock',
    'lastember',
    'chess',
    'checkers',
    'solitaire',
    'ledger-chess-original',
  ].map((id) => normalize(originals.find((e) => e.id === id)!)),
  ...creators
    .filter((e) => ['creation-engine', 'kayfabe'].includes(e.id))
    .map(normalize),
  ...presets.map((p) => ({
    ...normalize({ ...p, capability: 'configurable-creator' }),
    filter: p.category === 'music' ? ('music' as const) : ('tools' as const),
    label: 'MAKE THIS ONE YOURS',
    preset: p,
  })),
  ...['oligarch-maker', 'tipsy-demo'].map((id) => {
    const e = creators.find((e) => e.id === id)!;
    return {
      ...e,
      filter: 'collections' as const,
      label:
        id === 'oligarch-maker'
          ? 'HOLDER-GATED MAKER'
          : 'ATTRIBUTED DEMONSTRATION',
      legacy:
        id === 'oligarch-maker' ? '/legacy/oligarCH/make/' : '/legacy/tipsy/',
    };
  }),
];
const tabs: { id: Filter; name: string }[] = [
  { id: 'all', name: 'All work' },
  { id: 'games', name: 'Games' },
  { id: 'music', name: 'Sound' },
  { id: 'motion', name: 'Motion' },
  { id: 'tools', name: 'Useful things' },
  { id: 'art', name: 'Art' },
  { id: 'collections', name: 'Collections' },
];
const mime = (path: string): PayloadMime =>
  (({
    svg: 'image/svg+xml',
    avif: 'image/avif',
    webp: 'image/webp',
    png: 'image/png',
    html: 'text/html',
    zip: 'application/zip',
    json: 'application/json',
    txt: 'text/plain',
  })[path.split('.').pop()!.toLowerCase() as 'svg'] ||
    'application/octet-stream') as PayloadMime;
const shortBytes = (n: number) =>
  n < 1000 ? `${n} B` : `${(n / 1000).toFixed(1)} kB`;
const mediaURL = (media: Media) => {
  if (
    !media.path.startsWith('public/') ||
    media.path.includes('..') ||
    media.path.includes('\\')
  )
    throw new Error('Unknown media path.');
  return assetPath(media.path.slice(6));
};
async function verifiedBytes(media: Media): Promise<Uint8Array> {
  const response = await fetch(mediaURL(media), {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('This file could not load. Try again.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length !== media.bytes)
    throw new Error('The file size changed. Reload before using this work.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  if (
    Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('') !== media.sha256
  )
    throw new Error(
      'This file does not match its verified original. It has not been opened.',
    );
  return bytes;
}
function blobOf(bytes: Uint8Array, type: string) {
  return new Blob([new Uint8Array(bytes)], { type });
}
async function saveExact(media: Media) {
  const bytes = await verifiedBytes(media);
  const url = URL.createObjectURL(blobOf(bytes, mime(media.path))),
    a = document.createElement('a');
  a.href = url;
  a.download = media.path.split('/').slice(-2).join('-');
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function presetArtwork(p: Preset): Promise<Artwork> {
  const media = p.media.find((m) => m.path.endsWith('/cover.svg'))!;
  const bytes = await verifiedBytes(media),
    url = URL.createObjectURL(blobOf(bytes, 'image/svg+xml'));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot prepare the cover.');
    ctx.drawImage(image, 0, 0, 1024, 1024);
    return {
      ...INITIAL,
      name: p.title,
      description: p.description,
      source: 'custom',
      customImage: canvas.toDataURL('image/png'),
      scale: 100,
      signature: false,
      design: undefined,
      traits: [],
      utilities: [],
      interactive: validateInteractive(p.spec),
      license: 'Public reusable interactive program; no exclusive access.',
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function StudioShowcase({
  onUseArtwork,
  onCreate,
  onUseFiles,
}: StudioShowcaseProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Item | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('example');
    if (id) setSelected(items.find(item => item.id === id) || null);
  }, []);
  const visible = useMemo(
    () => items.filter((item) => filter === 'all' || item.filter === filter),
    [filter],
  );
  return (
    <section className="ns-gallery" aria-labelledby="ns-gallery-title">
      <header className="ns-gallery-heading">
        <div>
          <h1 id="ns-gallery-title">Explore</h1>
          <p>Play, listen, or find your next starting point.</p>
        </div>
        <button className="ns-secondary" onClick={() => onCreate('art')}>
          Make your own <ArrowUpRight size={16} />
        </button>
      </header>
      <Tabs
        className="ns-gallery-tabs"
        value={filter}
        onValueChange={(value) => setFilter(value as Filter)}
      >
        <div className="ns-gallery-toolbar">
          <TabsList variant="line" aria-label="Filter showcase">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.name}
                <span>
                  {
                    items.filter((i) => tab.id === 'all' || i.filter === tab.id)
                      .length
                  }
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          <span className="ns-gallery-count">
            {visible.length} things to explore
          </span>
        </div>
        <TabsContent value={filter}>
          <div className="ns-gallery-grid">
            {visible.map((item) => (
              <article
                className={
                  'ns-gallery-card' + (item.preset ? ' ns-gallery-preset' : '')
                }
                key={item.id}
                style={
                  {
                    '--gallery-accent':
                      item.accent || item.preset?.spec.accent || '#d7f98a',
                  } as CSSProperties
                }
              >
                <button
                  className="ns-gallery-visual"
                  onClick={() => setSelected(item)}
                  aria-label={'Open ' + item.title}
                >
                  {item.image ? (
                    <img
                      loading="lazy"
                      src={assetPath(item.poster || item.image.path.slice(6))}
                      alt={
                        item.title +
                        (item.poster
                          ? ' — still from the original animation'
                          : ' cover')
                      }
                    />
                  ) : (
                    <div
                      className={
                        'ns-gallery-symbol ' +
                        (item.id === 'ledger-chess-original'
                          ? 'ns-gallery-chess'
                          : '')
                      }
                    >
                      {item.id === 'ledger-chess-original' ? (
                        <Gamepad2 size={65} strokeWidth={1} />
                      ) : (
                        <Layers3 size={65} strokeWidth={1} />
                      )}
                    </div>
                  )}
                  <span className="ns-gallery-open">
                    {item.program ? (
                      <Play size={15} fill="currentColor" />
                    ) : (
                      <ArrowUpRight size={17} />
                    )}
                    <span>
                      {item.program
                        ? 'Open & play'
                        : item.legacy
                          ? 'Explore'
                          : 'View artwork'}
                    </span>
                  </span>
                  {item.preset && (
                    <span className="ns-gallery-template">
                      <Sparkles size={12} /> EDITABLE STARTER
                    </span>
                  )}
                </button>
                <div className="ns-gallery-card-body">
                  <p className="ns-gallery-label">{item.label}</p>
                  <h2>
                    <button onClick={() => setSelected(item)}>
                      {item.title}
                    </button>
                  </h2>
                  <p className="ns-gallery-description">{item.description}</p>
                  <footer>
                    <span>
                      {item.preset
                        ? item.preset.spec.kind === 'beats'
                          ? `${item.preset.spec.bpm} BPM · your groove`
                          : 'Your settings, your cover'
                        : item.legacy
                          ? 'Dedicated collection tool'
                          : item.program
                            ? `${shortBytes(item.program.bytes)} of playable code`
                            : item.image
                              ? `${shortBytes(item.image.bytes)} of embedded art`
                              : 'An entire game, in a Scroll'}
                    </span>
                    <button
                      onClick={() => setSelected(item)}
                      aria-label={'Explore ' + item.title}
                    >
                      <ArrowUpRight size={19} />
                    </button>
                  </footer>
                </div>
              </article>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      <aside className="ns-gallery-end">
        <div>
          <ScanLine size={23} />
          <p>
            <strong>The collectible is the content.</strong>
            <span>
              Open a work to inspect its original identity and keep the exact
              files.
            </span>
          </p>
        </div>
        <button onClick={() => onCreate('data')}>
          Build with your own files <ArrowRight size={17} />
        </button>
      </aside>
      {selected && (
        <WorkDialog
          item={selected}
          onClose={() => setSelected(null)}
          onUseArtwork={onUseArtwork}
          onCreate={onCreate}
          onUseFiles={onUseFiles}
        />
      )}
    </section>
  );
}

function WorkDialog({
  item,
  onClose,
  onUseArtwork,
  onCreate,
  onUseFiles,
}: StudioShowcaseProps & { item: Item; onClose: () => void }) {
  const [loaded, setLoaded] = useState<{
    image?: string;
    html?: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    const urls: string[] = [];
    setLoaded(null);
    setError('');
    void (async () => {
      const image = item.image
        ? URL.createObjectURL(
            blobOf(await verifiedBytes(item.image), mime(item.image.path)),
          )
        : undefined;
      if (image) urls.push(image);
      const html = item.program
        ? new TextDecoder('utf-8', { fatal: true }).decode(
            await verifiedBytes(item.program),
          )
        : undefined;
      if (live) setLoaded({ image, html });
      else urls.forEach((u) => URL.revokeObjectURL(u));
    })().catch((e) => {
      if (live)
        setError(e instanceof Error ? e.message : 'This work could not load.');
    });
    return () => {
      live = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [item, attempt]);
  const perform = async (label: string, task: () => Promise<void>) => {
    setBusy(label);
    setError('');
    try {
      await task();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'That action could not finish.',
      );
    } finally {
      setBusy('');
    }
  };
  const usePreset = () =>
    perform('Preparing your starter…', async () => {
      onUseArtwork(await presetArtwork(item.preset!));
      onClose();
    });
  const useFiles = () =>
    perform('Checking the exact files…', async () => {
      const media = [item.image, item.program].filter((m): m is Media => !!m);
      const files = await Promise.all(
        media.map(async (m) => ({
          name: m.path.split('/').pop()!,
          mediaType: mime(m.path),
          bytes: await verifiedBytes(m),
        })),
      );
      onUseFiles?.({
        name: item.title,
        files,
        coverIndex: item.image ? 0 : -1,
      });
      onClose();
    });
  const identity = item.original;
  const fp = identity?.fingerprint || item.originalURL?.split('/').pop();
  const makeMode: CreationMode =
    item.filter === 'games'
      ? 'game'
      : item.filter === 'music'
        ? 'music'
        : item.filter === 'motion'
          ? 'motion'
          : 'art';
  const downloadable = item.legacy ? [] : item.media || [];
  const libraryGame = item.capability === 'fixed-original-copy';
  const canBuildCopy =
    !!onUseFiles &&
    item.fileBuilderSupported !== false &&
    item.id !== 'ledger-chess-original' &&
    !libraryGame;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="ns-work-dialog" showCloseButton={false}>
        <header className="ns-work-top">
          <span>{item.label}</span>
          <DialogClose className="ns-work-close" aria-label="Close artwork">
            <X size={21} />
          </DialogClose>
        </header>
        <div className="ns-work-layout">
          <div
            className={
              'ns-work-player' + (item.program ? ' ns-work-interactive' : '')
            }
          >
            {!loaded && !error && (
              <div className="ns-work-loading">
                <LoaderCircle size={25} />
                <span>Checking the original bytes…</span>
              </div>
            )}
            {!loaded && error && (
              <div className="ns-work-loading ns-work-unverified">
                <ScanLine size={25} />
                <span>This original could not be verified.</span>
              </div>
            )}
            {loaded?.html && (
              <iframe
                key={item.id}
                title="Verified original program preview"
                sandbox="allow-scripts allow-downloads"
                srcDoc={loaded.html}
              />
            )}
            {loaded?.image && !item.program && (
              <img
                src={loaded.image}
                alt={item.title + ' — exact original artwork'}
              />
            )}
            {loaded && item.legacy && (
              <div className="ns-work-legacy">
                <Layers3 size={65} strokeWidth={1} />
                <h2>A collection with its own story.</h2>
                <p>
                  {item.id === 'oligarch-maker'
                    ? 'The existing holder-gated maker opens as a dedicated tool. Its collection policy stays the same.'
                    : 'Three vector recreations, with their original project attribution and source comparisons intact.'}
                </p>
                <a
                  href={assetPath(item.legacy)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.id === 'oligarch-maker'
                    ? 'Open the PFP maker'
                    : 'Open the demonstration'}
                  <ArrowUpRight size={17} />
                </a>
              </div>
            )}
          </div>
          <div className="ns-work-info">
            <p className="ns-eyebrow">
              {item.preset
                ? 'AN EDITABLE STARTING POINT'
                : item.legacy
                  ? 'COLLECTION TOOL'
                  : 'MADE BY BEACN'}
            </p>
            <DialogTitle>{item.title}</DialogTitle>
            <DialogDescription className="ns-work-description">
              {item.description}
            </DialogDescription>
            {loaded && (
              <p className="ns-work-verified">
                <Check size={15} />
                {item.legacy
                  ? 'Original collection tool, preserved'
                  : 'Files match their recorded SHA-256 hashes'}
              </p>
            )}
            {item.preset ? (
              <>
                <button
                  className="ns-primary ns-work-primary"
                  disabled={!!busy || !loaded}
                  onClick={usePreset}
                >
                  Use this starter <ArrowRight size={17} />
                </button>
                <p className="ns-work-hint">
                  Change the settings, add your own cover, then review before
                  signing. This example has not been minted.
                </p>
              </>
            ) : item.legacy ? null : (
              <>
                <button
                  className="ns-primary ns-work-primary"
                  disabled={!!busy || !loaded}
                  onClick={
                    canBuildCopy
                      ? useFiles
                      : () => {
                          onCreate(
                            item.id === 'ledger-chess-original'
                              ? 'scroll'
                              : makeMode,
                          );
                          onClose();
                        }
                  }
                >
                  {canBuildCopy
                    ? 'Build a new copy'
                    : item.fileBuilderSupported === false
                      ? 'Explore music tools'
                      : libraryGame
                        ? 'Open the mintable games library'
                        : item.id === 'ledger-chess-original'
                          ? 'Explore Ledger Scrolls'
                          : 'Create something like this'}
                  <ArrowRight size={17} />
                </button>
                <p className="ns-work-hint">
                  {canBuildCopy
                    ? 'A new asset in your wallet. The original stays unchanged. Your complete transaction must fit before you sign.'
                    : item.fileBuilderSupported === false
                      ? 'Compose and export inside this original. The Studio’s smaller Beat Lab is available for creating a new music NFT.'
                      : libraryGame
                        ? 'Choose this game in the library to use its exact, compact minting format.'
                        : 'Use the Studio’s tools to create and review your own work.'}
                </p>
              </>
            )}
            {item.id === 'starfall' && (
              <p className="ns-work-note">
                STARFALL uses two public on-chain memory cartridges. The Studio
                loads them automatically; pool.pm requires the saved files in
                the cartridge ZIP.
              </p>
            )}
            {item.id === 'chain-pressure' && (
              <p className="ns-work-note">
                The score and synthesizer live on chain. The player generates
                the WAV locally. Press Play or WAV to use it.
              </p>
            )}
            {item.id === 'ledger-chess-original' && (
              <p className="ns-work-note">
                This is the original full Scroll game. The standalone preview
                plays locally. Its separate reader handles on-chain win claims,
                each with a fee and 2 ADA locked forever.
              </p>
            )}
            {item.id === 'tipsy-demo' && (
              <p className="ns-work-note">
                Artwork and characters belong to Tipsy Turtles. Unaffiliated
                demonstration, not an official release. The old mint windows are
                closed.
              </p>
            )}
            {item.id === 'oligarch-maker' && (
              <p className="ns-work-note">
                Requires a qualifying oligarCH token in a spent wallet input.
                This is the existing collection gate, not a configurable gate
                for other projects.
              </p>
            )}
            {item.instructions?.length ? (
              <details className="ns-work-details">
                <summary>How to play</summary>
                <ol>
                  {item.instructions.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </details>
            ) : null}
            {identity && (
              <details className="ns-work-details">
                <summary>Original on-chain identity</summary>
                {fp && (
                  <>
                    <small>Asset fingerprint</small>
                    <code>{fp}</code>
                  </>
                )}
                {identity.policy && (
                  <>
                    <small>Policy</small>
                    <code>{identity.policy}</code>
                  </>
                )}
                {(identity.assetHex || identity.asset) && (
                  <>
                    <small>
                      Asset name {identity.assetHex ? 'bytes (hex)' : '(UTF-8)'}
                    </small>
                    <code>{identity.assetHex || identity.asset}</code>
                  </>
                )}
                {identity.txHash && (
                  <a
                    href={'https://cexplorer.io/tx/' + identity.txHash}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View the mint transaction <ArrowUpRight size={13} />
                  </a>
                )}
              </details>
            )}
            {item.manifestPointer && (
              <details className="ns-work-details">
                <summary>Original Scroll identity</summary>
                <small>Manifest transaction and output</small>
                <code>{item.manifestPointer}</code>
                <a
                  href={
                    'https://cexplorer.io/tx/' +
                    item.manifestPointer.split('#')[0]
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  View the manifest transaction <ArrowUpRight size={13} />
                </a>
              </details>
            )}
            {item.originalURL && (
              <a
                className="ns-work-proof"
                href={item.originalURL}
                target="_blank"
                rel="noreferrer"
              >
                Open the original on pool.pm <ArrowUpRight size={15} />
              </a>
            )}
            {item.publicURL && item.id === 'ledger-chess-original' && (
              <a
                className="ns-work-proof"
                href={item.publicURL}
                target="_blank"
                rel="noreferrer"
              >
                Open the complete original reader <ArrowUpRight size={15} />
              </a>
            )}
            {downloadable.length > 0 && (
              <details className="ns-work-details ns-work-downloads">
                <summary>
                  Keep the exact files <Download size={14} />
                </summary>
                {downloadable.map((m) => (
                  <button
                    key={m.path}
                    disabled={!!busy}
                    onClick={() =>
                      perform('Checking your download…', () => saveExact(m))
                    }
                  >
                    <span>
                      {m.path.split('/').pop()}
                      <small>
                        {shortBytes(m.bytes)} · SHA-256 verified before download
                      </small>
                    </span>
                    <Download size={15} />
                  </button>
                ))}
              </details>
            )}
            {item.attribution && (
              <p className="ns-work-attribution">{item.attribution}</p>
            )}
            {busy && (
              <p className="ns-work-status" role="status">
                <LoaderCircle size={15} />
                {busy}
              </p>
            )}
            {error && (
              <div className="ns-work-error" role="alert">
                <p>{error}</p>
                <button onClick={() => setAttempt((n) => n + 1)}>
                  Try loading again
                </button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
