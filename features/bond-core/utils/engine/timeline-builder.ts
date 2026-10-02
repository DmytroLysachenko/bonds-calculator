import { addMonths, addYears, differenceInDays, format, isBefore, min } from 'date-fns';

import { InterestPayout } from '../../types';

export interface TimelinePeriod {
  startDate: Date;
  endDate: Date;
  daysInPeriod: number;
  daysHeld: number;
  isMaturity: boolean;
  isWithdrawal: boolean;
  periodLabel: string;
}

/**
 * Generates the discrete periods for a bond cycle.
 * The engine always follows the natural product cadence.
 * Chart granularity is a display-only concern applied later.
 */
export function generateCyclePeriods(
  currentPurchaseDate: Date,
  cycleMaturityDate: Date,
  actualCycleEndDate: Date,
  payoutFrequency: InterestPayout,
): TimelinePeriod[] {
  const isMonthlyPayout = payoutFrequency === InterestPayout.MONTHLY;

  // Determine the natural step for the bond (payout based)
  const stepFn = isMonthlyPayout ? addMonths : addYears;

  const periods: TimelinePeriod[] = [];
  let currentPeriodStart = currentPurchaseDate;
  let periodIndex = 0;

  // Safety counter to prevent infinite loops
  let safety = 0;
  while (isBefore(currentPeriodStart, actualCycleEndDate) && safety < 1000) {
    safety++;
    periodIndex++;
    // Always derive anniversaries from the cycle purchase anchor. Advancing
    // from a clipped February date makes a 31st-of-month bond drift forever.
    const nextStepDate = stepFn(currentPurchaseDate, periodIndex);

    const periodEndDate = min([nextStepDate, actualCycleEndDate]);
    const isMaturity = periodEndDate.getTime() === cycleMaturityDate.getTime();
    const isWithdrawal = periodEndDate.getTime() === actualCycleEndDate.getTime();

    periods.push({
      startDate: currentPeriodStart,
      endDate: periodEndDate,
      daysInPeriod: differenceInDays(nextStepDate, currentPeriodStart),
      daysHeld: differenceInDays(periodEndDate, currentPeriodStart),
      isMaturity,
      isWithdrawal,
      periodLabel: format(periodEndDate, 'MMM yyyy'),
    });

    if (isWithdrawal) break;
    currentPeriodStart = periodEndDate;
  }

  return periods;
}
