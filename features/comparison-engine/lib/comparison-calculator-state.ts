import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import { BondInputs, BondType, TaxStrategy } from '@/features/bond-core/types';
import {
  BondComparisonCalculationEnvelope,
  IndependentBondComparisonPayload,
  SingleBondCalculationEnvelope,
} from '@/features/bond-core/types/scenarios';
import { areCalculatorStatesEqual } from '@/shared/lib/calculator-state';
import {
  getHorizonMonths,
  getWithdrawalDateFromMonths,
  toDateString,
} from '@/shared/lib/date-timing';

import { sanitizeScenarioOverride } from './comparison-scenario-state';

export type SharedComparisonConfig = IndependentBondComparisonPayload['sharedConfig'];
export type ScenarioOverride = IndependentBondComparisonPayload['scenarioA'];

const DEFAULT_HORIZON_MONTHS = 120;
export const DEFAULT_SCENARIO_A: ScenarioOverride = {
  bondType: BondType.EDO,
  isRebought: false,
};
export const DEFAULT_SCENARIO_B: ScenarioOverride = {
  bondType: BondType.EDO,
  isRebought: false,
};
const MACRO_ASSUMPTION_CONFIG_KEYS = new Set([
  'expectedInflation',
  'expectedNbpRate',
  'customInflation',
  'customNbpRate',
  'inflationScenario',
]);

export function buildDefaultSharedConfig(now = new Date()): SharedComparisonConfig {
  const today = toDateString(now);

  return {
    initialInvestment: 10000,
    purchaseDate: today,
    withdrawalDate: getWithdrawalDateFromMonths(today, DEFAULT_HORIZON_MONTHS),
    expectedInflation: 3.5,
    expectedNbpRate: 5.25,
    inflationScenario: 'base',
    taxStrategy: TaxStrategy.STANDARD,
    timingMode: 'general',
    investmentHorizonMonths: DEFAULT_HORIZON_MONTHS,
    maturityMode: 'reinvest_until_horizon',
  };
}

export function buildScenarioInputs(
  sharedConfig: SharedComparisonConfig,
  scenario: ScenarioOverride,
  definitions: Record<BondType, (typeof BOND_DEFINITIONS)[BondType]> | null,
): BondInputs {
  const normalizedScenario = sanitizeScenarioOverride(sharedConfig, scenario);
  const definition =
    definitions?.[normalizedScenario.bondType] ?? BOND_DEFINITIONS[normalizedScenario.bondType];
  const purchaseDate = normalizedScenario.purchaseDate ?? sharedConfig.purchaseDate;
  const timingMode = normalizedScenario.timingMode ?? sharedConfig.timingMode ?? 'general';
  const horizonMonths =
    normalizedScenario.investmentHorizonMonths ??
    sharedConfig.investmentHorizonMonths ??
    DEFAULT_HORIZON_MONTHS;
  const withdrawalDate =
    normalizedScenario.withdrawalDate ??
    (timingMode === 'general'
      ? getWithdrawalDateFromMonths(purchaseDate, horizonMonths)
      : sharedConfig.withdrawalDate);

  return {
    bondType: normalizedScenario.bondType,
    selectedSeriesId: normalizedScenario.selectedSeriesId,
    initialInvestment: sharedConfig.initialInvestment,
    firstYearRate: definition.firstYearRate,
    expectedInflation: sharedConfig.expectedInflation,
    expectedNbpRate: sharedConfig.expectedNbpRate ?? 5.25,
    customInflation: sharedConfig.customInflation,
    customNbpRate: sharedConfig.customNbpRate,
    inflationScenario: sharedConfig.inflationScenario,
    margin: definition.margin,
    duration: definition.duration,
    earlyWithdrawalFee: definition.earlyWithdrawalFee,
    taxRate: 19,
    isCapitalized: definition.isCapitalized,
    payoutFrequency: definition.payoutFrequency,
    purchaseDate,
    withdrawalDate,
    isRebought: false,
    rebuyDiscount: definition.rebuyDiscount,
    taxStrategy: normalizedScenario.taxStrategy ?? sharedConfig.taxStrategy ?? TaxStrategy.STANDARD,
    couponDisposition:
      normalizedScenario.couponDisposition ?? sharedConfig.couponDisposition ?? 'reinvest',
    rollover: normalizedScenario.rollover ?? false,
    timingMode,
    investmentHorizonMonths: horizonMonths,
  };
}

