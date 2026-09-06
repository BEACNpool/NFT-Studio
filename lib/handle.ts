// The campaign destination is fixed. Re-resolving never silently changes it.
export async function verifyHandleDestination(name: string, address: string) {
  const response = await fetch(
    `https://api.handle.me/handles/${encodeURIComponent(name)}`,
    {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw new Error(
      'The destination Handle cannot be checked right now. Try preparing again.',
    );
  const handle = (await response.json()) as {
    name?: unknown;
    resolved_addresses?: { ada?: unknown };
  } | null;
  if (handle?.name !== name || handle.resolved_addresses?.ada !== address)
    throw new Error(
      'The Handle now resolves to a different address. This mint is paused for a new recipient review.',
    );
}
