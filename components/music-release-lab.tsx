'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Disc3,
  Download,
  FileAudio2,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { PayloadPreview } from './file-workbench';
import { FileMintDialog } from './file-mint-dialog';
import { download, filename } from '@/lib/export';
import { errorText } from '@/lib/cardano';
import { assetPath } from '@/lib/paths';
import {
  decodePayloadURI,
  preparePayloadBundle,
  type PayloadInput,
  type PayloadMime,
} from '@/lib/studio-payload';
import {
  createMusicRelease,
  musicReleaseBudget,
  musicReleaseBytes,
  parseMusicRelease,
  type MusicComposerInput,
  type MusicReleasePackage,
  type MusicSong,
} from '@/lib/music-release';

const empty: MusicComposerInput = {
  release: { release_type: 'Single', release_title: '' },
  tracks: [],
};
const types: Record<string, PayloadMime> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  mid: 'audio/midi',
  midi: 'audio/midi',
};
function seconds(value: string) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  return match
    ? Number(match[1] || 0) * 3600 +
        Number(match[2] || 0) * 60 +
        Number(match[3] || 0)
    : '';
}
function duration(value: string) {
  if (!/^[1-9][0-9]{0,4}$/.test(value)) return '';
  const n = Number(value),
    h = Math.floor(n / 3600),
    m = Math.floor((n % 3600) / 60),
    s = n % 60;
  return `PT${h ? h + 'H' : ''}${m ? m + 'M' : ''}${s ? s + 'S' : ''}`;
}
export function MusicReleaseLab({ active = true }: { active?: boolean }) {
  const [files, setFiles] = useState<PayloadInput[]>([]);
  const [draft, setDraft] = useState<MusicComposerInput>(empty);
  const [description, setDescription] = useState('');
  const [bundleTitle, setBundleTitle] = useState('');
  const [pkg, setPackage] = useState<MusicReleasePackage | null>(null);
  const [budget, setBudget] = useState<Awaited<
    ReturnType<typeof musicReleaseBudget>
  > | null>(null);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [demo, setDemo] = useState(false);
  const revision = useRef(0),
    upload = useRef<HTMLInputElement>(null),
    reopen = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      revision.current++;
    },
    [],
  );
  useEffect(() => {
    if (!active) {
      revision.current++;
      setBusy(false);
    }
  }, [active]);
  function changed() {
    revision.current++;
    setPackage(null);
    setBudget(null);
    setError('');
    setBusy(false);
    setDemo(false);
  }
  function song(index: number, change: Partial<MusicSong>) {
    changed();
    setDraft({
      ...draft,
      tracks: draft.tracks.map((t, i) =>
        i === index ? { ...t, song: { ...t.song, ...change } } : t,
      ),
    });
  }
  async function run(action: (current: number) => Promise<void>) {
    const current = ++revision.current;
    setPackage(null);
    setBudget(null);
    setError('');
    setBusy(true);
    try {
      await action(current);
    } catch (e) {
      if (current === revision.current) setError(errorText(e));
    } finally {
      if (current === revision.current) setBusy(false);
    }
  }
  async function add(list: File[]) {
    if (!list.length) return;
    await run(async (current) => {
      if (
        files.length + list.length > 8 ||
        files.reduce((n, f) => n + f.bytes.length, 0) +
          list.reduce((n, f) => n + f.size, 0) >
          12000
      )
        throw new Error(
          'Use one cover and up to seven audio files, totaling at most 12,000 bytes. Larger audio belongs in a Ledger Scroll.',
        );
      const next = await Promise.all(
        list.map(async (file) => {
          const mediaType =
            types[file.name.split('.').pop()?.toLowerCase() || ''];
          if (!mediaType)
            throw new Error(
              'Choose a supported image, WAV, MP3, Ogg or MIDI file.',
            );
          return {
            name: file.name,
            mediaType,
            bytes: new Uint8Array(await file.arrayBuffer()),
          };
        }),
      );
      const combined = [...files, ...next];
      if (combined.filter((f) => f.mediaType.startsWith('image/')).length > 1)
        throw new Error(
          'Use one cover image. Remove the current cover before replacing it.',
        );
      if (
        new Set(combined.map((f) => f.name.toLowerCase())).size !==
        combined.length
      )
        throw new Error('Each file needs a distinct name.');
      if (current !== revision.current) return;
      setDemo(false);
      setFiles(combined);
      const audio = combined.filter((f) => f.mediaType.startsWith('audio/'));
      setDraft({
        release: {
          ...draft.release,
          release_type: audio.length > 1 ? 'Multiple' : 'Single',
        },
        tracks: audio.map(
          (file, i) =>
            draft.tracks.find((t) => t.fileName === file.name) || {
              fileName: file.name,
              song: {
                song_title: file.name.replace(/\.[^.]+$/, ''),
                song_duration: '',
                track_number: i + 1,
                artists: [{ name: '' }],
                genres: [''],
                copyright: { master: '', composition: '' },
              },
            },
        ),
      });
    });
  }
  function remove(name: string) {
    changed();
    setFiles(files.filter((f) => f.name !== name));
    const tracks = draft.tracks
      .filter((t) => t.fileName !== name)
      .map((t, i) => ({ ...t, song: { ...t.song, track_number: i + 1 } }));
    setDraft({
      release: {
        ...draft.release,
        release_type: tracks.length > 1 ? 'Multiple' : 'Single',
      },
      tracks,
    });
  }
  async function accept(raw: string, current: number, isDemo: boolean) {
    const verified = await parseMusicRelease(raw);
    const measured = await musicReleaseBudget(verified);
    const exact = verified.bundle.files.map((f) => ({
      name: f.name,
      mediaType: f.mediaType,
      bytes: decodePayloadURI(f.uri, f.mediaType),
    }));
    if (current !== revision.current) return;
    setFiles(exact);
    setDraft({ release: verified.release, tracks: verified.tracks });
    setDescription(verified.bundle.description);
    setBundleTitle(verified.bundle.name);
    setPackage(verified);
    setBudget(measured);
    setSelected(0);
    setDemo(isDemo);
  }
  async function example(kind: 'signal' | 'midnight' = 'signal') {
    await run(async (current) => {
      const demoPath = kind === 'midnight'
        ? '/labs/midnight-beacon/midnight-beacon.music-release.json'
        : '/labs/music-demo.package.json';
      const response = await fetch(assetPath(demoPath), {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        throw new Error('The demo could not be loaded. Try again.');
      await accept(await response.text(), current, true);
    });
  }
  async function buildPackage() {
    await run(async (current) => {
      const coverIndex = files.findIndex((f) =>
        f.mediaType.startsWith('image/'),
      );
      if (coverIndex < 0)
        throw new Error('Add one image for the release cover.');
      const bundle = await preparePayloadBundle({
        name: bundleTitle || draft.release.release_title,
        description,
        files,
        coverIndex,
      });
      const next = await createMusicRelease(bundle, draft);
      const measured = await musicReleaseBudget(next);
      if (current !== revision.current) return;
      setPackage(next);
      setBudget(measured);
      setSelected(0);
    });
  }
  async function exportPackage() {
    if (!pkg) return;
    const current = revision.current;
    try {
      const bytes = await musicReleaseBytes(pkg);
      if (current !== revision.current) return;
      download(
        new Blob([new Uint8Array(bytes)], { type: 'application/json' }),
        filename(pkg.release.release_title) + '.music-release.json',
      );
    } catch (e) {
      if (current === revision.current) setError(errorText(e));
    }
  }
  return (
    <div data-music-release>
      <div className="ns-lab-intro">
        <span className="ns-lab-kicker">
          <Disc3 size={18} /> MUSIC RELEASE
        </span>
        <h2>The recording. The credits. One exact release.</h2>
        <p>
          Package short audio, cover art and declared music credits together.
          Every file and credit contributes to the release hash.
        </p>
      </div>
      <p className="ns-capsule-boundary">
        <strong>Local music package.</strong> Nothing is minted by creating or
        opening a package. Credits and songwriting shares are published
        declarations; they do not verify rights or configure payments.
      </p>
      <div className="ns-button-row ns-music-tools">
        <Button
          disabled={busy}
          onClick={() => void example('midnight')}
          data-music-midnight
        >
          <Disc3 size={17} /> Try Midnight Beacon · 8s
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void example()}
          data-music-demo
        >
          <Disc3 size={17} /> Try a one-second original
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => reopen.current?.click()}
        >
          <Upload size={17} /> Open music package
        </Button>
      </div>
      <input
        hidden
        ref={reopen}
        type="file"
        accept=".json"
        data-music-import
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file)
            void run(async (current) => {
              if (file.size > 80000)
                throw new Error('Choose a music package under 80 KB.');
              await accept(await file.text(), current, false);
            });
        }}
      />
      <div className="ns-lab-columns">
        <section className="ns-panel">
          <h3>Compose the release.</h3>
          <label className="ns-field" htmlFor="music-title">
            Release title
            <Input
              id="music-title"
              value={draft.release.release_title}
              maxLength={64}
              onChange={(e) => {
                changed();
                setBundleTitle(e.target.value);
                setDraft({
                  ...draft,
                  release: { ...draft.release, release_title: e.target.value },
                });
              }}
            />
          </label>
          {bundleTitle && bundleTitle !== draft.release.release_title && (
            <p className="ns-lab-muted">
              NFT display name retained from this package: {bundleTitle}
            </p>
          )}
          <label className="ns-field" htmlFor="music-description">
            Description
            <Textarea
              id="music-description"
              value={description}
              maxLength={1024}
              onChange={(e) => {
                changed();
                setDescription(e.target.value);
              }}
            />
          </label>
          <label className="ns-field" htmlFor="music-date">
            Release date · optional
            <Input
              id="music-date"
              type="date"
              value={draft.release.release_date || ''}
              onChange={(e) => {
                changed();
                const release = { ...draft.release };
                if (e.target.value) release.release_date = e.target.value;
                else delete release.release_date;
                setDraft({ ...draft, release });
              }}
            />
          </label>
          <div className="ns-music-files">
            {files.map((f) => (
              <div key={f.name}>
                <span>
                  <strong>{f.name}</strong>
                  <small>
                    {f.mediaType} · {f.bytes.length.toLocaleString()} bytes
                  </small>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={'Remove ' + f.name}
                  onClick={() => remove(f.name)}
                >
                  <Trash2 size={17} />
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            disabled={busy || files.length >= 8}
            onClick={() => upload.current?.click()}
          >
            <Plus size={17} /> Add cover or audio
          </Button>
          <input
            hidden
            ref={upload}
            type="file"
            multiple
            accept=".svg,.png,.jpg,.jpeg,.webp,.avif,.gif,.wav,.mp3,.ogg,.mid,.midi"
            data-music-files
            onChange={(e) => {
              const list = Array.from(e.target.files || []);
              e.target.value = '';
              void add(list);
            }}
          />
          <p className="ns-lab-muted">
            {files.reduce((n, f) => n + f.bytes.length, 0).toLocaleString()} /
            12,000 raw bytes · one cover + up to seven audio files. Complete
            transaction size also includes credits and wallet inputs.
          </p>
          {draft.tracks.map((track, index) => (
            <details
              className="ns-lab-details ns-music-track"
              key={track.fileName}
              open={draft.tracks.length === 1 || undefined}
            >
              <summary>
                Track {track.song.track_number} · {track.fileName}
              </summary>
              <label className="ns-field" htmlFor={'music-song-' + index}>
                Song title
                <Input
                  id={'music-song-' + index}
                  value={track.song.song_title}
                  maxLength={192}
                  onChange={(e) => song(index, { song_title: e.target.value })}
                />
              </label>
              <label className="ns-field" htmlFor={'music-duration-' + index}>
                Declared duration in seconds
                <Input
                  id={'music-duration-' + index}
                  type="number"
                  min="1"
                  max="86399"
                  step="1"
                  value={seconds(track.song.song_duration)}
                  onChange={(e) =>
                    song(index, { song_duration: duration(e.target.value) })
                  }
                />
              </label>
              {track.song.artists.map((artist, a) => (
                <label
                  className="ns-field"
                  key={a}
                  htmlFor={`music-artist-${index}-${a}`}
                >
                  Artist {a + 1}
                  <Input
                    id={`music-artist-${index}-${a}`}
                    value={artist.name}
                    maxLength={64}
                    onChange={(e) =>
                      song(index, {
                        artists: track.song.artists.map((v, i) =>
                          i === a ? { ...v, name: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              {track.song.artists.length < 4 && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    song(index, {
                      artists: [...track.song.artists, { name: '' }],
                    })
                  }
                >
                  <Plus size={15} /> Add artist
                </Button>
              )}
              {track.song.artists.length > 1 && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    song(index, { artists: track.song.artists.slice(0, -1) })
                  }
                >
                  Remove last artist
                </Button>
              )}
              <label className="ns-field" htmlFor={'music-genres-' + index}>
                Genres · separated by commas
                <Input
                  id={'music-genres-' + index}
                  value={track.song.genres.join(', ')}
                  maxLength={255}
                  onChange={(e) =>
                    song(index, {
                      genres: e.target.value.split(',').map((v) => v.trim()),
                    })
                  }
                />
              </label>
              <label className="ns-field" htmlFor={'music-master-' + index}>
                Master declaration
                <Input
                  id={'music-master-' + index}
                  value={track.song.copyright.master}
                  maxLength={64}
                  onChange={(e) =>
                    song(index, {
                      copyright: {
                        ...track.song.copyright,
                        master: e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label
                className="ns-field"
                htmlFor={'music-composition-' + index}
              >
                Composition declaration
                <Input
                  id={'music-composition-' + index}
                  value={track.song.copyright.composition}
                  maxLength={64}
                  onChange={(e) =>
                    song(index, {
                      copyright: {
                        ...track.song.copyright,
                        composition: e.target.value,
                      },
                    })
                  }
                />
              </label>
              <details className="ns-lab-details">
                <summary>Declared songwriting shares</summary>
                <p>
                  Optional. Shares must total 100%. No payments are configured.
                </p>
                {track.song.authors?.map((author, a) => (
                  <div className="ns-music-share" key={a}>
                    <label htmlFor={`music-author-${index}-${a}`}>
                      Author
                      <Input
                        id={`music-author-${index}-${a}`}
                        value={author.name}
                        maxLength={64}
                        onChange={(e) =>
                          song(index, {
                            authors: track.song.authors!.map((v, i) =>
                              i === a ? { ...v, name: e.target.value } : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <label htmlFor={`music-share-${index}-${a}`}>
                      Share, %
                      <Input
                        id={`music-share-${index}-${a}`}
                        value={author.share.replace(/%$/, '')}
                        inputMode="decimal"
                        maxLength={6}
                        onChange={(e) =>
                          song(index, {
                            authors: track.song.authors!.map((v, i) =>
                              i === a
                                ? { ...v, share: e.target.value + '%' }
                                : v,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
                {(track.song.authors?.length || 0) < 8 && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      song(index, {
                        authors: [
                          ...(track.song.authors || []),
                          { name: '', share: '' },
                        ],
                      })
                    }
                  >
                    <Plus size={15} /> Add author
                  </Button>
                )}
                {!!track.song.authors?.length && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const { authors: _authors, ...rest } = track.song;
                      changed();
                      setDraft({
                        ...draft,
                        tracks: draft.tracks.map((t, i) =>
                          i === index ? { ...t, song: rest } : t,
                        ),
                      });
                    }}
                  >
                    Remove shares
                  </Button>
                )}
              </details>
            </details>
          ))}
          <div className="ns-button-row">
            <Button
              disabled={busy}
              onClick={() => void buildPackage()}
              data-music-build
            >
              <FileAudio2 size={17} />{' '}
              {busy ? 'Verifying exact content…' : 'Build music package'}
            </Button>
          </div>
          {error && (
            <p className="ns-error" role="alert">
              {error}
            </p>
          )}
        </section>
        <section className="ns-panel" aria-live="polite">
          {pkg && budget ? (
            <>
              <div className="ns-lab-row">
                <h3>{pkg.release.release_title}</h3>
                <span className="ns-kb-status">{pkg.release.release_type}</span>
              </div>
              {demo && (
                <p className="ns-lab-muted">
                  Original BEACN Labs demonstration. Unminted, with
                  declared demonstration credits.
                </p>
              )}
              <div className="ns-music-preview">
                <PayloadPreview file={pkg.bundle.files[selected]} />
              </div>
              <div className="ns-music-select">
                {pkg.bundle.files.map((f, i) => (
                  <button
                    key={f.name}
                    aria-pressed={selected === i}
                    onClick={() => setSelected(i)}
                  >
                    {i === 0 ? 'Cover' : f.name}
                  </button>
                ))}
              </div>
              {pkg.bundle.files[selected].mediaType === 'audio/midi' && (
                <p className="ns-lab-muted">
                  For MIDI playback, download the exact file and open it in a
                  MIDI player.
                </p>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  const file = pkg.bundle.files[selected];
                  download(
                    new Blob(
                      [
                        new Uint8Array(
                          decodePayloadURI(file.uri, file.mediaType),
                        ),
                      ],
                      { type: file.mediaType },
                    ),
                    file.name,
                  );
                }}
              >
                <Download size={16} /> Download selected file
              </Button>
              <div className="ns-hash">
                <span>Release hash · exact files + credits</span>
                <code data-music-hash>{pkg.packageHash}</code>
              </div>
              <div className="ns-hash">
                <span>{pkg.bundle.files[selected].name} · SHA-256</span>
                <code>{pkg.bundle.files[selected].sha256}</code>
              </div>
              <div className="ns-contract-stats">
                <div>
                  <strong>{pkg.bundle.bytes.toLocaleString()}</strong>
                  <span>exact file bytes</span>
                </div>
                <div>
                  <strong>
                    {budget.metadataBytesAt32ByteAssetName.toLocaleString()}
                  </strong>
                  <span>/ 14,000 metadata bytes</span>
                </div>
              </div>
              <p className="ns-lab-muted">
                The complete signed transaction is measured during wallet
                review. No compression or transcoding has been applied.
              </p>
              <div className="ns-button-row">
                <Button onClick={() => void exportPackage()} data-music-export>
                  <Download size={17} /> Export music package
                </Button>
                {active && (
                  <FileMintDialog key={pkg.packageHash} musicPackage={pkg} />
                )}
              </div>
              <details className="ns-lab-details">
                <summary>Complete declared credits</summary>
                <pre className="ns-music-credits">
                  {JSON.stringify(
                    { release: pkg.release, tracks: pkg.tracks },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </>
          ) : (
            <>
              <Disc3 size={40} className="ns-contract-mark" />
              <h3>Credits belong with the recording.</h3>
              <p className="ns-lab-muted">
                Add a compact original, an image cover and the people behind it.
                Build the package to inspect the exact files, credits and
                metadata size.
              </p>
              <div className="ns-contract-flow">
                <span>Audio + artwork</span>
                <span aria-hidden="true">+</span>
                <span>Artists + music declarations</span>
                <span aria-hidden="true">↓</span>
                <span>One verifiable release package</span>
              </div>
            </>
          )}
        </section>
      </div>
      <details className="ns-lab-details">
        <summary>Format and compatibility notes</summary>
        <p>
          This is a documented CIP-60-aligned Studio extension for embedded
          files. It is not strict v3 CDDL conformance, and playback or credit
          discovery in other players has not been verified. Optional Boolean
          fields from CIP-60 cannot be encoded directly in ledger metadata and
          are omitted. Omission does not mean false.
        </p>
        <a
          className="ns-text-link"
          href="https://github.com/BEACNpool/NFT-Studio/blob/main/docs/MUSIC_RELEASE.md"
          target="_blank"
          rel="noreferrer"
        >
          Read the format, primary sources and tested boundaries
        </a>
      </details>
    </div>
  );
}
