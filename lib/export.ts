import { zipSync, strToU8 } from 'fflate';
import {
  Artwork,
  artSVG,
  isGenerative,
  canExportSVG,
  renderArtwork,
  toBlob,
  SOURCES,
} from './art';
import { UTILITIES } from './utility';
import {
  interactiveHTML,
  interactiveURI,
  interactiveGuide,
} from './interactive';
export const filename = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'prism-artwork';
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function chunks(value: string, max = 64): string | string[] {
  const out: string[] = [];
  let current = '';
  for (const char of value) {
    if (new TextEncoder().encode(current + char).length > max) {
      out.push(current);
      current = '';
    }
    current += char;
  }
  if (current || !out.length) out.push(current);
  return out.length === 1 ? out[0] : out;
}
export function attributes(a: Artwork) {
  return [
    {
      trait_type: 'Art engine',
      value:
        SOURCES.find((s) => s.id === a.source)?.name ||
        (a.source === 'blank' ? 'Original canvas' : 'Uploaded artwork'),
    },
    { trait_type: 'Seed', value: a.seed },
    { trait_type: 'Spectrum', value: a.hue },
    { trait_type: 'Detail', value: a.detail },
    { trait_type: 'Scale', value: a.scale },
    { trait_type: 'Rotation', value: a.rotation },
    ...(a.design
      ? [
          { trait_type: 'Text layers', value: a.design.texts.length },
          { trait_type: 'Drawing strokes', value: a.design.strokes.length },
          { trait_type: 'Backdrop', value: a.design.backdrop },
          { trait_type: 'Frame', value: a.design.frame },
        ]
      : []),
    ...a.traits.filter((t) => t.trait_type.trim() && t.value.trim()),
  ];
}
export function metadata(
  a: Artwork,
  mediaUri = 'ipfs://REPLACE_WITH_ARTWORK_CID',
  policyId = 'REPLACE_WITH_POLICY_ID',
  assetName = 'REPLACE_WITH_ASSET_NAME',
) {
  if (new TextEncoder().encode(a.name).length > 64)
    throw new Error(
      'Artwork titles must fit within 64 UTF-8 bytes for the Cardano template.',
    );
  const traits = attributes(a);
  const program = a.interactive
    ? interactiveHTML(a.interactive, a.name)
    : undefined;
  return {
    opensea: {
      name: a.name,
      description: a.description,
      image: mediaUri,
      ...(program ? { animation_url: interactiveURI(program) } : {}),
      background_color: a.background.slice(1),
      attributes: traits,
      properties: {
        studio: 'BEACN PRISM',
        license: a.license,
        artwork_origin: isGenerative(a.source)
          ? 'Deterministic generative art'
          : a.source === 'blank'
            ? 'Hand-composed original canvas'
            : a.source === 'custom'
              ? 'User supplied image'
              : 'AI-generated artwork base, customized in PRISM',
        utility_status: program
          ? 'Embedded public interactive program; benefit plans are blueprints'
          : 'Blueprint only',
      },
    },
    cardano: {
      '721': {
        [policyId]: {
          [assetName]: {
            name: a.name,
            description: chunks(a.description),
            image: chunks(mediaUri),
            mediaType: 'image/png',
            files: [
              { name: a.name, mediaType: 'image/png', src: chunks(mediaUri) },
              ...(program
                ? [
                    {
                      name: 'interactive.html',
                      mediaType: 'text/html',
                      src: chunks(interactiveURI(program)),
                    },
                  ]
                : []),
            ],
            traits: traits.map((t) => ({
              trait: chunks(t.trait_type),
              value: chunks(String(t.value)),
            })),
            license: chunks(a.license),
          },
        },
        version: '1.0',
      },
    },
  };
}
export function utilityPlan(a: Artwork) {
  return {
    schema: 'prism.utility-plan.v1',
    artwork: a.name,
    status: 'blueprint',
    notice:
      'Access, redemption, voting and benefits require a connected service or contract. This document does not activate them.',
    benefits: a.utilities.map((u) => ({
      ...u,
      type: UTILITIES.find((t) => t.id === u.id)?.name || u.id,
      status: 'blueprint',
      implementation:
        UTILITIES.find((t) => t.id === u.id)?.needs ||
        'Connect a fulfillment service.',
    })),
  };
}
export function utilityMarkdown(a: Artwork) {
  return `# ${a.name} — utility plan\n\nBlueprint only. Benefits are not activated by this file.\n\n${a.utilities.map((u) => `## ${UTILITIES.find((t) => t.id === u.id)?.name || u.id}\n\n${u.benefit}\n\nEligibility: ${u.eligibility}\nStarts: ${u.starts || 'Not specified'}\nEnds: ${u.ends || 'Not specified'}\nPublic access page: ${u.destination || 'Not specified'}\n\nTerms: ${u.terms}\n\nImplementation: ${UTILITIES.find((t) => t.id === u.id)?.needs}\n`).join('\n')}\nUsage terms: ${a.license}\nToken ownership does not by itself transfer artwork rights.\n`;
}
export const jsonBlob = (value: unknown) =>
  new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
