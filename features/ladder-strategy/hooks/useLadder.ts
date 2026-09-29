'use client';

import { useCallback, useEffect } from 'react';

import { useBondDefinitions } from '@/shared/context/BondDefinitionsContext';
import { usePersistedMacroCalculator } from '@/shared/hooks/usePersistedMacroCalculator';
import { getCalculationEndpoint } from '@/shared/lib/calculation-endpoints';
import { logClientError } from '@/shared/lib/client-logger';

import { BOND_DEFINITIONS } from '../../bond-core/constants/bond-definitions';
import { MODEL_VERSION } from '../../bond-core/model-version';
import { BondType, RegularInvestmentInputs } from '../../bond-core/types';
import {
  RegularInvestmentCalculationEnvelope,
  ScenarioKind,
} from '../../bond-core/types/scenarios';
import {
  applyLadderBondDefinition,
  buildDefaultLadderInputs,
  isLadderMacroInputKey,
  normalizeLadderInputs,
  resolveLadderBondTypeUpdate,
} from '../lib/ladder-state';

const STORAGE_KEY = 'obligacje.ladder-calculator.v1';

/** Ladder keeps worker calculation local while session owns draft and committed snapshots. */
export function useLadder() {
  const { definitions } = useBondDefinitions();
  const { session, inputs, envelope, updateDraft, hasTouchedMacroAssumptionsRef } =
    usePersistedMacroCalculator<RegularInvestmentInputs, RegularInvestmentCalculationEnvelope>({
      buildInitialInputs: buildDefaultLadderInputs,
      storageKey: STORAGE_KEY,
      modelVersion: MODEL_VERSION,
    });
  const { runRemoteCalculation } = session;

  useEffect(() => {
    if (!definitions || !definitions[inputs.bondType]) return;
    const timer = window.setTimeout(() => {
      updateDraft((previous) =>
        applyLadderBondDefinition(previous, definitions[previous.bondType]),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [definitions, inputs.bondType, updateDraft]);

  const calculate = useCallback(async () => {
    try {
      await runRemoteCalculation(
        getCalculationEndpoint(ScenarioKind.REGULAR_INVESTMENT),
        (draftInputs) => draftInputs,
      );
    } catch (error) {
      logClientError('Ladder calculation error:', error);
    }
  }, [runRemoteCalculation]);

  const updateInput = useCallback(
    (key: keyof RegularInvestmentInputs, value: string | number | boolean | undefined) => {
      if (isLadderMacroInputKey(key)) hasTouchedMacroAssumptionsRef.current = true;
      updateDraft((previous) =>
        normalizeLadderInputs(previous, { [key]: value } as Partial<RegularInvestmentInputs>),
      );
    },
    [hasTouchedMacroAssumptionsRef, updateDraft],
  );

  const setBondType = useCallback(
    (type: BondType, horizonChoice: 'preserve' | 'native') => {
      updateDraft((previous) =>
        resolveLadderBondTypeUpdate(previous, type, definitions, horizonChoice),
      );
    },
    [definitions, updateDraft],
  );

  return {
    inputs,
    results: envelope?.result ?? null,
    envelope,
    warnings: envelope?.warnings ?? [],
    assumptions: envelope?.assumptions ?? [],
    dataFreshness: envelope?.dataFreshness,
    isDirty: session.isDirty,
    isCalculating: session.isCalculating,
    calculate,
    updateInput,
    setBondType,
    definitions: definitions ?? BOND_DEFINITIONS,
    isPersistenceReady: session.isPersistenceReady,
    committedInputs: session.committedInputs,
    hasPreviousOfferResult: Boolean(session.committedInputs && session.isDirty),
  };
}
