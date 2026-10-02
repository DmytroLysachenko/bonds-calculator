import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import {
  BondType,
  InterestPayout,
  InvestmentFrequency,
  RegularInvestmentInputs,
  TaxStrategy,
} from '@/features/bond-core/types';
import {
  getHorizonMonths,
  getWithdrawalDateFromMonths,
  toDateString,
} from '@/shared/lib/date-timing';

const DEFAULT_BOND = BondType.EDO;
const DEFAULT_HORIZON_YEARS = 10;
const DEFAULT_HORIZON_MONTHS = DEFAULT_HORIZON_YEARS * 12;
const MACRO_ASSUMPTION_INPUT_KEYS = new Set([
  'expectedInflation',
  'expectedNbpRate',
  'customInflation',
  'customNbpRate',
  'inflationScenario',
]);

export function buildRegularInvestmentFallbackInputs(now = new Date()): RegularInvestmentInputs {
  const purchaseDate = toDateString(now);

  return {
    bondType: DEFAULT_BOND,
    contributionAmount: 1000,
    frequency: InvestmentFrequency.MONTHLY,
    investmentHorizonMonths: DEFAULT_HORIZON_MONTHS,
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
    withdrawalDate: getWithdrawalDateFromMonths(purchaseDate, DEFAULT_HORIZON_MONTHS),
    isRebought: false,
    rebuyDiscount: 0,
    taxStrategy: TaxStrategy.STANDARD,
    timingMode: 'general',
  };
}

export function applyRegularInvestmentDefinition(
  previous: RegularInvestmentInputs,
  definition: (typeof BOND_DEFINITIONS)[BondType],
): RegularInvestmentInputs {
  return {
    ...previous,
    firstYearRate: definition.firstYearRate,
    margin: definition.margin,
    duration: definition.duration,
    earlyWithdrawalFee: definition.earlyWithdrawalFee,
    isCapitalized: definition.isCapitalized,
    payoutFrequency: definition.payoutFrequency,
    rebuyDiscount: definition.rebuyDiscount,
    nominalValue: definition.nominalValue,
    isInflationIndexed: definition.isInflationIndexed,
  };
}

export function isRegularInvestmentMacroInputKey(key: keyof RegularInvestmentInputs) {
  return MACRO_ASSUMPTION_INPUT_KEYS.has(key);
}

export function normalizeRegularInvestmentInputs(
  base: RegularInvestmentInputs,
  nextPartial: Partial<RegularInvestmentInputs>,
) {
  const next = { ...base, ...nextPartial };

  if (nextPartial.investmentHorizonMonths !== undefined) {
    const months = Number(nextPartial.investmentHorizonMonths);
    next.investmentHorizonMonths = months;
    next.withdrawalDate = getWithdrawalDateFromMonths(base.purchaseDate, months);
    extendCustomRatePaths(next, base);
  }

  if (nextPartial.purchaseDate) {
    const months =
      base.investmentHorizonMonths ?? getHorizonMonths(base.purchaseDate, base.withdrawalDate);
    next.withdrawalDate = getWithdrawalDateFromMonths(String(nextPartial.purchaseDate), months);
  }

  if (nextPartial.withdrawalDate) {
    const months = getHorizonMonths(base.purchaseDate, String(nextPartial.withdrawalDate));
    next.investmentHorizonMonths = months;
    next.timingMode = 'exact';
    extendCustomRatePaths(next, base);
  }

  if (nextPartial.timingMode === 'general') {
    const months =
      base.investmentHorizonMonths ?? getHorizonMonths(base.purchaseDate, base.withdrawalDate);
    next.investmentHorizonMonths = months;
    next.withdrawalDate = getWithdrawalDateFromMonths(base.purchaseDate, months);
  }

  return next;
}

export function resolveRegularInvestmentBondTypeUpdate(
  previous: RegularInvestmentInputs,
  type: BondType,
  definition: (typeof BOND_DEFINITIONS)[BondType],
  horizonChoice: 'preserve' | 'native' = 'preserve',
) {
  const next = {
    ...previous,
    bondType: type,
    duration: definition.duration,
    firstYearRate: definition.firstYearRate,
    margin: definition.margin,
    earlyWithdrawalFee: definition.earlyWithdrawalFee,
    isCapitalized: definition.isCapitalized,
    payoutFrequency: definition.payoutFrequency,
    rebuyDiscount: definition.rebuyDiscount,
    isRebought: false,
    nominalValue: definition.nominalValue,
    isInflationIndexed: definition.isInflationIndexed,
  };
  if (horizonChoice === 'native') {
    next.investmentHorizonMonths = Math.round(definition.duration * 12);
    next.withdrawalDate = getWithdrawalDateFromMonths(
      previous.purchaseDate,
      next.investmentHorizonMonths,
    );
    extendCustomRatePaths(next, previous);
  }
  return next;
}

function extendCustomRatePaths(next: RegularInvestmentInputs, base: RegularInvestmentInputs) {
  const years = Math.max(1, Math.ceil((next.investmentHorizonMonths ?? 12) / 12));

  if (base.customInflation) {
    next.customInflation = Array.from(
      { length: years },
      (_, index) => base.customInflation?.[index] ?? base.expectedInflation,
    );
  }

  if (base.customNbpRate) {
    next.customNbpRate = Array.from(
      { length: years },
      (_, index) => base.customNbpRate?.[index] ?? base.expectedNbpRate ?? 5.25,
    );
  }
}
