import { describe, expect, it } from 'vitest';

import { BondType } from '@/features/bond-core/types';

import {
  buildDefaultSharedConfig,
  buildScenarioInputs,
  DEFAULT_SCENARIO_A,
  getComparisonDirtyState,
  splitComparisonEnvelope,
  updateSharedComparisonConfig,
} from '../../lib/comparison-calculator-state';

describe('comparison calculator state model', () => {
  it('builds shared defaults from the supplied date', () => {
    const config = buildDefaultSharedConfig(new Date('2026-06-16T00:00:00.000Z'));

    expect(config).toMatchObject({
      initialInvestment: 10000,
      purchaseDate: '2026-06-16',
      withdrawalDate: '2036-06-16',
      investmentHorizonMonths: 120,
      maturityMode: 'reinvest_until_horizon',
    });
  });

  it('lets scenario horizon override shared timing without changing shared amount', () => {
    const shared = buildDefaultSharedConfig(new Date('2026-06-16T00:00:00.000Z'));
    const inputs = buildScenarioInputs(
      shared,
      { ...DEFAULT_SCENARIO_A, bondType: BondType.ROR, investmentHorizonMonths: 12 },
      null,
    );

    expect(inputs.initialInvestment).toBe(10000);
    expect(inputs.bondType).toBe(BondType.ROR);
    expect(inputs.withdrawalDate).toBe('2027-06-16');
    expect(inputs.investmentHorizonMonths).toBe(12);
  });

  it('normalizes shared horizon changes and custom rate paths', () => {
    const next = updateSharedComparisonConfig(
      {
        ...buildDefaultSharedConfig(new Date('2026-06-16T00:00:00.000Z')),
        customInflation: [3.8],
        customNbpRate: [3.75],
      },
      'investmentHorizonMonths',
      30,
    );

    expect(next.withdrawalDate).toBe('2028-12-16');
    expect(next.customInflation).toEqual([3.8, 3.5, 3.5]);
    expect(next.customNbpRate).toEqual([3.75, 5.25, 5.25]);
  });

  it('marks comparison clean only when committed inputs still match', () => {
    const shared = buildDefaultSharedConfig(new Date('2026-06-16T00:00:00.000Z'));
    const inputs = buildScenarioInputs(shared, DEFAULT_SCENARIO_A, null);

    expect(
      getComparisonDirtyState({
        inputsA: inputs,
        inputsB: inputs,
        committedInputsA: inputs,
        committedInputsB: inputs,
        isDirty: false,
        hasResults: true,
      }),
    ).toBe(false);

    expect(
      getComparisonDirtyState({
        inputsA: inputs,
        inputsB: inputs,
        committedInputsA: inputs,
        committedInputsB: inputs,
        isDirty: true,
        hasResults: true,
      }),
    ).toBe(true);
  });

  it('returns empty split envelopes when no comparison envelope is available', () => {
    expect(splitComparisonEnvelope(null)).toEqual({
      resultsA: null,
      resultsB: null,
      envelopeA: null,
      envelopeB: null,
    });
  });
});
