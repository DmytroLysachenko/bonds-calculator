import { BondInputs } from '@/features/bond-core/types';
import { parseScenarioPackage, SCENARIO_CODEC_VERSION } from '@/shared/lib/scenario-codec';

const STORAGE_KEY = 'obligacje.saved-single-scenarios.v1';
export const MAX_SCENARIOS = 12;
const SCHEMA_VERSION = SCENARIO_CODEC_VERSION;

export interface SavedScenarioRecord {
  id: string;
  kind: 'single-bond';
  schemaVersion: typeof SCHEMA_VERSION;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  inputs: BondInputs;
}

export class ScenarioStorageError extends Error {}
export class ScenarioCapacityError extends ScenarioStorageError {}

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `scenario-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const sortScenarios = (scenarios: SavedScenarioRecord[]) =>
  [...scenarios].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

export function createSavedScenario(
  inputs: BondInputs,
  overrides?: Partial<Pick<SavedScenarioRecord, 'name' | 'description' | 'tags'>>,
): SavedScenarioRecord {
  const now = new Date().toISOString();
  return {
    id: createId(),
    kind: 'single-bond',
    schemaVersion: SCHEMA_VERSION,
    name:
      overrides?.name ??
      `${inputs.bondType} ${inputs.investmentHorizonMonths ?? Math.round(inputs.duration * 12)}M`,
    description:
      overrides?.description ??
      `Saved ${inputs.bondType} scenario for ${inputs.initialInvestment} PLN.`,
    tags: overrides?.tags ?? [inputs.bondType, inputs.taxStrategy],
    createdAt: now,
    updatedAt: now,
    inputs,
  };
}

const isValidDate = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(new Date(value).getTime());

/** Converts pre-library records while refusing malformed or unknown intents. */
function parseRecord(value: unknown): SavedScenarioRecord | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<SavedScenarioRecord>;
  const decoded = parseScenarioPackage({
    version: raw.schemaVersion ?? SCHEMA_VERSION,
    kind: raw.kind ?? 'single-bond',
    intent: raw.inputs,
  });
  if (
    !decoded.ok ||
    decoded.scenario.kind !== 'single-bond' ||
    (raw.kind !== undefined && raw.kind !== 'single-bond') ||
    (raw.schemaVersion !== undefined && raw.schemaVersion !== SCHEMA_VERSION) ||
    typeof raw.id !== 'string' ||
    typeof raw.name !== 'string' ||
    typeof raw.description !== 'string' ||
    !Array.isArray(raw.tags) ||
    !raw.tags.every((tag) => typeof tag === 'string') ||
    !isValidDate(raw.createdAt) ||
    !isValidDate(raw.updatedAt)
  ) {
    return null;
  }

  return {
    id: raw.id,
    kind: 'single-bond',
    schemaVersion: SCHEMA_VERSION,
    name: raw.name,
    description: raw.description,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    tags: raw.tags,
    inputs: decoded.scenario.intent,
  };
}

export function loadSavedScenarios(): SavedScenarioRecord[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortScenarios(
      parsed.map(parseRecord).filter((record): record is SavedScenarioRecord => !!record),
    );
  } catch {
    return [];
  }
}

export function getSavedScenarioLoadReport() {
  if (typeof window === 'undefined') return { records: [], unsupportedCount: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return { records: [], unsupportedCount: 1 };
    const parsedRecords = parsed.map(parseRecord);
    return {
      records: sortScenarios(
        parsedRecords.filter((record): record is SavedScenarioRecord => !!record),
      ),
      unsupportedCount: parsedRecords.filter((record) => !record).length,
    };
  } catch {
    return { records: [], unsupportedCount: 1 };
  }
}

function persistSavedScenarios(scenarios: SavedScenarioRecord[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sortScenarios(scenarios)));
  } catch (error) {
    throw new ScenarioStorageError('Browser storage is unavailable.', { cause: error });
  }
}

export function saveScenarioRecord(record: SavedScenarioRecord): SavedScenarioRecord[] {
  const current = loadSavedScenarios();
  const next = [record, ...current.filter((item) => item.id !== record.id)];
  if (next.length > MAX_SCENARIOS) {
    throw new ScenarioCapacityError(`The local library can hold ${MAX_SCENARIOS} scenarios.`);
  }
  persistSavedScenarios(next);
  return sortScenarios(next);
}

export function deleteSavedScenario(id: string) {
  const next = loadSavedScenarios().filter((record) => record.id !== id);
  persistSavedScenarios(next);
  return next;
}

export function updateSavedScenario(
  id: string,
  update: Pick<Partial<SavedScenarioRecord>, 'name' | 'description' | 'tags'>,
) {
  const next = loadSavedScenarios().map((record) =>
    record.id === id ? { ...record, ...update, updatedAt: new Date().toISOString() } : record,
  );
  persistSavedScenarios(next);
  return sortScenarios(next);
}

export function duplicateSavedScenario(id: string) {
  const source = loadSavedScenarios().find((record) => record.id === id);
  return source
    ? saveScenarioRecord(
        createSavedScenario(source.inputs, {
          description: source.description,
          tags: source.tags,
          name: `${source.name} copy`,
        }),
      )
    : null;
}
