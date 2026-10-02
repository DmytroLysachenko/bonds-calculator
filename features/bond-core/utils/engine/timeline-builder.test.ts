import { addMonths, parseISO } from 'date-fns';
import { describe, expect, it } from 'vitest';

import { InterestPayout } from '../../types';

import { generateCyclePeriods } from './timeline-builder';

describe('calendar-stable issuer periods', () => {
  it('anchors every monthly anniversary to a January-31 purchase without a clipped-date extra period', () => {
    const start = parseISO('2026-01-31');
    const periods = generateCyclePeriods(
      start,
      addMonths(start, 12),
      addMonths(start, 12),
      InterestPayout.MONTHLY,
    );
    expect(periods).toHaveLength(12);
    expect(periods.map((period) => period.endDate.getDate())).toEqual([
      28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31, 31,
    ]);
    expect(periods.at(-1)?.isMaturity).toBe(true);
  });

  it('keeps leap-day anniversaries and a partial terminal period explicit', () => {
    const start = parseISO('2024-02-29');
    const periods = generateCyclePeriods(
      start,
      addMonths(start, 12),
      parseISO('2024-08-31'),
      InterestPayout.MONTHLY,
    );
    expect(periods).toHaveLength(7);
    expect(periods.at(-1)?.isWithdrawal).toBe(true);
    expect(periods.at(-1)?.isMaturity).toBe(false);
  });
});
