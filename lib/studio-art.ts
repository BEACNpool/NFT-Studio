import { INITIAL, byteTruncate, validateArtwork, type Artwork } from './art';
export async function imageArtwork(
  file: Blob & { name?: string },
): Promise<Artwork> {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size > 12_000_000
  )
    throw new Error(
      'Choose a PNG, JPEG or WebP under 12 MB. Use Files & data to preserve another format exactly.',
    );
  const bitmap = await createImageBitmap(file);
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 16_000_000
    )
      throw new Error('Choose an image no larger than 16 megapixels.');
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot prepare an image.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const customImage = canvas.toDataURL('image/webp', 0.94);
    if (customImage.length > 6_000_000)
      throw new Error('Try a smaller image for the editable project.');
    canvas.width = canvas.height = 1;
    return {
      ...INITIAL,
      source: 'custom',
      customImage,
      scale: 100,
      name: byteTruncate(
        (file.name || 'My artwork').replace(/\.[^.]+$/, ''),
        64,
      ),
      description: '',
    };
  } finally {
    bitmap.close();
  }
}
export async function importArtwork(file: File): Promise<Artwork> {
  if (file.size > 10_000_000)
    throw new Error('Editable projects must be under 10 MB.');
  const data = JSON.parse(await file.text());
  if (
    !['prism.artwork.v1', 'prism.artwork.v2', 'nftstudio.artwork.v1'].includes(
      data.schema,
    )
  )
    throw new Error('Choose an editable NFT Studio or PRISM artwork project.');
  const art = validateArtwork(data.artwork);
  if (art.source === 'custom' && art.customImage) {
    const normalized = await imageArtwork(
      await (await fetch(art.customImage)).blob(),
    );
    art.customImage = normalized.customImage;
  }
  return art;
}
