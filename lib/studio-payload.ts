/* oxlint-disable no-control-regex -- Input validation deliberately rejects control characters. */
/** Exact-byte, self-contained payloads. No wallet, network, or execution occurs here. */
export const DATA_LABEL = '1313231955';
export const MAX_PAYLOAD_BYTES = 12000;
// Recovery includes compact legacy programs larger than the new-package input bound.
export const MAX_RECOVERY_BYTES = 16384;
export const MAX_PAYLOAD_FILES = 8;
export const PAYLOAD_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/midi',
  'video/mp4',
  'video/webm',
  'text/html',
  'text/plain',
  'text/markdown',
  'application/json',
  'application/octet-stream',
] as const;
export type PayloadMime = (typeof PAYLOAD_TYPES)[number];
export type PayloadInput = {
  name: string;
  mediaType: PayloadMime;
  bytes: Uint8Array;
};
export type PayloadFile = Readonly<{
  name: string;
  mediaType: PayloadMime;
  bytes: number;
  sha256: string;
  uri: string;
}>;
export type PayloadBundle = Readonly<{
  schema: 'nft-studio.payload.v1';
  name: string;
  description: string;
  files: readonly PayloadFile[];
  cover: boolean;
  sha256: string;
  bytes: number;
}>;
export type LedgerValue =
  | string
  | number
  | LedgerValue[]
  | { [key: string]: LedgerValue };
