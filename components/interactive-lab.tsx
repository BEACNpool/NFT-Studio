'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Download,
  Check,
  Timer,
  Music2,
  Shuffle,
  Play,
  ImagePlus,
  X,
} from 'lucide-react';
import { Button } from './ui/button';
import type { Artwork } from '@/lib/art';
import { INITIAL } from '@/lib/art';
import {
  INTERACTIVE_TEMPLATES,
  interactiveDefault,
  interactiveHTML,
  interactivePoster,
  interactiveGuide,
  validateInteractive,
  type InteractiveSpec,
} from '@/lib/interactive';
import { download } from '@/lib/export';

export function InteractiveLab({
  art,
  hasArtwork,
  onApply,
  onRemove,
  onExample,
  templateKind,
}: {
  art: Artwork;
  hasArtwork: boolean;
  onApply: (spec: InteractiveSpec) => void;
  onRemove: () => void;
  onExample: (art: Artwork) => void;
  templateKind?: InteractiveSpec['kind'];
}) {
  const [draft, setDraft] = useState<InteractiveSpec>(
    art.interactive || interactiveDefault('focus'),
  );
  const [choices, setChoices] = useState(
    draft.kind === 'decision'
      ? draft.choices.join('\n')
      : 'Make something\nLearn something\nGo outside\nCall a friend',
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const kind = new URLSearchParams(location.search).get('utility');
    if (
      !art.interactive &&
      (kind === 'focus' || kind === 'decision' || kind === 'beats')
    )
      setDraft(interactiveDefault(kind));
  }, []);
  useEffect(() => {
    if (art.interactive) {
      setDraft(art.interactive);
      if (art.interactive.kind === 'decision')
        setChoices(art.interactive.choices.join('\n'));
    }
  }, [art.interactive]);
  const t = INTERACTIVE_TEMPLATES.find((t) => t.kind === draft.kind)!;
  const title = hasArtwork ? art.name : t.name;
  const preview = useMemo(() => {
    try {
      const spec = validateInteractive(
        draft.kind === 'decision'
          ? { ...draft, choices: choices.split('\n') }
          : draft,
      );
      return { spec, html: interactiveHTML(spec, title), error: '' };
    } catch (e) {
      return { spec: undefined, html: '', error: (e as Error).message };
    }
  }, [draft, choices, title]);
  const example = async () => {
    if (!preview.spec || busy) return;
    setBusy(true);
    setError('');
    try {
      const image = new Image();
      image.src =
        'data:image/svg+xml;charset=utf-8,' +
        encodeURIComponent(interactivePoster(preview.spec));
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('This browser cannot create a cover image.');
      ctx.drawImage(image, 0, 0);
      onExample({
        ...INITIAL,
        source: 'custom',
        customImage: canvas.toDataURL('image/png'),
        name: t.name,
        description:
          t.detail +
          ' Open the embedded interactive.html to use it. Public and reusable; session state resets on reload.',
        scale: 100,
        interactive: preview.spec,
        license: 'CC0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/',
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="interactive-lab" aria-labelledby="interactive-title">
      <div className="interactive-heading">
        <div>
          <p className="eyebrow">
            <span className="live-dot" /> WORKING UTILITIES / TRY BEFORE YOU
            MINT
          </p>
          <h2 id="interactive-title">
            A collectible that <em>does something.</em>
          </h2>
        </div>
        <p>
          Put a small, useful app inside your NFT. Your cover, your settings, a
          program that runs offline.
        </p>
      </div>
      <div className="interactive-templates">
        {INTERACTIVE_TEMPLATES.filter(
          (item) => !templateKind || item.kind === templateKind,
        ).map((item) => (
          <button
            key={item.kind}
            aria-pressed={draft.kind === item.kind}
            className={
              'interactive-template ' +
              (draft.kind === item.kind ? 'selected' : '')
            }
            onClick={() => {
              setDraft(interactiveDefault(item.kind));
              setError('');
            }}
          >
            <span className="interactive-symbol">
              {item.kind === 'beats' ? (
                <Music2 size={28} />
              ) : item.kind === 'focus' ? (
                <Timer size={28} />
              ) : (
                <Shuffle size={28} />
              )}
            </span>
            <span>
              <strong>{item.name}</strong>
              <small>{item.verb}</small>
            </span>
            {draft.kind === item.kind ? (
              <Check size={20} />
            ) : (
              <ArrowRight size={20} />
            )}
          </button>
        ))}
      </div>
      <div className="interactive-workbench">
        <div className="interactive-settings">
          <p className="eyebrow">01 / MAKE IT YOURS</p>
          <h3>{t.name}</h3>
          <p>{t.detail}</p>
          {draft.kind === 'beats' ? (
            <div className="beat-settings">
              <label htmlFor="beat-tempo" className="field-label">
                Starting tempo / BPM
              </label>
              <input
                id="beat-tempo"
                type="number"
                min="60"
                max="160"
                value={draft.bpm || ''}
                onChange={(e) => setDraft({ ...draft, bpm: +e.target.value })}
              />
              <p className="small-muted">
                Set the pattern your NFT opens with.
              </p>
              {['Kick', 'Snare', 'Hi-hat'].map((name, row) => (
                <div className="beat-row" key={name}>
                  <span>{name}</span>
                  <div>
                    {Array.from({ length: 8 }, (_, step) => (
                      <button
                        key={step}
                        aria-label={`${name} step ${step + 1}`}
                        aria-pressed={!!(draft.pattern[row] & (1 << step))}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            pattern: draft.pattern.map((bits, i) =>
                              i === row ? bits ^ (1 << step) : bits,
                            ),
                          })
                        }
                      >
                        {step + 1}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : draft.kind === 'focus' ? (
            <div className="two-fields">
              <div>
                <label htmlFor="focus-minutes" className="field-label">
                  Focus / minutes
                </label>
                <input
                  id="focus-minutes"
                  type="number"
                  min="1"
                  max="90"
                  value={draft.work || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, work: +e.target.value })
                  }
                />
              </div>
              <div>
                <label htmlFor="break-minutes" className="field-label">
                  Break / minutes
                </label>
                <input
                  id="break-minutes"
                  type="number"
                  min="1"
                  max="90"
                  value={draft.rest || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, rest: +e.target.value })
                  }
                />
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="decision-choices" className="field-label">
                Your choices / one per line
              </label>
              <textarea
                id="decision-choices"
                rows={6}
                maxLength={520}
                value={choices}
                onChange={(e) => setChoices(e.target.value)}
              />
              <small className="small-muted">
                2–8 distinct choices. Keep each one short.
              </small>
            </div>
          )}
          <div className="interactive-colors">
            <span className="field-label">Accent</span>
            {['#a5f3c4', '#c1b4ff', '#f4ca87', '#b0dfff'].map((color) => (
              <button
                key={color}
                aria-label={'Use accent ' + color}
                aria-pressed={draft.accent === color}
                style={{ background: color }}
                onClick={() => setDraft({ ...draft, accent: color })}
              >
                {draft.accent === color && <Check size={16} />}
              </button>
            ))}
          </div>
          {(preview.error || error) && (
            <p role="alert" className="interactive-error">
              {preview.error || error}
            </p>
          )}
          <div className="interactive-apply">
            {hasArtwork && (
              <Button
                className="btn primary wide"
                disabled={!preview.spec || busy}
                onClick={() => onApply(preview.spec!)}
              >
                <Check size={16} />
                Use with my artwork
                <ArrowRight size={16} />
              </Button>
            )}
            <Button
              className={'btn wide ' + (hasArtwork ? 'secondary' : 'primary')}
              disabled={!preview.spec || busy}
              onClick={example}
            >
              <ImagePlus size={16} />
              {busy ? 'Creating the cover…' : 'Create the example NFT'}
              <ArrowRight size={16} />
            </Button>
            <span className="interactive-hint">
              {hasArtwork
                ? 'Keep your image, or start an example with an illustrated how-to cover.'
                : 'Starts an editable draft with an illustrated how-to cover. No wallet needed.'}
            </span>
            {art.interactive && (
              <button className="text-link" onClick={onRemove}>
                <X size={14} />
                Remove current utility from artwork
              </button>
            )}
          </div>
        </div>
        <div className="interactive-demo">
          <div className="interactive-demo-label">
            <span className="eyebrow">02 / PLAY WITH IT</span>
            <span>
              <Play size={12} /> LIVE DEMO
            </span>
          </div>
          {preview.html ? (
            <iframe
              title="Interactive NFT live demo"
              sandbox="allow-scripts allow-downloads"
              referrerPolicy="no-referrer"
              srcDoc={preview.html}
            />
          ) : (
            <div className="interactive-demo-empty">
              Fix the settings to preview your program.
            </div>
          )}
          <div className="interactive-downloads">
            <button
              className="text-link"
              disabled={!preview.spec}
              onClick={() =>
                download(
                  new Blob([preview.html], { type: 'text/html' }),
                  'interactive.html',
                )
              }
            >
              <Download size={14} />
              Download app
            </button>
            <button
              className="text-link"
              disabled={!preview.spec}
              onClick={() =>
                download(
                  new Blob([interactiveGuide(preview.spec!, title)], {
                    type: 'text/plain',
                  }),
                  'HOW-TO-USE.txt',
                )
              }
            >
              <Download size={14} />
              How to use it
            </button>
          </div>
        </div>
      </div>
      <div className="interactive-facts">
        <p>
          <strong>Inside the NFT</strong>The cover and complete app are embedded
          in the mint transaction. A compatible HTML viewer or browser runs the
          app.
        </p>
        <p>
          <strong>Open to everyone</strong>This is a public, reusable tool.
          Anyone with a copy can use it. Transferring the NFT does not revoke
          copies.
        </p>
        <p>
          <strong>Your settings stay</strong>The minted configuration is fixed.
          Session progress resets on reload. The app makes no wallet or network
          requests.
        </p>
      </div>
    </section>
  );
}
