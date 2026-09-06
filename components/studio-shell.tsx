'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowUpRight,
  Plus,
  Grid2X2,
  FolderOpen,
  ScanLine,
  BookOpen,
  GitBranch,
  ImagePlus,
  ScrollText,
  LibraryBig,
  Music2,
  Gamepad2,
  Shapes,
  Clapperboard,
  Braces,
  ChevronRight,
  ShieldCheck,
  Layers3,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
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
  { id: 'showcase' as const, label: 'Showcase', icon: Grid2X2 },
  { id: 'projects' as const, label: 'My projects', icon: FolderOpen },
  { id: 'recover' as const, label: 'Activity', icon: ScanLine },
  { id: 'guide' as const, label: 'Guide', icon: BookOpen },
];
export function NFTStudio() {
  return (
    <SidebarProvider
      className="ns-app"
      style={{ '--sidebar-width': '224px' } as CSSProperties}
    >
      <StudioSurface />
    </SidebarProvider>
  );
}
function StudioSurface() {
  const [view, setView] = useState<StudioView>('create');
  const [mode, setMode] = useState<CreationMode | null>(null);
  const [initialArt, setInitialArt] = useState<Artwork>();
  const [initialFiles, setInitialFiles] = useState<FileSeed>();
  const [scrollFile, setScrollFile] = useState<File>();
  const [creationKey, setCreationKey] = useState(0);
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    const p = new URLSearchParams(location.search),
      kind = p.get('create');
    if (isCreationMode(kind)) setMode(kind);
  }, []);
  const navigate = (next: StudioView) => {
    setView(next);
    setOpenMobile(false);
    window.scrollTo({ top: 0 });
  };
  const choose = (next: CreationMode) => {
    setMode(next);
    setView('create');
    setInitialArt(undefined);
    setInitialFiles(undefined);
    setScrollFile(undefined);
    setCreationKey((k) => k + 1);
    const url = new URL(location.href);
    url.searchParams.set('create', next);
    history.replaceState(null, '', url);
    window.scrollTo({ top: 0 });
  };
  const home = () => {
    setMode(null);
    navigate('create');
    const url = new URL(location.href);
    url.searchParams.delete('create');
    history.replaceState(null, '', url);
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
      <Sidebar className="ns-sidebar">
        <SidebarHeader className="ns-brand-wrap">
          <button
            className="ns-brand"
            onClick={home}
            aria-label="NFT-Studio home"
          >
            <span className="ns-logo-mark">
              <Layers3 size={24} strokeWidth={1.8} />
            </span>
            <span className="ns-wordmark">
              NFT<span>-Studio</span>
            </span>
          </button>
          <span className="ns-byline">CREATOR WORKSPACE</span>
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label="Studio">
            <SidebarMenu className="ns-nav">
              {views.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    size="lg"
                    isActive={view === item.id}
                    onClick={() => navigate(item.id)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                    {view === item.id && (
                      <ChevronRight className="ns-nav-arrow" />
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </nav>
          <div className="ns-sidebar-note">
            <span className="ns-note-icon">
              <Sparkles size={18} />
            </span>
            <strong>From idea to on chain.</strong>
            <p>
              You create. We prepare the metadata. You sign when it’s ready.
            </p>
            <button onClick={() => navigate('guide')}>
              How it works <ArrowUpRight size={14} />
            </button>
          </div>
        </SidebarContent>
        <SidebarFooter className="ns-sidebar-footer">
          <a
            href="https://github.com/BEACNpool/NFT-Studio"
            target="_blank"
            rel="noreferrer"
          >
            <GitBranch size={17} /> Source code <ArrowUpRight size={14} />
          </a>
          <div className="ns-footer-brand">
            <img
              src={assetPath('/brand/beacn-64.png')}
              width="22"
              height="22"
              alt=""
            />
            <strong>BEACN</strong>
            <span>Built on Cardano</span>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="ns-main-wrap">
        <header className="ns-topbar">
          <div className="ns-breadcrumb">
            <SidebarTrigger className="ns-menu-toggle" />
            <button className="ns-mobile-brand" onClick={home}>
              <Layers3 size={22} /> NFT-Studio
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {mode && view === 'create'
                ? MODES.find((m) => m.id === mode)!.title
                : views.find((v) => v.id === view)!.label}
            </strong>
          </div>
          <div className="ns-topbar-actions">
            <span className="ns-network">
              <span />
              Cardano
            </span>
            <StudioWallet />
          </div>
        </header>
        <main id="studio-main" className="ns-main">
          {view === 'create' && !mode && (
            <>
              <div className="ns-heading ns-home-heading">
                <div>
                  <p className="ns-eyebrow">YOUR NEXT ORIGINAL</p>
                  <h1>What will you create?</h1>
                  <p>Choose a format. Bring your idea to life.</p>
                </div>
                <button
                  className="ns-draft-link"
                  onClick={() => navigate('projects')}
                >
                  <FolderOpen size={17} /> Open a project{' '}
                  <ArrowUpRight size={15} />
                </button>
              </div>
              <ol className="ns-flow-strip" aria-label="How creating works">
                <li aria-current="step">
                  <span>1</span>
                  <strong>Choose</strong>
                </li>
                <li>
                  <span>2</span>
                  <strong>Create</strong>
                </li>
                <li>
                  <span>3</span>
                  <strong>Review & sign</strong>
                </li>
              </ol>
              <div className="ns-mode-grid">
                {MODES.map((item) => {
                  const Icon = symbols[item.id];
                  return (
                    <button
                      className={'ns-mode ns-mode-' + item.id}
                      key={item.id}
                      onClick={() => choose(item.id)}
                      style={{ '--mode-accent': item.accent } as CSSProperties}
                    >
                      <div className="ns-format-visual">
                        {item.image ? (
                          <img
                            className="ns-format-image"
                            src={assetPath(item.image)}
                            alt=""
                          />
                        ) : (
                          <Icon
                            className="ns-format-glyph"
                            size={44}
                            strokeWidth={1.2}
                          />
                        )}
                        <span className="ns-format-type">
                          <Icon size={14} />
                          {item.tag.split(' · ')[0]}
                        </span>
                        <span className="ns-format-open">
                          <ArrowUpRight size={18} />
                        </span>
                      </div>
                      <div className="ns-mode-content">
                        <h2>{item.title}</h2>
                        <p>{item.detail}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="ns-ready-note">
                <span className="ns-note-icon">
                  <ShieldCheck size={21} />
                </span>
                <div>
                  <strong>Create first. Connect when you’re ready.</strong>
                  <p>
                    Your wallet approves the final transaction. No code or
                    metadata editing needed.
                  </p>
                </div>
                <button onClick={() => navigate('showcase')}>
                  Explore creations <ArrowRight size={16} />
                </button>
              </div>
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
          {view === 'guide' && <FieldGuide />}
        </main>
        <nav className="ns-bottom-nav" aria-label="Mobile studio">
          {views.map((item) => (
            <button
              key={item.id}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={21} />
              <span>{item.id === 'projects' ? 'Projects' : item.label}</span>
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
      </SidebarInset>
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