export type PayloadMetadata = Record<string, LedgerValue>;
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });
const fail = (message: string): never => {
  throw new Error(message);
};
export async function payloadHash(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
function boundedText(
  value: unknown,
  max: number,
  label: string,
  required = true,
) {
  if (
    typeof value !== 'string' ||
    enc.encode(value).length > max ||
    (required && !value.trim()) ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) ||
    dec.decode(enc.encode(value)) !== value
  )
    fail(`${label} must be valid UTF-8 text within ${max} bytes.`);
  return value as string;
}
function filename(name: unknown) {
  const value = boundedText(name, 64, 'File name');
  if (
    value !== value.normalize('NFC') ||
    /[\\/:<>"|?*]/.test(value) ||
    /[. ]$/.test(value) ||
    value === '.' ||
    value === '..' ||
    /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(value)
  )
    fail(
      'Use a simple file name without a folder, reserved name, or trailing dot.',
    );
  return value;
}
export function metadataChunks(text: string): string | string[] {
  if (enc.encode(text).length <= 64) return text;
  const out: string[] = [];
  let chunk = '';
  let bytes = 0;
  for (const c of text) {
    const size = enc.encode(c).length;
    if (bytes + size > 64) {
      out.push(chunk);
      chunk = '';
      bytes = 0;
    }
    chunk += c;
    bytes += size;
  }
  if (chunk) out.push(chunk);
  return out;
}
function joinChunks(value: unknown, max: number): string {
  const parts = typeof value === 'string' ? [value] : value;
  if (
    !Array.isArray(parts) ||
    !parts.length ||
    parts.length > Math.ceil(max / 16) ||
    parts.some((x) => typeof x !== 'string' || enc.encode(x).length > 64)
  )
    fail('Invalid ledger text chunks.');
  const joined = (parts as string[]).join('');
  if (enc.encode(joined).length > max)
    fail('Recovered content exceeds its limit.');
  return joined;
}
function isText(mime: string) {
  return (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'image/svg+xml'
  );
}
function validateBytes(mime: PayloadMime, bytes: Uint8Array) {
  const ascii = (a: number, b: number) =>
    String.fromCharCode(...bytes.slice(a, b));
  const starts = (hex: number[]) => hex.every((x, i) => bytes[i] === x);
  if (isText(mime)) {
    let text: string;
    try {
      text = dec.decode(bytes);
    } catch {
      return fail('Text files must contain valid UTF-8.');
    }
    if (mime === 'application/json') {
      try {
        JSON.parse(text);
      } catch {
        fail('The JSON file is not valid JSON.');
      }
    }
    if (
      mime === 'image/svg+xml' &&
      !/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(text)
    )
      fail('The SVG file must start with its svg element.');
    return;
  }
  const matches: Partial<Record<PayloadMime, boolean>> = {
    'image/png': starts([137, 80, 78, 71, 13, 10, 26, 10]),
    'image/jpeg': starts([255, 216, 255]),
    'image/webp': ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP',
    'image/avif': ascii(4, 8) === 'ftyp' && ascii(8, 64).includes('avif'),
    'image/gif': ['GIF87a', 'GIF89a'].includes(ascii(0, 6)),
    'audio/wav': ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE',
    'audio/ogg': ascii(0, 4) === 'OggS',
    'audio/midi': ascii(0, 4) === 'MThd',
    'audio/mpeg':
      ascii(0, 3) === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224),
    'video/mp4': ascii(4, 8) === 'ftyp',
    'video/webm': starts([26, 69, 223, 163]),
  };
  if (matches[mime] === false)
    fail('The file signature does not match its selected media type.');
}
function base64(bytes: Uint8Array) {
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
}
function makeURI(mime: PayloadMime, bytes: Uint8Array): string {
  const binary = `data:${mime};base64,${base64(bytes)}`;
  if (!isText(mime) || mime.startsWith('image/')) return binary;
  const text = `data:${mime},${encodeURIComponent(dec.decode(bytes))}`;
  return text.length < binary.length ? text : binary;
}
export function decodePayloadURI(uri: string, mime: PayloadMime): Uint8Array {
  if (typeof uri !== 'string' || uri.length > MAX_RECOVERY_BYTES * 4 + 100)
    return fail('Invalid or oversized embedded file URI.');
  // Existing compact games explicitly declare UTF-8. Accept that bounded parameter.
  if (isText(mime)) {
    const utf8 = `data:${mime};charset=utf-8`;
    if (uri.startsWith(utf8 + ',')) uri = `data:${mime},` + uri.slice(utf8.length + 1);
    else if (uri.startsWith(utf8 + ';base64,')) uri = `data:${mime};base64,` + uri.slice((utf8 + ';base64,').length);
  }
  const binary = `data:${mime};base64,`,
    text = `data:${mime},`;
  let bytes: Uint8Array;
  if (uri.startsWith(binary)) {
    const body = uri.slice(binary.length);
    if (
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        body,
      )
    )
      return fail('Invalid base64 data URI.');
    bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    if (base64(bytes) !== body) return fail('Noncanonical base64 data URI.');
  } else if (
    isText(mime) &&
    uri.startsWith(text)
  ) {
    try {
      bytes = enc.encode(decodeURIComponent(uri.slice(text.length)));
    } catch {
      return fail('Invalid encoded UTF-8 data URI.');
    }
  } else
    return fail(
      'Only self-contained data URIs matching the media type are accepted.',
    );
  if (!bytes.length || bytes.length > MAX_RECOVERY_BYTES)
    return fail('Embedded file size is outside the supported bound.');
  validateBytes(mime, bytes);
  return bytes;
}
function identity(bundle: Omit<PayloadBundle, 'sha256'>) {
  return enc.encode(
    JSON.stringify({
      schema: bundle.schema,
      name: bundle.name,
      description: bundle.description,
      cover: bundle.cover,
      files: bundle.files.map(({ name, mediaType, bytes, sha256 }) => ({
        name,
        mediaType,
        bytes,
        sha256,
      })),
    }),
  );
}
export async function preparePayloadBundle(options: {
  name: string;
  description?: string;
  files: readonly PayloadInput[];
  coverIndex?: number;
}): Promise<PayloadBundle> {
  const name = boundedText(options.name, 64, 'Title');
  const description = boundedText(
    options.description || '',
    1024,
    'Description',
    false,
  );
  if (
    !Array.isArray(options.files) ||
    options.files.length < 1 ||
    options.files.length > MAX_PAYLOAD_FILES
  )
    return fail(`Add between one and ${MAX_PAYLOAD_FILES} files.`);
  const inputs = [...options.files];
  const cover = options.coverIndex !== undefined;
  if (cover) {
    const i = options.coverIndex!;
    if (
      !Number.isSafeInteger(i) ||
      i < 0 ||
      i >= inputs.length ||
      !inputs[i].mediaType.startsWith('image/')
    )
      return fail('Choose an image file as the NFT cover.');
    inputs.unshift(...inputs.splice(i, 1));
  }
  let total = 0;
  const names = new Set<string>(),
    files: PayloadFile[] = [];
  for (const input of inputs) {
    const fileName = filename(input.name),
      mime = input.mediaType;
    if (!(PAYLOAD_TYPES as readonly string[]).includes(mime))
      return fail('Unsupported media type.');
    if (names.has(fileName.toLocaleLowerCase('en-US')))
      return fail('Each file needs a distinct name.');
    names.add(fileName.toLocaleLowerCase('en-US'));
    if (!(input.bytes instanceof Uint8Array) || !input.bytes.length)
      return fail('Files must contain at least one byte.');
    total += input.bytes.length;
    if (total > MAX_PAYLOAD_BYTES)
      return fail(
        `The files exceed ${MAX_PAYLOAD_BYTES.toLocaleString()} raw bytes. A complete transaction may need a smaller payload.`,
      );
    const bytes = new Uint8Array(input.bytes);
    validateBytes(mime, bytes);
    files.push(
      Object.freeze({
        name: fileName,
        mediaType: mime,
        bytes: bytes.length,
        sha256: await payloadHash(bytes),
        uri: makeURI(mime, bytes),
      }),
    );
  }
  const partial = {
    schema: 'nft-studio.payload.v1' as const,
    name,
    description,
    files: Object.freeze(files),
    cover,
    bytes: total,
  };
  return Object.freeze({
    ...partial,
    sha256: await payloadHash(identity(partial)),
  });
}
export async function verifyPayloadBundle(
  bundle: PayloadBundle,
): Promise<void> {
  if (!bundle || bundle.schema !== 'nft-studio.payload.v1')
    return fail('Unsupported payload bundle.');
  const rebuilt = await preparePayloadBundle({
    name: bundle.name,
    description: bundle.description,
    coverIndex: bundle.cover ? 0 : undefined,
    files: bundle.files.map((f) => ({
      name: f.name,
      mediaType: f.mediaType,
      bytes: decodePayloadURI(f.uri, f.mediaType),
    })),
  });
  if (
    rebuilt.sha256 !== bundle.sha256 ||
    rebuilt.bytes !== bundle.bytes ||
    rebuilt.files.some(
      (f, i) =>
        f.sha256 !== bundle.files[i].sha256 ||
        f.bytes !== bundle.files[i].bytes ||
        f.uri !== bundle.files[i].uri,
    )
  )
    fail('The prepared content changed. Prepare the transaction again.');
}
function fileMetadata(file: PayloadFile): LedgerValue {
  return {
    name: file.name,
    mediaType: file.mediaType,
    src: metadataChunks(file.uri),
    sha256: file.sha256,
    bytes: file.bytes,
  };
}
export function payloadMetadata(
  bundle: PayloadBundle,
  mint?: { policyId: string; assetName: string },
): PayloadMetadata {
  if (mint) {
    if (
      !/^[a-f0-9]{56}$/.test(mint.policyId) ||
      !mint.assetName ||
      enc.encode(mint.assetName).length > 32
    )
      return fail('Invalid asset identity.');
    if (!bundle.cover)
      return fail(
        'An NFT needs a cover image. Data records can be created without one.',
      );
    const image = bundle.files[0];
    return {
      '721': {
        [mint.policyId]: {
          [mint.assetName]: {
            name: bundle.name,
            image: metadataChunks(image.uri),
            mediaType: image.mediaType,
            image_name: image.name,
            image_sha256: image.sha256,
            image_bytes: image.bytes,
            ...(bundle.description
              ? { description: metadataChunks(bundle.description) }
              : {}),
            files: bundle.files.slice(1).map(fileMetadata),
            schema: bundle.schema,
            content_sha256: bundle.sha256,
          },
        },
        version: '1.0',
      },
    };
  }
  return {
    [DATA_LABEL]: {
      schema: 'nft-studio.data.v1',
      name: bundle.name,
      ...(bundle.description
        ? { description: metadataChunks(bundle.description) }
        : {}),
      files: bundle.files.map(fileMetadata),
      content_sha256: bundle.sha256,
      cover: bundle.cover ? 1 : 0,
    },
  };
}
/** Recover only our explicit schema; returns original file bytes after all hashes match. */
export async function recoverPayloadMetadata(
  metadata: unknown,
  mint?: { policyId: string; assetName: string },
) {
  if (!metadata || typeof metadata !== 'object')
    return fail('Invalid transaction metadata.');
  const map = metadata as Record<string, unknown>;
  const container = mint
    ? (map['721'] as Record<string, Record<string, unknown>>)?.[
        mint.policyId
      ]?.[mint.assetName]
    : map[DATA_LABEL];
  if (!container || typeof container !== 'object')
    return fail('No NFT Studio payload was found at this identity.');
  const row = container as Record<string, unknown>;
  if (row.schema !== (mint ? 'nft-studio.payload.v1' : 'nft-studio.data.v1'))
    return fail('Unsupported payload metadata schema.');
  if (!Array.isArray(row.files) || row.files.length > MAX_PAYLOAD_FILES)
    return fail('Invalid payload file list.');
  const records: Record<string, unknown>[] = [...row.files];
  if (mint)
    records.unshift({
      name: row.image_name,
      mediaType: row.mediaType,
      src: row.image,
      sha256: row.image_sha256,
      bytes: row.image_bytes,
    });
  const files = records.map((r) => {
    if (
      !r ||
      typeof r !== 'object' ||
      !(PAYLOAD_TYPES as readonly unknown[]).includes(r.mediaType)
    )
      return fail('Invalid recovered file type.');
    const mime = r.mediaType as PayloadMime;
    return {
      name: filename(r.name),
      mediaType: mime,
      bytes: decodePayloadURI(
        joinChunks(r.src, MAX_PAYLOAD_BYTES * 4 + 100),
        mime,
      ),
    };
  });
  const bundle = await preparePayloadBundle({
    name: row.name as string,
    description:
      row.description === undefined ? '' : joinChunks(row.description, 1024),
    files,
    coverIndex: mint || row.cover === 1 ? 0 : undefined,
  });
  if (
    bundle.sha256 !== row.content_sha256 ||
    bundle.files.some(
      (f, i) => f.sha256 !== records[i].sha256 || f.bytes !== records[i].bytes,
    )
  )
    return fail('Recovered file integrity verification failed.');
  return { bundle, files };
}

