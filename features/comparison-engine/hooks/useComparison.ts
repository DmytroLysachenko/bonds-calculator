'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useBondDefinitions } from '@/shared/context/BondDefinitionsContext';
import { useCalculatorWorkflow } from '@/shared/hooks/useCalculatorWorkflow';
import { useMacroAssumptionDefaults } from '@/shared/hooks/useMacroAssumptionDefaults';
import { getCalculationEndpoint } from '@/shared/lib/calculation-endpoints';
import { createCalculationEnvelopeVersionValidator } from '@/shared/lib/calculation-envelope-version';
import { applyUntouchedMacroDefaults } from '@/shared/lib/calculator-session-persistence';
import { logClientError } from '@/shared/lib/client-logger';

import { BOND_DEFINITIONS } from '../../bond-core/constants/bond-definitions';
import { MODEL_VERSION } from '../../bond-core/model-version';
import { BondType } from '../../bond-core/types';
import type { BondComparisonCalculationEnvelope } from '../../bond-core/types/scenarios';
import { ScenarioKind } from '../../bond-core/types/scenarios';
import { buildIndependentComparisonPayload } from '../lib/comparison-actions';
import {
  buildDefaultSharedConfig,
  buildScenarioInputs,
  DEFAULT_SCENARIO_A,
  DEFAULT_SCENARIO_B,
  getComparisonDirtyState,
  type ScenarioOverride,
  type SharedComparisonConfig,
  splitComparisonEnvelope,
} from '../lib/comparison-calculator-state';
import type { ComparisonUrlState } from '../lib/comparison-deep-link';
import { getComparisonOfferStatus } from '../lib/comparison-offer-status';
import { COMPARISON_CALCULATOR_STORAGE_KEY } from '../lib/comparison-persistence';
import {
  applyScenarioBondTypeUpdate,
  applyScenarioCustomHorizonEnabled,
  applyScenarioCustomHorizonMonths,
  applyScenarioOverrideUpdate,
  applySharedComparisonConfigUpdate,
  isSharedComparisonMacroUpdate,
} from '../lib/comparison-update-actions';

interface ComparisonDraft {
  sharedConfig: SharedComparisonConfig;
  scenarioA: ScenarioOverride;
  scenarioB: ScenarioOverride;
}

const initialDraft = (): ComparisonDraft => ({
  sharedConfig: buildDefaultSharedConfig(),
  scenarioA: DEFAULT_SCENARIO_A,
  scenarioB: DEFAULT_SCENARIO_B,
});

