import { BondInputsSchema } from '@/features/bond-core/types/schemas';
import { getCanonicalUrl } from '@/lib/site-url';
import {
  buildSharedSingleScenarioPayload,
  serializeSharedSingleScenario,
} from '@/shared/lib/single-scenario-share';

import { SharedScenarioPayloadSchema } from './input-schema';
import { createSharedSingleScenarioRecord, findSharedSingleScenarioRecord } from './repository';

const SHARED_SCENARIO_RETENTION_MS = 30 * 24 * 60 * 60_000;

function parseStoredSingleScenarioInputs(raw: string) {
  const parsed = JSON.parse(raw) as { inputs: unknown };
  return BondInputsSchema.parse(parsed.inputs);
}

export async function createSharedSingleScenario(body: unknown, now = new Date()) {
  const { inputs, description } = SharedScenarioPayloadSchema.parse(body);
  const validatedInputs = BondInputsSchema.parse(inputs);
  const normalizedPayload = buildSharedSingleScenarioPayload(validatedInputs, description);

  const created = await createSharedSingleScenarioRecord({
    title: normalizedPayload.title,
    description: normalizedPayload.description,
    payloadJson: serializeSharedSingleScenario(normalizedPayload),
    expiresAt: new Date(now.getTime() + SHARED_SCENARIO_RETENTION_MS),
  });

  return {
    shareId: created.shareId,
    shareUrl: getCanonicalUrl(`/shared-scenarios/${created.shareId}`),
    expiresAt: new Date(now.getTime() + SHARED_SCENARIO_RETENTION_MS).toISOString(),
  };
}

export async function getSharedSingleScenarioPageData(shareId: string) {
  const scenario = await findSharedSingleScenarioRecord(shareId);

  if (!scenario) {
    return null;
  }

  const inputs = parseStoredSingleScenarioInputs(scenario.payloadJson);

  return {
    title: scenario.title,
    inputs,
  };
}
