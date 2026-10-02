import { format } from 'date-fns';
import { describe, expect, it, vi } from 'vitest';

import {
  createMarketDataCache,
  getCached,
  getSeriesReferenceDate,
  invalidateCached,
  setCache,
} from './market-data-cache';

describe('market data cache helpers', () => {
  it('does not read the current time when returning a cached value', () => {
    const key = 'test-cache-hit';
    setCache(key, { cached: true });
    const now = vi.spyOn(Date, 'now');

    try {
      expect(getCached<{ cached: boolean }>(key)).toEqual({ cached: true });
      expect(now).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
      invalidateCached(key);
    }
  });

  it('uses the latest data point date as the reference date for NBP series', () => {
    const referenceDate = getSeriesReferenceDate({
      slug: 'nbp-ref-rate',
      frequency: 'on-event',
      lastDataPointDate: '2026-05-15',
      updatedAt: new Date('2026-03-26T12:00:00.000Z'),
    });

    expect(referenceDate ? format(referenceDate, 'yyyy-MM-dd') : undefined).toBe('2026-05-15');
  });

  it('falls back to update time only when no data point date exists', () => {
    const referenceDate = getSeriesReferenceDate({
      slug: 'nbp-ref-rate',
      frequency: 'on-event',
      updatedAt: new Date('2026-03-26T12:00:00.000Z'),
    });

    expect(referenceDate?.toISOString()).toBe('2026-03-26T12:00:00.000Z');
  });

  it('uses CPI data point date when both sync time and data time are present', () => {
    const referenceDate = getSeriesReferenceDate({
      slug: 'pl-cpi',
      frequency: 'monthly',
      lastDataPointDate: '2026-04-01',
      updatedAt: new Date('2026-05-31T08:00:00.000Z'),
    });

    expect(referenceDate ? format(referenceDate, 'yyyy-MM-dd') : undefined).toBe('2026-04-01');
  });

  it('keeps sync-only series readable when no datapoint has been recorded', () => {
    const referenceDate = getSeriesReferenceDate({
      slug: 'custom-reference',
      updatedAt: new Date('2026-05-31T08:00:00.000Z'),
    });

    expect(referenceDate?.toISOString()).toBe('2026-05-31T08:00:00.000Z');
  });

  it('gives independent processes isolated, bounded cache instances', () => {
    vi.useFakeTimers();
    try {
      const first = createMarketDataCache(10);
      const second = createMarketDataCache(10);
      first.set('definitions', { revision: 1 });

      expect(first.get('definitions')).toEqual({ revision: 1 });
      expect(second.get('definitions')).toBeNull();
      vi.advanceTimersByTime(10);
      expect(first.get('definitions')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
