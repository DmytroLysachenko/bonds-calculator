import { BondInputs } from '@/features/bond-core/types';
import { createSingleScenarioPackage, isSinglePortableScenario } from '@/shared/lib/scenario-codec';

export interface SharedSingleScenarioPayload {
  title: string;
  description: string;
  inputs: BondInputs;
}

function normalizeSharedSingleScenarioInputs(inputs: BondInputs): BondInputs {
  // Shared links and local packages use one intent codec. The API still
  // validates this untrusted payload before storage.
  const scenario = createSingleScenarioPackage(inputs);
  if (!isSinglePortableScenario(scenario))
    throw new Error('Expected a single-bond scenario package.');
  return scenario.intent;
}

export function buildSharedSingleScenarioPayload(
  inputs: BondInputs,
  description?: string,
): SharedSingleScenarioPayload {
  const normalizedInputs = normalizeSharedSingleScenarioInputs(inputs);
  const horizonMonths =
    normalizedInputs.investmentHorizonMonths ?? Math.round(normalizedInputs.duration * 12);

  return {
    title: `Single ${normalizedInputs.bondType} ${horizonMonths}M`,
    description:
      description ??
      `Committed single-bond scenario for ${normalizedInputs.bondType} over ${horizonMonths} months.`,
    inputs: normalizedInputs,
  };
}

export function serializeSharedSingleScenario(payload: SharedSingleScenarioPayload) {
  return JSON.stringify(payload);
}
