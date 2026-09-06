import catalog from './arcade-catalog.json';
import { INITIAL, type Artwork } from './art';
import {
  digestHex,
  type OnchainImage,
  type OnchainProgram,
} from './onchain-art';
import { assetPath } from './paths';

export const ARCADE = catalog;
export type ArcadeId = keyof typeof catalog;
export type ArcadeMedia = {
  id: ArcadeId;
  image: OnchainImage;
  program: OnchainProgram;
};
export const isArcadeId = (id: string): id is ArcadeId =>
  Object.hasOwn(catalog, id);
export const arcadeURI = (html: string) =>
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(html)
    .replace(/%2F/g, '/')
    .replace(/%2B/g, '+')
    .replace(/%3D/g, '=')
    .replace(/%3A/g, ':')
    .replace(/%3B/g, ';')
    .replace(/%2C/g, ',');

// Only the frozen, hash-pinned catalog programs and covers may use compact metadata.
// This path never accepts executable uploads or changes the general image validator.
export async function verifyArcade(media: ArcadeMedia): Promise<ArcadeMedia> {
  if (!media || !isArcadeId(media.id))
    throw new Error('Unknown game. Choose a Pocket Arcade game.');
  const entry = catalog[media.id],
    { image, program } = media;
  const bytes = new TextEncoder().encode(program.html);
  if (
    program.kind !== 'pocket-arcade' ||
    bytes.length !== entry.programBytes ||
    program.bytes !== bytes.length ||
    program.sha256 !== entry.programSHA256 ||
    (await digestHex(bytes)) !== entry.programSHA256 ||
    program.uri !== arcadeURI(program.html)
  )
    throw new Error('The game file changed. Reload before playing or minting.');
  const prefix = 'data:image/svg+xml;base64,';
  if (
    image.mediaType !== 'image/svg+xml' ||
    !image.uri.startsWith(prefix) ||
    image.uri.length > 1600 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(image.uri.slice(prefix.length)) ||
    image.width !== 640 ||
    image.bytes !== entry.coverBytes ||
    image.sha256 !== entry.coverSHA256
  )
    throw new Error('The game cover changed. Reload before minting.');
  const cover = Uint8Array.from(atob(image.uri.slice(prefix.length)), (c) =>
    c.charCodeAt(0),
  );
  if (
    cover.length !== entry.coverBytes ||
    (await digestHex(cover)) !== entry.coverSHA256
  )
    throw new Error('The game cover failed its integrity check.');
  return media;
}

export async function loadArcade(id: ArcadeId): Promise<ArcadeMedia> {
  if (!isArcadeId(id)) throw new Error('Unknown game.');
  const entry = catalog[id];
  const read = async (file: string) => {
    const response = await fetch(assetPath('/arcade/' + id + '/' + file), {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('The game could not load. Try again.');
    return response.text();
  };
  const [html, svg] = await Promise.all([read('game.html'), read('cover.svg')]);
  const cover = new TextEncoder().encode(svg);
  return verifyArcade({
    id,
    image: {
      uri: 'data:image/svg+xml;base64,' + btoa(String.fromCharCode(...cover)),
      mediaType: 'image/svg+xml',
      bytes: cover.length,
      width: 640,
      quality: 100,
      sha256: entry.coverSHA256,
    },
    program: {
      html,
      uri: arcadeURI(html),
      bytes: new TextEncoder().encode(html).length,
      sha256: entry.programSHA256,
      kind: 'pocket-arcade',
    },
  });
}

export function arcadeArtwork(media: ArcadeMedia): Artwork {
  const entry = catalog[media.id];
  return {
    ...INITIAL,
    name: entry.title,
    description: entry.description,
    source: 'custom',
    customImage: media.image.uri,
    traits: [],
    utilities: [],
    interactive: undefined,
    signature: false,
    design: undefined,
    license: 'Publicly playable; no additional artwork rights granted',
  };
}

export function arcadeMetadata(
  media: ArcadeMedia,
  policy: string,
  asset: string,
) {
  const entry = catalog[media.id];
  const chunks = (s: string) => s.match(/.{1,64}/g)!;
  return {
    '721': {
      [policy]: {
        [asset]: {
          name: entry.title,
          mediaType: 'image/svg+xml',
          image: chunks(media.image.uri),
          files: [
            {
              name: 'PLAY ' + entry.title,
              mediaType: 'text/html',
              src: chunks(media.program.uri),
            },
          ],
          description: chunks(entry.description),
          sha256: media.program.sha256,
        },
      },
    },
  };
}
