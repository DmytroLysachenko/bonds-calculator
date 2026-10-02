import { addMonths, format, parseISO } from 'date-fns';
import { describe, expect, it } from 'vitest';

import { InterestPayout } from '../../../types';
import { calculateCumulativeInflation } from '../../../utils/engine/inflation';
import { generateCyclePeriods } from '../../../utils/engine/timeline-builder';

describe('calendar-stable periods and real-value inflation', () => {
  it('keeps monthly anniversaries anchored to a January 31 purchase', () => {
    const purchaseDate = parseISO('2026-01-31');
    const periods = generateCyclePeriods(
      purchaseDate,
      addMonths(purchaseDate, 12),
      addMonths(purchaseDate, 12),
      InterestPayout.MONTHLY,
    );

    expect(periods).toHaveLength(12);
    expect(periods.map((period) => format(period.endDate, 'yyyy-MM-dd'))).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
      '2026-06-30',
      '2026-07-31',
      '2026-08-31',
      '2026-09-30',
      '2026-10-31',
      '2026-11-30',
      '2026-12-31',
      '2027-01-31',
    ]);
  });

  it('uses an effective annual CPI factor over a full year', () => {
    const factor = calculateCumulativeInflation(12, 12, undefined, parseISO('2026-01-01'));
    expect(factor.toFixed(12)).toBe('1.120000000000');
  });
});
