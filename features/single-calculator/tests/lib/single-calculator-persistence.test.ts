import { describe, expect, it } from 'vitest';

import { MODEL_VERSION } from '@/features/bond-core/model-version';
import { SingleBondCalculationEnvelope } from '@/features/bond-core/types/scenarios';

import {
  buildPersistedSingleCalculatorState,
  resolveAvailableSelectedSeriesId,
  restoreSingleCalculatorState,
  SINGLE_CALCULATOR_STORAGE_KEY,
} from '../../lib/single-calculator-persistence';
import { buildFallbackInputs } from '../../lib/single-calculator-state';

function createEnvelope(version = MODEL_VERSION): SingleBondCalculationEnvelope {
  return {
    result: {
      initialInvestment: 1000,
      timeline: [],
      finalNominalValue: 1000,
      finalRealValue: 1000,
      totalProfit: 0,
      totalTax: 0,
      totalEarlyWithdrawalFee: 0,
      grossValue: 1000,
      netPayoutValue: 1000,
      isEarlyWithdrawal: false,
      maturityDate: '2036-06-16',
      nominalAnnualizedReturn: 0,
      realAnnualizedReturn: 0,
    },
    warnings: [],
    assumptions: [],
    calculationNotes: [],
    dataQualityFlags: [],
    dataFreshness: { status: 'unknown', usedFallback: false },
    calculationVersion: version,
  };
}

describe('single calculator persistence model', () => {
  it('exposes the stable storage key used by the calculator hook', () => {
    expect(SINGLE_CALCULATOR_STORAGE_KEY).toBe('obligacje.single-calculator.v1');
  });

  it('restores persisted inputs and strips display-only fields', () => {
    const fallbackInputs = buildFallbackInputs(new Date('2026-06-16T00:00:00.000Z'));
    const envelope = createEnvelope();
    const restored = restoreSingleCalculatorState({
      inputs: { ...fallbackInputs, chartStep: 'yearly' },
      envelope,
      selectedSeriesId: 'current',
      lastCommittedInputs: { ...fallbackInputs, chartStep: 'monthly' },
      isDirty: false,
    });

    expect(restored).toMatchObject({
      envelope,
      selectedSeriesId: 'current',
      isDirty: false,
      restoredFromPersistence: true,
    });
    expect(restored?.inputs).not.toHaveProperty('chartStep');
    expect(restored?.lastCommittedInputs).not.toHaveProperty('chartStep');
  });

  it('drops stale envelopes and marks restored state dirty', () => {
    const fallbackInputs = buildFallbackInputs(new Date('2026-06-16T00:00:00.000Z'));
    const restored = restoreSingleCalculatorState({
      inputs: fallbackInputs,
      envelope: createEnvelope('old-version'),
      selectedSeriesId: null,
      lastCommittedInputs: fallbackInputs,
      isDirty: false,
    });

    expect(restored?.envelope).toBeNull();
    expect(restored?.lastCommittedInputs).toBeNull();
    expect(restored?.isDirty).toBe(true);
  });

  it('rejects invalid persisted inputs instead of reviving a malformed draft', () => {
    const fallbackInputs = buildFallbackInputs(new Date('2026-06-16T00:00:00.000Z'));

    expect(
      restoreSingleCalculatorState({
        inputs: { ...fallbackInputs, initialInvestment: -1 },
        envelope: createEnvelope(),
        selectedSeriesId: 'current',
        lastCommittedInputs: fallbackInputs,
        isDirty: false,
      }),
    ).toBeNull();
  });

  it('reconciles a restored draft with the current offer definition', () => {
    const fallbackInputs = buildFallbackInputs(new Date('2026-06-16T00:00:00.000Z'));
    const restored = restoreSingleCalculatorState({
      inputs: { ...fallbackInputs, firstYearRate: 99, margin: 19, duration: 1 },
      envelope: createEnvelope(),
      selectedSeriesId: 'current',
      lastCommittedInputs: fallbackInputs,
      isDirty: false,
    });

    expect(restored?.inputs).toMatchObject({ firstYearRate: 5.35, margin: 2, duration: 10 });
  });

  it('falls back to the current offer when a persisted historical series is unavailable', () => {
    expect(resolveAvailableSelectedSeriesId('removed-series', [])).toBe('current');
    expect(resolveAvailableSelectedSeriesId('edo-2026-06', [{ id: 'edo-2026-06' }])).toBe(
      'edo-2026-06',
    );
  });

  it('keeps the last valid result while a changed draft awaits a successful recalculation', () => {
    const fallbackInputs = buildFallbackInputs(new Date('2026-06-16T00:00:00.000Z'));
    const envelope = createEnvelope();
    const restored = restoreSingleCalculatorState({
      inputs: { ...fallbackInputs, initialInvestment: 20_000 },
      envelope,
      selectedSeriesId: 'current',
      lastCommittedInputs: fallbackInputs,
      isDirty: true,
    });

    expect(restored).toMatchObject({
      inputs: { initialInvestment: 20_000 },
      envelope,
      lastCommittedInputs: fallbackInputs,
      isDirty: true,
    });
  });

  it('builds the save payload without mutating calculator state', () => {
    const inputs = buildFallbackInputs(new Date('2026-06-16T00:00:00.000Z'));
    const envelope = createEnvelope();

    expect(
      buildPersistedSingleCalculatorState({
        inputs,
        envelope,
        selectedSeriesId: 'current',
        lastCommittedInputs: inputs,
        isDirty: false,
      }),
    ).toEqual({
      inputs,
      envelope,
      selectedSeriesId: 'current',
      lastCommittedInputs: inputs,
      isDirty: false,
    });
  });
});
