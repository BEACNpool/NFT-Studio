'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  Download,
  Paintbrush,
  Shuffle,
  Plus,
  Trash2,
  Check,
  Save,
  Undo2,
  Redo2,
  ImagePlus,
  Shapes,
  X,
  FolderOpen,
} from 'lucide-react';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Slider } from './ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { DesignLab } from './design-lab';
import { ArtPreview } from './art-preview';
import { InteractiveLab } from './interactive-lab';
import { MintDialog } from './mint-dialog';
import { UtilityPlanner } from './utility-planner';
import {
  INITIAL,
  SOURCES,
  renderArtwork,
  isGenerative,
  type Artwork,
  type SavedArtwork,
} from '@/lib/art';
import { interactiveDefault } from '@/lib/interactive';
import { imageArtwork, importArtwork } from '@/lib/studio-art';
import { loadSaved, saveRecords, removeRecord } from '@/lib/storage';
import { download, filename, jsonBlob, packageArtworks } from '@/lib/export';
import type { CreationMode } from '@/lib/studio-modes';

const stages = ['Create', 'Details', 'Extras', 'Review'];
export function ArtWorkbench({
  mode,
  initialArt,
  onSaved,
}: {
  mode: CreationMode;
  initialArt?: Artwork;
  onSaved?: () => void;
}) {
  const [art, setArt] = useState<Artwork>(
    () =>
      initialArt ||
      (mode === 'music' || mode === 'utility'
        ? {
            ...INITIAL,
            source: mode === 'music' ? 'solar' : 'orbit',
            name: mode === 'music' ? 'My beat' : 'My focus capsule',
            description: '',
            interactive: interactiveDefault(
              mode === 'music' ? 'beats' : 'focus',
            ),
          }
        : INITIAL),
  );
  const [ready, setReady] = useState(!!initialArt || mode !== 'art');
  const [buildPane, setBuildPane] = useState(
    mode === 'music' || mode === 'utility' ? 'app' : 'cover',
  );
  const [stage, setStage] = useState(0),
    [design, setDesign] = useState(false);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState('');
  const [past, setPast] = useState<Artwork[]>([]),
    [future, setFuture] = useState<Artwork[]>([]);
  const uploadRef = useRef<HTMLInputElement>(null),
    importRef = useRef<HTMLInputElement>(null);
  const operation = useRef(false),
    current = useRef(art);
  current.current = art;
  useEffect(() => {
    if (initialArt) {
      setArt(initialArt);
      setReady(true);
    }
  }, [initialArt]);
  const update = (next: Artwork) => {
    setPast((p) => [...p, current.current].slice(-30));
    setFuture([]);
    setArt(next);
    setReady(true);
    setError('');
    setNotice('');
  };
  const patch = (values: Partial<Artwork>) => update({ ...art, ...values });
  const perform = async (label: string, action: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(label);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      operation.current = false;
      setBusy('');
    }
  };
  const upload = (file?: File) =>
    file &&
    perform('Opening image…', async () => {
      const image = await imageArtwork(file);
      update({ ...image, interactive: art.interactive });
    });
  const importFile = (file?: File) =>
    file &&
    perform('Opening project…', async () => {
      update(await importArtwork(file));
    });
  const save = () =>
    perform('Saving project…', async () => {
      if (!art.name.trim())
        throw new Error('Give your creation a title first.');
      const saved = await loadSaved();
      if (saved.length >= 50)
        throw new Error(
          'This device holds 50 projects. Export and remove a project to make room.',
        );
      if (
        saved.some(
          (record) => JSON.stringify(record.art) === JSON.stringify(art),
        )
      ) {
        setNotice('This version is already saved.');
        return;
      }
      const thumbnail = (await renderArtwork(art, 320)).toDataURL(
        'image/webp',
        0.8,
      );
      await saveRecords([
        {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          art: structuredClone(art),
          thumbnail,
        },
      ]);
      setNotice('Saved on this device. Export a copy to keep it elsewhere.');
      onSaved?.();
    });
  const exportProject = () =>
    download(
      jsonBlob({ schema: 'nftstudio.artwork.v1', artwork: art }),
      filename(art.name) + '.nftstudio.json',
    );
  const exportPackage = () =>
    perform('Preparing creation package…', async () => {
      download(
        await packageArtworks([art], 1024, () => {}),
        filename(art.name) + '.zip',
      );
      setNotice(
        'Your package contains the full-size cover, editable project and any embedded app.',
      );
    });
  const continueStage = () => {
    if (!ready) {
      setError('Choose an image, a blank canvas or a starter.');
      return;
    }
    if (
      stage >= 1 &&
      (!art.name.trim() || new TextEncoder().encode(art.name).length > 64)
    ) {
      setError('Your title must contain 1–64 UTF-8 bytes.');
      return;
    }
    setError('');
    setStage(Math.min(3, stage + 1));
    window.scrollTo({ top: 0 });
  };
  return (
    <div className="ns-creator">
      <ol className="ns-stage-list" aria-label="Creation steps">
        {stages.map((label, i) => (
          <li
            key={label}
            className={stage === i ? 'current' : stage > i ? 'complete' : ''}
          >
            <button
              onClick={() => {
                if (i < stage) setStage(i);
              }}
              disabled={i > stage}
              aria-current={stage === i ? 'step' : undefined}
            >
              <span>
                {i < stage ? (
                  <Check size={13} />
                ) : (
                  String(i + 1).padStart(2, '0')
                )}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>
      <input
        ref={uploadRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          void importFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {error && (
        <p className="ns-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="ns-notice" role="status">
          {notice}
        </p>
      )}
      {!ready && stage === 0 ? (
        <div className="ns-start-art">
          <button
            className="ns-upload-zone"
            onClick={() => uploadRef.current?.click()}
            disabled={!!busy}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void upload(e.dataTransfer.files[0]);
            }}
          >
            <span className="ns-upload-icon">
              <ImagePlus size={34} strokeWidth={1.4} />
            </span>
            <h2>{busy || 'Your image starts here.'}</h2>
            <p>
              Drop a photo, artwork or PFP.
              <br />
              Or choose one from your device.
            </p>
            <span className="ns-primary">
              Choose an image <Upload size={17} />
            </span>
            <small>PNG, JPEG or WebP · up to 12 MB</small>
          </button>
          <div className="ns-start-options">
            <button
              onClick={() =>
                update({
                  ...INITIAL,
                  source: 'blank',
                  name: 'Untitled creation',
                  description: '',
                  scale: 100,
                })
              }
            >
              <Paintbrush size={22} />
              <div>
                <strong>Start with a blank canvas</strong>
                <span>Text, drawing, shapes and composition.</span>
              </div>
              <ArrowUpRightIcon />
            </button>
            <button onClick={() => importRef.current?.click()}>
              <FolderOpen size={22} />
              <div>
                <strong>Reopen a project</strong>
                <span>NFT Studio and PRISM projects welcome.</span>
              </div>
              <ArrowUpRightIcon />
            </button>
            <p className="ns-eyebrow">OR START WITH A LITTLE INSPIRATION</p>
            <div className="ns-starters">
              {SOURCES.slice(0, 3).map((s) => (
                <button
                  key={s.id}
                  onClick={() =>
                    update({
                      ...INITIAL,
                      source: s.id,
                      name: s.name,
                      description: s.description,
                    })
                  }
                >
                  <img src={s.image} alt={s.name} />
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {stage === 0 && (
            <>
              {(mode === 'music' || mode === 'utility') && (
                <Tabs
                  value={buildPane}
                  onValueChange={setBuildPane}
                  className="ns-build-tabs"
                >
                  <TabsList variant="line">
                    <TabsTrigger value="app">Build the app</TabsTrigger>
                    <TabsTrigger value="cover">Design the cover</TabsTrigger>
                    {mode === 'utility' && (
                      <TabsTrigger value="plan">Plan a benefit</TabsTrigger>
                    )}
                  </TabsList>
                </Tabs>
              )}
              {(mode === 'music' || mode === 'utility') && (
                <div hidden={buildPane !== 'app'} className="ns-embedded-lab">
                  <InteractiveLab
                    art={art}
                    hasArtwork={ready}
                    onApply={(spec) => {
                      patch({ interactive: spec });
                      setNotice('App settings applied to this creation.');
                    }}
                    onRemove={() => patch({ interactive: undefined })}
                    onExample={update}
                  />
                </div>
              )}
              {buildPane === 'plan' && (
                <UtilityPlanner art={art} onChange={update} />
              )}
              <div hidden={buildPane !== 'cover'} className="ns-editor-grid">
                <div className="ns-canvas-panel">
                  <div className="ns-canvas-toolbar">
                    <span>YOUR CANVAS</span>
                    <div>
                      <button
                        title="Undo"
                        aria-label="Undo"
                        disabled={!past.length}
                        onClick={() => {
                          const previous = past.at(-1)!;
                          setFuture((f) => [art, ...f]);
                          setPast((p) => p.slice(0, -1));
                          setArt(previous);
                        }}
                      >
                        <Undo2 size={17} />
                      </button>
                      <button
                        title="Redo"
                        aria-label="Redo"
                        disabled={!future.length}
                        onClick={() => {
                          setPast((p) => [...p, art]);
                          setArt(future[0]);
                          setFuture((f) => f.slice(1));
                        }}
                      >
                        <Redo2 size={17} />
                      </button>
                    </div>
                  </div>
                  <ArtPreview art={art} size={1024} />
                  <div className="ns-canvas-caption">
                    <span>WORKING ORIGINAL</span>
                    <span>Exact compressed preview at mint review</span>
                  </div>
                </div>
                <div className="ns-control-panel">
                  <div className="ns-panel-heading">
                    <h2>Shape the image.</h2>
                    <p>Keep it simple, or make it your own.</p>
                  </div>
                  <Button
                    className="ns-primary ns-wide"
                    onClick={() => setDesign(true)}
                  >
                    <Paintbrush size={17} /> Open Design Lab{' '}
                    <ArrowRight size={16} />
                  </Button>
                  <p className="ns-hint">
                    Draw, add text, arrange layers, choose a palette and build a
                    frame.
                  </p>
                  <Tabs defaultValue="adjust" className="ns-adjust-tabs">
                    <TabsList variant="line">
                      <TabsTrigger value="adjust">Adjust</TabsTrigger>
                      <TabsTrigger value="source">Source</TabsTrigger>
                    </TabsList>
                    <TabsContent value="adjust">
                      <Range
                        label="Hue"
                        value={art.hue}
                        min={0}
                        max={360}
                        suffix="°"
                        onChange={(value) => patch({ hue: value })}
                      />
                      <Range
                        label="Scale"
                        value={art.scale}
                        min={35}
                        max={160}
                        suffix="%"
                        onChange={(value) => patch({ scale: value })}
                      />
                      <Range
                        label="Rotation"
                        value={art.rotation}
                        min={0}
                        max={360}
                        suffix="°"
                        onChange={(value) => patch({ rotation: value })}
                      />
                      {isGenerative(art.source) && (
                        <Range
                          label="Detail"
                          value={art.detail}
                          min={10}
                          max={100}
                          suffix="%"
                          onChange={(value) => patch({ detail: value })}
                        />
                      )}
                      <label className="ns-color-field">
                        Background
                        <input
                          aria-label="Canvas background"
                          type="color"
                          value={art.background}
                          onChange={(e) =>
                            patch({ background: e.target.value })
                          }
                        />
                      </label>
                      <Button
                        className="ns-secondary ns-wide"
                        onClick={() =>
                          patch({
                            seed: Math.floor(Math.random() * 999999),
                            hue: Math.floor(Math.random() * 360),
                          })
                        }
                      >
                        <Shuffle size={16} /> Another variation
                      </Button>
                    </TabsContent>
                    <TabsContent value="source">
                      <button
                        className="ns-secondary ns-wide"
                        onClick={() => uploadRef.current?.click()}
                      >
                        <Upload size={16} /> Replace image
                      </button>
                      <div className="ns-source-list">
                        {SOURCES.map((s) => (
                          <button
                            key={s.id}
                            aria-pressed={art.source === s.id}
                            onClick={() =>
                              update({
                                ...art,
                                source: s.id,
                                customImage: undefined,
                                scale: isGenerative(s.id) ? 100 : 87,
                                detail: isGenerative(s.id) ? 65 : 0,
                              })
                            }
                          >
                            {s.image ? (
                              <img src={s.image} alt="" />
                            ) : (
                              <Shapes size={21} />
                            )}
                            <span>
                              {s.name}
                              <small>{s.tag}</small>
                            </span>
                            {art.source === s.id && <Check size={15} />}
                          </button>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </>
          )}
          {stage === 1 && (
            <div className="ns-details-grid">
              <div className="ns-detail-preview">
                <ArtPreview art={art} size={700} />
                <p>
                  {art.interactive
                    ? 'Cover + a working embedded app'
                    : 'Your image, stored in the transaction'}
                </p>
              </div>
              <div className="ns-detail-fields">
                <h2>Give it a name. Tell its story.</h2>
                <label className="ns-field">
                  Title
                  <input
                    value={art.name}
                    maxLength={64}
                    onChange={(e) => patch({ name: e.target.value })}
                    placeholder="Something worth keeping"
                  />
                  <small>
                    {new TextEncoder().encode(art.name).length} / 64 UTF-8 bytes
                  </small>
                </label>
                <label className="ns-field">
                  Description
                  <textarea
                    rows={4}
                    value={art.description}
                    maxLength={1400}
                    onChange={(e) => patch({ description: e.target.value })}
                    placeholder="What should someone know about this creation?"
                  />
                  <small>
                    Your words are public and use transaction space.
                  </small>
                </label>
                <div className="ns-field">
                  <span>Usage rights</span>
                  <Select
                    value={art.license}
                    onValueChange={(value) =>
                      value && patch({ license: String(value) })
                    }
                  >
                    <SelectTrigger className="ns-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        'No license specified',
                        'All rights reserved',
                        'CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/',
                        'CC0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/',
                      ].map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <small>Only grant rights you actually hold.</small>
                </div>
                <div className="ns-traits-heading">
                  <h3>Traits</h3>
                  <button
                    onClick={() =>
                      patch({
                        traits: [...art.traits, { trait_type: '', value: '' }],
                      })
                    }
                    disabled={art.traits.length >= 12}
                  >
                    <Plus size={14} /> Add trait
                  </button>
                </div>
                {art.traits.map((trait, i) => (
                  <div className="ns-trait" key={i}>
                    <input
                      aria-label={'Trait ' + (i + 1) + ' name'}
                      placeholder="Trait"
                      maxLength={64}
                      value={trait.trait_type}
                      onChange={(e) =>
                        patch({
                          traits: art.traits.map((t, j) =>
                            j === i ? { ...t, trait_type: e.target.value } : t,
                          ),
                        })
                      }
                    />
                    <input
                      aria-label={'Trait ' + (i + 1) + ' value'}
                      placeholder="Value"
                      maxLength={64}
                      value={trait.value}
                      onChange={(e) =>
                        patch({
                          traits: art.traits.map((t, j) =>
                            j === i ? { ...t, value: e.target.value } : t,
                          ),
                        })
                      }
                    />
                    <button
                      aria-label={'Remove trait ' + (i + 1)}
                      onClick={() =>
                        patch({ traits: art.traits.filter((_, j) => j !== i) })
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {stage === 2 && (
            <div className="ns-embedded-lab">
              <InteractiveLab
                art={art}
                hasArtwork={ready}
                onApply={(spec) => {
                  patch({ interactive: spec });
                  setNotice(
                    'App settings applied. You can continue to review.',
                  );
                }}
                onRemove={() => patch({ interactive: undefined })}
                onExample={update}
              />
              <div className="ns-inline-note">
                <Shapes size={18} />
                <p>
                  These apps work, are public, and can run offline. Holder-only
                  access, tickets and redemption need their own enforcement; an
                  NFT description cannot activate them.
                </p>
              </div>
              <details className="ns-plan-details">
                <summary>Plan additional holder benefits</summary>
                <UtilityPlanner art={art} onChange={update} />
              </details>
            </div>
          )}
          {stage === 3 && (
            <div className="ns-review-grid">
              <div className="ns-review-art">
                <ArtPreview art={art} size={800} />
                <span>
                  YOUR CREATION · EXACT ON-CHAIN PREVIEW AT WALLET REVIEW
                </span>
              </div>
              <div className="ns-review-summary">
                <p className="ns-eyebrow">READY FOR YOUR WALLET</p>
                <h2>{art.name}</h2>
                <p>{art.description || 'A creation made in NFT Studio.'}</p>
                <dl>
                  <div>
                    <dt>Includes</dt>
                    <dd>
                      Image
                      {art.interactive
                        ? ' + ' +
                          (art.interactive.kind === 'beats'
                            ? 'Beat Lab'
                            : art.interactive.kind === 'focus'
                              ? 'Focus Capsule'
                              : 'Decision Deck')
                        : ''}
                    </dd>
                  </div>
                  {art.utilities.length > 0 && (
                    <div>
                      <dt>Benefit blueprints</dt>
                      <dd>{art.utilities.length} · implementation required</dd>
                    </div>
                  )}
                  <div>
                    <dt>Destination</dt>
                    <dd>Your connected wallet</dd>
                  </div>
                  <div>
                    <dt>Network</dt>
                    <dd>Cardano mainnet</dd>
                  </div>
                  <div>
                    <dt>Studio fee</dt>
                    <dd>None</dd>
                  </div>
                  <div>
                    <dt>Network fee + asset ADA</dt>
                    <dd>Calculated with your wallet</dd>
                  </div>
                </dl>
                <div className="ns-metadata-ready">
                  <Check size={18} />
                  <div>
                    <strong>Metadata handled for you</strong>
                    <p>
                      Your title, artwork, attributes and extras become the
                      NFT’s on-chain metadata.
                    </p>
                  </div>
                </div>
                <MintDialog art={art} triggerLabel="Review with my wallet" />
                <p className="ns-hint">
                  Connect, review the exact content and transaction, then
                  approve in your wallet. The policy belongs to your wallet;
                  review its minting window before signing.
                </p>
                <button
                  className="ns-text-link"
                  onClick={exportPackage}
                  disabled={!!busy}
                >
                  <Download size={16} /> Keep the full creation package
                </button>
              </div>
            </div>
          )}
        </>
      )}
      <div className="ns-workbench-footer">
        <div>
          <button
            className="ns-secondary"
            disabled={!ready || !!busy}
            onClick={save}
          >
            <Save size={16} /> Save project
          </button>
          <button
            className="ns-icon-button"
            title="Export editable project"
            aria-label="Export editable project"
            disabled={!ready || !!busy}
            onClick={exportProject}
          >
            <Download size={18} />
          </button>
          {busy && <span role="status">{busy}</span>}
        </div>
        <div>
          {stage > 0 && (
            <button
              className="ns-back-button"
              onClick={() => setStage(stage - 1)}
            >
              <ArrowLeft size={16} /> Back
            </button>
          )}
          {stage < 3 && (
            <Button
              className="ns-primary"
              disabled={!ready || !!busy}
              onClick={continueStage}
            >
              {stage === 2 && !art.interactive
                ? 'Continue without an app'
                : 'Continue'}
              <ArrowRight size={17} />
            </Button>
          )}
        </div>
      </div>
      <DesignLab
        open={design}
        onOpenChange={setDesign}
        art={art}
        onApply={update}
      />
    </div>
  );
}
function Range({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="ns-range">
      <label>
        {label}
        <span>
          {value}
          {suffix}
        </span>
      </label>
      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
    </div>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={17} className="ns-option-arrow" />;
}

export function ProjectsPanel({ onOpen }: { onOpen: (art: Artwork) => void }) {
  const [items, setItems] = useState<SavedArtwork[]>([]),
    [error, setError] = useState(''),
    [removed, setRemoved] = useState<SavedArtwork | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const refresh = () =>
    loadSaved()
      .then(setItems)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void refresh();
  }, []);
  const remove = async (item: SavedArtwork) => {
    try {
      await removeRecord(item.id);
      setRemoved(item);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <div className="ns-heading">
        <div>
          <p className="ns-eyebrow">CONTINUE WHERE YOU LEFT OFF</p>
          <h1>My projects</h1>
          <p>
            Saved on this device. Export a copy to move your work elsewhere.
          </p>
        </div>
        <Button className="ns-secondary" onClick={() => input.current?.click()}>
          <Upload size={16} /> Open project file
        </Button>
      </div>
      <input
        ref={input}
        hidden
        type="file"
        accept=".json,application/json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            onOpen(await importArtwork(f));
          } catch (error) {
            setError((error as Error).message);
          }
          e.target.value = '';
        }}
      />
      {error && (
        <p className="ns-error" role="alert">
          {error}
        </p>
      )}
      {removed && (
        <p className="ns-notice">
          Project removed.{' '}
          <button
            onClick={async () => {
              try {
                await saveRecords([removed]);
                setRemoved(null);
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Undo
          </button>
        </p>
      )}
      {!items.length ? (
        <div className="ns-empty">
          <FolderOpen size={38} strokeWidth={1} />
          <h2>A place for your next idea.</h2>
          <p>
            Save a creation from the workbench, or reopen an exported NFT Studio
            or PRISM project.
          </p>
        </div>
      ) : (
        <div className="ns-project-grid">
          {items.map((item) => (
            <article key={item.id}>
              <button
                className="ns-project-open"
                onClick={() => onOpen(item.art)}
              >
                <img src={item.thumbnail} alt={item.art.name} />
                <h2>{item.art.name}</h2>
                <p>
                  {new Date(item.createdAt).toLocaleDateString()} ·{' '}
                  {item.art.interactive ? 'Image + app' : 'Artwork'}
                </p>
              </button>
              <div>
                <button
                  onClick={() =>
                    download(
                      jsonBlob({
                        schema: 'nftstudio.artwork.v1',
                        artwork: item.art,
                      }),
                      filename(item.art.name) + '.nftstudio.json',
                    )
                  }
                >
                  <Download size={15} /> Export
                </button>
                <button
                  aria-label={'Remove ' + item.art.name}
                  onClick={() => void remove(item)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
