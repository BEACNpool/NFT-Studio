import {
  encode64,
  verifySealedIntent,
  HANDOFF_TTL_SECONDS,
} from '../lib/studio-handoff';

export type HandoffEnv = { DB: D1Database };
const ALLOWED_ORIGINS = new Set([
  'https://beacnpool.github.io',
  'https://handoff.beacnpool.org',
]);
const MAX_BODY = 107000;
let readingBodies = 0;
async function digest(value: string): Promise<string> {
  return encode64(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  );
}
async function readBody(request: Request): Promise<unknown> {
  if (
    !request.headers.get('content-type')?.match(/^application\/json(?:;|$)/i) ||
    Number(request.headers.get('content-length')) > MAX_BODY
  )
    throw Error('Invalid body.');
  const reader = request.body?.getReader();
  if (!reader) throw Error('Empty body.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  let deadline: ReturnType<typeof setTimeout>;
  const timedOut = new Promise<never>((_, reject) => {
    deadline = setTimeout(() => {
      reject(Error('Body deadline exceeded.'));
      void reader.cancel().catch(() => {});
    }, 10000);
  });
  try {
    while (true) {
      const part = await Promise.race([reader.read(), timedOut]);
      if (part.done) break;
      size += part.value.length;
      if (size > MAX_BODY) throw Error('Body too large.');
      chunks.push(part.value);
    }
  } finally {
    clearTimeout(deadline!);
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
export async function handleHandoff(
  request: Request,
  env: HandoffEnv,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  });
  const response = (body: unknown, status = 200) =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers,
    });
  // CORS is not authentication. Random IDs are read capabilities; creator-only
  // revocation uses a separate token. Rate and capacity limits also apply.
  if (origin && origin !== requestUrl.origin && !ALLOWED_ORIGINS.has(origin))
    return response({ error: 'Origin not allowed.' }, 403);
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  if (request.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Max-Age', '600');
    return response(null, 204);
  }
  const path = requestUrl.pathname;
  if (requestUrl.search) return response({ error: 'Not found.' }, 404);
  const match = /^\/api\/handoffs\/([A-Za-z0-9_-]{22})$/.exec(path);
  if (path !== '/api/handoffs' && !match)
    return response({ error: 'Not found.' }, 404);
  if (!env.DB) return response({ error: 'Service unavailable.' }, 503);
  const now = Date.now();
  try {
    if (request.method === 'POST' && path === '/api/handoffs') {
      if (readingBodies >= 8)
        return response({ error: 'Transfer capacity reached.' }, 429);
      readingBodies++;
      let sealed;
      try {
        sealed = verifySealedIntent(await readBody(request));
      } catch {
        return response({ error: 'Invalid encrypted request.' }, 400);
      } finally {
        readingBodies--;
      }
      const id = encode64(crypto.getRandomValues(new Uint8Array(16)));
      const revokeToken = encode64(crypto.getRandomValues(new Uint8Array(32)));
      const expiresAt = now + HANDOFF_TTL_SECONDS * 1000;
      // Never retain the raw IP. Rotating the hash daily limits cross-day links;
      // this is a rate-limit identifier, not a claim of IP anonymization.
      const clientHash = await digest(
        `${new Date(now).toISOString().slice(0, 10)}|${request.headers.get('cf-connecting-ip') || 'unknown'}`,
      );
      const revokeHash = await digest(revokeToken);
      const results = await env.DB.batch([
        env.DB.prepare('DELETE FROM handoffs WHERE expires_at <= ?').bind(now),
        env.DB.prepare(`INSERT INTO handoffs (id, sealed, revoke_hash, client_hash, created_at, expires_at)
          SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM handoffs) < 300
          AND (SELECT COUNT(*) FROM handoffs WHERE client_hash = ?) < 20`).bind(
          id,
          JSON.stringify(sealed),
          revokeHash,
          clientHash,
          now,
          expiresAt,
          clientHash,
        ),
      ]);
      if (!results[1].meta.changes) {
        headers.set('Retry-After', '900');
        return response({ error: 'Transfer capacity reached.' }, 429);
      }
      return response({ id, expiresAt, revokeToken }, 201);
    }
    if (match && request.method === 'GET') {
      const row = await env.DB.prepare(
        'SELECT sealed, expires_at FROM handoffs WHERE id = ? AND expires_at > ? AND sealed IS NOT NULL',
      )
        .bind(match[1], now)
        .first<{ sealed: string; expires_at: number }>();
      if (!row) return response({ error: 'Transfer expired or ended.' }, 404);
      // Reading is intentionally repeatable: Android Chrome hands the same
      // request to a separate VESPR WebView before the user signs.
      return response({
        sealed: JSON.parse(row.sealed),
        expiresAt: row.expires_at,
      });
    }
    if (match && request.method === 'DELETE') {
      const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(
        request.headers.get('authorization') || '',
      );
      if (!token) return response({ error: 'Creator token required.' }, 401);
      const result = await env.DB.prepare(
        'UPDATE handoffs SET sealed = NULL WHERE id = ? AND revoke_hash = ?',
      )
        .bind(match[1], await digest(token[1]))
        .run();
      if (!result.meta.changes)
        return response({ error: 'Transfer not found.' }, 404);
      return response(null, 204);
    }
    return response({ error: 'Method not allowed.' }, 405);
  } catch {
    return response({ error: 'Service unavailable.' }, 503);
  }
}
