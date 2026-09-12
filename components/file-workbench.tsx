'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Upload,
  FilePlus2,
  Trash2,
  Download,
  ArrowRight,
  ShieldCheck,
  ImagePlus,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  MAX_PAYLOAD_BYTES,
  PAYLOAD_TYPES,
  preparePayloadBundle,
  payloadMetadata,
  staticPayloadPreview,
  type PayloadInput,
  type PayloadMime,
  type PayloadBundle,
} from '@/lib/studio-payload';
import { errorText } from '@/lib/cardano';
import { download, filename, jsonBlob } from '@/lib/export';
import { FileCreationControls } from './creation-controls';
export type FileSeed = {
  name: string;
  files: PayloadInput[];
  coverIndex?: number;
};
export function FileWorkbench({
  initial,
  onUseScroll,
}: {
  initial?: FileSeed;
  onUseScroll: (file?: File) => void;
}) {
  const [files, setFiles] = useState<PayloadInput[]>(initial?.files || []),
    [name, setName] = useState(initial?.name || 'My on-chain creation'),
    [description, setDescription] = useState(''),
    [mode, setMode] = useState<'nft' | 'data'>('nft'),
    [cover, setCover] = useState<number | undefined>(initial?.coverIndex),
    [bundle, setBundle] = useState<PayloadBundle | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(0),
    [text, setText] = useState(''),
    [textType, setTextType] = useState<
      'text/plain' | 'application/json' | 'text/html' | 'text/markdown'
    >('text/plain'),
    [oversize, setOversize] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null),
    lock = useRef(false);
  const size = files.reduce((n, f) => n + f.bytes.length, 0);
  useEffect(() => {
    setBundle(null);
  }, [files, name, description, cover, mode]);
  const run = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const add = async (list: File[]) =>
    run(async () => {
      if (files.length + list.length > 8)
        throw new Error('Use up to eight files in one transaction.');
      const big = list.find((f) => f.size > MAX_PAYLOAD_BYTES);
      if (big) {
        setOversize(big);
        throw new Error(
          'This file needs a Ledger Scroll. Keep every byte across a recoverable sequence of transactions.',
        );
      }
      const next = await Promise.all(
        list.map(async (f) => ({
          name: f.name,
          mediaType: mimeOf(f),
          bytes: new Uint8Array(await f.arrayBuffer()),
        })),
      );
      const combined = [...files, ...next];
      if (combined.reduce((s, f) => s + f.bytes.length, 0) > MAX_PAYLOAD_BYTES)
        throw new Error(
          'These files exceed the single-transaction input bound. Remove a file or use a Ledger Scroll.',
        );
      setFiles(combined);
      if (cover === undefined) {
        const i = combined.findIndex((f) => f.mediaType.startsWith('image/'));
        if (i >= 0) setCover(i);
      }
    });
  const makeCover = () =>
    run(async () => {
      const label = Array.from(name)
        .slice(0, 30)
        .join('')
        .replace(
          /[&<>"']/g,
          (c) =>
            ({
              '&': '&amp;',
              '<': '&lt;',
              '>': '&gt;',
              '"': '&quot;',
              "'": '&#39;',
            })[c]!,
        );
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><rect width="640" height="640" fill="#151a18"/><circle cx="460" cy="200" r="220" fill="#cce88f"/><circle cx="460" cy="200" r="150" fill="#151a18"/><path d="M60 380h520M60 400h380M60 420h240" stroke="#cce88f" stroke-width="2"/><text x="60" y="510" fill="#fafaf5" font-family="sans-serif" font-size="22">${label}</text><text x="60" y="570" fill="#a8b19e" font-family="sans-serif" font-size="16">NFT STUDIO / ON-CHAIN ORIGINAL</text></svg>`;
      if (files.length >= 8)
        throw new Error('Remove a file to leave room for the cover.');
      let n = 'studio-cover.svg';
      let i = 1;
      while (files.some((f) => f.name === n)) n = `studio-cover-${i++}.svg`;
      setCover(files.length);
      setFiles([
        ...files,
        {
          name: n,
          mediaType: 'image/svg+xml',
          bytes: new TextEncoder().encode(svg),
        },
      ]);
    });
  const prepare = () =>
    run(async () => {
      setBundle(
        await preparePayloadBundle({
          name,
          description,
          files,
          coverIndex: mode === 'nft' ? cover : undefined,
        }),
      );
      setSelected(0);
    });
  return (
    <div className="ns-files">
      <div className="ns-tool-intro">
        <span className="ns-eyebrow">YOUR CONTENT</span>
        <h2>Add your files.</h2>
        <p>
          Small audio, moving artwork, HTML, documents or structured data. Files
          stay byte-for-byte intact. Larger works belong in a Ledger Scroll.
        </p>
      </div>
      <div className="ns-file-layout">
        <section className="ns-panel">
          <div className="ns-segment">
            <button
              aria-pressed={mode === 'nft'}
              onClick={() => setMode('nft')}
            >
              NFT with files
            </button>
            <button
              aria-pressed={mode === 'data'}
              onClick={() => setMode('data')}
            >
              Data record
            </button>
          </div>
          <p className="ns-fineprint">
            {mode === 'nft'
              ? 'Mint a collectible with an image cover and up to seven additional files.'
              : 'Publish the files in transaction metadata. No token is created. A network fee still applies.'}
          </p>
          <label className="ns-field" htmlFor="file-title">
            Title
            <Input
              id="file-title"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
            />
            <small>
              {new TextEncoder().encode(name).length} / 64 UTF-8 bytes
            </small>
          </label>
          <label className="ns-field" htmlFor="file-description">
            Description
            <Textarea
              id="file-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1024}
              placeholder="What should someone know about this creation?"
            />
          </label>
          <Tabs defaultValue="files">
            <TabsList>
              <TabsTrigger value="files">Upload files</TabsTrigger>
              <TabsTrigger value="write">Write text or code</TabsTrigger>
            </TabsList>
            <TabsContent value="files">
              <button
                className="ns-file-drop"
                disabled={busy}
                onClick={() => input.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void add(Array.from(e.dataTransfer.files));
                }}
              >
                <Upload size={30} />
                <strong>Drop files, or choose them</strong>
                <span>12 KB total raw input · eight files maximum</span>
              </button>
              <input
                ref={input}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  void add(Array.from(e.target.files || []));
                  e.target.value = '';
                }}
              />
            </TabsContent>
            <TabsContent value="write">
              <Select
                value={textType}
                onValueChange={(v) => setTextType(v as typeof textType)}
              >
                <SelectTrigger aria-label="Text format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text/plain">Plain text</SelectItem>
                  <SelectItem value="text/markdown">Markdown</SelectItem>
                  <SelectItem value="application/json">JSON</SelectItem>
                  <SelectItem value="text/html">HTML source</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                className="ns-code-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  textType === 'application/json'
                    ? '{"hello":"chain"}'
                    : 'Write something worth keeping.'
                }
              />
              <Button
                variant="outline"
                disabled={!text || busy}
                onClick={() =>
                  run(async () => {
                    const ext = {
                      'text/plain': 'txt',
                      'text/markdown': 'md',
                      'application/json': 'json',
                      'text/html': 'html',
                    }[textType];
                    const f = new File(
                      [text],
                      `creation-${files.length + 1}.${ext}`,
                      { type: textType },
                    );
                    if (f.size + size > 12000)
                      throw new Error('This text needs a Ledger Scroll.');
                    if (files.length >= 8)
                      throw new Error('Use up to eight files.');
                    if (textType === 'application/json') JSON.parse(text);
                    setFiles([
                      ...files,
                      {
                        name: f.name,
                        mediaType: textType,
                        bytes: new Uint8Array(await f.arrayBuffer()),
                      },
                    ]);
                    setText('');
                  })
                }
              >
                <FilePlus2 size={16} />
                Add this file
              </Button>
            </TabsContent>
          </Tabs>
          <div className="ns-file-list">
            {files.map((f, i) => (
              <div key={i} className="ns-file-row">
                <div>
                  <strong>{f.name}</strong>
                  <span>
                    {f.mediaType} · {f.bytes.length.toLocaleString()} bytes
                  </span>
                </div>
                {mode === 'nft' && f.mediaType.startsWith('image/') && (
                  <button
                    className={
                      'ns-cover-choice ' + (cover === i ? 'active' : '')
                    }
                    onClick={() => setCover(i)}
                  >
                    {cover === i ? 'Cover' : 'Use cover'}
                  </button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={'Remove ' + f.name}
                  onClick={() => {
                    setFiles(files.filter((_, j) => i !== j));
                    setCover(
                      cover === i
                        ? undefined
                        : cover !== undefined && cover > i
                          ? cover - 1
                          : cover,
                    );
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
          {mode === 'nft' && cover === undefined && (
            <Button variant="outline" disabled={busy} onClick={makeCover}>
              <ImagePlus size={16} />
              Generate a small cover
            </Button>
          )}
          <div className="ns-byte-meter">
            <div style={{ width: Math.min(100, size / 120) + '%' }} />
          </div>
          <p className="ns-fineprint">
            {size.toLocaleString()} / 12,000 raw bytes. File encoding, metadata
            and wallet inputs add to the complete transaction. The wallet review
            measures the real fit.
          </p>
          {error && (
            <div role="alert" className="ns-error">
              {error}
              {oversize && (
                <Button variant="outline" onClick={() => onUseScroll(oversize)}>
                  Continue with this file in Ledger Scroll
                  <ArrowRight size={16} />
                </Button>
              )}
            </div>
          )}
          <Button
            className="ns-primary"
            disabled={
              busy || !files.length || (mode === 'nft' && cover === undefined)
            }
            onClick={prepare}
          >
            Prepare exact content
            <ArrowRight size={17} />
          </Button>
        </section>
        <section className="ns-panel ns-payload-review">
          {bundle ? (
            <>
              <div className="ns-eyebrow">
                <ShieldCheck size={15} /> CONTENT READY FOR REVIEW
              </div>
              <h2>{bundle.name}</h2>
              <div className="ns-file-tabs">
                {bundle.files.map((f, i) => (
                  <button
                    key={f.name}
                    aria-pressed={selected === i}
                    onClick={() => setSelected(i)}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
              <PayloadPreview
                file={bundle.files[Math.min(selected, bundle.files.length - 1)]}
              />
              <p className="ns-fineprint">
                {bundle.files[selected]?.mediaType === 'text/html'
                  ? 'HTML uses an inert preview here. Downloaded and minted source retains its original code.'
                  : 'Preview support depends on your browser and the eventual NFT viewer.'}
              </p>
              <div className="ns-hash">
                <span>Bundle SHA-256</span>
                <code>{bundle.sha256}</code>
              </div>
              <div className="ns-button-row">
                <Button
                  variant="outline"
                  onClick={() =>
                    download(
                      jsonBlob({
                        schema: 'nft-studio.package.v1',
                        bundle,
                        metadata: payloadMetadata(bundle),
                      }),
                      filename(bundle.name) + '.package.json',
                    )
                  }
                >
                  <Download size={16} />
                  Save package
                </Button>
              </div>
              <FileCreationControls
                key={bundle.sha256 + mode}
                bundle={bundle}
                mode={mode}
              />
            </>
          ) : (
            <div className="ns-preview-empty">
              <ShieldCheck size={44} strokeWidth={1} />
              <h3>The exact content appears here.</h3>
              <p>
                Add your files and prepare them. Check the full payload before
                connecting a wallet.
              </p>
              <button className="ns-text-link" onClick={() => onUseScroll()}>
                Need more room? Open Ledger Scroll
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
export function PayloadPreview({
  file,
}: {
  file: PayloadBundle['files'][number];
}) {
  const [preview, setPreview] = useState<ReturnType<
    typeof staticPayloadPreview
  > | null>(null);
  useEffect(() => {
    try {
      setPreview(staticPayloadPreview(file));
    } catch {
      setPreview(null);
    }
  }, [file]);
  return preview ? (
    <iframe
      className="ns-payload-frame"
      {...preview}
      title="Exact file preview"
    />
  ) : (
    <p>Preview unavailable. Download the exact file to inspect it.</p>
  );
}
function mimeOf(file: File): PayloadMime {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const types: Record<string, PayloadMime> = {
    svg: 'image/svg+xml',
    md: 'text/markdown',
    json: 'application/json',
    html: 'text/html',
    htm: 'text/html',
    txt: 'text/plain',
    mid: 'audio/midi',
    midi: 'audio/midi',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    mp4: 'video/mp4',
    webm: 'video/webm',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    avif: 'image/avif',
    gif: 'image/gif',
  };
  return (
    types[ext || ''] ||
    ((PAYLOAD_TYPES as readonly string[]).includes(file.type)
      ? (file.type as PayloadMime)
      : 'application/octet-stream')
  );
}
