'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Paintbrush,
  Type,
  SlidersHorizontal,
  Undo2,
  Redo2,
  Plus,
  Trash2,
  Copy,
  Check,
  Eraser,
  Circle,
  Square,
  Minus,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { ArtPreview } from './art-preview';
import { type Artwork, SOURCES, validateArtwork } from '@/lib/art';
import {
  PALETTES,
  normalizeDesign,
  drawStroke,
  MAX_STROKES,
  MAX_POINTS,
  type Design,
  type InkStroke,
  type InkTool,
  type TextLayer,
} from '@/lib/design';

type Panel = 'compose' | 'text' | 'draw';
export function DesignLab({
  open,
  onOpenChange,
  art,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  art: Artwork;
  onApply: (art: Artwork) => void;
}) {
  const [draft, setDraft] = useState(art),
    [panel, setPanel] = useState<Panel>('compose'),
    [selectedText, setSelectedText] = useState(0),
    [error, setError] = useState('');
  const [tool, setTool] = useState<InkTool>('pen'),
    [ink, setInk] = useState('#d8ef82'),
    [width, setWidth] = useState(8),
    [symmetry, setSymmetry] = useState(1);
  const [past, setPast] = useState<Artwork[]>([]),
    [future, setFuture] = useState<Artwork[]>([]);
  const overlay = useRef<HTMLCanvasElement>(null),
    stroke = useRef<InkStroke | null>(null),
    pointer = useRef<number | null>(null);
  const starting = useRef(''),
    current = useRef(draft);
  const rangeStart = useRef<Artwork | null>(null);
  current.current = draft;
  const design = normalizeDesign(draft.design),
    layer = design.texts[selectedText];
  useEffect(() => {
    if (open) {
      setDraft(structuredClone(art));
      starting.current = JSON.stringify(art);
      setPast([]);
      setFuture([]);
      setError('');
      setSelectedText(0);
      stroke.current = null;
      pointer.current = null;
      rangeStart.current = null;
    }
  }, [open]);
  const change = (next: Artwork) => {
    const previous = current.current;
    if (!rangeStart.current) setPast((p) => [...p, previous].slice(-24));
    setFuture([]);
    current.current = next;
    setDraft(next);
    setError('');
  };
  const endRange = () => {
    const before = rangeStart.current;
    rangeStart.current = null;
    if (before && before !== current.current)
      setPast((p) => [...p, before].slice(-24));
  };
  const patch = (values: Partial<Design>) =>
    change({
      ...current.current,
      design: { ...normalizeDesign(current.current.design), ...values },
    });
  const undo = () => {
    if (!past.length) return;
    const previous = current.current;
    setFuture((f) => [previous, ...f]);
    const next = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setDraft(next);
    current.current = next;
  };
  const redo = () => {
    if (!future.length) return;
    const previous = current.current;
    setPast((p) => [...p, previous]);
    const next = future[0];
    setFuture((f) => f.slice(1));
    setDraft(next);
    current.current = next;
  };
  const textPatch = (values: Partial<TextLayer>) =>
    patch({
      texts: design.texts.map((t, i) =>
        i === selectedText ? { ...t, ...values } : t,
      ),
    });
  const addText = () => {
    if (design.texts.length >= 6) return;
    patch({
      texts: [
        ...design.texts,
        {
          id: 'text-' + Date.now(),
          text: 'MAKE YOUR MARK',
          x: 512,
          y: 850 - design.texts.length * 75,
          size: 52,
          color: ink,
          font: 'sans',
          rotation: 0,
          align: 'center',
        },
      ],
    });
    setSelectedText(design.texts.length);
  };
  const clearOverlay = () =>
    overlay.current?.getContext('2d')?.clearRect(0, 0, 1024, 1024);
  const coordinate = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ): [number, number] => {
    const r = event.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1024, ((event.clientX - r.left) / r.width) * 1024)),
      Math.max(0, Math.min(1024, ((event.clientY - r.top) / r.height) * 1024)),
    ];
  };
  const showStroke = () => {
    const ctx = overlay.current?.getContext('2d');
    if (!ctx || !stroke.current) return;
    clearOverlay();
    const preview =
      stroke.current.tool === 'eraser'
        ? {
            ...stroke.current,
            tool: 'pen' as const,
            color: '#ff9090',
            opacity: 50,
          }
        : stroke.current;
    drawStroke(ctx, preview);
  };
  const begin = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (
      pointer.current !== null ||
      (event.pointerType === 'mouse' && event.button !== 0)
    )
      return;
    if (
      design.strokes.length >= MAX_STROKES ||
      design.strokes.reduce((n, s) => n + s.points.length, 0) >= MAX_POINTS
    ) {
      setError(
        'The drawing limit is reached. Undo or clear some strokes before adding more.',
      );
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = event.pointerId;
    stroke.current = {
      tool,
      color: ink,
      width,
      opacity: 100,
      symmetry,
      points: [coordinate(event)],
    };
    showStroke();
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!stroke.current || event.pointerId !== pointer.current) return;
    const s = stroke.current,
      p = coordinate(event),
      last = s.points[s.points.length - 1];
    if (['line', 'circle', 'rectangle'].includes(s.tool))
      s.points = [s.points[0], p];
    else if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 3) {
      if (s.points.length >= 600) {
        s.points = s.points.filter((_, i) => i % 2 === 0);
        setError(
          'This long stroke was smoothed to keep drawing responsive. Shorter strokes preserve finer detail.',
        );
      }
      s.points.push(p);
    }
    showStroke();
  };
  const finish = (
    event: React.PointerEvent<HTMLCanvasElement>,
    cancel = false,
  ) => {
    if (pointer.current !== event.pointerId) return;
    const s = stroke.current;
    if (s && !cancel) {
      const end = coordinate(event);
      if (['line', 'circle', 'rectangle'].includes(s.tool))
        s.points = [s.points[0], end];
      else if (
        Math.hypot(
          end[0] - s.points[s.points.length - 1][0],
          end[1] - s.points[s.points.length - 1][1],
        ) > 1
      ) {
        if (s.points.length === 600) s.points.pop();
        s.points.push(end);
      }
    }
    stroke.current = null;
    pointer.current = null;
    clearOverlay();
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!s || cancel) return;
    const d = normalizeDesign(current.current.design);
    if (
      d.strokes.reduce((n, v) => n + v.points.length, 0) + s.points.length >
      MAX_POINTS
    ) {
      setError(
        'That stroke exceeds the drawing point limit. Try a shorter stroke.',
      );
      return;
    }
    patch({ strokes: [...d.strokes, s] });
  };
  const range = (
    label: string,
    key:
      | 'offsetX'
      | 'offsetY'
      | 'opacity'
      | 'contrast'
      | 'saturation'
      | 'frameWidth',
    min: number,
    max: number,
    suffix = '',
  ) => (
    <label className="lab-range">
      <span>
        {label}
        <b>
          {design[key]}
          {suffix}
        </b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={design[key]}
        onChange={(e) => patch({ [key]: +e.target.value })}
      />
    </label>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="design-dialog">
        <div className="lab-title-row">
          <div>
            <p className="eyebrow">BEACN PRISM / DESIGN LAB</p>
            <DialogTitle>
              Your imagination. <em>On canvas.</em>
            </DialogTitle>
            <DialogDescription>
              Draw, compose and make it yours. Apply your design when you’re
              ready.
            </DialogDescription>
          </div>
          <div className="lab-history">
            <button
              className="icon-button"
              aria-label="Undo design change"
              disabled={!past.length}
              onClick={undo}
            >
              <Undo2 size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Redo design change"
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 size={17} />
            </button>
          </div>
        </div>
        <div className="lab-layout">
          <section className="lab-preview-column">
            <div
              className={'lab-canvas ' + (panel === 'draw' ? 'is-drawing' : '')}
            >
              <ArtPreview art={draft} size={1024} />
              {panel === 'draw' && (
                <canvas
                  ref={overlay}
                  width={1024}
                  height={1024}
                  aria-label="Drawing canvas. Drag with mouse, pen or touch to draw. Use the text and composition controls for keyboard editing."
                  onPointerDown={begin}
                  onPointerMove={move}
                  onPointerUp={(e) => finish(e)}
                  onPointerCancel={(e) => finish(e, true)}
                  onLostPointerCapture={(e) => finish(e, true)}
                />
              )}
            </div>
            <div className="lab-canvas-caption">
              <span>
                {panel === 'draw'
                  ? 'DRAW DIRECTLY ON THE CANVAS'
                  : 'LIVE DESIGN PREVIEW'}
              </span>
              <span>
                {design.texts.length} text · {design.strokes.length} strokes
              </span>
            </div>
            <p className="lab-help">
              {panel === 'draw'
                ? 'Mouse, pen or touch. Each stroke is one undo. The eraser removes ink only; a red preview marks what will be erased.'
                : 'Text and ink stay independent of the artwork underneath. Your full design is included in PNG exports and the on-chain mint preview.'}
            </p>
            <div className="lab-preview-actions">
              <button
                className="text-link"
                onClick={() =>
                  change({
                    ...draft,
                    source: 'blank',
                    customImage: undefined,
                    name: 'My original design',
                    description: '',
                    detail: 0,
                    design: normalizeDesign(draft.design),
                  })
                }
              >
                <Plus size={15} />
                Start with a blank canvas
              </button>
              <button
                className="text-link"
                onClick={() => change({ ...draft, design: undefined })}
              >
                Reset Design Lab layers
              </button>
            </div>
          </section>
          <section
            className="lab-controls"
            onPointerDownCapture={(e) => {
              const target = e.target as HTMLInputElement;
              if (target.tagName === 'INPUT' && target.type === 'range')
                rangeStart.current ||= current.current;
            }}
            onPointerUpCapture={endRange}
            onPointerCancelCapture={endRange}
            onBlurCapture={endRange}
            onKeyDownCapture={(e) => {
              const target = e.target as HTMLInputElement;
              if (
                target.type === 'range' &&
                [
                  'ArrowLeft',
                  'ArrowRight',
                  'ArrowUp',
                  'ArrowDown',
                  'Home',
                  'End',
                  'PageUp',
                  'PageDown',
                ].includes(e.key)
              )
                rangeStart.current ||= current.current;
            }}
            onKeyUpCapture={endRange}
          >
            <div className="lab-tabs" role="tablist" aria-label="Design tools">
              {(
                [
                  { id: 'compose', label: 'Compose', icon: SlidersHorizontal },
                  { id: 'text', label: 'Text', icon: Type },
                  { id: 'draw', label: 'Draw', icon: Paintbrush },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={panel === t.id}
                  className={panel === t.id ? 'active' : ''}
                  onClick={() => {
                    stroke.current = null;
                    pointer.current = null;
                    clearOverlay();
                    setPanel(t.id);
                  }}
                >
                  <t.icon size={16} />
                  {t.label}
                </button>
              ))}
            </div>
            {panel === 'compose' && (
              <div className="lab-panel">
                <label className="lab-field">
                  Artwork underneath
                  <select
                    value={draft.source}
                    onChange={(e) =>
                      change({
                        ...draft,
                        source: e.target.value,
                        customImage:
                          e.target.value === 'custom'
                            ? draft.customImage
                            : undefined,
                      })
                    }
                  >
                    <option value="blank">Blank canvas</option>
                    {SOURCES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                    {draft.customImage && (
                      <option value="custom">Your uploaded image</option>
                    )}
                  </select>
                </label>
                <span className="lab-label">A palette to start from</span>
                <div className="palette-grid">
                  {PALETTES.map((p) => (
                    <button
                      key={p.name}
                      title={p.name}
                      onClick={() => {
                        setInk(p.ink);
                        change({
                          ...draft,
                          background: p.base,
                          hue: p.hue,
                          design: {
                            ...design,
                            accent: p.accent,
                            frameColor: p.frame,
                            backdrop: 'radial',
                            saturation: p.name === 'Monochrome' ? 0 : 100,
                          },
                        });
                      }}
                    >
                      <span
                        style={{
                          background: `linear-gradient(135deg,${p.base},${p.accent} 60%,${p.ink})`,
                        }}
                      />
                      <small>{p.name}</small>
                    </button>
                  ))}
                </div>
                <div className="lab-two">
                  <label className="lab-field">
                    Backdrop
                    <select
                      value={design.backdrop}
                      onChange={(e) =>
                        patch({
                          backdrop: e.target.value as Design['backdrop'],
                        })
                      }
                    >
                      {['solid', 'radial', 'linear', 'grid'].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="lab-field">
                    Base color
                    <input
                      type="color"
                      value={draft.background}
                      onChange={(e) =>
                        change({ ...draft, background: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label className="lab-field lab-color">
                  Accent color
                  <input
                    type="color"
                    value={design.accent}
                    onChange={(e) => patch({ accent: e.target.value })}
                  />
                </label>
                <div className="lab-divider" />
                <span className="lab-label">Composition</span>
                <div className="lab-checks">
                  <label>
                    <input
                      type="checkbox"
                      checked={design.flipX}
                      onChange={(e) => patch({ flipX: e.target.checked })}
                    />
                    Flip horizontally
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={design.flipY}
                      onChange={(e) => patch({ flipY: e.target.checked })}
                    />
                    Flip vertically
                  </label>
                </div>
                <label className="lab-field">
                  Radial copies
                  <select
                    value={design.copies}
                    onChange={(e) => patch({ copies: +e.target.value })}
                  >
                    {[1, 2, 4, 6].map((n) => (
                      <option key={n} value={n}>
                        {n === 1
                          ? 'Single artwork'
                          : `${n} copies around the center`}
                      </option>
                    ))}
                  </select>
                </label>
                {range('Move across', 'offsetX', -400, 400)}
                {range('Move vertically', 'offsetY', -400, 400)}
                {range('Artwork opacity', 'opacity', 0, 100, '%')}
                {range('Contrast', 'contrast', 30, 200, '%')}
                {range('Saturation', 'saturation', 0, 200, '%')}
                <div className="lab-divider" />
                <div className="lab-two">
                  <label className="lab-field">
                    Frame
                    <select
                      value={design.frame}
                      onChange={(e) =>
                        patch({ frame: e.target.value as Design['frame'] })
                      }
                    >
                      {['none', 'line', 'double', 'corners'].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="lab-field">
                    Frame color
                    <input
                      type="color"
                      value={design.frameColor}
                      onChange={(e) => patch({ frameColor: e.target.value })}
                    />
                  </label>
                </div>
                {design.frame !== 'none' &&
                  range('Frame weight', 'frameWidth', 1, 20)}
              </div>
            )}
            {panel === 'text' && (
              <div className="lab-panel">
                <div className="lab-section-heading">
                  <h3>Words become part of the art.</h3>
                  <Button
                    className="btn secondary"
                    disabled={design.texts.length >= 6}
                    onClick={addText}
                  >
                    <Plus size={14} />
                    Add text
                  </Button>
                </div>
                <p className="lab-help">
                  Up to six editable layers. Place a name, a message, an edition
                  label or a whole new idea.
                </p>
                {!!design.texts.length && (
                  <div className="text-layer-list">
                    {design.texts.map((t, i) => (
                      <button
                        key={i}
                        className={selectedText === i ? 'selected' : ''}
                        onClick={() => setSelectedText(i)}
                      >
                        <Type size={14} />
                        <span>{t.text || 'Empty text layer'}</span>
                        {i === selectedText && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                )}
                {layer ? (
                  <>
                    <label className="lab-field">
                      Your words
                      <textarea
                        value={layer.text}
                        maxLength={160}
                        rows={3}
                        onChange={(e) => textPatch({ text: e.target.value })}
                      />
                    </label>
                    <div className="lab-two">
                      <label className="lab-field">
                        Typeface
                        <select
                          value={layer.font}
                          onChange={(e) =>
                            textPatch({
                              font: e.target.value as TextLayer['font'],
                            })
                          }
                        >
                          <option value="sans">Modern sans</option>
                          <option value="serif">Editorial serif</option>
                          <option value="mono">Technical mono</option>
                        </select>
                      </label>
                      <label className="lab-field">
                        Color
                        <input
                          type="color"
                          value={layer.color}
                          onChange={(e) => textPatch({ color: e.target.value })}
                        />
                      </label>
                    </div>
                    <label className="lab-field">
                      Alignment
                      <select
                        value={layer.align}
                        onChange={(e) =>
                          textPatch({
                            align: e.target.value as TextLayer['align'],
                          })
                        }
                      >
                        {['left', 'center', 'right'].map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                    {(
                      [
                        { key: 'size', label: 'Size', min: 12, max: 200 },
                        {
                          key: 'x',
                          label: 'Horizontal position',
                          min: 0,
                          max: 1024,
                        },
                        {
                          key: 'y',
                          label: 'Vertical position',
                          min: 0,
                          max: 1024,
                        },
                        {
                          key: 'rotation',
                          label: 'Angle',
                          min: -180,
                          max: 180,
                        },
                      ] as const
                    ).map((r) => (
                      <label className="lab-range" key={r.key}>
                        <span>
                          {r.label}
                          <b>{Math.round(layer[r.key])}</b>
                        </span>
                        <input
                          type="range"
                          min={r.min}
                          max={r.max}
                          value={layer[r.key]}
                          onChange={(e) =>
                            textPatch({ [r.key]: +e.target.value })
                          }
                        />
                      </label>
                    ))}
                    <div className="lab-two">
                      <button
                        className="text-link"
                        disabled={design.texts.length >= 6}
                        onClick={() => {
                          patch({
                            texts: [
                              ...design.texts,
                              {
                                ...layer,
                                id: 'text-' + Date.now(),
                                y: Math.min(1024, layer.y + 65),
                              },
                            ],
                          });
                          setSelectedText(design.texts.length);
                        }}
                      >
                        <Copy size={14} />
                        Duplicate layer
                      </button>
                      <button
                        className="text-link"
                        onClick={() => {
                          patch({
                            texts: design.texts.filter(
                              (_, i) => i !== selectedText,
                            ),
                          });
                          setSelectedText(Math.max(0, selectedText - 1));
                        }}
                      >
                        <Trash2 size={14} />
                        Remove layer
                      </button>
                    </div>
                    <p className="lab-help">
                      Fine text may soften in the compressed on-chain version.
                      Check the mint preview before signing.
                    </p>
                  </>
                ) : (
                  <div className="lab-empty">
                    <Type size={32} />
                    <p>
                      Add your first text layer. Keep it bold, or make it
                      beautifully quiet.
                    </p>
                  </div>
                )}
              </div>
            )}
            {panel === 'draw' && (
              <div className="lab-panel">
                <h3>Leave your own fingerprint.</h3>
                <p className="lab-help">
                  Draw original marks or build geometric patterns with repeated
                  strokes.
                </p>
                <div className="brush-tools">
                  {(
                    [
                      { id: 'pen', label: 'Brush', icon: Paintbrush },
                      { id: 'eraser', label: 'Eraser', icon: Eraser },
                      { id: 'line', label: 'Line', icon: Minus },
                      { id: 'circle', label: 'Ellipse', icon: Circle },
                      { id: 'rectangle', label: 'Rectangle', icon: Square },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      aria-pressed={tool === t.id}
                      className={tool === t.id ? 'selected' : ''}
                      onClick={() => setTool(t.id)}
                    >
                      <t.icon size={19} />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
                <label className="lab-field lab-color">
                  Ink color
                  <input
                    type="color"
                    value={ink}
                    onChange={(e) => setInk(e.target.value)}
                  />
                </label>
                <div className="ink-swatches">
                  {[
                    '#d8ef82',
                    '#e0f4ff',
                    '#69deef',
                    '#ef91db',
                    '#ffad69',
                    '#ffffff',
                    '#121212',
                  ].map((c) => (
                    <button
                      key={c}
                      style={{ background: c }}
                      aria-label={`Use ${c} ink`}
                      aria-pressed={ink === c}
                      onClick={() => setInk(c)}
                    />
                  ))}
                </div>
                <label className="lab-range">
                  <span>
                    Brush weight<b>{width}px</b>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={80}
                    value={width}
                    onChange={(e) => setWidth(+e.target.value)}
                  />
                </label>
                <label className="lab-field">
                  Radial brush symmetry
                  <select
                    value={symmetry}
                    onChange={(e) => setSymmetry(+e.target.value)}
                  >
                    {[1, 2, 4, 8].map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? 'One stroke' : `${n} repeated strokes`}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="lab-ink-example">
                  <Sparkles size={20} />
                  <p>
                    Try an eightfold brush on a blank canvas. One small gesture
                    becomes an original mandala.
                  </p>
                </div>
                <button
                  className="text-link"
                  disabled={!design.strokes.length}
                  onClick={() => patch({ strokes: [] })}
                >
                  <Trash2 size={14} />
                  Clear ink layer
                </button>
                <p className="lab-help">
                  {design.strokes.length} / {MAX_STROKES} strokes. Erasing
                  affects ink only. Clear and remove actions can be undone
                  inside this lab.
                </p>
              </div>
            )}
          </section>
        </div>
        {error && (
          <p role="alert" className="mint-error">
            {error}
          </p>
        )}
        <div className="lab-footer">
          <p>
            Editable layers stay in your project file. Minting embeds the
            complete rendered image.
          </p>
          <Button className="btn secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="btn primary"
            onClick={() => {
              try {
                if (JSON.stringify(art) !== starting.current)
                  throw new Error(
                    'The studio artwork changed while this lab was open. Close and reopen the lab to avoid overwriting it.',
                  );
                onApply(validateArtwork(draft));
                onOpenChange(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            <Check size={16} />
            Apply to studio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
