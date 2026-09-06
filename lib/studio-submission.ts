import { PROTOCOL_URL } from './cardano';

export type SubmissionAttempt = {
  schema: 'nft-studio.submission.v1';
  hash: string;
  state: 'submitting' | 'submitted' | 'unknown';
  attemptedAt: number;
  updatedAt: number;
  message?: string;
};
export type AttemptStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type AttemptLocks = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
};
const PREFIX = 'nft-studio:submission:v1:';
function validHash(hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash))
    throw new Error('Expected a lowercase 64-character transaction hash.');
}
export function readSubmissionAttempt(
  hash: string,
  storage: AttemptStorage = localStorage,
): SubmissionAttempt | null {
  validHash(hash);
  const raw = storage.getItem(PREFIX + hash);
  if (raw === null) return null;
  let record: SubmissionAttempt;
  try {
    record = JSON.parse(raw);
  } catch {
    throw new Error(
      'The saved transaction attempt is unreadable. Check this transaction hash on chain before taking further action.',
    );
  }
  if (
    record.schema !== 'nft-studio.submission.v1' ||
    record.hash !== hash ||
    !['submitting', 'submitted', 'unknown'].includes(record.state) ||
    !Number.isSafeInteger(record.attemptedAt) ||
    !Number.isSafeInteger(record.updatedAt)
  )
    throw new Error(
      'The saved transaction attempt is invalid. Check this transaction hash on chain before taking further action.',
    );
  return record;
}
function writeAttempt(record: SubmissionAttempt, storage: AttemptStorage) {
  storage.setItem(PREFIX + record.hash, JSON.stringify(record));
  const saved = readSubmissionAttempt(record.hash, storage);
  if (
    !saved ||
    saved.attemptedAt !== record.attemptedAt ||
    saved.state !== record.state
  )
    throw new Error(
      'The browser could not retain the transaction attempt. Submission is paused.',
    );
}
/** Call only after signed-CBOR validation. A saved attempt is never submitted again.
 * Web Locks serialize tabs; durable storage prevents a reload from retrying.
 * Clearing browser data or another browser/device is outside this local guarantee.
 */
export async function submitTransactionOnce(options: {
  hash: string;
  submit: () => Promise<string>;
  storage?: AttemptStorage;
  locks?: AttemptLocks;
}): Promise<{ attempt: SubmissionAttempt; alreadyAttempted: boolean }> {
  validHash(options.hash);
  const storage = options.storage || localStorage;
  const locks =
    options.locks ||
    (typeof navigator !== 'undefined' ? navigator.locks : undefined);
  if (!locks?.request)
    throw new Error(
      'This browser cannot safely coordinate transaction attempts. Use a current wallet browser or desktop extension.',
    );
  return locks.request(PREFIX + options.hash, async () => {
    const existing = readSubmissionAttempt(options.hash, storage);
    if (existing) return { attempt: existing, alreadyAttempted: true };
    const at = Date.now();
    let attempt: SubmissionAttempt = {
      schema: 'nft-studio.submission.v1',
      hash: options.hash,
      state: 'submitting',
      attemptedAt: at,
      updatedAt: at,
    };
    // Fail closed before touching the wallet when storage is unavailable/full.
    writeAttempt(attempt, storage);
    try {
      const returnedHash = await options.submit();
      if (
        typeof returnedHash !== 'string' ||
        returnedHash.toLowerCase() !== options.hash
      )
        throw new Error(
          'The wallet returned a different or invalid transaction hash.',
        );
      attempt = { ...attempt, state: 'submitted', updatedAt: Date.now() };
    } catch {
      attempt = {
        ...attempt,
        state: 'unknown',
        updatedAt: Date.now(),
        message:
          'The submission response was inconclusive. Check the expected transaction hash; do not create another copy.',
      };
    }
    // The original submitting marker remains a replay guard if this update fails.
    try {
      writeAttempt(attempt, storage);
    } catch {
      attempt = {
        ...attempt,
        state: 'unknown',
        message:
          'Save this transaction hash now. The browser could not update its receipt; check the chain before continuing.',
      };
    }
    return { attempt, alreadyAttempted: false };
  });
}

export type ChainObservation = {
  hash: string;
  state: 'pending' | 'confirmed';
  checkedAt: number;
  /** Koios counts blocks AFTER the inclusion block: zero still means inclusion. */
  blocksAfterInclusion?: number;
  metadata?: unknown;
};
type ReadOptions = {
  fetcher?: typeof fetch;
  endpoint?: string;
  signal?: AbortSignal;
};
async function query(path: string, hash: string, options: ReadOptions) {
  validHash(hash);
  const response = await (options.fetcher || fetch)(
    (options.endpoint || PROTOCOL_URL) + path,
    {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _tx_hashes: [hash] }),
      signal: options.signal || AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw new Error(
      'The chain reader is unavailable. Your transaction status is not yet known.',
    );
  const text = await response.text();
  if (text.length > 1000000)
    throw new Error('The chain reader returned an oversized response.');
  const rows: unknown = JSON.parse(text);
  if (!Array.isArray(rows) || rows.length > 1)
    throw new Error('The chain reader returned an unexpected result.');
  if (!rows.length) return null;
  const row = rows[0];
  if (!row || typeof row !== 'object' || row.tx_hash !== hash)
    throw new Error('The chain reader returned a different transaction hash.');
  return row as Record<string, unknown>;
}
/** A bounded, read-only poll; callers schedule subsequent polls and stop on unmount.
 * Confirmed means observed chain inclusion, not irreversible settlement.
 */
export async function checkTransaction(
  hash: string,
  options: ReadOptions = {},
): Promise<ChainObservation> {
  const row = await query('/tx_status', hash, options);
  const count = row?.num_confirmations;
  if (count === null || count === undefined)
    return { hash, state: 'pending', checkedAt: Date.now() };
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0)
    throw new Error('The chain reader returned an invalid confirmation count.');
  return {
    hash,
    state: 'confirmed',
    checkedAt: Date.now(),
    blocksAfterInclusion: count,
  };
}
/** Retrieves metadata for a known transaction hash. Empty indexing results remain pending. */
export async function readTransactionMetadata(
  hash: string,
  options: ReadOptions = {},
): Promise<unknown> {
  const row = await query('/tx_metadata', hash, options);
  if (!row || row.metadata === null || row.metadata === undefined) return null;
  if (typeof row.metadata !== 'object' || Array.isArray(row.metadata))
    throw new Error('Invalid transaction metadata response.');
  return row.metadata;
}
