import { describe, expect, it } from 'vitest';

import { BondType } from '@/features/bond-core/types';

import {
  buildDefaultSharedConfig,
  DEFAULT_SCENARIO_A,
} from '../../lib/comparison-calculator-state';
import {
  applyScenarioBondTypeUpdate,
  applyScenarioCustomHorizonEnabled,
  applyScenarioCustomHorizonMonths,
  applyScenarioOverrideUpdate,
  applySharedComparisonConfigUpdate,
  isSharedComparisonMacroUpdate,
} from '../../lib/comparison-update-actions';

describe('comparison update actions', () => {
  it('applies shared timing updates through the shared config model', () => {
    const previous = buildDefaultSharedConfig(new Date('2026-06-16T00:00:00.000Z'));
    const next = applySharedComparisonConfigUpdate(previous, 'investmentHorizonMonths', 24);

    expect(next.withdrawalDate).toBe('2028-06-16');
    expect(next.investmentHorizonMonths).toBe(24);
  });

  it('identifies macro updates for persisted default reconciliation', () => {
    expect(isSharedComparisonMacroUpdate('expectedInflation')).toBe(true);
    expect(isSharedComparisonMacroUpdate('initialInvestment')).toBe(false);
  });

  it('applies simple scenario overrides without changing unrelated fields', () => {
    expect(applyScenarioOverrideUpdate(DEFAULT_SCENARIO_A, 'rollover', false)).toMatchObject({
      bondType: BondType.EDO,
      isRebought: false,
      rollover: false,
    });
  });

  it('normalizes bond type and custom horizon actions', () => {
    const shared = buildDefaultSharedConfig(new Date('2026-06-16T00:00:00.000Z'));
    const bondTypeUpdated = applyScenarioBondTypeUpdate(
      { ...DEFAULT_SCENARIO_A, investmentHorizonMonths: 12 },
      BondType.ROR,
    );
    const customEnabled = applyScenarioCustomHorizonEnabled(shared, DEFAULT_SCENARIO_A, true);
    const customMonths = applyScenarioCustomHorizonMonths(shared, DEFAULT_SCENARIO_A, 18);

    expect(bondTypeUpdated).toMatchObject({
      bondType: BondType.ROR,
      isRebought: false,
      investmentHorizonMonths: 12,
    });
    expect(customEnabled.investmentHorizonMonths).toBe(120);
    expect(customMonths).toMatchObject({
      investmentHorizonMonths: 18,
      withdrawalDate: '2027-12-16',
      timingMode: 'general',
    });
  });
});
