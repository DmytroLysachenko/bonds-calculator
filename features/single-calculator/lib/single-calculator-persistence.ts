import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import { MODEL_VERSION } from '@/features/bond-core/model-version';
import { BondInputs, BondType } from '@/features/bond-core/types';
import { SingleBondCalculationEnvelope } from '@/features/bond-core/types/scenarios';
import { restoreVersionedEnvelope, stripDisplayOnlyInputs } from '@/shared/lib/calculator-state';
import { parseScenarioPackage, SCENARIO_CODEC_VERSION } from '@/shared/lib/scenario-codec';

import { applyDefinitionToInputs } from './single-calculator-state';

export const SINGLE_CALCULATOR_STORAGE_KEY = 'obligacje.single-calculator.v1';

export interface PersistedSingleCalculatorState {
  inputs: BondInputs;
  envelope: SingleBondCalculationEnvelope | null;
  selectedSeriesId: string | null;
  lastCommittedInputs: BondInputs | null;
  isDirty: boolean;
}

export interface RestoredSingleCalculatorState {
  inputs: BondInputs;
  envelope: SingleBondCalculationEnvelope | null;
  selectedSeriesId: string | null;
  lastCommittedInputs: BondInputs | null;
  isDirty: boolean;
  restoredFromPersistence: boolean;
}

export function restoreSingleCalculatorState(
  restoredState: PersistedSingleCalculatorState | null,
): RestoredSingleCalculatorState | null {
  if (!restoredState) {
    return null;
  }

  const restoredInputs = stripDisplayOnlyInputs(restoredState.inputs);
  const decoded = restoredInputs
    ? parseScenarioPackage({
        version: SCENARIO_CODEC_VERSION,
        kind: 'single-bond',
        intent: restoredInputs,
      })
    : null;
  if (!decoded?.ok || decoded.scenario.kind !== 'single-bond') {
    return null;
  }

  const definition = BOND_DEFINITIONS[decoded.scenario.intent.bondType as BondType];
  if (!definition) {
    return null;
  }

  const selectedSeriesId = normalizePersistedSelectedSeriesId(restoredState.selectedSeriesId);
  const inputs = applyDefinitionToInputs(decoded.scenario.intent, definition, selectedSeriesId);

  const restoredEnvelope = restoreVersionedEnvelope(restoredState.envelope, MODEL_VERSION);

  return {
    inputs,
    envelope: restoredEnvelope,
    selectedSeriesId,
    lastCommittedInputs: restoredEnvelope
      ? stripDisplayOnlyInputs(restoredState.lastCommittedInputs ?? null)
      : null,
    isDirty: restoredEnvelope ? (restoredState.isDirty ?? true) : true,
    restoredFromPersistence: true,
  };
}

/** A disappeared historical issue must not leave the form pointing at a dead option. */
export function resolveAvailableSelectedSeriesId(
  selectedSeriesId: string | null,
  availableSeries: readonly { id: string }[],
) {
  if (!selectedSeriesId || selectedSeriesId === 'current') {
    return 'current';
  }

  return availableSeries.some((series) => series.id === selectedSeriesId)
    ? selectedSeriesId
    : 'current';
}

function normalizePersistedSelectedSeriesId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : 'current';
}

export function buildPersistedSingleCalculatorState({
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
