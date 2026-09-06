'use client';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import type { CreationMode } from '@/lib/studio-modes';
import { MODES } from '@/lib/studio-modes';
import type { Artwork } from '@/lib/art';
import { ArtWorkbench } from './art-workbench';
import { LedgerWorkbench } from './ledger-workbench';
import { FileWorkbench, type FileSeed } from './file-workbench';
import { PocketArcade } from './pocket-arcade';
import { Button } from './ui/button';
export function CreationWorkbench({
  mode,
  onBack,
  initialArt,
  initialFiles,
  file,
  onUseScroll,
  onShowcase,
}: {
  mode: CreationMode;
  onBack: () => void;
  initialArt?: Artwork;
  initialFiles?: FileSeed;
  file?: File;
  onUseScroll: (file?: File) => void;
  onShowcase: () => void;
}) {
  const [ownAudio, setOwnAudio] = useState(false);
  return (
    <section className="ns-workbench">
      <button className="ns-back" onClick={onBack}>
        <ArrowLeft size={16} />
        All formats
      </button>
      <div className="ns-heading ns-workbench-heading">
        <div>
          <p className="ns-eyebrow">YOUR CREATIVE WORKBENCH</p>
          <h1>{MODES.find((m) => m.id === mode)!.title}</h1>
        </div>
        {mode === 'music' && (
          <Button variant="outline" onClick={() => setOwnAudio(!ownAudio)}>
            {ownAudio ? 'Open Beat Lab' : 'Use my own audio'}
            <ArrowRight size={16} />
          </Button>
        )}
      </div>
      {(mode === 'art' ||
        mode === 'utility' ||
        (mode === 'music' && !ownAudio)) && (
        <ArtWorkbench key={mode} mode={mode} initialArt={initialArt} />
      )}
      {(mode === 'scroll' || mode === 'book') && (
        <LedgerWorkbench key={mode} kind={mode} file={file} />
      )}
      {mode === 'game' && (
        <div className="ns-arcade">
          <PocketArcade />
        </div>
      )}
      {(mode === 'data' ||
        mode === 'motion' ||
        (mode === 'music' && ownAudio)) && (
        <>
          {mode === 'motion' && (
            <div className="ns-inline-callout">
              <p>
                See animated SVG, pixel films and WebGL originals recovered from
                the chain.
              </p>
              <Button variant="outline" onClick={onShowcase}>
                Explore motion originals
                <ArrowRight size={16} />
              </Button>
            </div>
          )}
          <FileWorkbench
            key={mode}
            initial={initialFiles}
            onUseScroll={onUseScroll}
          />
        </>
      )}
    </section>
  );
}
