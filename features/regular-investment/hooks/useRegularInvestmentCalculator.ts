'use client';

import { useCallback, useEffect } from 'react';

import { useBondDefinitions } from '@/shared/context/BondDefinitionsContext';
import { usePersistedMacroCalculator } from '@/shared/hooks/usePersistedMacroCalculator';
import { getCalculationEndpoint } from '@/shared/lib/calculation-endpoints';
import { stripDisplayOnlyInputs } from '@/shared/lib/calculator-state';
import { logClientError } from '@/shared/lib/client-logger';

import { MODEL_VERSION } from '../../bond-core/model-version';
import { BondType, RegularInvestmentInputs } from '../../bond-core/types';
import {
  RegularInvestmentCalculationEnvelope,
  ScenarioKind,
} from '../../bond-core/types/scenarios';
import {
  applyRegularInvestmentDefinition,
  buildRegularInvestmentFallbackInputs,
  isRegularInvestmentMacroInputKey,
  normalizeRegularInvestmentInputs,
  resolveRegularInvestmentBondTypeUpdate,
} from '../lib/regular-investment-state';

const STORAGE_KEY = 'obligacje.regular-calculator.v1';

/** Draft changes never replace displayed result. Session commits only successful calculations. */
export function useRegularInvestmentCalculator() {
  const { definitions, isLoading: isLoadingDefs } = useBondDefinitions();
  const { session, inputs, envelope, updateDraft, hasTouchedMacroAssumptionsRef } =
    usePersistedMacroCalculator<RegularInvestmentInputs, RegularInvestmentCalculationEnvelope>({
      buildInitialInputs: buildRegularInvestmentFallbackInputs,
      storageKey: STORAGE_KEY,
      modelVersion: MODEL_VERSION,
    });
  const { runRemoteCalculation } = session;

  useEffect(() => {
    if (!definitions || !definitions[inputs.bondType]) return;
    const timer = window.setTimeout(() => {
      updateDraft((previous) =>
        applyRegularInvestmentDefinition(previous, definitions[previous.bondType]),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [definitions, inputs.bondType, updateDraft]);

  const calculate = useCallback(async () => {
    try {
      await runRemoteCalculation(
        getCalculationEndpoint(ScenarioKind.REGULAR_INVESTMENT),
        (draftInputs) => stripDisplayOnlyInputs(draftInputs) ?? draftInputs,
      );
    } catch (error) {
      logClientError('Calculation error:', error);
    }
  }, [runRemoteCalculation]);

  const updateInput = useCallback(
    <K extends keyof RegularInvestmentInputs>(key: K, value: RegularInvestmentInputs[K]) => {
      if (isRegularInvestmentMacroInputKey(key)) hasTouchedMacroAssumptionsRef.current = true;
      updateDraft((previous) =>
        normalizeRegularInvestmentInputs(previous, {
          [key]: value,
        } as Partial<RegularInvestmentInputs>),
      );
    },
    [hasTouchedMacroAssumptionsRef, updateDraft],
  );

  const setBondType = useCallback(
    (type: BondType, horizonChoice: 'preserve' | 'native') => {
      if (!definitions) return;
      updateDraft((previous) =>
        resolveRegularInvestmentBondTypeUpdate(previous, type, definitions[type], horizonChoice),
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
    isCalculating: session.isCalculating,
    isError: session.isError,
    isDirty: session.isDirty,
    calculate,
    updateInput,
    setBondType,
    definitions,
    isLoadingDefs,
    isPersistenceReady: session.isPersistenceReady,
    committedInputs: session.committedInputs,
    hasPreviousOfferResult: Boolean(session.committedInputs && session.isDirty),
  };
}