export function useComparison(initialUrlState?: ComparisonUrlState | null) {
  const { definitions } = useBondDefinitions();
  const { defaults: macroDefaults } = useMacroAssumptionDefaults();
  const fallbackDraft = useMemo(() => initialDraft(), []);
  const isCommittedResultValid = useMemo(
    () => createCalculationEnvelopeVersionValidator(MODEL_VERSION),
    [],
  );
  const hasTouchedMacroAssumptions = useRef(false);
  const hasAppliedMacroDefaults = useRef(false);
  const appliedUrlState = useRef<string | null>(null);
  const session = useCalculatorWorkflow<ComparisonDraft, BondComparisonCalculationEnvelope>({
    initialInputs: fallbackDraft,
    storageKey: COMPARISON_CALCULATOR_STORAGE_KEY,
    isCommittedResultValid,
    modelVersion: MODEL_VERSION,
  });
  const { sharedConfig, scenarioA, scenarioB } = session.draftInputs;

  const inputsA = useMemo(
    () => buildScenarioInputs(sharedConfig, scenarioA, definitions),
    [definitions, scenarioA, sharedConfig],
  );
  const inputsB = useMemo(
    () => buildScenarioInputs(sharedConfig, scenarioB, definitions),
    [definitions, scenarioB, sharedConfig],
  );
  const { resultsA, resultsB, envelopeA, envelopeB } = useMemo(
    () => splitComparisonEnvelope(session.committedResult),
    [session.committedResult],
  );
  const committedInputsA = useMemo(
    () =>
      session.committedInputs
        ? buildScenarioInputs(
            session.committedInputs.sharedConfig,
            session.committedInputs.scenarioA,
            definitions,
          )
        : null,
    [definitions, session.committedInputs],
  );
  const committedInputsB = useMemo(
    () =>
      session.committedInputs
        ? buildScenarioInputs(
            session.committedInputs.sharedConfig,
            session.committedInputs.scenarioB,
            definitions,
          )
        : null,
    [definitions, session.committedInputs],
  );
  const isDirty = getComparisonDirtyState({
    inputsA,
    inputsB,
    committedInputsA,
    committedInputsB,
    isDirty: session.isDirty,
    hasResults: Boolean(resultsA && resultsB),
  });

  const updateDraft = useCallback(
    (update: (previous: ComparisonDraft) => ComparisonDraft) => {
      session.setDraftInputs(update(session.draftInputs));
    },
    [session],
  );

  useEffect(() => {
    if (
      !macroDefaults ||
      !session.isPersistenceReady ||
      hasTouchedMacroAssumptions.current ||
      hasAppliedMacroDefaults.current
    )
      return;
    hasAppliedMacroDefaults.current = true;
    const nextSharedConfig = applyUntouchedMacroDefaults(
      session.draftInputs.sharedConfig,
      macroDefaults,
      false,
    );
    if (nextSharedConfig !== session.draftInputs.sharedConfig) {
      session.setDraftInputs({ ...session.draftInputs, sharedConfig: nextSharedConfig });
    }
  }, [macroDefaults, session]);

  useEffect(() => {
    if (!initialUrlState || !session.isPersistenceReady) return;
    const nextUrlState = JSON.stringify(initialUrlState);
    if (appliedUrlState.current === nextUrlState) return;
    appliedUrlState.current = nextUrlState;
    session.setDraftInputs({
      sharedConfig: initialUrlState.sharedConfig,
      scenarioA: initialUrlState.scenarioA,
      scenarioB: initialUrlState.scenarioB,
    });
  }, [initialUrlState, session]);

  const calculate = useCallback(async () => {
    try {
      await session.runRemoteCalculation(
        getCalculationEndpoint(ScenarioKind.BOND_COMPARISON),
        ({ sharedConfig, scenarioA, scenarioB }) =>
          buildIndependentComparisonPayload({ sharedConfig, scenarioA, scenarioB }),
      );
    } catch (error) {
      logClientError('Comparison error:', error);
    }
  }, [session]);

  const restorePortableScenario = useCallback(
    (next: ComparisonUrlState) => {
      session.setDraftInputs({
        sharedConfig: next.sharedConfig,
        scenarioA: next.scenarioA,
        scenarioB: next.scenarioB,
      });
    },
    [session],
  );

  const updateSharedConfig = <K extends keyof SharedComparisonConfig>(
    key: K,
    value: SharedComparisonConfig[K],
  ) => {
    if (isSharedComparisonMacroUpdate(key)) hasTouchedMacroAssumptions.current = true;
    updateDraft((previous) => ({
      ...previous,
      sharedConfig: applySharedComparisonConfigUpdate(previous.sharedConfig, key, value),
    }));
  };
  const updateScenarioA = <K extends keyof ScenarioOverride>(key: K, value: ScenarioOverride[K]) =>
    updateDraft((previous) => ({
      ...previous,
      scenarioA: applyScenarioOverrideUpdate(previous.scenarioA, key, value),
    }));
  const updateScenarioB = <K extends keyof ScenarioOverride>(key: K, value: ScenarioOverride[K]) =>
    updateDraft((previous) => ({
      ...previous,
      scenarioB: applyScenarioOverrideUpdate(previous.scenarioB, key, value),
    }));
  const setBondTypeA = (type: BondType) =>
    updateDraft((previous) => ({
      ...previous,
      scenarioA: applyScenarioBondTypeUpdate(previous.scenarioA, type),
    }));
  const setBondTypeB = (type: BondType) =>
    updateDraft((previous) => ({
      ...previous,
      scenarioB: applyScenarioBondTypeUpdate(previous.scenarioB, type),
    }));

  const setScenarioACustomHorizonEnabled = (enabled: boolean) =>
    updateDraft((previous) => ({
      ...previous,
      scenarioA: applyScenarioCustomHorizonEnabled(
        previous.sharedConfig,
        previous.scenarioA,
        enabled,
      ),
    }));
  const setScenarioBCustomHorizonEnabled = (enabled: boolean) =>
    updateDraft((previous) => ({
      ...previous,
      scenarioB: applyScenarioCustomHorizonEnabled(
        previous.sharedConfig,
        previous.scenarioB,
        enabled,
      ),
    }));
  const setScenarioACustomHorizonMonths = (value: number | undefined) =>
    updateDraft((previous) => ({
      ...previous,
      scenarioA: applyScenarioCustomHorizonMonths(previous.sharedConfig, previous.scenarioA, value),
    }));
  const setScenarioBCustomHorizonMonths = (value: number | undefined) =>
    updateDraft((previous) => ({
      ...previous,
      scenarioB: applyScenarioCustomHorizonMonths(previous.sharedConfig, previous.scenarioB, value),
    }));

  const offerStatusA = getComparisonOfferStatus({
    inputs: inputsA,
    committedInputs: committedInputsA,
    envelope: envelopeA,
  });
  const offerStatusB = getComparisonOfferStatus({
    inputs: inputsB,
    committedInputs: committedInputsB,
    envelope: envelopeB,
  });
  return {
    sharedConfig,
    scenarioA,
    scenarioB,
    inputsA,
    inputsB,
    committedInputsA,
    committedInputsB,
    committedComparisonDraft: session.committedInputs,
    resultsA,
    resultsB,
    envelopeA,
    envelopeB,
    offerStatusA,
    offerStatusB,
    warningsA: envelopeA?.warnings ?? [],
    warningsB: envelopeB?.warnings ?? [],
    isCalculating: session.isCalculating,
    isDirty,
    calculate,
    restorePortableScenario,
    updateSharedConfig,
    updateScenarioA,
    updateScenarioB,
    setBondTypeA,
    setBondTypeB,
    setScenarioACustomHorizonEnabled,
    setScenarioBCustomHorizonEnabled,
    setScenarioACustomHorizonMonths,
    setScenarioBCustomHorizonMonths,
    definitions: definitions ?? BOND_DEFINITIONS,
    isPersistenceReady: session.isPersistenceReady,
  };
}
