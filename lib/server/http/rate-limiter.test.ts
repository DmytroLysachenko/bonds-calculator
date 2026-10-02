import { describe, expect, it, vi } from 'vitest';

import {
  BoundedMemoryRateLimiter,
  type RateLimitPolicy,
  SharedStoreRateLimiter,
} from './rate-limiter';

const policy: RateLimitPolicy = { key: 'write', limit: 2, windowMs: 1_000 };

describe('BoundedMemoryRateLimiter', () => {
  it('returns a stable decision and headers-ready metadata', () => {
    const limiter = new BoundedMemoryRateLimiter();
    expect(limiter.consume('user', policy, 1)).toEqual({
      allowed: true,
      limit: 2,
      remaining: 1,
      resetAt: 1_001,
    });
    expect(limiter.consume('user', policy, 2)).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.consume('user', policy, 3)).toMatchObject({ allowed: false, remaining: 0 });
  });

  it('keeps identities and policies isolated', () => {
    const limiter = new BoundedMemoryRateLimiter();
    limiter.consume('a', policy, 1);
    expect(limiter.consume('b', policy, 2).remaining).toBe(1);
    expect(limiter.consume('a', { ...policy, key: 'admin' }, 3).remaining).toBe(1);
  });

  it('resets a counter at the policy boundary', () => {
    const limiter = new BoundedMemoryRateLimiter();
    limiter.consume('user', policy, 1);
    limiter.consume('user', policy, 2);
    expect(limiter.consume('user', policy, 1_001)).toMatchObject({ allowed: true, remaining: 1 });
  });

  it('evicts expired entries and limits active cardinality', () => {
    const limiter = new BoundedMemoryRateLimiter(2);
    limiter.consume('one', policy, 1);
    limiter.consume('two', policy, 1);
    limiter.consume('three', policy, 1);
    expect(limiter.consume('one', policy, 2)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume('expired', policy, 2_000)).toMatchObject({ allowed: true });
  });
});

describe('SharedStoreRateLimiter', () => {
  it('delegates atomic counter ownership to the shared adapter', async () => {
    const consume = vi.fn().mockResolvedValue({ count: 3, resetAt: new Date(2_000) });
    const limiter = new SharedStoreRateLimiter({ consume });

    await expect(limiter.consume('user', policy, 1_000)).resolves.toEqual({
      allowed: false,
      limit: 2,
      remaining: 0,
      resetAt: 2_000,
    });
    expect(consume).toHaveBeenCalledWith({
      bucketKey: 'write:user',
      now: new Date(1_000),
      resetAt: new Date(2_000),
    });
  });
});
