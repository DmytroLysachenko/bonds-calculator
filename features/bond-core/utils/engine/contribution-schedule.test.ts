import { describe, expect, it } from 'vitest';

import {
  BondType,
  InterestPayout,
  InvestmentFrequency,
  RegularInvestmentInputs,
  TaxStrategy,
} from '../../types';

import { buildContributionSchedule } from './contribution-schedule';

const inputs: RegularInvestmentInputs = {
  bondType: BondType.EDO,
  contributionAmount: 100,
  frequency: InvestmentFrequency.MONTHLY,
  investmentHorizonMonths: 3,
  initialLumpSum: 200,
  annualContributionIncreasePercent: 0,
  firstYearRate: 5,
  expectedInflation: 3,
  margin: 2,
  duration: 10,
  earlyWithdrawalFee: 2,
  taxRate: 19,
  isCapitalized: true,
  payoutFrequency: InterestPayout.MATURITY,
  purchaseDate: '2024-01-31',
  withdrawalDate: '2024-04-30',
  isRebought: false,
  rebuyDiscount: 0,
  taxStrategy: TaxStrategy.STANDARD,
};

describe('contribution schedule', () => {
  it('keeps initial capital, pauses, overrides and same-day top-ups deterministic', () => {
    expect(
      buildContributionSchedule({
        ...inputs,
        skippedContributionDates: ['2024-02-29'],
        contributionOverrides: [{ date: '2024-03-31', amount: 150 }],
        oneOffContributions: [
          { date: '2024-03-31', amount: 50 },
          { date: '2024-03-31', amount: 25 },
        ],
      }),
    ).toEqual([
      { date: '2024-01-31', amount: 300, kind: 'base' },
      { date: '2024-03-31', amount: 225, kind: 'top_up' },
    ]);
  });

  it('applies annual nominal increases to future cadence flows', () => {
    expect(
      buildContributionSchedule({
        ...inputs,
        investmentHorizonMonths: 13,
        withdrawalDate: '2025-02-28',
        frequency: InvestmentFrequency.YEARLY,
        annualContributionIncreasePercent: 10,
        initialLumpSum: 0,
      }).map((flow) => flow.amount),
    ).toEqual([100, 110]);
  });
});
