/* oxlint-disable no-control-regex -- Metadata validation rejects control characters. */
/**
 * A local music-release profile layered over Studio's exact-file NFT metadata.
 * No wallet, network, decoder execution, signing, submission, or rights inference.
 * This is a documented CIP-60-aligned extension, not strict v3 CDDL conformance.
 */
import {
  payloadHash,
  payloadMetadata,
  metadataChunks,
  recoverPayloadMetadata,
  verifyPayloadBundle,
  type LedgerValue,
  type PayloadBundle,
  type PayloadMetadata,
} from './studio-payload';

export const MUSIC_RELEASE_SCHEMA = 'beacn.music-release.v1' as const;
export const MUSIC_RELEASE_PROFILE = 'cip60-v3-studio-exact-files' as const;
export const MUSIC_LIMITS = Object.freeze({
  packageBytes: 80000,
  musicJsonBytes: 6000,
  metadataCborBytes: 14000,
  tracks: 7,
  artists: 4,
  contributors: 8,
  authors: 8,
  links: 3,
  textBytes: 64,
  songTitleBytes: 192,
});

export type MusicArtist = Readonly<{
  name: string;
  isni?: string;
  links?: Readonly<Record<string, string>>;
}>;
export type MusicContributor = Readonly<{
  name: string;
  ipi?: string;
  ipn?: string;
  role?: readonly string[];
  links?: Readonly<Record<string, string>>;
}>;
export type MusicAuthor = Readonly<{
  name: string;
  ipi?: string;
  share: string;
}>;
export type MusicRelease = Readonly<{
  release_type: 'Single' | 'Multiple';
  release_title: string;
  distributor?: string;
  visual_artist?: string;
  release_date?: string;
  publication_date?: string;
  catalog_number?: string;
  series?: string;
  collection?: string;
}>;
export type MusicSong = Readonly<{
  song_title: string;
  song_duration: string;
  track_number: number;
  artists: readonly MusicArtist[];
  copyright: Readonly<{ master: string; composition: string }>;
  genres: readonly string[];
  featured_artists?: readonly MusicArtist[];
  contributing_artists?: readonly MusicContributor[];
  authors?: readonly MusicAuthor[];
  mood?: string;
  set?: string;
  lyrics?: string;
  special_thanks?: readonly string[];
  bitrate?: string;
  bpm?: string;
  mix_engineer?: string;
  mastering_engineer?: string;
  producer?: string;
  co_producer?: string;
  recording_engineer?: string;
  isrc?: string;
  iswc?: string;
  metadata_language?: string;
  country_of_origin?: string;
  language?: string;
  derived_from?: string;
}>;
export type MusicTrack = Readonly<{ fileName: string; song: MusicSong }>;
export type MusicComposerInput = Readonly<{
  release: MusicRelease;
  tracks: readonly MusicTrack[];
}>;
export type MusicReleasePackage = Readonly<{
  schema: typeof MUSIC_RELEASE_SCHEMA;
  profile: typeof MUSIC_RELEASE_PROFILE;
  bundle: PayloadBundle;
  release: MusicRelease;
  tracks: readonly MusicTrack[];
  packageHash: string;
}>;
export type MusicAssetIdentity = Readonly<{
  policyId: string;
  assetName: string;
}>;
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
function error(message: string): never {
  throw new Error(message);
}

