'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowUpRight,
  Plus,
  Grid2X2,
  FolderOpen,
  ScanLine,
  ImagePlus,
  ScrollText,
  LibraryBig,
  Music2,
  Gamepad2,
  Shapes,
  Clapperboard,
  Braces,
  ShieldCheck,
  Layers3,
  CircleHelp,
  ArrowLeft,
} from 'lucide-react';
import {
  MODES,
  type CreationMode,
  type StudioView,
  isCreationMode,
} from '@/lib/studio-modes';
import { assetPath } from '@/lib/paths';
import { CreationWorkbench } from './creation-workbench';
import { ProjectsPanel } from './art-workbench';
import { RecoveryPanel } from './recovery-panel';
import { StudioShowcase } from './studio-showcase';
import type { Artwork } from '@/lib/art';
import type { FileSeed } from './file-workbench';
import { StudioWallet } from './studio-wallet';
import { registerStudioTools } from '@/lib/studio-webmcp';
declare global {
  interface Window {
    NFTStudioNavigation?: {
      onTraverse: ((state: { path: string; scrollY: number }) => void) | null;
    };
  }
}
const symbols = {
  art: ImagePlus,
  scroll: ScrollText,
  book: LibraryBig,
  music: Music2,
  game: Gamepad2,
  utility: Shapes,
  motion: Clapperboard,
  data: Braces,
};
const views = [
  { id: 'create' as const, label: 'Create', icon: Plus },
  { id: 'showcase' as const, label: 'Explore', icon: Grid2X2 },
  { id: 'projects' as const, label: 'Saved', icon: FolderOpen },
  { id: 'recover' as const, label: 'Activity', icon: ScanLine },
];
const homeFormats = [
  ['art', 'Image & art', 'Upload or design'],
  ['game', 'Games', 'Play and mint'],
  ['music', 'Music', 'Make some sound'],
  ['scroll', 'Documents', 'Publish a Scroll'],
  ['book', 'Books', 'Keep a living journal'],
  ['utility', 'Apps', 'Add something useful'],
  ['motion', 'Motion', 'Create moving art'],
  ['data', 'Files & data', 'Preserve your files'],
] as const;
function readRoute() {
  const params = new URLSearchParams(location.search);
  const requestedView = params.get('view');
  const view: StudioView =
    requestedView === 'guide' || views.some((v) => v.id === requestedView)
      ? (requestedView as StudioView)
      : 'create';
  const requestedMode = params.get('create');
  return { view, mode: isCreationMode(requestedMode) ? requestedMode : null };
}
function routeState(scrollY = 0) {
  return {
    ...history.state,
    nftStudio: { path: location.pathname, scrollY },
  };
}
export function NFTStudio() {
  return (
    <div className="ns-app ns-mobile-app">
      <StudioSurface />
    </div>
  );
}
function StudioSurface() {
  const [view, setView] = useState<StudioView>('create');
  const [mode, setMode] = useState<CreationMode | null>(null);
  const [initialArt, setInitialArt] = useState<Artwork>();
  const [initialFiles, setInitialFiles] = useState<FileSeed>();
  const [scrollFile, setScrollFile] = useState<File>();
  const [creationKey, setCreationKey] = useState(0);
  const main = useRef<HTMLElement>(null);
  const activeMode = useRef(mode);
  activeMode.current = mode;
  useEffect(() => {
    const restore = () => {
      const next = readRoute();
      if (next.mode !== activeMode.current) {
        setInitialArt(undefined);
        setInitialFiles(undefined);
        setScrollFile(undefined);
        setCreationKey((key) => key + 1);
      }
      setView(next.view);
      setMode(next.mode);
    };
    restore();
    history.replaceState(routeState(window.scrollY), '', location.href);
    const onTraverse = (state: { scrollY: number }) => {
      restore();
      requestAnimationFrame(() => {
        window.scrollTo({ top: state.scrollY || 0 });
        main.current?.focus({ preventScroll: true });
      });
    };
    const navigation = window.NFTStudioNavigation;
    if (navigation) navigation.onTraverse = onTraverse;
    return () => {
      if (navigation?.onTraverse === onTraverse) navigation.onTraverse = null;
    };
  }, []);
  const route = (nextView: StudioView, nextMode = mode) => {
    const url = new URL(location.href);
    if (nextView === 'create') url.searchParams.delete('view');
    else url.searchParams.set('view', nextView);
    if (nextMode) url.searchParams.set('create', nextMode);
    else url.searchParams.delete('create');
    if (url.href !== location.href) {
      history.replaceState(routeState(window.scrollY), '', location.href);
      history.pushState(routeState(), '', url);
    }
    setView(nextView);
    setMode(nextMode);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
  };
  const navigate = (next: StudioView) => {
    route(next);
  };
  const choose = (next: CreationMode) => {
    route('create', next);
    setInitialArt(undefined);
    setInitialFiles(undefined);
    setScrollFile(undefined);
    setCreationKey((k) => k + 1);
  };
  const home = () => {
    route('create', null);
  };
  const currentState = useRef({ view, format: mode });
  currentState.current = { view, format: mode };
  const currentChoose = useRef(choose);
  currentChoose.current = choose;
  useEffect(
    () =>
      registerStudioTools({
        read: () => currentState.current,
        start: (format) => currentChoose.current(format),
      }),
    [],
  );
  return (
    <>
      <a className="ns-skip" href="#studio-main">
        Skip to studio
      </a>
      <div className="ns-main-wrap">
        <header className="ns-topbar">
          <div className="ns-topbar-inner">
            <button
              className="ns-app-brand"
              onClick={home}
              aria-label="NFT-Studio home"
            >
              <span className="ns-app-mark">
                <Layers3 size={22} strokeWidth={1.8} />
              </span>
              <span>
                NFT<span>-Studio</span>
              </span>
            </button>
            <div className="ns-topbar-actions">
              <button
                className="ns-help-button"
                onClick={() => navigate('guide')}
                aria-label="Help and guide"
                aria-current={view === 'guide' ? 'page' : undefined}
              >
                <CircleHelp size={21} />
              </button>
              <StudioWallet />
            </div>
          </div>
        </header>
        <main id="studio-main" className="ns-main" ref={main} tabIndex={-1}>
          {view === 'create' && !mode && (
            <>
              <div className="ns-heading ns-home-heading">
                <div>
                  <p className="ns-eyebrow">CREATE ON CARDANO</p>
                  <h1>What will you create?</h1>
                  <p>Pick a format. Make it yours.</p>
                </div>
                <button
                  className="ns-draft-link"
                  onClick={() => navigate('projects')}
                >
                  <FolderOpen size={17} /> Open a project{' '}
                  <ArrowUpRight size={15} />
                </button>
              </div>
              <div className="ns-mode-grid">
                {homeFormats.map(([id, title, detail]) => {
                  const item = MODES.find((mode) => mode.id === id)!;
                  const Icon = symbols[item.id];
                  return (
                    <button
                      className={'ns-mode ns-mode-' + item.id}
                      key={item.id}
                      onClick={() => choose(item.id)}
                      style={{ '--mode-accent': item.accent } as CSSProperties}
                    >
                      <span className="ns-format-icon">
                        <Icon size={25} strokeWidth={1.6} />
                      </span>
                      {item.id === 'art' && (
                        <img
                          className="ns-card-art"
                          src={assetPath('/art/chroma.webp')}
                          alt=""
                        />
                      )}
                      <div className="ns-mode-content">
                        <h2>{title}</h2>
                        <p>{detail}</p>
                      </div>
                      <ArrowUpRight
                        className="ns-card-arrow"
                        size={18}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
              <p className="ns-start-hint">
                <ShieldCheck size={17} /> No wallet needed to start.
              </p>
            </>
          )}
          <div hidden={view !== 'create' || !mode}>
            {mode && (
              <CreationWorkbench
                key={creationKey}
                mode={mode}
                initialArt={initialArt}
                initialFiles={initialFiles}
                file={scrollFile}
                onUseScroll={(file) => {
                  choose('scroll');
                  setScrollFile(file);
                }}
                onShowcase={() => navigate('showcase')}
                onBack={home}
              />
            )}
          </div>
          {view === 'showcase' && (
            <StudioShowcase
              onCreate={choose}
              onUseArtwork={(art) => {
                choose(
                  art.interactive?.kind === 'beats'
                    ? 'music'
                    : art.interactive
                      ? 'utility'
                      : 'art',
                );
                setInitialArt(art);
              }}
              onUseFiles={(bundle) => {
                choose('data');
                setInitialFiles(bundle);
              }}
            />
          )}
          {view === 'projects' && (
            <ProjectsPanel
              onOpen={(art) => {
                choose('art');
                setInitialArt(art);
              }}
            />
          )}
          {view === 'recover' && <RecoveryPanel />}
          {view === 'guide' && (
            <>
              <button className="ns-back" onClick={() => navigate('create')}>
                <ArrowLeft size={18} /> Back to creating
              </button>
              <FieldGuide />
            </>
          )}
        </main>
        <nav className="ns-app-nav" aria-label="Main navigation">
          {views.map((item) => (
            <button
              key={item.id}
              data-view={item.id}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={21} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <footer className="ns-main-footer">
          <span>NFT-STUDIO · YOUR WORK, ON CHAIN</span>
          <a
            href="https://github.com/BEACNpool/NFT-Studio"
            target="_blank"
            rel="noreferrer"
          >
            Made by BEACN <ArrowUpRight size={13} />
          </a>
        </footer>
      </div>
    </>
  );
}
function FieldGuide() {
  const items = [
    [
      '01',
      'Start with the thing you want to make.',
      'An image, a song, a playable game, a finished Scroll or a Book that keeps growing. Each format gets its own tools.',
    ],
    [
      '02',
      'Preview what actually fits.',
      'On-chain space is finite. Image compression, file size, words and wallet inputs all affect the transaction. We show the exact content before you approve it. Large works may need more than one transaction.',
    ],
    [
      '03',
      'Your wallet is in charge.',
      'Nothing is signed automatically. Review the content, destination, network fee, ADA kept with the asset and minting rules, then approve in your wallet.',
    ],
    [
      '04',
      'Confirmation is a separate step.',
      'A submitted transaction is not yet confirmed. Keep its transaction ID and receipt. If the network response is unclear, check that ID before trying again.',
    ],
    [
      '05',
      'Give the collectible a life after minting.',
      'Download a playable copy, save the editable project and keep the recovery information. Public programs can be copied and used by anyone; they are not holder-only services.',
    ],
  ];
  return (
    <>
      <div className="ns-heading">
        <div>
          <p className="ns-eyebrow">A LITTLE CONTEXT. A BETTER CREATION.</p>
          <h1>From an idea to on chain.</h1>
        </div>
      </div>
      <div className="ns-guide">
        {items.map(([n, title, body]) => (
          <article key={n}>
            <span>{n}</span>
            <div>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          </article>
        ))}
        <aside>
          <h2>Choose what you publish.</h2>
          <p>
            On-chain content is public. A wallet signature does not make it
            private or grant copyright. Publish material you have permission to
            use, and keep private information out of the transaction.
          </p>
        </aside>
      </div>
    </>
  );
}
