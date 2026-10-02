import { BondType, TaxStrategy } from '@/features/bond-core/types';
import { isIsoCalendarDate } from '@/features/bond-core/types/iso-calendar-date';
import { BondComparisonScenarioPayloadSchema } from '@/features/bond-core/types/schemas';
import type {
  ScenarioOverride,
  SharedComparisonConfig,
} from '@/features/comparison-engine/lib/comparison-calculator-state';
import { getHorizonMonths, getWithdrawalDateFromMonths } from '@/shared/lib/date-timing';
import {
  createComparisonScenarioPackage,
  decodeScenarioFromUrl,
  encodeScenarioForUrl,
} from '@/shared/lib/scenario-codec';

type SearchParams = Pick<URLSearchParams, 'get'>;

export type ComparisonBondPair = readonly [BondType, BondType];

export interface ComparisonUrlState {
  sharedConfig: SharedComparisonConfig;
  scenarioA: ScenarioOverride;
  scenarioB: ScenarioOverride;
}

const URL_KEYS = [
  'a',
  'b',
  'amount',
  'timing',
  'purchase',
  'withdrawal',
  'horizon',
  'tax',
  'inflation',
  'nbp',
  'taxA',
  'taxB',
  'horizonA',
  'horizonB',
  'scenario',
] as const;

export class ComparisonScenarioUrlTooLongError extends Error {}

export function parseComparisonBondPair(searchParams: SearchParams): ComparisonBondPair | null {
  const a = parseBondType(searchParams.get('a'));
  const b = parseBondType(searchParams.get('b'));

  return a && b ? [a, b] : null;
}

export function parseComparisonUrlState(
  searchParams: SearchParams,
  defaults: SharedComparisonConfig,
): ComparisonUrlState | null {
  const encodedScenario = searchParams.get('scenario');
  const portable = decodeScenarioFromUrl(encodedScenario);
  if (portable.ok && portable.scenario.kind === 'bond-comparison') {
    const intent = portable.scenario.intent;
    return {
      sharedConfig: intent.sharedConfig,
      scenarioA: intent.scenarioA,
      scenarioB: intent.scenarioB,
    };
  }
  if (encodedScenario !== null) return null;
  const pair = parseComparisonBondPair(searchParams);
  if (!pair) return null;

  const legacyFields = [
    ['purchase', parseDate],
    ['withdrawal', parseDate],
    ['horizon', (value: string | null) => parseInteger(value, 1, 360)],
    ['horizonA', (value: string | null) => parseInteger(value, 1, 360)],
    ['horizonB', (value: string | null) => parseInteger(value, 1, 360)],
    ['amount', (value: string | null) => parseNumber(value, 100, 100_000_000_000)],
    ['inflation', (value: string | null) => parseNumber(value, -20, 100)],
    ['nbp', (value: string | null) => parseNumber(value, -10, 100)],
    ['tax', parseTaxStrategy],
    ['taxA', parseTaxStrategy],
    ['taxB', parseTaxStrategy],
  ] as const;
  if (
    legacyFields.some(
      ([key, parse]) => searchParams.get(key) !== null && parse(searchParams.get(key)) === null,
    )
  )
    return null;
  const timing = searchParams.get('timing');
  if (timing !== null && timing !== 'exact' && timing !== 'general') return null;
  if (timing === 'general' && searchParams.get('withdrawal') !== null) return null;

  const purchaseDate = parseDate(searchParams.get('purchase')) ?? defaults.purchaseDate;
  const timingMode =
    timing === 'exact' || (timing === null && searchParams.get('withdrawal') !== null)
      ? 'exact'
      : 'general';
  const exactWithdrawal = parseDate(searchParams.get('withdrawal'));
  const horizon =
    parseInteger(searchParams.get('horizon'), 1, 360) ??
    (exactWithdrawal ? getHorizonMonths(purchaseDate, exactWithdrawal) : undefined) ??
    defaults.investmentHorizonMonths ??
    120;
  const withdrawalDate =
    timingMode === 'exact'
      ? (exactWithdrawal ?? getWithdrawalDateFromMonths(purchaseDate, horizon))
      : getWithdrawalDateFromMonths(purchaseDate, horizon);
  const taxStrategy =
    parseTaxStrategy(searchParams.get('tax')) ?? defaults.taxStrategy ?? TaxStrategy.STANDARD;
  const sharedConfig: SharedComparisonConfig = {
    ...defaults,
    initialInvestment:
      parseNumber(searchParams.get('amount'), 100, 100_000_000_000) ?? defaults.initialInvestment,
    purchaseDate,
    withdrawalDate,
    investmentHorizonMonths: horizon,
    timingMode,
    taxStrategy,
    expectedInflation:
      parseNumber(searchParams.get('inflation'), -20, 100) ?? defaults.expectedInflation,
    expectedNbpRate: parseNumber(searchParams.get('nbp'), -10, 100) ?? defaults.expectedNbpRate,
  };

  const state = {
    sharedConfig,
    scenarioA: buildScenario(pair[0], searchParams.get('taxA'), searchParams.get('horizonA')),
    scenarioB: buildScenario(pair[1], searchParams.get('taxB'), searchParams.get('horizonB')),
  };
  return BondComparisonScenarioPayloadSchema.safeParse({ mode: 'independent', ...state }).success
    ? state
    : null;
}

export function withComparisonUrlState(
  pathname: string,
  currentSearchParams: URLSearchParams,
  state: ComparisonUrlState,
) {
  const searchParams = new URLSearchParams(currentSearchParams);
  URL_KEYS.forEach((key) => searchParams.delete(key));

  const encoded = encodeScenarioForUrl(
    createComparisonScenarioPackage({
      mode: 'independent',
      sharedConfig: state.sharedConfig,
      scenarioA: state.scenarioA,
      scenarioB: state.scenarioB,
    }),
  );
  if (!encoded) throw new ComparisonScenarioUrlTooLongError('Scenario requires a local package.');
  searchParams.set('scenario', encoded);
  return `${pathname}?${searchParams.toString()}`;
}

export function withComparisonBondPair(
  pathname: string,
  currentSearchParams: URLSearchParams,
  pair: ComparisonBondPair,
) {
  const searchParams = new URLSearchParams(currentSearchParams);
  searchParams.set('a', pair[0]);
  searchParams.set('b', pair[1]);
  return `${pathname}?${searchParams.toString()}`;
}

function buildScenario(bondType: BondType, taxValue: string | null, horizonValue: string | null) {
  const taxStrategy = parseTaxStrategy(taxValue);
  const investmentHorizonMonths = parseInteger(horizonValue, 1, 360);
  return {
    bondType,
    isRebought: false,
    ...(taxStrategy ? { taxStrategy } : {}),
    ...(investmentHorizonMonths ? { investmentHorizonMonths } : {}),
  } satisfies ScenarioOverride;
}

function parseBondType(value: string | null) {
  return value && Object.values(BondType).includes(value as BondType) ? (value as BondType) : null;
}

function parseTaxStrategy(value: string | null) {
  return value && Object.values(TaxStrategy).includes(value as TaxStrategy)
    ? (value as TaxStrategy)
    : null;
}

function parseNumber(value: string | null, min: number, max: number) {
  if (!value || !/^-?\d+(?:\.\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function parseInteger(value: string | null, min: number, max: number) {
  const parsed = parseNumber(value, min, max);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function parseDate(value: string | null) {
  return value && isIsoCalendarDate(value) ? value : null;
}
