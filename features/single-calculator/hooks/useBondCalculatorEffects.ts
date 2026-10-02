'use client';

import { useEffect, useEffectEvent } from 'react';

import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import { BondInputs, BondType } from '@/features/bond-core/types';
import { SingleBondCalculationEnvelope } from '@/features/bond-core/types/scenarios';
import { BondSeriesMetadata } from '@/shared/lib/bond-series-client';
import {
  loadPersistedCalculatorState,
  savePersistedCalculatorState,
} from '@/shared/lib/calculator-persistence';
import { logClientError } from '@/shared/lib/client-logger';

import { fetchBondSeriesForSymbol } from '../lib/single-calculator-actions';
import {
  buildSingleCalculatorPersistenceSnapshot,
  isSameSingleCalculatorCalculation,
} from '../lib/single-calculator-client-state';
import {
  applySingleCalculatorMacroDefaults,
  type MacroDefaults,
  reconcilePersistedSingleCalculatorMacroDefaults,
  resolveDefinitionSyncedInputs,
} from '../lib/single-calculator-effect-state';
import {
  type PersistedSingleCalculatorState,
  resolveAvailableSelectedSeriesId,
  SINGLE_CALCULATOR_STORAGE_KEY,
} from '../lib/single-calculator-persistence';
import { resolveSingleCalculatorRestoration } from '../lib/single-calculator-restoration';

interface SingleCalculatorSessionState {
  inputs: BondInputs;
  envelope: SingleBondCalculationEnvelope | null;
  selectedSeriesId: string | null;
  lastCommittedInputs: BondInputs | null;
  isDirty: boolean;
  isCalculating: boolean;
  isPersistenceReady: boolean;
}

interface SingleCalculatorSessionActions {
  setInputs: React.Dispatch<React.SetStateAction<BondInputs>>;
  setEnvelope: React.Dispatch<React.SetStateAction<SingleBondCalculationEnvelope | null>>;
  setSelectedSeriesId: React.Dispatch<React.SetStateAction<string | null>>;
  setLastCommittedInputs: React.Dispatch<React.SetStateAction<BondInputs | null>>;
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPersistenceReady: React.Dispatch<React.SetStateAction<boolean>>;
  setAvailableSeries: React.Dispatch<React.SetStateAction<BondSeriesMetadata[]>>;
}

interface UseBondCalculatorEffectsInput {
  session: SingleCalculatorSessionState;
  actions: SingleCalculatorSessionActions;
  initialInputs: BondInputs | undefined;
  bondFromUrl?: BondType | null;
  fallbackInputs: BondInputs;
  definitions: typeof BOND_DEFINITIONS | null | undefined;
  macroDefaults: MacroDefaults | null | undefined;
  calculate: (currentInputs: BondInputs) => Promise<void>;
  hasRestoredStateRef: React.MutableRefObject<boolean>;
  hasAutoCalculatedSharedScenarioRef: React.MutableRefObject<boolean>;
  restoredFromPersistenceRef: React.MutableRefObject<boolean>;
  hasTouchedMacroAssumptionsRef: React.MutableRefObject<boolean>;
}

