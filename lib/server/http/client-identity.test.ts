import { describe, expect, it } from 'vitest';

import { getClientIdentity } from './client-identity';

const request = (headers: HeadersInit) =>
  new Request('https://app.example.test/api', { headers }) as never;

describe('client identity', () => {
  it('uses forwarded identity only under the explicit trusted-proxy contract', () => {
    expect(
      getClientIdentity(request({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }), {
        trustedProxy: true,
        trustedHops: 2,
      }),
    ).toBe('203.0.113.7');
    expect(
      getClientIdentity(request({ 'x-forwarded-for': '203.0.113.7' }), { trustedProxy: false }),
    ).toBe('unknown');
  });

  it('ignores spoofed real-IP and untrusted prefixes', () => {
    expect(
      getClientIdentity(request({ 'x-real-ip': '203.0.113.7' }), { trustedProxy: false }),
    ).toBe('unknown');
    expect(
      getClientIdentity(request({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7' }), {
        trustedProxy: true,
      }),
    ).toBe('203.0.113.7');
    for (const candidate of ['999.1.1.1', ':::', '1.2.3', 'attacker'])
      expect(
        getClientIdentity(request({ 'x-forwarded-for': candidate }), { trustedProxy: true }),
      ).toBe('unknown');
  });

  it('rejects malformed forwarded values', () => {
    expect(
      getClientIdentity(request({ 'x-forwarded-for': 'attacker-value' }), { trustedProxy: true }),
    ).toBe('unknown');
  });
});
