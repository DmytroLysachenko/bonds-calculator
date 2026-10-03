import { describe, expect, it } from 'vitest';

import type { MonthlyReturn } from '@/features/bond-core/constants/historical-data';

import { fallbackAnnualInflationObservations } from './multi-asset-history';

function months(count: number, inflation = 1): MonthlyReturn[] {
  return Array.from({ length: count }, (_, index) => ({
    date: `${2024 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`,
    sp500: 0,
    gold: 0,
    savings: 0,
    inflation,
    inflationKind: 'month_on_month',
    nbpRate: 5,
  }));
}

describe('illustrative annual CPI fallback', () => {
  it('compounds twelve monthly observations into an annual percentage', () => {
    expect(fallbackAnnualInflationObservations(months(12))).toEqual([
      expect.closeTo((1.01 ** 12 - 1) * 100, 8),
    ]);
    expect(fallbackAnnualInflationObservations(months(13))).toHaveLength(2);
  });

  it('does not mix annual CPI, gaps, or incomplete years into monthly windows', () => {
    expect(fallbackAnnualInflationObservations(months(11))).toEqual([]);
    const annual = months(12);
    annual[4].inflationKind = 'year_over_year';
    expect(fallbackAnnualInflationObservations(annual)).toEqual([]);
    const untyped = months(12);
    delete untyped[4].inflationKind;
    expect(fallbackAnnualInflationObservations(untyped)).toEqual([]);
    const gap = months(12);
    gap[4].date = '2024-08';
    expect(fallbackAnnualInflationObservations(gap)).toEqual([]);
  });
});