export function useBondCalculatorEffects({
  session: {
    inputs,
    envelope,
    selectedSeriesId,
    lastCommittedInputs,
    isDirty,
    isCalculating,
    isPersistenceReady,
  },
  actions: {
    setInputs,
    setEnvelope,
    setSelectedSeriesId,
    setLastCommittedInputs,
    setIsDirty,
    setIsPersistenceReady,
    setAvailableSeries,
  },
  initialInputs,
  bondFromUrl,
  fallbackInputs,
  definitions,
  macroDefaults,
  calculate,
  hasRestoredStateRef,
  hasAutoCalculatedSharedScenarioRef,
  restoredFromPersistenceRef,
  hasTouchedMacroAssumptionsRef,
}: UseBondCalculatorEffectsInput) {
  const applyMacroDefaults = useEffectEvent((defaults: MacroDefaults) => {
    setInputs((previous) => {
      const next = applySingleCalculatorMacroDefaults(previous, defaults);
      if (lastCommittedInputs && !isSameSingleCalculatorCalculation(next, lastCommittedInputs)) {
        setIsDirty(true);
      }
      return next;
    });
  });

  const reconcilePersistedMacroDefaults = useEffectEvent((defaults: MacroDefaults) => {
    setInputs((previous) => {
      const next = reconcilePersistedSingleCalculatorMacroDefaults(previous, defaults);
      if (lastCommittedInputs && !isSameSingleCalculatorCalculation(next, lastCommittedInputs)) {
        setIsDirty(true);
      }
      return next;
    });
  });

  useEffect(() => {
    if (!definitions || !definitions[inputs.bondType]) {
      return;
    }

    const timer = window.setTimeout(() => {
      setInputs((previous) => {
        const next = resolveDefinitionSyncedInputs({
          previous,
          definitions,
          selectedSeriesId,
        });
        if (lastCommittedInputs && !isSameSingleCalculatorCalculation(next, lastCommittedInputs)) {
          setIsDirty(true);
        }
        return next;
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [definitions, inputs.bondType, lastCommittedInputs, selectedSeriesId, setInputs, setIsDirty]);

  useEffect(() => {
    if (initialInputs || hasRestoredStateRef.current || !definitions) {
      return;
    }

    const timer = window.setTimeout(() => {
      hasRestoredStateRef.current = true;

      const restoredState = loadPersistedCalculatorState<PersistedSingleCalculatorState>(
        SINGLE_CALCULATOR_STORAGE_KEY,
      );
      const restored = resolveSingleCalculatorRestoration({
        bondFromUrl,
        fallbackInputs,
        persistedState: restoredState,
        definitions,
      });
      if (restored) {
        restoredFromPersistenceRef.current = restored.restoredFromPersistence;
        setInputs(restored.inputs);
        setEnvelope(restored.envelope);
        setSelectedSeriesId(restored.selectedSeriesId);
        setLastCommittedInputs(restored.lastCommittedInputs);
        setIsDirty(restored.isDirty);
      }

      setIsPersistenceReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    fallbackInputs,
    bondFromUrl,
    definitions,
    hasRestoredStateRef,
    initialInputs,
    restoredFromPersistenceRef,
    setEnvelope,
    setInputs,
    setIsDirty,
    setIsPersistenceReady,
    setLastCommittedInputs,
    setSelectedSeriesId,
  ]);

  useEffect(() => {
    if (
      !macroDefaults ||
      initialInputs ||
      !isPersistenceReady ||
      hasTouchedMacroAssumptionsRef.current
    ) {
      return;
    }

    if (restoredFromPersistenceRef.current) {
      const timer = window.setTimeout(() => {
        reconcilePersistedMacroDefaults(macroDefaults);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    applyMacroDefaults(macroDefaults);
  }, [
    hasTouchedMacroAssumptionsRef,
    initialInputs,
    isPersistenceReady,
    macroDefaults,
    restoredFromPersistenceRef,
  ]);

  useEffect(() => {
    let obsolete = false;
    const timer = setTimeout(() => {
      void fetchSeries(inputs.bondType, () => obsolete).then((series) => {
        if (obsolete || !series) {
          return;
        }
        setAvailableSeries(series);
        const resolvedSeriesId = resolveAvailableSelectedSeriesId(selectedSeriesId, series);
        if (resolvedSeriesId !== selectedSeriesId) {
          setSelectedSeriesId(resolvedSeriesId);
          setInputs((previous) =>
            resolveDefinitionSyncedInputs({
              previous,
              definitions: definitions ?? BOND_DEFINITIONS,
              selectedSeriesId: resolvedSeriesId,
            }),
          );
          setIsDirty(true);
        }
      });
    }, 0);
    return () => {
      obsolete = true;
      clearTimeout(timer);
    };
  }, [
    definitions,
    inputs.bondType,
    selectedSeriesId,
    setAvailableSeries,
    setInputs,
    setIsDirty,
    setSelectedSeriesId,
  ]);

  useEffect(() => {
    if (!initialInputs || hasAutoCalculatedSharedScenarioRef.current || isCalculating) {
      return;
    }

    hasAutoCalculatedSharedScenarioRef.current = true;
    const timer = window.setTimeout(() => {
      void calculate(initialInputs);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [calculate, hasAutoCalculatedSharedScenarioRef, initialInputs, isCalculating]);

  useEffect(() => {
    if (initialInputs || !isPersistenceReady) {
      return;
    }

    savePersistedCalculatorState(
      SINGLE_CALCULATOR_STORAGE_KEY,
      buildSingleCalculatorPersistenceSnapshot({
        inputs,
        envelope,
        selectedSeriesId,
        lastCommittedInputs,
        isDirty,
      }),
    );
  }, [
    envelope,
    initialInputs,
    inputs,
    isDirty,
    isPersistenceReady,
    lastCommittedInputs,
    selectedSeriesId,
  ]);
}

async function fetchSeries(
  symbol: BondType,
  isObsolete: () => boolean,
): Promise<BondSeriesMetadata[] | null> {
  try {
    await Promise.resolve();
    return await fetchBondSeriesForSymbol(symbol);
  } catch (error) {
    if (!isObsolete()) {
      logClientError('Failed to fetch series:', error);
    }
    return null;
  }
}
