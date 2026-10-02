'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { createCalculationEnvelopeVersionValidator } from '@/shared/lib/calculation-envelope-version';
import { applyUntouchedMacroDefaults } from '@/shared/lib/calculator-session-persistence';
import { preserveStableState } from '@/shared/lib/calculator-state';

import { useCalculatorWorkflow } from './useCalculatorWorkflow';
import { useMacroAssumptionDefaults } from './useMacroAssumptionDefaults';

type MacroAssumptionInputs = {
  expectedInflation?: number;
  expectedNbpRate?: number;
};

type MacroDefaults = Required<MacroAssumptionInputs>;

interface PersistedMacroCalculatorOptions<TInputs extends MacroAssumptionInputs> {
  buildInitialInputs: () => TInputs;
  storageKey: string;
  modelVersion: string;
  applyMacroDefaults?: (inputs: TInputs, defaults: MacroDefaults) => TInputs;
}

/**
 * Owns the persisted session mechanics common to calculator screens. Features
 * keep their own input normalization and offer-definition rules, while this
 * hook protects the shared invariant that untouched macro fields may refresh.
 */
export function usePersistedMacroCalculator<TInputs extends MacroAssumptionInputs, TEnvelope>(
  options: PersistedMacroCalculatorOptions<TInputs>,
) {
  const { applyMacroDefaults, buildInitialInputs, modelVersion, storageKey } = options;
  const { defaults: macroDefaults } = useMacroAssumptionDefaults();
  const fallbackInputs = useMemo(() => buildInitialInputs(), [buildInitialInputs]);
  const isCommittedResultValid = useMemo(
    () => createCalculationEnvelopeVersionValidator(modelVersion),
    [modelVersion],
  );
  const hasTouchedMacroAssumptions = useRef(false);
  const session = useCalculatorWorkflow<TInputs, TEnvelope>({
    initialInputs: fallbackInputs,
    storageKey,
    isCommittedResultValid,
    modelVersion,
  });
  const { draftInputs: inputs, committedResult: envelope, setDraftInputs } = session;

  const updateDraft = useCallback(
    (update: (previous: TInputs) => TInputs) => {
      setDraftInputs(preserveStableState(inputs, update(inputs)));
    },
    [inputs, setDraftInputs],
  );

  useEffect(() => {
    if (!session.isPersistenceReady || hasTouchedMacroAssumptions.current) return;
    const applyDefaults =
      applyMacroDefaults ??
      ((current: TInputs, defaults: MacroDefaults) =>
        applyUntouchedMacroDefaults(current, defaults, false));
    updateDraft((previous) => applyDefaults(previous, macroDefaults));
  }, [applyMacroDefaults, macroDefaults, session.isPersistenceReady, updateDraft]);

  return {
    session,
    inputs,
    envelope,
    updateDraft,
    hasTouchedMacroAssumptionsRef: hasTouchedMacroAssumptions,
  };
}
