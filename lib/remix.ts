import { INITIAL, validateArtwork, type Artwork } from './art';
export function remixLink(art: Artwork, origin: string, pathname: string) {
  if (art.source === 'custom')
    throw new Error(
      'Uploaded images travel in your project file. Export the editable project to share this design.',
    );
  const visual = {
    ...art,
    description: '',
    traits: [],
    utilities: [],
    license: INITIAL.license,
    customImage: undefined,
  };
  const bytes = new TextEncoder().encode(
    JSON.stringify({ schema: 'beacn.prism.remix.v1', artwork: visual }),
  );
  if (bytes.length > 11000)
    throw new Error(
      'This detailed drawing is too large for a remix link. Export the editable project to share all its layers.',
    );
  const code = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return (
    origin +
    pathname.replace(/\/index\.html$/, '/').replace(/\/?$/, '/') +
    '#remix=' +
    code
  );
}
export function readRemix(hash: string): Artwork | null {
  if (!hash.startsWith('#remix=')) return null;
  const encoded = hash.slice(7);
  if (encoded.length > 15000 || !/^[A-Za-z0-9_-]+$/.test(encoded))
    throw new Error('This remix link is invalid or too large.');
  const bytes = Uint8Array.from(
    atob(encoded.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0),
  );
  const value = JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(bytes),
  );
  if (
    value.schema !== 'beacn.prism.remix.v1' ||
    value.artwork?.source === 'custom'
  )
    throw new Error('This remix link uses an unsupported format.');
  const art = validateArtwork(value.artwork);
  return {
    ...art,
    description: '',
    traits: [],
    utilities: [],
    license: INITIAL.license,
  };
}