export function updateSharedComparisonConfig(
  previous: SharedComparisonConfig,
  key: keyof SharedComparisonConfig,
  value: string | number | boolean | number[] | undefined,
) {
  const next = { ...previous, [key]: value };

  if (key === 'purchaseDate') {
    const months =
      previous.investmentHorizonMonths ??
      getHorizonMonths(previous.purchaseDate, previous.withdrawalDate);
    next.withdrawalDate = getWithdrawalDateFromMonths(String(value), months);
  }

  if (key === 'investmentHorizonMonths') {
    next.withdrawalDate = getWithdrawalDateFromMonths(previous.purchaseDate, Number(value));
    extendSharedRatePaths(previous, next, Number(value));
  }

  if (key === 'withdrawalDate') {
    next.investmentHorizonMonths = getHorizonMonths(previous.purchaseDate, String(value));
    next.timingMode = 'exact';
    extendSharedRatePaths(previous, next, next.investmentHorizonMonths);
  }

  if (key === 'timingMode' && value === 'general') {
    const months =
      previous.investmentHorizonMonths ??
      getHorizonMonths(previous.purchaseDate, previous.withdrawalDate);
    next.investmentHorizonMonths = months;
    next.withdrawalDate = getWithdrawalDateFromMonths(previous.purchaseDate, months);
  }

  return next;
}

export function isComparisonMacroConfigKey(key: keyof SharedComparisonConfig) {
  return MACRO_ASSUMPTION_CONFIG_KEYS.has(key);
}

export function updateScenarioBondType(
  scenario: ScenarioOverride,
  type: BondType,
): ScenarioOverride {
  return {
    ...scenario,
    bondType: type,
    selectedSeriesId: scenario.bondType === type ? scenario.selectedSeriesId : undefined,
    isRebought: false,
    investmentHorizonMonths: scenario.investmentHorizonMonths,
  };
}

export function splitComparisonEnvelope(envelope: BondComparisonCalculationEnvelope | null) {
  const itemA = envelope?.result.find((item) => item.scenarioKey === 'scenarioA');
  const itemB = envelope?.result.find((item) => item.scenarioKey === 'scenarioB');
  const resultA = itemA?.result ?? null;
  const resultB = itemB?.result ?? null;

  return {
    resultsA: resultA,
    resultsB: resultB,
    envelopeA: buildSingleEnvelope(envelope, resultA, itemA?.offerTerms),
    envelopeB: buildSingleEnvelope(envelope, resultB, itemB?.offerTerms),
  };
}

export function getComparisonDirtyState({
  inputsA,
  inputsB,
  committedInputsA,
  committedInputsB,
  isDirty,
  hasResults,
}: {
  inputsA: BondInputs;
  inputsB: BondInputs;
  committedInputsA: BondInputs | null;
  committedInputsB: BondInputs | null;
  isDirty: boolean;
  hasResults: boolean;
}) {
  if (!hasResults) return isDirty;
  if (!committedInputsA || !committedInputsB) return true;

  return (
    isDirty ||
    !areCalculatorStatesEqual(inputsA, committedInputsA) ||
    !areCalculatorStatesEqual(inputsB, committedInputsB)
  );
}

function buildSingleEnvelope(
  source: BondComparisonCalculationEnvelope | null,
  result: SingleBondCalculationEnvelope['result'] | null,
  offerTerms?: BondComparisonCalculationEnvelope['result'][number]['offerTerms'],
): SingleBondCalculationEnvelope | null {
  if (!source || !result) return null;

  return {
    result,
    warnings: source.warnings || [],
    assumptions: source.assumptions || [],
    calculationNotes: source.calculationNotes || [],
    dataQualityFlags: source.dataQualityFlags || [],
    dataFreshness: source.dataFreshness ?? { status: 'unknown', usedFallback: false },
    calculationVersion: source.calculationVersion,
    taxRulesRevision: source.taxRulesRevision,
    diagnostics: source.diagnostics,
    offerTerms,
  };
}

function extendSharedRatePaths(
  previous: SharedComparisonConfig,
  next: SharedComparisonConfig,
  horizonMonths: number,
) {
  const years = Math.max(1, Math.ceil(horizonMonths / 12));

  if (previous.customInflation) {
    next.customInflation = Array.from(
      { length: years },
      (_, index) => previous.customInflation?.[index] ?? previous.expectedInflation,
    );
  }

  if (previous.customNbpRate) {
    next.customNbpRate = Array.from(
      { length: years },
      (_, index) => previous.customNbpRate?.[index] ?? previous.expectedNbpRate ?? 5.25,
    );
  }
}
