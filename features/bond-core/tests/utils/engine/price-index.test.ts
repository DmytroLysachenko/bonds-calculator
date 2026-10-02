import { addMonths, parseISO } from 'date-fns';
import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import {
  createAnnualPriceIndexPath,
  createMonthlyPriceIndexPath,
  priceIndexPathForProjection,
} from '../../../utils/engine/price-index';

describe('price-index path', () => {
  it('uses annual-effective anchors across a leap-year anniversary', () => {
    const start = parseISO('2024-02-01');
    const path = priceIndexPathForProjection(start, 12);

    expect(path.factorBetween(start, addMonths(start, 12)).toFixed(12)).toBe('1.120000000000');
  });

  it('interpolates partial months and supports zero CPI and deflation', () => {
    const start = parseISO('2026-01-01');
    const twelvePercent = priceIndexPathForProjection(start, 12);
    const zero = priceIndexPathForProjection(start, 0);
    const deflation = priceIndexPathForProjection(start, -12);

    expect(twelvePercent.factorBetween(start, parseISO('2026-01-16')).greaterThan(1)).toBe(true);
    expect(twelvePercent.factorBetween(start, parseISO('2026-01-16')).lessThan(1.12)).toBe(true);
    expect(zero.factorBetween(start, parseISO('2026-01-16')).toNumber()).toBe(1);
    expect(deflation.factorBetween(start, addMonths(start, 12)).toNumber()).toBeCloseTo(0.88, 12);
  });

  it('uses a different annual anchor for each projection year', () => {
    const start = parseISO('2026-03-15');
    const path = createAnnualPriceIndexPath({
      startDate: start,
      annualCpiPercent: 2,
      annualCpiPercentByYear: [10, -5],
    });

    expect(path.factorBetween(start, addMonths(start, 12)).toNumber()).toBeCloseTo(1.1, 12);
    expect(path.factorBetween(start, addMonths(start, 24)).toNumber()).toBeCloseTo(1.045, 12);
  });

  it('marks incomplete monthly observations as approximate instead of exact historical deflation', () => {
    const path = createMonthlyPriceIndexPath([
      { date: '2026-01', changePercent: 1 },
      { date: '2026-02' },
    ]);

    expect(path.precision).toBe('approximate');
    expect(
      path.deflate(new Decimal(101), parseISO('2026-01-01'), parseISO('2026-02-01')).toNumber(),
    ).toBeCloseTo(100, 10);
  });

  it('labels a YoY-derived historical path as approximate and does not treat its annual rate as monthly CPI', () => {
    const path = createMonthlyPriceIndexPath([
      { date: '2026-01', changePercent: 12, kind: 'year_over_year' },
    ]);

    expect(path.precision).toBe('approximate');
    expect(
      path.factorBetween(parseISO('2026-01-01'), parseISO('2026-02-01')).toNumber(),
    ).toBeCloseTo(Math.pow(1.12, 1 / 12), 12);
  });
});
