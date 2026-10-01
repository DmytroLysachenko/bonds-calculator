import { z } from 'zod';

import { BondInputs } from '@/features/bond-core/types';
import { IndependentBondComparisonPayload } from '@/features/bond-core/types/scenarios';
import {
  BondComparisonScenarioPayloadSchema,
  BondInputsSchema,
} from '@/features/bond-core/types/schemas';

export const SCENARIO_CODEC_VERSION = 1;
export const MAX_INLINE_SCENARIO_LENGTH = 1_800;

const singleScenarioSchema = z.object({
  version: z.literal(SCENARIO_CODEC_VERSION),
  kind: z.literal('single-bond'),
  intent: BondInputsSchema.refine(
    (intent) => intent.couponDisposition === undefined,
    'Single-bond portable intent does not support couponDisposition.',
  ),
});
const comparisonScenarioSchema = z.object({
  version: z.literal(SCENARIO_CODEC_VERSION),
  kind: z.literal('bond-comparison'),
  intent: BondComparisonScenarioPayloadSchema.refine(
    (intent): intent is IndependentBondComparisonPayload => intent.mode === 'independent',
    'Only independent comparison scenarios are portable.',
  ),
});
const scenarioPackageSchema = z.discriminatedUnion('kind', [
  singleScenarioSchema,
  comparisonScenarioSchema,
]);

export type PortableScenario =
  | {
      version: typeof SCENARIO_CODEC_VERSION;
      kind: 'single-bond';
      intent: BondInputs;
    }
  | {
      version: typeof SCENARIO_CODEC_VERSION;
      kind: 'bond-comparison';
      intent: IndependentBondComparisonPayload;
    };

export type ScenarioDecodeResult =
  | { ok: true; scenario: PortableScenario }
  | { ok: false; reason: 'malformed' | 'unsupported-version' | 'unsupported-kind' };

export function isSinglePortableScenario(
  scenario: PortableScenario,
): scenario is Extract<PortableScenario, { kind: 'single-bond' }> {
  return scenario.kind === 'single-bond';
}

export function isComparisonPortableScenario(
  scenario: PortableScenario,
): scenario is Extract<PortableScenario, { kind: 'bond-comparison' }> {
  return scenario.kind === 'bond-comparison';
}

/**
 * Scenario packages contain only declarative inputs. Results, portfolio ids,
 * owner identity, historical observations and issuer data are never portable.
 */
export function createSingleScenarioPackage(inputs: BondInputs): PortableScenario {
  const intent = { ...inputs };
  delete intent.historicalData;
  return {
    version: SCENARIO_CODEC_VERSION,
    kind: 'single-bond',
    intent,
  };
}

export function createComparisonScenarioPackage(
  intent: IndependentBondComparisonPayload,
): PortableScenario {
  return { version: SCENARIO_CODEC_VERSION, kind: 'bond-comparison', intent };
}

export function serializeScenarioPackage(scenario: PortableScenario) {
  return JSON.stringify(scenario);
}

export function parseScenarioPackage(value: unknown): ScenarioDecodeResult {
  let parsed: unknown = value;
  try {
    if (typeof value === 'string') parsed = JSON.parse(value);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'malformed' };
  const raw = parsed as { version?: unknown; kind?: unknown };
  if (raw.version !== SCENARIO_CODEC_VERSION) return { ok: false, reason: 'unsupported-version' };
  if (raw.kind !== 'single-bond' && raw.kind !== 'bond-comparison') {
    return { ok: false, reason: 'unsupported-kind' };
  }
  const result = scenarioPackageSchema.safeParse(parsed);
  return result.success
    ? { ok: true, scenario: result.data as PortableScenario }
    : { ok: false, reason: 'malformed' };
}

export function encodeScenarioForUrl(scenario: PortableScenario): string | null {
  const validated = parseScenarioPackage(scenario);
  if (!validated.ok) return null;
  const value = encodeURIComponent(serializeScenarioPackage(validated.scenario));
  return value.length <= MAX_INLINE_SCENARIO_LENGTH ? value : null;
}

export function decodeScenarioFromUrl(value: string | null): ScenarioDecodeResult {
  if (!value) return { ok: false, reason: 'malformed' };
  try {
    return parseScenarioPackage(decodeURIComponent(value));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}
