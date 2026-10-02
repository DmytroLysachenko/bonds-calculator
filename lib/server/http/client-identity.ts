import { isIP } from 'node:net';

import type { NextRequest } from 'next/server';

/**
 * Trust only addresses appended by the explicitly configured ingress hops.
 * The ingress must strip/append headers as documented before enabling this.
 * Without that contract every caller shares the fail-closed unknown bucket.
 */
export function getClientIdentity(
  request: NextRequest,
  {
    trustedProxy = process.env.TRUSTED_PROXY === '1',
    trustedHops = Number(process.env.TRUSTED_PROXY_HOPS ?? '1'),
  }: { trustedProxy?: boolean; trustedHops?: number } = {},
) {
  if (!trustedProxy || !Number.isInteger(trustedHops) || trustedHops < 1) return 'unknown';
  const addresses = request.headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((value) => value.trim());
  const candidate = addresses?.[addresses.length - trustedHops];
  if (!candidate || !isIP(candidate)) return 'unknown';
  // URL serialization canonicalizes equivalent IPv6 spellings to one bucket.
  return isIP(candidate) === 6
    ? new URL(`http://[${candidate}]/`).hostname.slice(1, -1)
    : candidate;
}
