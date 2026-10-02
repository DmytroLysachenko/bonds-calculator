import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import { BondInputs, BondType, InterestPayout, TaxStrategy } from '@/features/bond-core/types';
import { BondSeriesMetadata } from '@/shared/lib/bond-series-client';
import {
  getHorizonMonths,
  getWithdrawalDateFromMonths,
  toDateString,
} from '@/shared/lib/date-timing';

const DEFAULT_BOND = BondType.EDO;
const PLAYWRIGHT_SMOKE_DEFAULT_DATE = '2026-07-09T00:00:00.000Z';
const REVERSE_CALCULATION_TEST_BASE = 10000;
const MACRO_ASSUMPTION_INPUT_KEYS = new Set([
  'expectedInflation',
  'expectedNbpRate',
  'customInflation',
  'customNbpRate',
  'inflationScenario',
]);

export function buildFallbackInputs(now = new Date()): BondInputs {
  const purchaseDate = toDateString(
    process.env.PLAYWRIGHT_SMOKE === '1' || process.env.NEXT_PUBLIC_PLAYWRIGHT_SMOKE === '1'
      ? new Date(PLAYWRIGHT_SMOKE_DEFAULT_DATE)
      : now,
  );

  return {
    bondType: DEFAULT_BOND,
    initialInvestment: 10000,
    firstYearRate: 5.35,
    expectedInflation: 3.5,
    expectedNbpRate: 5.25,
    margin: 2.0,
    duration: 10,
    earlyWithdrawalFee: 2.0,
    taxRate: 19,
    isCapitalized: true,
    payoutFrequency: InterestPayout.MATURITY,
    purchaseDate,
    withdrawalDate: getWithdrawalDateFromMonths(purchaseDate, 120),
    isRebought: false,
    rebuyDiscount: 0,
    taxStrategy: TaxStrategy.STANDARD,
    showRealValue: false,
    rollover: false,
    timingMode: 'general',
    investmentHorizonMonths: 120,
  };
}

export function parseBondType(value: string | null | undefined): BondType | null {
  if (!value || !Object.values(BondType).includes(value as BondType)) {
    return null;
  }

  return value as BondType;
}

export function applyDefinitionToInputs(
  previous: BondInputs,
  definition: (typeof BOND_DEFINITIONS)[BondType],
  selectedSeriesId: string | null,
): BondInputs {
  const shouldUseCurrentOffer = !selectedSeriesId || selectedSeriesId === 'current';

  return {
    ...previous,
    firstYearRate: shouldUseCurrentOffer ? definition.firstYearRate : previous.firstYearRate,
    margin: shouldUseCurrentOffer ? definition.margin : previous.margin,
    duration: definition.duration,
    earlyWithdrawalFee: definition.earlyWithdrawalFee,
    isCapitalized: definition.isCapitalized,
    payoutFrequency: definition.payoutFrequency,
    rebuyDiscount: definition.rebuyDiscount,
    nominalValue: definition.nominalValue,
    isInflationIndexed: definition.isInflationIndexed,
  };
}

export function normalizeSingleCalculatorInputs(
  base: BondInputs,
  nextPartial?: Partial<BondInputs>,
) {
  const merged = { ...base, ...nextPartial };

  if (nextPartial?.purchaseDate) {
    const horizonMonths =
      merged.investmentHorizonMonths ?? getHorizonMonths(base.purchaseDate, base.withdrawalDate);
    merged.withdrawalDate = getWithdrawalDateFromMonths(
      String(nextPartial.purchaseDate),
      horizonMonths,
    );
  }

  if (nextPartial?.investmentHorizonMonths !== undefined) {
    merged.withdrawalDate = getWithdrawalDateFromMonths(
      merged.purchaseDate,
      Number(nextPartial.investmentHorizonMonths),
    );
    extendCustomRatePaths(merged);
  }

  if (nextPartial?.withdrawalDate) {
    merged.investmentHorizonMonths = getHorizonMonths(
      merged.purchaseDate,
      String(nextPartial.withdrawalDate),
    );
    merged.timingMode = 'exact';
    extendCustomRatePaths(merged);
  }

  if (nextPartial?.timingMode === 'general') {
    const horizonMonths =
      merged.investmentHorizonMonths ??
      getHorizonMonths(merged.purchaseDate, merged.withdrawalDate);
    merged.investmentHorizonMonths = horizonMonths;
    merged.withdrawalDate = getWithdrawalDateFromMonths(merged.purchaseDate, horizonMonths);
  }

  return merged;
}

