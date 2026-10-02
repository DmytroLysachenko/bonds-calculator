import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createApiHandler } from './api-handler';
import type { RateLimiter, RateLimitPolicy } from './rate-limiter';

const policy: RateLimitPolicy = { key: 'route-under-test', limit: 4, windowMs: 60_000 };
const context = { params: Promise.resolve({}) };

function request(path = '/api/example') {
  return new NextRequest(`https://calculator.test${path}`, {
    headers: { 'x-request-id': 'request-test-0001' },
  });
}

function createLimiter(
  overrides: Partial<Awaited<ReturnType<RateLimiter['consume']>>> = {},
): RateLimiter {
  return {
    consume: vi.fn().mockResolvedValue({
      allowed: true,
      limit: policy.limit,
      remaining: policy.limit - 1,
      resetAt: Date.now() + policy.windowMs,
      ...overrides,
    }),
  };
}

describe('apiHandler endpoint policy boundary', () => {
  it('returns a successful correlated response and consumes the named policy', async () => {
    const limiter = createLimiter();
    const GET = createApiHandler({ rateLimiter: limiter, getIdentity: () => 'test-client' })(
      async () => NextResponse.json({ ok: true }),
      { rateLimitPolicy: policy },
    );

    const response = await GET(request(), context);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('request-test-0001');
    await expect(response.json()).resolves.toEqual({ ok: true, requestId: 'request-test-0001' });
    expect(limiter.consume).toHaveBeenCalledWith('test-client', policy);
  });

  it('maps malformed input to the stable public validation problem', async () => {
    const GET = createApiHandler({ rateLimiter: createLimiter() })(async () => {
      z.object({ symbol: z.string().min(1) }).parse({ symbol: '' });
      return NextResponse.json({ unreachable: true });
    });

    const response = await GET(request(), context);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_ERROR',
      detail: 'The request payload is invalid.',
      requestId: 'request-test-0001',
    });
  });

  it('does not disclose internal failures while retaining the correlation id', async () => {
    const GET = createApiHandler({ rateLimiter: createLimiter() })(async () => {
      throw new Error('postgres password=not-for-clients');
    });

    const response = await GET(request(), context);

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload).toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      detail: 'An unexpected internal error occurred. Please try again later.',
      requestId: 'request-test-0001',
    });
    expect(JSON.stringify(payload)).not.toContain('password=not-for-clients');
  });

  it.each(['identity', 'limiter'] as const)(
    'correlates %s failures before running the handler',
    async (failure) => {
      const handler = vi.fn(() => NextResponse.json({ ok: true }));
      const limiter = createLimiter();
      if (failure === 'limiter')
        vi.mocked(limiter.consume).mockRejectedValue(new Error('store unavailable'));
      const GET = createApiHandler({
        rateLimiter: limiter,
        getIdentity: () => {
          if (failure === 'identity') throw new Error('identity unavailable');
          return 'test-client';
        },
      })(handler);
      const response = await GET(request(), context);
      expect(response.status).toBe(500);
      expect(response.headers.get('x-request-id')).toBe('request-test-0001');
      await expect(response.json()).resolves.toMatchObject({
        code: 'INTERNAL_SERVER_ERROR',
        requestId: 'request-test-0001',
      });
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it('returns standard 429 headers before invoking a costly endpoint', async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const resetAt = Date.now() + 20_000;
    const GET = createApiHandler({
      rateLimiter: createLimiter({ allowed: false, remaining: 0, resetAt }),
    })(handler, { rateLimitPolicy: policy });

    const response = await GET(request(), context);

    expect(response.status).toBe(429);
    expect(response.headers.get('RateLimit-Limit')).toBe('4');
    expect(response.headers.get('RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('RateLimit-Reset')).toBe(Math.ceil(resetAt / 1000).toString());
    expect(response.headers.get('Retry-After')).toMatch(/^20$/);
    expect(response.headers.get('x-request-id')).toBe('request-test-0001');
    await expect(response.json()).resolves.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      requestId: 'request-test-0001',
    });
    expect(handler).not.toHaveBeenCalled();
  });
});
