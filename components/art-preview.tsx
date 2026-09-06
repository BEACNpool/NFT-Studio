'use client';
import { useEffect, useRef, useState } from 'react';
import { Artwork, renderArtwork, SOURCES } from '@/lib/art';
export function ArtPreview({
  art,
  className = '',
  size = 1024,
}: {
  art: Artwork;
  className?: string;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const lastSource = useRef('');
  useEffect(() => {
    let canceled = false;
    setError('');
    const sourceKey = art.source + (art.customImage || '');
    if (lastSource.current !== sourceKey) {
      setReady(false);
      lastSource.current = sourceKey;
    }
    renderArtwork(art, size)
      .then((canvas) => {
        if (canceled || !ref.current) return;
        ref.current.width = ref.current.height = size;
        ref.current.getContext('2d')?.drawImage(canvas, 0, 0);
        setReady(true);
      })
      .catch((e) => {
        if (!canceled) {
          setError(e.message);
          setReady(false);
          ref.current?.getContext('2d')?.clearRect(0, 0, size, size);
        }
      });
    return () => {
      canceled = true;
    };
  }, [art, size]);
  const fallback =
    art.source === 'custom'
      ? art.customImage
      : SOURCES.find((s) => s.id === art.source)?.image;
  return (
    <div className={'artboard ' + className}>
      {!ready && fallback && (
        <img className="canvas-fallback" src={fallback} alt="" />
      )}
      <canvas
        ref={ref}
        role="img"
        aria-label={`${art.name}. ${art.description}`}
        style={{ opacity: ready ? 1 : 0 }}
      />
      {error && (
        <div className="canvas-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
