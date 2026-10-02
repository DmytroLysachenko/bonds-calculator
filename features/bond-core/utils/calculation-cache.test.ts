import { describe, expect, it } from 'vitest';

import { calculationCache } from './calculation-cache';

describe('CalculationCache expiry and invalidation', () => {
  it('returns an entry only until its explicit TTL expires', () => {
    calculationCache.clear();
    calculationCache.set('revision:key', { value: 1 }, 100, 1_000);
    expect(calculationCache.get('revision:key', 1_099)).toEqual({ value: 1 });
    expect(calculationCache.get('revision:key', 1_100)).toBeUndefined();
  });

  it('invalidates only the requested revision namespace', () => {
    calculationCache.clear();
    calculationCache.set('offer-1:request-a', 'old', 1000, 0);
    calculationCache.set('offer-2:request-a', 'new', 1000, 0);
    calculationCache.invalidateNamespace('offer-1:');
    expect(calculationCache.get('offer-1:request-a', 1)).toBeUndefined();
    expect(calculationCache.get('offer-2:request-a', 1)).toBe('new');
  });

  it('maintains stable keys despite object key order', () => {
    const left = calculationCache.generateKey({
      offer: 'a',
      payload: { date: '2026-01-01', amount: 100 },
    });
    const right = calculationCache.generateKey({
      payload: { amount: 100, date: '2026-01-01' },
      offer: 'a',
    });
    expect(left).toBe(right);
  });
});