/** Take a bounded value-only snapshot before any asynchronous operation. */
function snapshot(
  value: unknown,
  maxBytes: number = MUSIC_LIMITS.packageBytes,
): Json {
  let budget = maxBytes;
  let nodes = 0;
  const debit = (bytes: number) => {
    budget -= bytes;
    if (budget < 0) error('Music package exceeds its JSON size limit.');
  };
  const visit = (v: unknown, depth: number): Json => {
    if (++nodes > 4096 || depth > 16)
      error('Music package nesting or item limit exceeded.');
    if (typeof v === 'string') {
      // Reject lone surrogates before TextEncoder can replace them.
      if (v.length > maxBytes || dec.decode(enc.encode(v)) !== v)
        error('Invalid music UTF-8 text.');
      debit(enc.encode(JSON.stringify(v)).length);
      return v;
    }
    if (v === null || typeof v === 'boolean') {
      debit(5);
      return v;
    }
    if (typeof v === 'number' && Number.isSafeInteger(v) && !Object.is(v, -0)) {
      debit(String(v).length);
      return v;
    }
    if (!v || typeof v !== 'object')
      error('Music package must contain plain JSON values.');
    const proto = Object.getPrototypeOf(v);
    const array = Array.isArray(v);
    if (
      array
        ? proto !== Array.prototype
        : proto !== Object.prototype && proto !== null
    )
      error('Music package requires plain objects and arrays.');
    const keys = Reflect.ownKeys(v);
    if (keys.length > 4096 || keys.some((key) => typeof key !== 'string'))
      error('Invalid music object keys.');
    if (array) {
      const length = Object.getOwnPropertyDescriptor(v, 'length')?.value;
      if (
        !Number.isSafeInteger(length) ||
        length > 4096 ||
        keys.length !== length + 1
      )
        error('Music arrays must be dense and have no extra properties.');
      debit(2 + length);
      const out: Json[] = [];
      for (let i = 0; i < length; i++) {
        const d = Object.getOwnPropertyDescriptor(v, String(i));
        if (!d || !d.enumerable || !Object.hasOwn(d, 'value'))
          error('Music arrays must contain plain values.');
        out.push(visit(d.value, depth + 1));
      }
      return out;
    }
    debit(2 + keys.length * 2);
    const out: { [key: string]: Json } = {};
    for (const k of (keys as string[]).sort()) {
      if (enc.encode(k).length > 64 || dec.decode(enc.encode(k)) !== k)
        error('Invalid music field name.');
      const d = Object.getOwnPropertyDescriptor(v, k)!;
      if (!d.enumerable || !Object.hasOwn(d, 'value'))
        error('Music fields must be plain enumerable values.');
      debit(enc.encode(JSON.stringify(k)).length);
      Object.defineProperty(out, k, {
        value: visit(d.value, depth + 1),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return out;
  };
  return visit(value, 0);
}

function fields(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  label: string,
) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    error(`Invalid ${label}.`);
  const row = value as Record<string, unknown>;
  if (
    required.some((key) => !Object.hasOwn(row, key)) ||
    Object.keys(row).some(
      (key) => !required.includes(key) && !optional.includes(key),
    )
  )
    error(`Unexpected or missing ${label} fields.`);
  return row;
}
function text(value: unknown, label: string, max = 64): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value !== value.trim() ||
    enc.encode(value).length > max ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    error(
      `${label} must be nonempty text of at most ${max} UTF-8 bytes without surrounding whitespace or controls.`,
    );
  return value as string;
}
function list(value: unknown, max: number, label: string): unknown[] {
  if (!Array.isArray(value) || !value.length || value.length > max)
    error(`${label} must contain 1–${max} entries.`);
  return value as unknown[];
}
function uniqueTextList(value: unknown, max: number, label: string): string[] {
  const result = list(value, max, label).map((v) => text(v, label));
  if (new Set(result).size !== result.length)
    error(`${label} must not repeat an entry.`);
  return result;
}
function url(value: unknown, label: string): string {
  const s = text(value, label);
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return error(`${label} must be an absolute HTTPS URL.`);
  }
  if (
    u.protocol !== 'https:' ||
    !u.hostname ||
    u.username ||
    u.password ||
    /[\\\s]/.test(s)
  )
    error(`${label} must be an absolute HTTPS URL without credentials.`);
  return s;
}
function links(value: unknown): Record<string, string> {
  const row = fields(value, [], Object.keys(value as object), 'artist links');
  if (!Object.keys(row).length || Object.keys(row).length > MUSIC_LIMITS.links)
    error('Include 1–3 artist links.');
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (
      !/^[a-z][a-z0-9_]{0,23}$/.test(key) ||
      ['constructor', 'prototype', '__proto__'].includes(key)
    )
      error('Use a short lowercase link label.');
    out[key] = url(value, 'Artist link');
  }
  return out;
}
function identifier(value: unknown, label: string, regex: RegExp): string {
  const s = text(value, label);
  if (!regex.test(s))
    error(
      `Invalid ${label} syntax; only enter an identifier that was actually assigned.`,
    );
  return s;
}
function artist(value: unknown): MusicArtist {
  const row = fields(value, ['name'], ['isni', 'links'], 'artist');
  return {
    name: text(row.name, 'Artist name'),
    ...(row.isni !== undefined
      ? { isni: identifier(row.isni, 'ISNI', /^[0-9]{15}[0-9X]$/) }
      : {}),
    ...(row.links !== undefined ? { links: links(row.links) } : {}),
  };
}
function contributor(value: unknown): MusicContributor {
  const row = fields(
    value,
    ['name'],
    ['ipn', 'ipi', 'role', 'links'],
    'contributor',
  );
  return {
    name: text(row.name, 'Contributor name'),
    ...(row.ipi !== undefined
      ? { ipi: identifier(row.ipi, 'IPI', /^[0-9]{9,11}$/) }
      : {}),
    ...(row.ipn !== undefined
      ? { ipn: identifier(row.ipn, 'IPN', /^[0-9]{1,16}$/) }
      : {}),
    ...(row.role !== undefined
      ? { role: uniqueTextList(row.role, 4, 'Contributor roles') }
      : {}),
    ...(row.links !== undefined ? { links: links(row.links) } : {}),
  };
}
function shares(value: unknown): MusicAuthor[] {
  let total = 0;
  const result = list(value, MUSIC_LIMITS.authors, 'Authors').map((v) => {
    const row = fields(v, ['name', 'share'], ['ipi'], 'author');
    const share = identifier(
      row.share,
      'author share',
      /^(?:0|[1-9][0-9]?|100)(?:\.[0-9]{1,2})?%$/,
    );
    const [whole, fraction = ''] = share.slice(0, -1).split('.');
    const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (basisPoints < 1 || basisPoints > 10000)
      error('Author shares must be above zero and at most 100%.');
    total += basisPoints;
    return {
      name: text(row.name, 'Author name'),
      share,
      ...(row.ipi !== undefined
        ? { ipi: identifier(row.ipi, 'IPI', /^[0-9]{9,11}$/) }
        : {}),
    };
  });
  if (total !== 10000) error('Declared author shares must total exactly 100%.');
  return result;
}
function date(value: unknown, label: string): string {
  const s = text(value, label);
  if (!/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/.test(s))
    error(`${label} must use YYYY-MM-DD.`);
  const parsed = new Date(`${s}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== s
  )
    error(`Invalid ${label}.`);
  return s;
}
function duration(value: unknown): string {
  const s = text(value, 'Song duration');
  const parts =
    /^PT(?:(0|[1-9][0-9]?)H)?(?:(0|[1-9][0-9]?)M)?(?:(0|[1-9][0-9]?)S)?$/.exec(
      s,
    );
  if (!parts || (!parts[1] && !parts[2] && !parts[3]))
    error('Use a positive whole-second duration such as PT3M21S.');
  const [h, m, sec] = parts.slice(1).map((n) => Number(n || 0));
  if (h > 23 || m > 59 || sec > 59 || h * 3600 + m * 60 + sec < 1)
    error(
      'Song duration must be 1 second to less than 24 hours, with minutes and seconds below 60.',
    );
  return s;
}
const songTextFields = [
  'mood',
  'set',
  'bitrate',
  'bpm',
  'mix_engineer',
  'mastering_engineer',
  'producer',
  'co_producer',
  'recording_engineer',
  'country_of_origin',
  'derived_from',
] as const;
function song(value: unknown): MusicSong {
  const row = fields(
    value,
    [
      'song_title',
      'song_duration',
      'track_number',
      'artists',
      'copyright',
      'genres',
    ],
    [
      ...songTextFields,
      'lyrics',
      'special_thanks',
      'featured_artists',
      'contributing_artists',
      'authors',
      'isrc',
      'iswc',
      'metadata_language',
      'language',
    ],
    'song',
  );
  if (
    !Number.isSafeInteger(row.track_number) ||
    Number(row.track_number) < 1 ||
    Number(row.track_number) > 999
  )
    error('Track number must be an integer from 1 to 999.');
  const rights = fields(
    row.copyright,
    ['master', 'composition'],
    [],
    'copyright declaration',
  );
  const out: Record<string, unknown> = {
    song_title: text(row.song_title, 'Song title', MUSIC_LIMITS.songTitleBytes),
    song_duration: duration(row.song_duration),
    track_number: row.track_number,
    artists: list(row.artists, MUSIC_LIMITS.artists, 'Artists').map(artist),
    copyright: {
      master: text(rights.master, 'Master copyright declaration'),
      composition: text(
        rights.composition,
        'Composition copyright declaration',
      ),
    },
    genres: uniqueTextList(row.genres, 3, 'Genres'),
  };
  for (const key of songTextFields)
    if (row[key] !== undefined) out[key] = text(row[key], key);
  if (row.lyrics !== undefined) out.lyrics = url(row.lyrics, 'Lyrics link');
  if (row.special_thanks !== undefined)
    out.special_thanks = uniqueTextList(
      row.special_thanks,
      8,
      'Special thanks',
    );
  if (row.featured_artists !== undefined)
    out.featured_artists = list(
      row.featured_artists,
      MUSIC_LIMITS.artists,
      'Featured artists',
    ).map(artist);
  if (row.contributing_artists !== undefined)
    out.contributing_artists = list(
      row.contributing_artists,
      MUSIC_LIMITS.contributors,
      'Contributors',
    ).map(contributor);
  if (row.authors !== undefined) out.authors = shares(row.authors);
  if (row.isrc !== undefined)
    out.isrc = identifier(
      row.isrc,
      'ISRC',
      /^[A-Z]{2}-[A-Z0-9]{3}-[0-9]{2}-[0-9]{5}$/,
    );
  if (row.iswc !== undefined)
    out.iswc = identifier(row.iswc, 'ISWC', /^T-[0-9]{9}-[0-9]$/);
  // A deliberately small syntax subset, not a complete BCP-47 registry validator.
  for (const key of ['language', 'metadata_language'])
    if (row[key] !== undefined)
      out[key] = identifier(
        row[key],
        key,
        /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2}|-[0-9]{3})?$/,
      );
  return out as MusicSong;
}
function parseComposer(value: unknown): MusicComposerInput {
  const row = fields(value, ['release', 'tracks'], [], 'music composer');
  const release = fields(
    row.release,
    ['release_type', 'release_title'],
    [
      'distributor',
      'visual_artist',
      'release_date',
      'publication_date',
      'catalog_number',
      'series',
      'collection',
    ],
    'release',
  );
  if (!['Single', 'Multiple'].includes(release.release_type as string))
    error(
      'This profile supports Single and Multiple releases; Album/EP is outside this profile.',
    );
  const out: Record<string, unknown> = {
    release_type: release.release_type,
    release_title: text(release.release_title, 'Release title'),
  };
  for (const key of ['visual_artist', 'catalog_number', 'series', 'collection'])
    if (release[key] !== undefined) out[key] = text(release[key], key);
  if (release.distributor !== undefined)
    out.distributor = url(release.distributor, 'Distributor');
  for (const key of ['release_date', 'publication_date'])
    if (release[key] !== undefined) out[key] = date(release[key], key);
  const tracks = list(row.tracks, MUSIC_LIMITS.tracks, 'Tracks').map((item) => {
    const track = fields(item, ['fileName', 'song'], [], 'track');
    return {
      fileName: text(track.fileName, 'Track file name'),
      song: song(track.song),
    };
  });
  if (
    new Set(tracks.map((t) => t.fileName)).size !== tracks.length ||
    new Set(tracks.map((t) => t.song.track_number)).size !== tracks.length
  )
    error('Track files and track numbers must be unique.');
  if (release.release_type === 'Single' && tracks.length !== 1)
    error('A Single release must contain exactly one track.');
  // Stable, visible playback order; caller input array order has no hidden meaning.
  tracks.sort((a, b) => a.song.track_number - b.song.track_number);
  const result = { release: out as MusicRelease, tracks };
  snapshot(result, MUSIC_LIMITS.musicJsonBytes);
  return result;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}
function canonical(value: unknown): string {
  return JSON.stringify(snapshot(value));
}
function validateIdentity(value: unknown): MusicAssetIdentity {
  const row = fields(
    snapshot(value),
    ['policyId', 'assetName'],
    [],
    'asset identity',
  );
  if (typeof row.policyId !== 'string' || !/^[a-f0-9]{56}$/.test(row.policyId))
    error('Use an exact lowercase policy ID.');
  const name = text(row.assetName, 'Asset name', 32);
  return { policyId: row.policyId as string, assetName: name };
}

/** Build a content-bound local package. It is not a Studio mint intent. */
export async function createMusicRelease(
  bundleInput: unknown,
  composerInput: unknown,
): Promise<MusicReleasePackage> {
  const bundle = snapshot(bundleInput) as unknown as PayloadBundle;
  // Validate the entire field shape before the shared exact-byte decoder sees it.
  fields(
    bundle,
    ['schema', 'name', 'description', 'files', 'cover', 'sha256', 'bytes'],
    [],
    'payload bundle',
  );
  if (
    bundle.schema !== 'nft-studio.payload.v1' ||
    bundle.cover !== true ||
    typeof bundle.name !== 'string' ||
    typeof bundle.description !== 'string' ||
    typeof bundle.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(bundle.sha256) ||
    !Number.isSafeInteger(bundle.bytes) ||
    bundle.bytes < 1 ||
    !Array.isArray(bundle.files) ||
    bundle.files.length < 2 ||
    bundle.files.length > 8
  )
    error(
      'Music needs a Studio NFT bundle with a cover image and 1–7 audio files.',
    );
  for (const file of bundle.files) {
    fields(
      file,
      ['name', 'mediaType', 'bytes', 'sha256', 'uri'],
      [],
      'payload file',
    );
    if (
      typeof file.name !== 'string' ||
      typeof file.mediaType !== 'string' ||
      typeof file.uri !== 'string' ||
      typeof file.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 1
    )
      error(
        'Music payload files require exact typed names, MIME types, URIs, byte lengths and SHA-256 hashes.',
      );
  }
  const composer = parseComposer(
    snapshot(composerInput, MUSIC_LIMITS.musicJsonBytes),
  );
  if (
    !bundle.files[0].mediaType.startsWith('image/') ||
    bundle.files
      .slice(1)
      .some(
        (f) =>
          !['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/midi'].includes(
            f.mediaType,
          ),
      )
  )
    error(
      'This music profile accepts one cover followed only by supported audio files.',
    );
  if (
    composer.tracks.length !== bundle.files.length - 1 ||
    composer.tracks.some(
      (track) => !bundle.files.slice(1).some((f) => f.name === track.fileName),
    )
  )
    error('Every audio file must have exactly one matching track record.');
  await verifyPayloadBundle(bundle);
  const core = {
    schema: MUSIC_RELEASE_SCHEMA,
    profile: MUSIC_RELEASE_PROFILE,
    bundle,
    ...composer,
  };
  const packageHash = await payloadHash(enc.encode(canonical(core)));
  const result = { ...core, packageHash };
  snapshot(result);
  // A 32-byte textual asset name is the maximum supported identity. This bounds
  // the final label-721 bytes even before a wallet chooses a real policy/name.
  assembleMetadata(result, {
    policyId: '0'.repeat(56),
    assetName: '0'.repeat(32),
  });
  return freeze(result);
}
export async function verifyMusicRelease(
  input: unknown,
): Promise<MusicReleasePackage> {
  const row = fields(
    snapshot(input),
    ['schema', 'profile', 'bundle', 'release', 'tracks', 'packageHash'],
    [],
    'music release package',
  );
  if (
    row.schema !== MUSIC_RELEASE_SCHEMA ||
    row.profile !== MUSIC_RELEASE_PROFILE ||
    typeof row.packageHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(row.packageHash)
  )
    error('Unsupported music package or invalid hash.');
  const rebuilt = await createMusicRelease(row.bundle, {
    release: row.release,
    tracks: row.tracks,
  });
  if (rebuilt.packageHash !== row.packageHash)
    error('Music package hash does not match its exact content and credits.');
  return rebuilt;
}
export async function parseMusicRelease(
  input: string,
): Promise<MusicReleasePackage> {
  if (
    typeof input !== 'string' ||
    input.length > MUSIC_LIMITS.packageBytes ||
    enc.encode(input).length > MUSIC_LIMITS.packageBytes
  )
    error('Music package exceeds 80 KB.');
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    return error('Invalid music package JSON.');
  }
  // Reject duplicate keys, alternate number spellings, BOM and other ambiguous
  // JSON presentations. The exported package is the import format.
  if (canonical(value) !== input)
    error('Use the canonical music package exported by this codec.');
  return verifyMusicRelease(value);
}
export async function musicReleaseBytes(input: unknown): Promise<Uint8Array> {
  return enc.encode(canonical(await verifyMusicRelease(input)));
}

/** Independent deterministic, definite-length metadata CBOR; top-level labels are uints. */
export function musicMetadataCbor(input: PayloadMetadata): Uint8Array {
  const metadata = snapshot(input) as unknown as PayloadMetadata;
  const parts: number[] = [];
  const put = (...bytes: number[]) => {
    parts.push(...bytes);
    if (parts.length > MUSIC_LIMITS.metadataCborBytes)
      error(
        'Music metadata exceeds the 14,000-byte profile cap; reduce files or credits.',
      );
  };
  const head = (major: number, n: number) => {
    if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff)
      error('Metadata size or integer is outside this profile.');
    if (n < 24) put(major * 32 + n);
    else if (n <= 255) put(major * 32 + 24, n);
    else if (n <= 65535) put(major * 32 + 25, n >>> 8, n & 255);
    else
      put(
        major * 32 + 26,
        (n >>> 24) & 255,
        (n >>> 16) & 255,
        (n >>> 8) & 255,
        n & 255,
      );
  };
  const write = (v: LedgerValue): void => {
    if (typeof v === 'string') {
      const b = enc.encode(v);
      if (b.length > 64) error('Ledger metadata text exceeds 64 UTF-8 bytes.');
      head(3, b.length);
      for (const byte of b) put(byte);
      return;
    }
    if (typeof v === 'number') {
      head(v >= 0 ? 0 : 1, v >= 0 ? v : -1 - v);
      return;
    }
    if (Array.isArray(v)) {
      head(4, v.length);
      for (const item of v) write(item);
      return;
    }
    if (!v || typeof v !== 'object')
      error('Ledger metadata has no Boolean or null values.');
    const entries = Object.entries(v);
    head(5, entries.length);
    for (const [k, val] of entries) {
      write(k);
      write(val);
    }
  };
  const entries = Object.entries(metadata);
  if (entries.length !== 1 || entries[0][0] !== '721')
    error('Music metadata must use only integer label 721.');
  head(5, 1);
  head(0, 721);
  write(entries[0][1]);
  return Uint8Array.from(parts);
}

function assembleMetadata(
  pkg: MusicReleasePackage,
  identity: MusicAssetIdentity,
): {
  metadata: PayloadMetadata;
  metadataCborHex: string;
  metadataCborBytes: number;
  packageHash: string;
} {
  const metadata = payloadMetadata(pkg.bundle, identity);
  const label = metadata['721'] as Record<string, LedgerValue>;
  const policy = label[identity.policyId] as Record<string, LedgerValue>;
  const row = policy[identity.assetName] as Record<string, LedgerValue>;
  row.music_metadata_version = 3;
  row.release = snapshot(pkg.release) as LedgerValue;
  row.music_profile = MUSIC_RELEASE_PROFILE;
  row.music_package_sha256 = pkg.packageHash;
  const songs = new Map(
    pkg.tracks.map((track) => [track.fileName, track.song]),
  );
  // Preserve bundle file order so Studio recovery retains the original content hash.
  row.files = (row.files as Record<string, LedgerValue>[]).map((file) => {
    const track = songs.get(file.name as string)!;
    return {
      ...file,
      song: {
        ...(snapshot(track) as Record<string, LedgerValue>),
        song_title: metadataChunks(track.song_title),
      },
    };
  });
  // Sort object keys for a stable wire representation, but preserve every array order.
  const stable = snapshot(metadata) as unknown as PayloadMetadata;
  const encoded = musicMetadataCbor(stable);
  return freeze({
    metadata: stable,
    metadataCborHex: Array.from(encoded, (b) =>
      b.toString(16).padStart(2, '0'),
    ).join(''),
    metadataCborBytes: encoded.length,
    packageHash: pkg.packageHash,
  });
}
export async function musicReleaseMetadata(
  input: unknown,
  identityInput: unknown,
) {
  const identity = validateIdentity(identityInput);
  return assembleMetadata(await verifyMusicRelease(input), identity);
}
/** Worst-case identity allowance only; the complete transaction must be measured separately. */
export async function musicReleaseBudget(input: unknown): Promise<{
  metadataBytesAt32ByteAssetName: number;
  metadataByteLimit: number;
  remainingMetadataBytes: number;
  completeTransactionMeasured: false;
}> {
  const pkg = await verifyMusicRelease(input);
  const { metadataCborBytes } = assembleMetadata(pkg, {
    policyId: '0'.repeat(56),
    assetName: '0'.repeat(32),
  });
  return Object.freeze({
    metadataBytesAt32ByteAssetName: metadataCborBytes,
    metadataByteLimit: MUSIC_LIMITS.metadataCborBytes,
    remainingMetadataBytes: MUSIC_LIMITS.metadataCborBytes - metadataCborBytes,
    completeTransactionMeasured: false,
  });
}

/** Recover this exact adapter, rejecting changed/dropped/extra metadata fields. */
export async function recoverMusicRelease(
  metadataInput: unknown,
  identityInput: unknown,
): Promise<MusicReleasePackage> {
  const identity = validateIdentity(identityInput);
  const metadata = snapshot(metadataInput) as unknown as PayloadMetadata;
  const row = (
    (metadata['721'] as Record<string, LedgerValue>)?.[
      identity.policyId
    ] as Record<string, LedgerValue>
  )?.[identity.assetName] as Record<string, LedgerValue>;
  if (
    !row ||
    row.music_metadata_version !== 3 ||
    row.music_profile !== MUSIC_RELEASE_PROFILE ||
    !Array.isArray(row.files)
  )
    error('This identity does not contain the supported music profile.');
  const tracks = row.files.map((file) => {
    const f = file as Record<string, LedgerValue>;
    const s = f.song as Record<string, LedgerValue>;
    if (!s || typeof s !== 'object' || Array.isArray(s))
      return error('Music file lacks its song record.');
    const title = s.song_title;
    if (
      Array.isArray(title) &&
      (title.length < 1 ||
        title.length > 12 ||
        title.some(
          (part) => typeof part !== 'string' || enc.encode(part).length > 64,
        ))
    )
      error('Invalid song title chunks.');
    return {
      fileName: f.name,
      song: {
        ...s,
        song_title: Array.isArray(title) ? (title as string[]).join('') : title,
      },
    };
  });
  const recovered = await recoverPayloadMetadata(metadata, identity);
  const pkg = await createMusicRelease(recovered.bundle, {
    release: row.release,
    tracks,
  });
  if (pkg.packageHash !== row.music_package_sha256)
    error('Recovered music package hash differs from its metadata.');
  const rebuilt = await musicReleaseMetadata(pkg, identity);
  if (canonical(rebuilt.metadata) !== canonical(metadata))
    error('Music metadata is not the exact supported adapter representation.');
  return pkg;
}