export async function packageArtworks(
  artworks: Artwork[],
  size: number,
  onProgress: (n: number) => void,
  mediaUri?: string,
  policyId?: string,
  assetName?: string,
) {
  const files: Record<string, Uint8Array> = {};
  const manifest = [];
  let totalBytes = 0;
  if (artworks.length > 1 && size > 2048)
    throw new Error(
      'Collection exports support up to 2048px. Export a single piece for 4096px.',
    );
  for (let i = 0; i < artworks.length; i++) {
    const a = artworks[i],
      base = `${String(i + 1).padStart(3, '0')}-${filename(a.name)}`,
      png = await toBlob(await renderArtwork(a, size));
    const bytes = new Uint8Array(await png.arrayBuffer());
    totalBytes += bytes.byteLength;
    if (totalBytes > 96 * 1024 * 1024)
      throw new Error(
        'This package is too large. Select fewer works or choose 1024px.',
      );
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    const beforeFiles = new Set(Object.keys(files));
    const m = metadata(
      a,
      artworks.length === 1 ? mediaUri : undefined,
      policyId,
      artworks.length === 1
        ? assetName
        : `PRISM${String(i + 1).padStart(3, '0')}`,
    );
    files[`${base}/artwork.png`] = bytes;
    if (canExportSVG(a)) files[`${base}/artwork.svg`] = strToU8(artSVG(a));
    files[`${base}/metadata-opensea.json`] = strToU8(
      JSON.stringify(m.opensea, null, 2),
    );
    files[`${base}/metadata-cardano-template.json`] = strToU8(
      JSON.stringify(m.cardano, null, 2),
    );
    files[`${base}/project.prism.json`] = strToU8(
      JSON.stringify({ schema: 'prism.artwork.v2', artwork: a }, null, 2),
    );
    files[`${base}/utility-plan.json`] = strToU8(
      JSON.stringify(utilityPlan(a), null, 2),
    );
    files[`${base}/utility-plan.md`] = strToU8(utilityMarkdown(a));
    if (a.interactive) {
      files[`${base}/interactive.html`] = strToU8(
        interactiveHTML(a.interactive, a.name),
      );
      files[`${base}/HOW-TO-USE.txt`] = strToU8(
        interactiveGuide(a.interactive, a.name),
      );
    }
    totalBytes += Object.entries(files).reduce(
      (sum, [key, value]) =>
        sum +
        (!beforeFiles.has(key) && !key.endsWith('/artwork.png')
          ? value.byteLength
          : 0),
      0,
    );
    if (totalBytes > 96 * 1024 * 1024)
      throw new Error(
        'This package, including editable recipes, is too large. Select fewer works or a smaller export size.',
      );
    manifest.push({
      name: a.name,
      folder: base,
      sha256,
      seed: a.seed,
      source: a.source,
      width: size,
      height: size,
    });
    onProgress(Math.round(((i + 1) / artworks.length) * 100));
    await new Promise((r) => setTimeout(r, 0));
  }
  files['manifest.json'] = strToU8(
    JSON.stringify(
      { schema: 'prism.collection.v1', status: 'unminted', artworks: manifest },
      null,
      2,
    ),
  );
  files['READ-ME.txt'] = strToU8(
    'PRISM — CREATION PACKAGE\n\nYour artwork, editable recipe, metadata templates and utility plans. No token has been minted.\n\n1. Finalize title, traits, rights and benefit terms. AI bases are shared starting points and are not exclusive.\n2. Publish each artwork to persistent storage and replace image URI placeholders.\n3. For Cardano, supply the minting policy ID (56 lowercase hex characters) and unique asset name (at most 32 UTF-8 bytes). Validate the complete transaction metadata against your minting tool.\n4. Mint through your chosen wallet and platform; review network, supply, fees and permissions. For fully on-chain Cardano minting, return to PRISM and choose Mint on Cardano. It prepares a compact WebP preview, embeds the artwork and metadata, checks the complete transaction size, and asks your wallet to sign and submit. This creation package itself does not mint anything.\n5. Connect ownership verification and benefit fulfillment before offering utilities. Never publish private access URLs, credentials, shipping details or personal information in metadata.\n\nImage export dimensions may exceed the 1254px AI artwork bases; those are upscaled, not additional source detail. Generative SVG files without Design Lab layers scale without a fixed pixel resolution. Personalized designs export completely as PNG, on-chain WebP and editable project files.\n\nThe manifest SHA-256 verifies exported PNG bytes; it does not prove authorship or on-chain registration. Saved drafts are local to this browser. Preserve this package.\n\nFormats: https://docs.opensea.io/docs/metadata-standards\nhttps://cips.cardano.org/cip/CIP-0025\n',
  );
  return new Blob([new Uint8Array(zipSync(files, { level: 0 }))], {
    type: 'application/zip',
  });
}
