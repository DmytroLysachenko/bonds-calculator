import { describe, expect, it } from 'vitest';

import {
  createVitalRetentionCleanup,
  shouldSampleVital,
  toVitalAggregate,
  VITAL_RETENTION_DAYS,
  vitalRetentionCutoff,
} from './vital-aggregates';

describe('web-vital aggregate privacy boundary', () => {
  it('derives an hourly aggregate with no identity or request metadata', () => {
    const aggregate = toVitalAggregate(
      { name: 'LCP', value: 1234.56, rating: 'good', path: '/single-calculator' },
      new Date('2026-07-30T10:49:15.000Z'),
    );

    expect(aggregate).toEqual({
      metric: 'LCP',
      path: '/single-calculator',
      rating: 'good',
      timeBucket: new Date('2026-07-30T10:00:00.000Z'),
      sampleCount: 1,
      valueSum: '1234.5600',
      valueMin: '1234.5600',
      valueMax: '1234.5600',
    });
    expect(Object.keys(aggregate)).not.toEqual(
      expect.arrayContaining(['accountId', 'payload', 'rawUrl', 'userAgent']),
    );
  });

  it('samples probabilistically and uses a fixed retention cutoff', () => {
    expect(shouldSampleVital(() => 0.09)).toBe(true);
    expect(shouldSampleVital(() => 0.1)).toBe(false);
    expect(vitalRetentionCutoff(new Date('2026-07-30T00:00:00.000Z'))).toEqual(
      new Date('2026-06-30T00:00:00.000Z'),
    );
    expect(VITAL_RETENTION_DAYS).toBe(30);
  });

  it('delegates retention cleanup to the durable caller and returns only a count', async () => {
    const cleanup = createVitalRetentionCleanup(async () => ({ rowCount: 7 }));

    await expect(cleanup()).resolves.toEqual({ deletedCount: 7 });
  });
});
