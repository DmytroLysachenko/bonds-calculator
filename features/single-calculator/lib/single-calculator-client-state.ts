import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import { BondInputs } from '@/features/bond-core/types';
import { SingleBondCalculationEnvelope } from '@/features/bond-core/types/scenarios';
import { BondSeriesMetadata } from '@/shared/lib/bond-series-client';

import { PersistedSingleCalculatorState } from './single-calculator-persistence';
import {
  isMacroAssumptionInputKey,
  normalizeSingleCalculatorInputs,
  resolveSelectedSeriesInputUpdate,
} from './single-calculator-state';

export interface SingleCalculatorClientState {
  inputs: BondInputs;
  envelope: SingleBondCalculationEnvelope | null;
  isDirty: boolean;
  selectedSeriesId: string | null;
  lastCommittedInputs: BondInputs | null;
  isPersistenceReady: boolean;
}

interface FieldUpdateInput {
  key: string;
  value: unknown;
  previous: BondInputs;
}

interface SelectedSeriesUpdateInput {
  seriesId: string | null;
  previous: BondInputs;
  definitions: typeof BOND_DEFINITIONS;
  availableSeries: BondSeriesMetadata[];
}

export function getInitialSingleCalculatorClientState(
  initialInputs: BondInputs | undefined,
  fallbackInputs: BondInputs,
): SingleCalculatorClientState {
  return {
    inputs: initialInputs ?? fallbackInputs,
    envelope: null,
    isDirty: initialInputs ? false : true,
    selectedSeriesId: initialInputs?.selectedSeriesId ?? null,
    lastCommittedInputs: initialInputs ?? null,
    isPersistenceReady: Boolean(initialInputs),
  };
}

export function buildSingleCalculatorPersistenceSnapshot({
  inputs,
  envelope,
  selectedSeriesId,
  lastCommittedInputs,
  isDirty,
}: PersistedSingleCalculatorState): PersistedSingleCalculatorState {
  return {
    inputs,
    envelope,
    selectedSeriesId,
    lastCommittedInputs,
    isDirty,
  };
}

export function resolveSingleCalculatorFieldUpdate({ key, value, previous }: FieldUpdateInput): {
  inputs: BondInputs;
  touchedMacroAssumptions: boolean;
} {
  return {
    inputs: normalizeSingleCalculatorInputs(previous, {
      [key as keyof BondInputs]: value,
    } as Partial<BondInputs>),
    touchedMacroAssumptions: isMacroAssumptionInputKey(key),
  };
}

export function resolveSingleCalculatorSelectedSeriesUpdate({
  seriesId,
  previous,
  definitions,
  availableSeries,
}: SelectedSeriesUpdateInput): BondInputs | null {
  return resolveSelectedSeriesInputUpdate({
    seriesId,
    inputs: previous,
    definitions,
    availableSeries,
  });
}

export function resolveSingleCalculatorReplacementInputs(nextInputs: BondInputs) {
  return {
    selectedSeriesId: nextInputs.selectedSeriesId ?? 'current',
    inputs: normalizeSingleCalculatorInputs(nextInputs, nextInputs),
  };
}

/** Presentation preferences do not alter a calculation identity. */
export function isSameSingleCalculatorCalculation(
  draftInputs: BondInputs,
  committedInputs: BondInputs,
) {
  const draft = { ...draftInputs };
  const committed = { ...committedInputs };
  delete draft.chartStep;
  delete draft.showRealValue;
  delete committed.chartStep;
  delete committed.showRealValue;
  return JSON.stringify(draft) === JSON.stringify(committed);
}
