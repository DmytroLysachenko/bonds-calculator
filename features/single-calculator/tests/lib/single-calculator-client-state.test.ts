import { describe, expect, it } from 'vitest';

import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import { BondType } from '@/features/bond-core/types';

import {
  buildSingleCalculatorPersistenceSnapshot,
  getInitialSingleCalculatorClientState,
  isSameSingleCalculatorCalculation,
  resolveSingleCalculatorFieldUpdate,
  resolveSingleCalculatorReplacementInputs,
  resolveSingleCalculatorSelectedSeriesUpdate,
} from '../../lib/single-calculator-client-state';
import { buildFallbackInputs } from '../../lib/single-calculator-state';

describe('single calculator client state', () => {
  it('builds the default hook state from fallback inputs', () => {
    const fallbackInputs = buildFallbackInputs(new Date('2026-06-16T00:00:00.000Z'));

    expect(getInitialSingleCalculatorClientState(undefined, fallbackInputs)).toEqual({
      inputs: fallbackInputs,
      envelope: null,
      isDirty: true,
      selectedSeriesId: null,
      lastCommittedInputs: null,
      isPersistenceReady: false,
    });
  });

  it('treats shared-scenario initial inputs as committed and persistence-ready', () => {
    const fallbackInputs = buildFallbackInputs(new Date('2026-06-16T00:00:00.000Z'));
    const initialInputs = { ...fallbackInputs, selectedSeriesId: 'edo-2026-06' };

    expect(getInitialSingleCalculatorClientState(initialInputs, fallbackInputs)).toMatchObject({
      inputs: initialInputs,
      isDirty: false,
      selectedSeriesId: 'edo-2026-06',
      lastCommittedInputs: initialInputs,
      isPersistenceReady: true,
    });
  });

  it('normalizes regular field updates and flags macro assumption edits', () => {
    const inputs = buildFallbackInputs(new Date('2026-06-16T00:00:00.000Z'));

    const purchaseDateUpdate = resolveSingleCalculatorFieldUpdate({
      key: 'purchaseDate',
      value: '2026-07-01',
      previous: inputs,
    });
    const macroUpdate = resolveSingleCalculatorFieldUpdate({
      key: 'expectedInflation',
      value: 4.25,
      previous: inputs,
    });

    expect(purchaseDateUpdate.touchedMacroAssumptions).toBe(false);
    expect(purchaseDateUpdate.inputs.purchaseDate).toBe('2026-07-01');
    expect(purchaseDateUpdate.inputs.withdrawalDate).not.toBe(inputs.withdrawalDate);
    expect(macroUpdate.touchedMacroAssumptions).toBe(true);
    expect(macroUpdate.inputs.expectedInflation).toBe(4.25);
  });

  it('resolves current-offer and historical selected series changes', () => {
    const inputs = {
      ...buildFallbackInputs(new Date('2026-06-16T00:00:00.000Z')),
      bondType: BondType.EDO,
    };
    const current = resolveSingleCalculatorSelectedSeriesUpdate({
      seriesId: 'current',
      previous: { ...inputs, firstYearRate: 1, margin: 1 },
      definitions: BOND_DEFINITIONS,
      availableSeries: [],
    });
    const historical = resolveSingleCalculatorSelectedSeriesUpdate({
      seriesId: 'edo-2026-06',
      previous: inputs,
      definitions: BOND_DEFINITIONS,
      availableSeries: [
        {
          id: 'edo-2026-06',
          seriesCode: 'EDO0626',
          emissionMonth: '2026-06-01',
          firstYearRate: 6.5,
          baseMargin: 2.25,
        },
      ],
    });

    expect(current?.firstYearRate).toBe(BOND_DEFINITIONS.EDO.firstYearRate);
    expect(current?.margin).toBe(BOND_DEFINITIONS.EDO.margin);
    expect(historical).toMatchObject({
      firstYearRate: 6.5,
      margin: 2.25,
      purchaseDate: '2026-06-01',
    });
  });

  it('normalizes replacement inputs and mirrors the persistence snapshot', () => {
    const inputs = buildFallbackInputs(new Date('2026-06-16T00:00:00.000Z'));
    const replacement = resolveSingleCalculatorReplacementInputs({
      ...inputs,
      selectedSeriesId: undefined,
      investmentHorizonMonths: 72,
    });
    const snapshot = buildSingleCalculatorPersistenceSnapshot({
      inputs,
      envelope: null,
      selectedSeriesId: replacement.selectedSeriesId,
      lastCommittedInputs: inputs,
      isDirty: false,
    });

    expect(replacement.selectedSeriesId).toBe('current');
    expect(replacement.inputs.investmentHorizonMonths).toBe(120);
    expect(replacement.inputs.withdrawalDate).toBe(inputs.withdrawalDate);
    expect(snapshot).toEqual({
      inputs,
      envelope: null,
      selectedSeriesId: 'current',
      lastCommittedInputs: inputs,
      isDirty: false,
    });
  });

  it('keeps display-only changes out of report identity but detects draft edits', () => {
    const committed = buildFallbackInputs(new Date('2026-06-16T00:00:00.000Z'));

    expect(
      isSameSingleCalculatorCalculation(
        { ...committed, chartStep: 'yearly', showRealValue: true },
        committed,
      ),
    ).toBe(true);
    expect(
      isSameSingleCalculatorCalculation({ ...committed, bondType: BondType.COI }, committed),
    ).toBe(false);
    expect(
      isSameSingleCalculatorCalculation({ ...committed, initialInvestment: 20_000 }, committed),
    ).toBe(false);
  });
});
