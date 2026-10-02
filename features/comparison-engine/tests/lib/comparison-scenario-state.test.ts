import { describe, expect, it } from 'vitest';

import { BondType, TaxStrategy } from '@/features/bond-core/types';

import {
  sanitizeScenarioOverride,
  setScenarioCustomHorizonMonths,
  toggleScenarioCustomHorizon,
} from '../../lib/comparison-scenario-state';

const sharedConfig = {
  initialInvestment: 10000,
  purchaseDate: '2026-05-05',
  withdrawalDate: '2036-05-05',
  expectedInflation: 2.5,
  expectedNbpRate: 3.75,
  taxStrategy: TaxStrategy.STANDARD,
  timingMode: 'general' as const,
  investmentHorizonMonths: 120,
};

describe('comparison scenario state', () => {
  it('clears stale exact-date fields when scenario returns to the shared horizon', () => {
    const sanitized = sanitizeScenarioOverride(sharedConfig, {
      bondType: BondType.EDO,
      investmentHorizonMonths: undefined,
      withdrawalDate: '2031-05-05',
      timingMode: 'exact',
      taxStrategy: TaxStrategy.STANDARD,
    });

    expect(sanitized.investmentHorizonMonths).toBeUndefined();
    expect(sanitized.withdrawalDate).toBeUndefined();
    expect(sanitized.timingMode).toBeUndefined();
    expect(sanitized.taxStrategy).toBeUndefined();
  });

  it('rebuilds scenario withdrawal dates from custom horizon months', () => {
    const sanitized = setScenarioCustomHorizonMonths(
      sharedConfig,
      {
        bondType: BondType.ROR,
        isRebought: false,
      },
      24,
    );

    expect(sanitized.investmentHorizonMonths).toBe(24);
    expect(sanitized.timingMode).toBe('general');
    expect(sanitized.withdrawalDate).toBe('2028-05-05');
  });

  it('disables custom horizon cleanly after it was enabled', () => {
    const withCustom = toggleScenarioCustomHorizon(
      sharedConfig,
      {
        bondType: BondType.DOR,
        investmentHorizonMonths: 48,
        withdrawalDate: '2030-05-05',
        timingMode: 'general',
      },
      false,
    );

    expect(withCustom.investmentHorizonMonths).toBeUndefined();
    expect(withCustom.withdrawalDate).toBeUndefined();
    expect(withCustom.timingMode).toBeUndefined();
  });
});
