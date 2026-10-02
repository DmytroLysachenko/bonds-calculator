import { enUS } from 'date-fns/locale';
import { describe, expect, it } from 'vitest';

import { buildLadderMaturityBuckets, buildLadderYearBuckets } from './ladder-display';

describe('ladder display helpers', () => {
  it('groups maturity lots into sorted monthly buckets', () => {
    const buckets = buildLadderMaturityBuckets(
      [
        {
          maturityDate: '2036-05-01T00:00:00.000Z',
          netValue: 1200,
          investedAmount: 1000,
        },
        {
          maturityDate: '2036-05-15T00:00:00.000Z',
          netValue: 300,
          investedAmount: 500,
        },
        {
          maturityDate: '2036-06-01T00:00:00.000Z',
          netValue: 900,
          investedAmount: 900,
        },
      ] as never,
      enUS,
    );

    expect(buckets).toHaveLength(2);
    expect(buckets[0]).toMatchObject({
      date: '2036-05',
      amount: 1500,
      count: 2,
    });
    expect(buckets[1]).toMatchObject({
      date: '2036-06',
      amount: 900,
      count: 1,
    });
  });

  it('groups monthly ladder buckets into sorted yearly buckets for default chart mode', () => {
    const monthlyBuckets = buildLadderMaturityBuckets(
      [
        {
          maturityDate: '2036-05-01T00:00:00.000Z',
          netValue: 1200,
          investedAmount: 1200,
        },
        {
          maturityDate: '2036-06-01T00:00:00.000Z',
          netValue: 900,
          investedAmount: 900,
        },
        {
          maturityDate: '2037-01-01T00:00:00.000Z',
          netValue: 750,
          investedAmount: 700,
        },
      ] as never,
      enUS,
    );

    const yearlyBuckets = buildLadderYearBuckets(monthlyBuckets);

    expect(yearlyBuckets).toHaveLength(2);
    expect(yearlyBuckets[0]).toMatchObject({
      key: '2036',
      year: '2036',
      displayDate: '2036',
      amount: 2100,
      count: 2,
      firstMonth: 'May 2036',
      lastMonth: 'Jun 2036',
    });
    expect(yearlyBuckets[1]).toMatchObject({
      key: '2037',
      year: '2037',
      displayDate: '2037',
      amount: 700,
      count: 1,
      firstMonth: 'Jan 2037',
      lastMonth: 'Jan 2037',
    });
  });
});
