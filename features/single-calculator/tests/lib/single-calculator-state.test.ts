import { describe, expect, it } from 'vitest';

import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import { BondType } from '@/features/bond-core/types';

import {
  applyDefinitionToInputs,
  applyReverseSavingsGoal,
  buildFallbackInputs,
  getReverseCalculationTestInputs,
  normalizeSingleCalculatorInputs,
  parseBondType,
  resolveBondTypeInputUpdate,
} from '../../lib/single-calculator-state';

describe('single calculator state model', () => {
  it('accepts only supported bond types from a calculator URL', () => {
    expect(parseBondType('OTS')).toBe(BondType.OTS);
    expect(parseBondType('invalid')).toBeNull();
    expect(parseBondType(null)).toBeNull();
  });

  it('builds stable fallback inputs from the supplied date', () => {
    const inputs = buildFallbackInputs(new Date('2026-06-16T00:00:00.000Z'));

    expect(inputs).toMatchObject({
      bondType: BondType.EDO,
      initialInvestment: 10000,
      purchaseDate: '2026-06-16',
      withdrawalDate: '2036-06-16',
      investmentHorizonMonths: 120,
    });
  });

  it('preserves historical offer rates when a non-current series is selected', () => {
    const previous = buildFallbackInputs(new Date('2026-06-16T00:00:00.000Z'));
    const next = applyDefinitionToInputs(
      { ...previous, firstYearRate: 4.2, margin: 1.1 },
      BOND_DEFINITIONS[BondType.EDO],
      'historical-series-id',
    );

    expect(next.firstYearRate).toBe(4.2);
    expect(next.margin).toBe(1.1);
    expect(next.duration).toBe(BOND_DEFINITIONS[BondType.EDO].duration);
  });

  it('makes a shorter family switch choose between the existing plan and native maturity', () => {
    const previous = buildFallbackInputs(new Date('2026-06-16T00:00:00.000Z'));
    const definition = BOND_DEFINITIONS[BondType.ROR];
    const preserved = resolveBondTypeInputUpdate(previous, BondType.ROR, definition, 'preserve');
    const native = resolveBondTypeInputUpdate(previous, BondType.ROR, definition, 'native');

    expect(preserved.withdrawalDate).toBe('2036-06-16');
    expect(native.withdrawalDate).toBe('2027-06-16');
    expect(native.investmentHorizonMonths).toBe(12);
  });

  it('normalizes horizon-driven dates and custom rate paths', () => {
    const inputs = normalizeSingleCalculatorInputs(
      {
        ...buildFallbackInputs(new Date('2026-06-16T00:00:00.000Z')),
        customInflation: [3.8],
        customNbpRate: [3.75],
      },
      { investmentHorizonMonths: 30 },
    );

    expect(inputs.withdrawalDate).toBe('2028-12-16');
    expect(inputs.customInflation).toEqual([3.8, 3.5, 3.5]);
    expect(inputs.customNbpRate).toEqual([3.75, 5.25, 5.25]);
  });

  it('rounds reverse savings goal to whole bond purchase lots', () => {
    const inputs = {
      ...buildFallbackInputs(new Date('2026-06-16T00:00:00.000Z')),
      calculatorMode: 'reverse' as const,
      savingsGoal: 1234,
      isRebought: true,
      rebuyDiscount: 0.1,
    };

    expect(getReverseCalculationTestInputs(inputs).initialInvestment).toBe(10000);
    expect(applyReverseSavingsGoal(inputs, 11000).initialInvestment).toBeCloseTo(1198.8);
  });
});