/** Imported HTML has a STATIC preview. Bytes minted/exported remain unchanged.
 * A separate trusted-template runner may execute audited built-in games/apps.
 * Put this srcDoc only in <iframe sandbox="" referrerPolicy="no-referrer">.
 */
export function staticPayloadPreview(file: PayloadFile): {
  srcDoc: string;
  sandbox: '';
  referrerPolicy: 'no-referrer';
} {
  const bytes = decodePayloadURI(file.uri, file.mediaType);
  const escape = (x: string) =>
    x.replace(
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
  const csp =
    "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; media-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  let body = '';
  if (file.mediaType === 'text/html') {
    // Template contents are inert: no scripts, image loads, or frame loads during parsing.
    const template = document.createElement('template');
    template.innerHTML = dec.decode(bytes);
    const allowed = new Set(
      'A ABBR ARTICLE ASIDE B BLOCKQUOTE BR BUTTON CAPTION CODE COL COLGROUP DD DEL DETAILS DFN DIV DL DT EM FIGCAPTION FIGURE FOOTER H1 H2 H3 H4 H5 H6 HEADER HR I IMG INS KBD LI MAIN MARK NAV OL P PRE Q S SAMP SECTION SMALL SPAN STRONG SUB SUMMARY SUP TABLE TBODY TD TH THEAD TIME TR U UL VAR WBR'.split(
        ' ',
      ),
    );
    const attributes = new Set([
      'id',
      'class',
      'title',
      'alt',
      'lang',
      'dir',
      'colspan',
      'rowspan',
      'scope',
      'open',
    ]);
    for (const el of Array.from(template.content.querySelectorAll('*'))) {
      // Foreign namespaces and animation elements could restore a removed href
      // without JavaScript. A small HTML allowlist keeps imported previews inert.
      if (
        el.namespaceURI !== 'http://www.w3.org/1999/xhtml' ||
        !allowed.has(el.tagName.toUpperCase())
      ) {
        el.remove();
        continue;
      }
      for (const attr of Array.from(el.attributes))
        if (!attributes.has(attr.name.toLowerCase()))
          el.removeAttribute(attr.name);
    }
    body = template.innerHTML;
  } else if (file.mediaType.startsWith('image/'))
    body = `<img alt="${escape(file.name)}" src="${escape(file.uri)}">`;
  else if (file.mediaType.startsWith('audio/'))
    body = `<audio controls src="${escape(file.uri)}"></audio>`;
  else if (file.mediaType.startsWith('video/'))
    body = `<video controls playsinline src="${escape(file.uri)}"></video>`;
  else
    body = `<pre>${escape(isText(file.mediaType) ? dec.decode(bytes) : `${file.name}\n${file.bytes} bytes\nSHA-256 ${file.sha256}`)}</pre>`;
  return {
    srcDoc: `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>html{color-scheme:dark}body{margin:16px;color:#f5f5f5;background:#121316;font:15px system-ui}img,video{max-width:100%;max-height:80vh}pre{white-space:pre-wrap;overflow-wrap:anywhere}audio{max-width:100%}</style></head><body>${body}</body></html>`,
    sandbox: '',
    referrerPolicy: 'no-referrer',
  };
}
