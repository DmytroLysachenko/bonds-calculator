import { describe, expect, it } from 'vitest';

import { HISTORICAL_RETURNS, type MonthlyReturn } from '../constants/historical-data';
import {
  calculateAssetPerformance,
  calculateBondsPerformance,
  getHistoricalReplayIssue,
} from '../utils/asset-calculations';

const metadata = {
  id: 'test',
  name: 'Test',
  color: '#000',
  description: { en: 'Test', pl: 'Test' },
};

function months(count: number): MonthlyReturn[] {
  return Array.from({ length: count }, (_, index) => ({
    date: `${2024 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`,
    sp500: 0,
    gold: 0,
    savings: 0,
    inflation: 1,
    inflationKind: 'month_on_month',
    nbpRate: 5,
  }));
}

describe('historical replay boundary', () => {
  it('keeps the illustrative fallback explicitly monthly', () => {
    expect(HISTORICAL_RETURNS).toHaveLength(54);
    expect(getHistoricalReplayIssue(HISTORICAL_RETURNS)).toBeNull();
    expect(HISTORICAL_RETURNS.every((row) => row.inflationKind === 'month_on_month')).toBe(true);
  });
  it('rejects annual CPI, missing observations and noncontiguous common months', () => {
    const annual = months(2);
    annual[0].inflation = 12;
    annual[0].inflationKind = 'year_over_year';
    expect(getHistoricalReplayIssue(annual)).toBe('non_monthly_inflation');
    expect(() => calculateBondsPerformance(100, 0, metadata, annual)).toThrow(
      'non_monthly_inflation',
    );
    const untyped = months(2);
    delete untyped[0].inflationKind;
    expect(getHistoricalReplayIssue(untyped)).toBe('non_monthly_inflation');

    const missing = months(2);
    missing[1].gold = Number.NaN;
    expect(getHistoricalReplayIssue(missing)).toBe('missing_observation');

    const gap = months(3);
    gap.splice(1, 1);
    expect(getHistoricalReplayIssue(gap)).toBe('non_contiguous');
    expect(getHistoricalReplayIssue([])).toBe('missing_history');
  });

  it('locks each annual bond rate from the previous twelve monthly CPI changes', () => {
    const data = months(14);
    data[13].inflation = 50; // This month's CPI cannot reprice an already locked issuer period.
    const result = calculateBondsPerformance(100, 0, metadata, data, {
      firstYearRate: 0,
      margin: 0,
    });
    expect(result.series[12].value).toBeCloseTo(100);
    expect(result.series[13].value / result.series[12].value).toBeCloseTo(1.01);
    expect(result.series[14].value / result.series[13].value).toBeCloseTo(1.01);
  });

  it('uses a constant price index for unchanged CPI and contribution-independent drawdown', () => {
    const data = months(2).map((row) => ({ ...row, inflation: 0 }));
    data[1].sp500 = -10;
    const result = calculateAssetPerformance(100, 1000, 'sp500', metadata, data);
    expect(result.series[1].realValue).toBeCloseTo(result.series[1].value);
    expect(result.series[2].drawdown).toBeCloseTo(10);
  });
});
