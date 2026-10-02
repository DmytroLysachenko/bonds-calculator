import { describe, expect, it } from 'vitest';

import { buildFallbackInputs } from '@/features/single-calculator/lib/single-calculator-state';

import { BOND_DEFINITIONS } from '../constants/bond-definitions';
import { BondType } from '../types';

import { calculateComparisonScenarioItem } from './comparison-result';

describe('comparison strategy policies', () => {
  const inputs = {
    ...buildFallbackInputs(new Date('2026-01-01')),
    bondType: BondType.ROR,
    duration: BOND_DEFINITIONS.ROR.duration,
    firstYearRate: BOND_DEFINITIONS.ROR.firstYearRate,
    margin: BOND_DEFINITIONS.ROR.margin,
    earlyWithdrawalFee: BOND_DEFINITIONS.ROR.earlyWithdrawalFee,
    isCapitalized: BOND_DEFINITIONS.ROR.isCapitalized,
    payoutFrequency: BOND_DEFINITIONS.ROR.payoutFrequency,
    investmentHorizonMonths: 36,
    withdrawalDate: '2029-01-01',
  };

  it('honors reinvest, native-maturity, and cash-after-maturity policy declarations', () => {
    const reinvested = calculateComparisonScenarioItem({
      inputs,
      definition: BOND_DEFINITIONS.ROR,
      expectedInflation: inputs.expectedInflation,
      maturityMode: 'reinvest_until_horizon',
    });
    const held = calculateComparisonScenarioItem({
      inputs,
      definition: BOND_DEFINITIONS.ROR,
      expectedInflation: inputs.expectedInflation,
      maturityMode: 'hold_to_maturity',
    });
    const cash = calculateComparisonScenarioItem({
      inputs,
      definition: BOND_DEFINITIONS.ROR,
      expectedInflation: inputs.expectedInflation,
      maturityMode: 'cash_after_maturity',
    });

    expect(reinvested.strategyPolicy).toBe('reinvest_until_horizon');
    expect(held.strategyPolicy).toBe('hold_to_maturity');
    expect(cash.strategyPolicy).toBe('cash_after_maturity');
    expect(reinvested.result.timeline.length).toBeGreaterThan(held.result.timeline.length);
    expect(cash.result.netPayoutValue).toBe(held.result.netPayoutValue);
  });

  it('keeps paid coupons out of subsequent purchases when cash handling is selected', () => {
    const reinvestedCoupons = calculateComparisonScenarioItem({
      inputs,
      definition: BOND_DEFINITIONS.ROR,
      expectedInflation: inputs.expectedInflation,
      maturityMode: 'reinvest_until_horizon',
      couponDisposition: 'reinvest',
    });
    const cashCoupons = calculateComparisonScenarioItem({
      inputs,
      definition: BOND_DEFINITIONS.ROR,
      expectedInflation: inputs.expectedInflation,
      maturityMode: 'reinvest_until_horizon',
      couponDisposition: 'cash',
    });

    expect(cashCoupons.result.netPayoutValue).toBeLessThan(reinvestedCoupons.result.netPayoutValue);
  });
});
