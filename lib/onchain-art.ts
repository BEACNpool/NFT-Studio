import { Artwork, renderArtwork } from './art';
import { attributes, chunks, utilityPlan } from './export';
import {
  interactiveHTML,
  interactiveURI,
  type InteractiveSpec,
} from './interactive';

export type OnchainProgram = {
  html: string;
  uri: string;
  bytes: number;
  sha256: string;
  kind: InteractiveSpec['kind'] | 'pocket-arcade';
};
export async function prepareProgram(
  art: Artwork,
): Promise<OnchainProgram | undefined> {
  if (!art.interactive) return undefined;
  const html = interactiveHTML(art.interactive, art.name),
    bytes = new TextEncoder().encode(html);
  return {
    html,
    uri: interactiveURI(html),
    bytes: bytes.length,
    sha256: await digestHex(bytes),
    kind: art.interactive.kind,
  };
}

export type OnchainImage = {
  uri: string;
  mediaType?: 'image/webp' | 'image/avif' | 'image/svg+xml';
  bytes: number;
  width: number;
  quality: number;
  sha256: string;
};
// A curated campaign may preserve its measured bytes instead of re-encoding.
// Ordinary studio artwork always uses fitOnchainImage below.
export async function verifyPreparedImage(image: OnchainImage) {
  const mime = image.mediaType || 'image/webp';
  const prefix = `data:${mime};base64,`;
  if (
    !['image/webp', 'image/avif'].includes(mime) ||
    !image.uri.startsWith(prefix) ||
    image.uri.length > 24000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(image.uri.slice(prefix.length)) ||
    !Number.isSafeInteger(image.width) ||
    image.width < 96 ||
    image.width > 2048
  )
    throw new Error('This prepared image is invalid. Nothing was minted.');
  const bytes = Uint8Array.from(atob(image.uri.slice(prefix.length)), (c) =>
    c.charCodeAt(0),
  );
  if (bytes.length !== image.bytes || (await digestHex(bytes)) !== image.sha256)
    throw new Error('The prepared image changed. Nothing was minted.');
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.slice(from, to));
  if (
    mime === 'image/webp'
      ? ascii(0, 4) !== 'RIFF' || ascii(8, 12) !== 'WEBP'
      : ascii(4, 8) !== 'ftyp' || !ascii(8, 32).includes('avif')
  )
    throw new Error('The image encoding does not match its declared type.');
  return image;
}
export async function digestHex(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

// Always compress a rendering of the current recipe, including uploaded images.
// The returned URI is both the preview and the exact metadata payload.
export async function fitOnchainImage(
  art: Artwork,
  budget = 8200,
): Promise<OnchainImage> {
  const source = await renderArtwork(art, 1024);
  for (const width of [512, 384, 320, 256, 192, 160, 128, 96]) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = width;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot prepare artwork.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, width);
    let best: { blob: Blob; quality: number } | undefined;
    // Prefer the largest image that fits without extreme compression.
    let low = 0.12,
      high = 0.93;
    for (let i = 0; i < 7; i++) {
      const quality = i === 0 ? low : (low + high) / 2;
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error('Image encoding failed.')),
          'image/webp',
          quality,
        ),
      );
      if (blob.type !== 'image/webp')
        throw new Error(
          'This browser cannot encode WebP. Try a current Chrome, Edge or Firefox browser.',
        );
      if (blob.size <= budget) {
        best = { blob, quality };
        low = quality;
      } else {
        high = quality;
        if (i === 0) break;
      }
    }
    if (best) {
      const bytes = new Uint8Array(await best.blob.arrayBuffer());
      const uri =
        'data:image/webp;base64,' +
        btoa(Array.from(bytes, (n) => String.fromCharCode(n)).join(''));
      return {
        uri,
        bytes: bytes.length,
        width,
        quality: Math.round(best.quality * 100),
        sha256: await digestHex(bytes),
      };
    }
  }
  throw new Error(
    'Artwork cannot fit at this budget. Simplify the image or reduce its metadata.',
  );
}

function splitText(value: unknown): unknown {
  if (typeof value === 'string') return chunks(value);
  if (typeof value === 'number' && !Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return value.map(splitText);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, splitText(v)]),
    );
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return value;
}
export function onchainMetadata(
  art: Artwork,
  image: OnchainImage,
  policyId: string,
  assetName: string,
  program?: OnchainProgram,
) {
  if (!art.name.trim() || new TextEncoder().encode(art.name).length > 64)
    throw new Error('Give your artwork a title of at most 64 UTF-8 bytes.');
  if (
    !!art.interactive !== !!program ||
    (program && program.html !== interactiveHTML(art.interactive!, art.name))
  )
    throw new Error(
      'The interactive program does not match this artwork. Prepare again.',
    );
  return {
    '721': {
      [policyId]: {
        [assetName]: splitText({
          name: art.name,
          description: art.description,
          image: image.uri,
          mediaType: image.mediaType || 'image/webp',
          image_sha256: image.sha256,
          ...(program
            ? {
                files: [
                  {
                    name: 'interactive.html',
                    mediaType: 'text/html',
                    src: program.uri,
                  },
                ],
                interactive: {
                  schema: 'bmkr.interactive.v1',
                  template: program.kind,
                  sha256: program.sha256,
                  bytes: program.bytes,
                  access: 'Public and reusable; not holder-only',
                  use: 'Open the HTML attachment in a compatible viewer or download it and open in a browser.',
                  state: 'Session only; resets on reload',
                },
              }
            : {}),
          width: image.width,
          height: image.width,
          attributes: attributes(art),
          license: art.license,
          utility_plan: utilityPlan(art),
          studio: 'BEACN PRISM',
          origin:
            art.source === 'blank'
              ? 'Hand-composed original canvas'
              : art.source === 'custom'
                ? 'User supplied artwork'
                : ['chroma', 'solar', 'tidal'].includes(art.source)
                  ? 'AI-generated base, customized in PRISM'
                  : 'Deterministic mathematical artwork',
        }),
      },
      version: '1.0',
    },
  };
}
