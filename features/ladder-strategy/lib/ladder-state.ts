import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import {
  BondType,
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
const DEFAULT_DEFINITION = BOND_DEFINITIONS[DEFAULT_BOND];
const DEFAULT_HORIZON_YEARS = 10;
const DEFAULT_HORIZON_MONTHS = DEFAULT_HORIZON_YEARS * 12;
const MACRO_ASSUMPTION_INPUT_KEYS = new Set([
  'expectedInflation',
  'expectedNbpRate',
  'customInflation',
  'customNbpRate',
  'inflationScenario',
]);

export function buildDefaultLadderInputs(now = new Date()): RegularInvestmentInputs {
  const purchaseDate = toDateString(now);

  return {
    bondType: DEFAULT_BOND,
    contributionAmount: 1000,
    frequency: InvestmentFrequency.MONTHLY,
    investmentHorizonMonths: DEFAULT_HORIZON_MONTHS,
    firstYearRate: DEFAULT_DEFINITION.firstYearRate,
    expectedInflation: 3.5,
    margin: DEFAULT_DEFINITION.margin,
    duration: DEFAULT_DEFINITION.duration,
    earlyWithdrawalFee: DEFAULT_DEFINITION.earlyWithdrawalFee,
    taxRate: 19,
    isCapitalized: DEFAULT_DEFINITION.isCapitalized,
    payoutFrequency: DEFAULT_DEFINITION.payoutFrequency,
    purchaseDate,
    withdrawalDate: getWithdrawalDateFromMonths(purchaseDate, DEFAULT_HORIZON_MONTHS),
    isRebought: false,
    rebuyDiscount: DEFAULT_DEFINITION.rebuyDiscount,
    taxStrategy: TaxStrategy.STANDARD,
    timingMode: 'general',
  };
}

export function isLadderMacroInputKey(key: keyof RegularInvestmentInputs) {
  return MACRO_ASSUMPTION_INPUT_KEYS.has(key);
}

export function applyLadderBondDefinition(
  previous: RegularInvestmentInputs,
  definition: (typeof BOND_DEFINITIONS)[BondType],
) {
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

export function normalizeLadderInputs(
  previous: RegularInvestmentInputs,
  nextPartial: Partial<RegularInvestmentInputs>,
) {
  const next = { ...previous, ...nextPartial };

  if (nextPartial.investmentHorizonMonths !== undefined) {
    const months = Number(nextPartial.investmentHorizonMonths);
    next.investmentHorizonMonths = months;
    next.withdrawalDate = getWithdrawalDateFromMonths(previous.purchaseDate, months);
    extendCustomRatePaths(next, previous);
  }

  if (nextPartial.purchaseDate) {
    const months =
      previous.investmentHorizonMonths ??
      getHorizonMonths(previous.purchaseDate, previous.withdrawalDate);
    next.withdrawalDate = getWithdrawalDateFromMonths(String(nextPartial.purchaseDate), months);
  }

  if (nextPartial.withdrawalDate) {
    const months = getHorizonMonths(previous.purchaseDate, String(nextPartial.withdrawalDate));
    next.investmentHorizonMonths = months;
    next.timingMode = 'exact';
    extendCustomRatePaths(next, previous);
  }

  if (nextPartial.timingMode === 'general') {
    const months =
      previous.investmentHorizonMonths ??
      getHorizonMonths(previous.purchaseDate, previous.withdrawalDate);
    next.investmentHorizonMonths = months;
    next.withdrawalDate = getWithdrawalDateFromMonths(previous.purchaseDate, months);
  }

  return next;
}

export function resolveLadderBondTypeUpdate(
  previous: RegularInvestmentInputs,
  type: BondType,
  definitions?: Record<BondType, (typeof BOND_DEFINITIONS)[BondType]> | null,
  horizonChoice: 'preserve' | 'native' = 'preserve',
): RegularInvestmentInputs {
  const definition = definitions?.[type] ?? BOND_DEFINITIONS[type];

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

function extendCustomRatePaths(next: RegularInvestmentInputs, previous: RegularInvestmentInputs) {
  const years = Math.max(1, Math.ceil((next.investmentHorizonMonths ?? 12) / 12));

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
