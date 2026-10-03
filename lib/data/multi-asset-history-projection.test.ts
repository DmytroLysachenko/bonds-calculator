import { describe, expect, it } from 'vitest';

import { buildMultiAssetHistory } from './multi-asset-history-projection';

describe('buildMultiAssetHistory', () => {
  it('projects database points without depending on a cache or database adapter', () => {
    const projected = buildMultiAssetHistory({
      sp500: [
        { date: '2024-01', value: 100 },
        { date: '2024-02', value: 110 },
      ],
      gold: [
        { date: '2024-01', value: 200 },
        { date: '2024-02', value: 210 },
      ],
      inflation: [{ date: '2024-02', value: 3.5 }],
      nbpRate: [{ date: '2024-02', value: 5.75 }],
      usdPln: [
        { date: '2024-01', value: 4 },
        { date: '2024-02', value: 4.4 },
      ],
      inflationUnit: 'month_on_month_percent',
    });
    expect(projected).toMatchObject({
      source: 'database',
      currencyBasis: 'PLN',
      observationBasis: 'observed',
      coverageStart: '2024-02',
      coverageEnd: '2024-02',
      data: [expect.objectContaining({ inflation: 3.5, nbpRate: 5.75 })],
    });
    expect(projected?.data[0].sp500).toBeCloseTo(21);
    expect(projected?.data[0].gold).toBeCloseTo(15.5);
  });

  it('returns no projection when required series cannot support it', () => {
    expect(buildMultiAssetHistory({ sp500: [], gold: [], inflation: [], nbpRate: [] })).toBeNull();
    expect(
      buildMultiAssetHistory({
        sp500: [
          { date: '2024-01', value: 100 },
          { date: '2024-02', value: 110 },
        ],
        gold: [
          { date: '2024-01', value: 100 },
          { date: '2024-02', value: 110 },
        ],
        inflation: [{ date: '2024-02', value: 12 }],
        nbpRate: [{ date: '2024-02', value: 5 }],
        usdPln: [
          { date: '2024-01', value: 4 },
          { date: '2024-02', value: 4 },
        ],
        inflationUnit: 'year_over_year_percent',
      }),
    ).toBeNull();
  });

  it('does not replace a missing middle month with a zero return', () => {
    const months = ['2024-01', '2024-02', '2024-03', '2024-04'];
    const source = {
      sp500: months.map((date, index) => ({ date, value: 100 + index * 10 })),
      gold: months.filter((date) => date !== '2024-03').map((date) => ({ date, value: 100 })),
      inflation: months.map((date) => ({ date, value: 0 })),
      nbpRate: months.map((date) => ({ date, value: 5 })),
      usdPln: months.map((date) => ({ date, value: 4 })),
      inflationUnit: 'month_on_month_percent' as const,
    };
    expect(buildMultiAssetHistory(source)).toMatchObject({
      data: [expect.objectContaining({ date: '2024-02' })],
      coverageGaps: ['2024-03', '2024-04'],
    });
  });

  it('rejects nonoverlap, absent FX and missing gold despite intact macro series', () => {
    const base = {
      sp500: [
        { date: '2024-01', value: 100 },
        { date: '2024-02', value: 110 },
      ],
      gold: [
        { date: '2024-01', value: 100 },
        { date: '2024-02', value: 110 },
      ],
      inflation: [{ date: '2024-02', value: 0 }],
      nbpRate: [{ date: '2024-02', value: 5 }],
      usdPln: [
        { date: '2024-01', value: 4 },
        { date: '2024-02', value: 4 },
      ],
      inflationUnit: 'month_on_month_percent' as const,
    };
    expect(buildMultiAssetHistory({ ...base, gold: [] })).toBeNull();
    expect(buildMultiAssetHistory({ ...base, usdPln: [] })).toBeNull();
    expect(
      buildMultiAssetHistory({
        ...base,
        gold: [
          { date: '2023-01', value: 100 },
          { date: '2023-02', value: 110 },
        ],
      }),
    ).toBeNull();
    expect(
      buildMultiAssetHistory({
        ...base,
        usdPln: [
          { date: '2024-01', value: 4 },
          { date: '2024-02', value: Number.NaN },
        ],
      }),
    ).toBeNull();
  });
});