export function getReverseCalculationTestInputs(inputs: BondInputs) {
  return {
    ...inputs,
    initialInvestment: REVERSE_CALCULATION_TEST_BASE,
  };
}

export function applyReverseSavingsGoal(inputs: BondInputs, simulatedNetPayoutValue: number) {
  if (inputs.calculatorMode !== 'reverse' || !inputs.savingsGoal) {
    return { ...inputs };
  }

  const netMultiplier = simulatedNetPayoutValue / REVERSE_CALCULATION_TEST_BASE;
  const bondPrice = inputs.isRebought ? 100 - (inputs.rebuyDiscount || 0) : 100;
  const requiredInvestmentRaw = inputs.savingsGoal / netMultiplier;
  const requiredBonds = Math.ceil(requiredInvestmentRaw / bondPrice);

  return {
    ...inputs,
    initialInvestment: requiredBonds * bondPrice,
  };
}

export function isMacroAssumptionInputKey(key: string) {
  return MACRO_ASSUMPTION_INPUT_KEYS.has(key);
}

interface SelectedSeriesInputUpdate {
  seriesId: string | null;
  inputs: BondInputs;
  definitions: typeof BOND_DEFINITIONS;
  availableSeries: BondSeriesMetadata[];
}

export function resolveSelectedSeriesInputUpdate({
  seriesId,
  inputs,
  definitions,
  availableSeries,
}: SelectedSeriesInputUpdate): BondInputs | null {
  if (seriesId === 'current') {
    const definition = definitions[inputs.bondType];
    return {
      ...inputs,
      firstYearRate: definition.firstYearRate,
      margin: definition.margin,
    };
  }

  const series = availableSeries.find((item) => item.id === seriesId);
  if (!series) {
    return null;
  }

  return {
    ...inputs,
    firstYearRate: Number(series.firstYearRate),
    margin: Number(series.baseMargin),
    purchaseDate: series.emissionMonth,
    withdrawalDate: getWithdrawalDateFromMonths(
      series.emissionMonth,
      inputs.investmentHorizonMonths ?? Math.round(inputs.duration * 12),
    ),
  };
}

export function resolveBondTypeInputUpdate(
  previous: BondInputs,
  type: BondType,
  definition: (typeof BOND_DEFINITIONS)[BondType],
  horizonChoice: 'preserve' | 'native' = 'preserve',
) {
  const previousHorizonMonths = getHorizonMonths(previous.purchaseDate, previous.withdrawalDate);
  const fallbackHorizonMonths = Math.round(definition.duration * 12);
  const nextHorizonMonths =
    horizonChoice === 'native'
      ? fallbackHorizonMonths
      : Math.max(previousHorizonMonths, fallbackHorizonMonths);

  return {
    ...previous,
    bondType: type,
    duration: definition.duration,
    firstYearRate: definition.firstYearRate,
    margin: definition.margin,
    earlyWithdrawalFee: definition.earlyWithdrawalFee,
    isCapitalized: definition.isCapitalized,
    payoutFrequency: definition.payoutFrequency,
    withdrawalDate: getWithdrawalDateFromMonths(previous.purchaseDate, nextHorizonMonths),
    rebuyDiscount: definition.rebuyDiscount,
    isRebought: false,
    investmentHorizonMonths: nextHorizonMonths,
    nominalValue: definition.nominalValue,
    isInflationIndexed: definition.isInflationIndexed,
  };
}

function extendCustomRatePaths(inputs: BondInputs) {
  const years = Math.max(1, Math.ceil((inputs.investmentHorizonMonths ?? 12) / 12));

  if (inputs.customInflation) {
    inputs.customInflation = Array.from(
      { length: years },
      (_, index) => inputs.customInflation?.[index] ?? inputs.expectedInflation,
    );
  }

  if (inputs.customNbpRate) {
    inputs.customNbpRate = Array.from(
      { length: years },
      (_, index) => inputs.customNbpRate?.[index] ?? inputs.expectedNbpRate ?? 5.25,
    );
  }
}
