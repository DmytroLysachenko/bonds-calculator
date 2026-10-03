import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/db';

import { getMultiAssetHistory } from './multi-asset-history';

vi.mock('@/db', () => ({
  db: {
    query: {
      dataSeries: { findMany: vi.fn() },
      dataPoints: { findMany: vi.fn() },
    },
  },
}));
vi.mock('./market-data-cache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./market-data-cache')>()),
  getCached: vi.fn(() => null),
  setCache: vi.fn(),
}));

const series = [
  { id: 'sp', slug: 'sp500' },
  { id: 'gold', slug: 'gold-usd' },
  { id: 'annual-cpi', slug: 'pl-cpi' },
  { id: 'monthly-cpi', slug: 'pl-cpi-mom' },
  { id: 'nbp', slug: 'nbp-ref-rate' },
  { id: 'fx', slug: 'usd-pln' },
];
const point = (seriesId: string, date: string, value: number) => ({
  seriesId,
  date: `${date}-01`,
  value: String(value),
});

describe('observed multi-asset CPI source selection', () => {
  beforeEach(() => {
    vi.mocked(db.query.dataSeries.findMany).mockResolvedValue(series as never);
    vi.mocked(db.query.dataPoints.findMany).mockResolvedValue([
      ...['2024-01', '2024-02', '2024-03'].map((date, index) => point('sp', date, 100 + index)),
      ...['2024-01', '2024-02', '2024-03'].map((date, index) => point('gold', date, 200 + index)),
      ...['2024-01', '2024-02', '2024-03'].map((date) => point('annual-cpi', date, 12)),
      point('monthly-cpi', '2024-02', 1),
      point('monthly-cpi', '2024-03', 0.5),
      ...['2024-01', '2024-02', '2024-03'].map((date) => point('nbp', date, 5)),
      ...['2024-01', '2024-02', '2024-03'].map((date) => point('fx', date, 4)),
    ] as never);
  });

  it('uses only official month-on-month CPI for observed monthly replay', async () => {
    const result = await getMultiAssetHistory();
    expect(result.source).toBe('database');
    expect(result.currencyBasis).toBe('PLN');
    expect(result.data.map((row) => row.inflation)).toEqual([1, 0.5]);
  });

  it('does not substitute year-over-year CPI if monthly CPI is absent', async () => {
    vi.mocked(db.query.dataSeries.findMany).mockResolvedValue(
      series.filter((item) => item.slug !== 'pl-cpi-mom') as never,
    );
    const result = await getMultiAssetHistory();
    expect(result.source).toBe('fallback');
    expect(result.observationBasis).toBe('illustrative');
  });
});
