import { addMonths, differenceInCalendarMonths, format, parseISO } from 'date-fns';
import { z } from 'zod';

import { BondType, InterestPayout, InvestmentFrequency, ScenarioKind, TaxStrategy } from './index';
import { BaseInstrumentInputsSchema } from './instruments';
import {
  customPathSchema,
  DateRangeInputsSchema,
  DateStringSchema,
  finiteNumber,
  HistoricalDataMapSchema,
  horizonMonths,
  money,
  percent,
  validatePathLengths,
  withDateOrderValidation,
} from './schema-primitives';

const ComparisonMaturityModeSchema = z.enum([
  'hold_to_maturity',
  'reinvest_until_horizon',
  'cash_after_maturity',
  'align_to_shorter_duration',
]);

function validateEffectiveHorizon(
  value: { purchaseDate: string; withdrawalDate: string; investmentHorizonMonths?: number },
  ctx: z.RefinementCtx,
  maximumMonths: number,
) {
  const dateMonths = Math.max(
    1,
    differenceInCalendarMonths(parseISO(value.withdrawalDate), parseISO(value.purchaseDate)),
  );
  if (
    parseISO(value.withdrawalDate).getTime() >
    addMonths(parseISO(value.purchaseDate), maximumMonths).getTime()
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['withdrawalDate'],
      message: `Effective calculation horizon must not exceed ${maximumMonths} months`,
    });
  }
  if (value.investmentHorizonMonths !== undefined && value.investmentHorizonMonths !== dateMonths) {
    ctx.addIssue({
      code: 'custom',
      path: ['investmentHorizonMonths'],
      message: 'investmentHorizonMonths must match the supplied calendar-date range',
    });
  }
}

export const BondInputsSchema = withDateOrderValidation(
  BaseInstrumentInputsSchema.extend({
    initialInvestment: money('initialInvestment', 100),
    firstYearRate: percent('firstYearRate', 0, 100),
    expectedInflation: percent('expectedInflation', -20, 100),
    expectedNbpRate: percent('expectedNbpRate', -10, 100).optional(),
    margin: percent('margin', 0, 20),
    duration: finiteNumber('duration').min(0.25).max(30),
    earlyWithdrawalFee: money('earlyWithdrawalFee', 0, 10),
    taxRate: percent('taxRate', 0, 100),
    bondType: z.nativeEnum(BondType),
    isCapitalized: z.boolean(),
    payoutFrequency: z.nativeEnum(InterestPayout),
    isRebought: z.boolean(),
    rebuyDiscount: money('rebuyDiscount', 0, 1),
    taxStrategy: z.nativeEnum(TaxStrategy),
    savingsGoal: money('savingsGoal', 0).optional(),
    historicalData: HistoricalDataMapSchema,
    customInflation: customPathSchema('customInflation', -20, 100),
    customNbpRate: customPathSchema('customNbpRate', -10, 100),
    rollover: z.boolean().optional(),
    couponDisposition: z.enum(['reinvest', 'cash']).optional(),
    timingMode: z.enum(['general', 'exact']).optional(),
    investmentHorizonMonths: horizonMonths(360).optional(),
    useTaxWrapperLimit: z.boolean().optional(),
    inflationScenario: z.enum(['low', 'base', 'high']).optional(),
    selectedSeriesId: z.string().uuid().nullable().optional(),
  }),
).superRefine((value, ctx) => {
  validateEffectiveHorizon(value, ctx, 360);
  validatePathLengths(
    value,
    Math.max(
      1,
      differenceInCalendarMonths(parseISO(value.withdrawalDate), parseISO(value.purchaseDate)),
    ) / 12,
    ctx,
  );
});

/** HTTP/share-link compatibility decoder: drops issuer-controlled legacy keys. */
export const SingleBondCalculationIntentSchema = withDateOrderValidation(
  BaseInstrumentInputsSchema.extend({
    initialInvestment: money('initialInvestment', 100),
    bondType: z.nativeEnum(BondType),
    expectedInflation: percent('expectedInflation', -20, 100),
    expectedNbpRate: percent('expectedNbpRate', -10, 100).optional(),
    isRebought: z.boolean(),
    taxStrategy: z.nativeEnum(TaxStrategy),
    savingsGoal: money('savingsGoal', 0).optional(),
    customInflation: customPathSchema('customInflation', -20, 100),
    customNbpRate: customPathSchema('customNbpRate', -10, 100),
    rollover: z.boolean().optional(),
    // These strategy fields belong to comparison; accepting them here would
    // silently discard a user's requested cash policy.
    couponDisposition: z.never().optional(),
    strategyPolicy: z.never().optional(),
    timingMode: z.enum(['general', 'exact']).optional(),
    investmentHorizonMonths: horizonMonths(360).optional(),
    useTaxWrapperLimit: z.boolean().optional(),
    inflationScenario: z.enum(['low', 'base', 'high']).optional(),
    selectedSeriesId: z.string().uuid().nullable().optional(),
  }),
).superRefine((value, ctx) => {
  validateEffectiveHorizon(value, ctx, 360);
  validatePathLengths(
    value,
    Math.max(
      1,
      differenceInCalendarMonths(parseISO(value.withdrawalDate), parseISO(value.purchaseDate)),
    ) / 12,
    ctx,
  );
});

export const RegularInvestmentInputsSchema = withDateOrderValidation(
  DateRangeInputsSchema.extend({
    contributionAmount: money('contributionAmount', 100, 10_000_000),
    initialLumpSum: money('initialLumpSum', 0, 10_000_000).optional(),
    annualContributionIncreasePercent: percent(
      'annualContributionIncreasePercent',
      0,
      100,
    ).optional(),
    skippedContributionDates: z.array(DateStringSchema).max(120).optional(),
    oneOffContributions: z
      .array(z.object({ date: DateStringSchema, amount: money('amount', 0, 10_000_000) }))
      .max(120)
      .optional(),
    contributionOverrides: z
      .array(z.object({ date: DateStringSchema, amount: money('amount', 0, 10_000_000) }))
      .max(120)
      .optional(),
    allocationTargets: z
      .array(z.object({ bondType: z.nativeEnum(BondType), percent: percent('percent', 0, 100) }))
      .min(2)
      .max(3)
      .optional(),
    cashBenchmark: z
      .object({
        annualRate: percent('annualRate', 0, 100),
        capitalization: z.enum(['monthly', 'yearly']),
        taxRate: percent('taxRate', 0, 100),
      })
      .optional(),
    frequency: z.nativeEnum(InvestmentFrequency),
    investmentHorizonMonths: horizonMonths(600),
    bondType: z.nativeEnum(BondType),
    firstYearRate: percent('firstYearRate', 0, 100),
    expectedInflation: percent('expectedInflation', -20, 100),
    expectedNbpRate: percent('expectedNbpRate', -10, 100).optional(),
    margin: percent('margin', 0, 20),
    duration: finiteNumber('duration').min(0.25).max(30),
    earlyWithdrawalFee: money('earlyWithdrawalFee', 0, 10),
    taxRate: percent('taxRate', 0, 100),
    isCapitalized: z.boolean(),
    payoutFrequency: z.nativeEnum(InterestPayout),
    isRebought: z.boolean(),
    rebuyDiscount: money('rebuyDiscount', 0, 1),
    taxStrategy: z.nativeEnum(TaxStrategy),
    savingsGoal: money('savingsGoal', 0).optional(),
    historicalData: HistoricalDataMapSchema,
    inflationScenario: z.enum(['low', 'base', 'high']).optional(),
    customInflation: customPathSchema('customInflation', -20, 100),
    customNbpRate: customPathSchema('customNbpRate', -10, 100),
    rollover: z.boolean().optional(),
    timingMode: z.enum(['general', 'exact']).optional(),
  }),
).superRefine((value, ctx) => {
  validateEffectiveHorizon(value, ctx, 600);
  validatePathLengths(value, value.investmentHorizonMonths / 12, ctx);
  if (value.allocationTargets) {
    const total = value.allocationTargets.reduce((sum, target) => sum + target.percent, 0);
    if (
      Math.abs(total - 100) > 0.0001 ||
      new Set(value.allocationTargets.map((target) => target.bondType)).size !==
        value.allocationTargets.length
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['allocationTargets'],
        message: 'Allocation targets must be unique and total 100%',
      });
    }
  }
});

export const RegularInvestmentCalculationIntentSchema = withDateOrderValidation(
  DateRangeInputsSchema.extend({
    contributionAmount: money('contributionAmount', 100, 10_000_000),
    initialLumpSum: money('initialLumpSum', 0, 10_000_000).optional(),
    annualContributionIncreasePercent: percent(
      'annualContributionIncreasePercent',
      0,
      100,
    ).optional(),
    skippedContributionDates: z.array(DateStringSchema).max(120).optional(),
    oneOffContributions: z
      .array(z.object({ date: DateStringSchema, amount: money('amount', 0, 10_000_000) }))
      .max(120)
      .optional(),
    contributionOverrides: z
      .array(z.object({ date: DateStringSchema, amount: money('amount', 0, 10_000_000) }))
      .max(120)
      .optional(),
    allocationTargets: z
      .array(z.object({ bondType: z.nativeEnum(BondType), percent: percent('percent', 0, 100) }))
      .min(2)
      .max(3)
      .optional(),
    cashBenchmark: z
      .object({
        annualRate: percent('annualRate', 0, 100),
        capitalization: z.enum(['monthly', 'yearly']),
        taxRate: percent('taxRate', 0, 100),
      })
      .optional(),
    frequency: z.nativeEnum(InvestmentFrequency),
    investmentHorizonMonths: horizonMonths(600),
    bondType: z.nativeEnum(BondType),
    expectedInflation: percent('expectedInflation', -20, 100),
    expectedNbpRate: percent('expectedNbpRate', -10, 100).optional(),
    isRebought: z.boolean(),
    taxStrategy: z.nativeEnum(TaxStrategy),
    savingsGoal: money('savingsGoal', 0).optional(),
    inflationScenario: z.enum(['low', 'base', 'high']).optional(),
    customInflation: customPathSchema('customInflation', -20, 100),
    customNbpRate: customPathSchema('customNbpRate', -10, 100),
    rollover: z.boolean().optional(),
    couponDisposition: z.never().optional(),
    strategyPolicy: z.never().optional(),
    timingMode: z.enum(['general', 'exact']).optional(),
  }),
).superRefine((value, ctx) => {
  validateEffectiveHorizon(value, ctx, 600);
  validatePathLengths(value, value.investmentHorizonMonths / 12, ctx);
  if (value.allocationTargets) {
    const total = value.allocationTargets.reduce((sum, target) => sum + target.percent, 0);
    if (
      Math.abs(total - 100) > 0.0001 ||
      new Set(value.allocationTargets.map((target) => target.bondType)).size !==
        value.allocationTargets.length
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['allocationTargets'],
        message: 'Allocation targets must be unique and total 100%',
      });
    }
  }
});

const NormalizedBondComparisonPayloadSchema = withDateOrderValidation(
  z.strictObject({
    mode: z.literal('normalized').optional(),
    bondTypes: z.array(z.nativeEnum(BondType)).min(1).max(Object.keys(BondType).length),
    initialInvestment: money('initialInvestment', 100),
    purchaseDate: DateStringSchema,
    withdrawalDate: DateStringSchema,
    expectedInflation: percent('expectedInflation', -20, 100),
    expectedNbpRate: percent('expectedNbpRate', -10, 100).optional(),
    customInflation: customPathSchema('customInflation', -20, 100),
    customNbpRate: customPathSchema('customNbpRate', -10, 100),
    inflationScenario: z.enum(['low', 'base', 'high']).optional(),
    taxStrategy: z.nativeEnum(TaxStrategy).optional(),
    reinvest: z.boolean().optional(),
  }),
).superRefine((value, ctx) => {
  validateEffectiveHorizon(value, ctx, 360);
  if (value.reinvest === false) {
    ctx.addIssue({
      code: 'custom',
      path: ['reinvest'],
      message:
        'Legacy reinvest=false does not select a supported maturity policy; use independent strategyPolicy',
    });
  }
  const start = new Date(value.purchaseDate).getTime();
  const end = new Date(value.withdrawalDate).getTime();
  validatePathLengths(
    value,
    Math.max(1, Math.ceil((end - start) / (365.25 * 24 * 60 * 60 * 1000))),
    ctx,
  );
});

const ComparisonSharedConfigSchema = withDateOrderValidation(
  z.strictObject({
    initialInvestment: money('initialInvestment', 100),
    purchaseDate: DateStringSchema,
    withdrawalDate: DateStringSchema,
    expectedInflation: percent('expectedInflation', -20, 100),
    expectedNbpRate: percent('expectedNbpRate', -10, 100).optional(),
    customInflation: customPathSchema('customInflation', -20, 100),
    customNbpRate: customPathSchema('customNbpRate', -10, 100),
    inflationScenario: z.enum(['low', 'base', 'high']).optional(),
    taxStrategy: z.nativeEnum(TaxStrategy).optional(),
    timingMode: z.enum(['general', 'exact']).optional(),
    investmentHorizonMonths: horizonMonths(360).optional(),
    maturityMode: ComparisonMaturityModeSchema.optional(),
    strategyPolicy: z
      .enum(['hold_to_maturity', 'reinvest_until_horizon', 'cash_after_maturity'])
      .optional(),
    couponDisposition: z.enum(['reinvest', 'cash']).optional(),
  }),
).superRefine((value, ctx) => {
  validateEffectiveHorizon(value, ctx, 360);
  let horizonYears: number;
  if (value.investmentHorizonMonths) {
    horizonYears = value.investmentHorizonMonths / 12;
  } else {
    const start = new Date(value.purchaseDate).getTime();
    const end = new Date(value.withdrawalDate).getTime();
    horizonYears = Math.max(1, Math.ceil((end - start) / (365.25 * 24 * 60 * 60 * 1000)));
  }
  validatePathLengths(value, horizonYears, ctx);
});

const ComparisonScenarioOverrideSchema = z.strictObject({
  bondType: z.nativeEnum(BondType),
  selectedSeriesId: z.string().uuid().nullable().optional(),
  rollover: z.literal(false).optional(),
  isRebought: z.literal(false).optional(),
  taxStrategy: z.nativeEnum(TaxStrategy).optional(),
  strategyPolicy: z
    .enum(['hold_to_maturity', 'reinvest_until_horizon', 'cash_after_maturity'])
    .optional(),
  couponDisposition: z.enum(['reinvest', 'cash']).optional(),
  purchaseDate: DateStringSchema.optional(),
  withdrawalDate: DateStringSchema.optional(),
  timingMode: z.enum(['general', 'exact']).optional(),
  investmentHorizonMonths: horizonMonths(360).optional(),
});

const IndependentBondComparisonPayloadSchema = z
  .strictObject({
    mode: z.literal('independent'),
    sharedConfig: ComparisonSharedConfigSchema,
    scenarioA: ComparisonScenarioOverrideSchema,
    scenarioB: ComparisonScenarioOverrideSchema,
  })
  .superRefine((value, ctx) => {
    for (const key of ['scenarioA', 'scenarioB'] as const) {
      const scenario = value[key];
      if (
        scenario.investmentHorizonMonths === undefined &&
        (scenario.withdrawalDate !== undefined || scenario.timingMode !== undefined)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'An override withdrawal date or timing mode requires its own horizon',
        });
      }
      if (scenario.investmentHorizonMonths !== undefined && scenario.timingMode === 'exact') {
        ctx.addIssue({
          code: 'custom',
          path: [key, 'timingMode'],
          message: 'Override horizons use general timing',
        });
      }
      const purchaseDate = scenario.purchaseDate ?? value.sharedConfig.purchaseDate;
      const horizon =
        scenario.investmentHorizonMonths ?? value.sharedConfig.investmentHorizonMonths;
      const timingMode = scenario.timingMode ?? value.sharedConfig.timingMode ?? 'general';
      const withdrawalDate =
        scenario.withdrawalDate ??
        (timingMode === 'general' && horizon
          ? format(addMonths(parseISO(purchaseDate), horizon), 'yyyy-MM-dd')
          : value.sharedConfig.withdrawalDate);
      if (parseISO(withdrawalDate).getTime() < parseISO(purchaseDate).getTime()) {
        ctx.addIssue({
          code: 'custom',
          path: [key, 'withdrawalDate'],
          message: 'withdrawalDate must be on or after purchaseDate',
        });
      }
      if (parseISO(withdrawalDate).getTime() > addMonths(parseISO(purchaseDate), 360).getTime()) {
        ctx.addIssue({
          code: 'custom',
          path: [key, 'withdrawalDate'],
          message: 'Effective calculation horizon must not exceed 360 months',
        });
      }
      if (
        scenario.investmentHorizonMonths !== undefined &&
        scenario.withdrawalDate !== undefined &&
        scenario.withdrawalDate !==
          format(addMonths(parseISO(purchaseDate), scenario.investmentHorizonMonths), 'yyyy-MM-dd')
      ) {
        ctx.addIssue({
          code: 'custom',
          path: [key, 'withdrawalDate'],
          message: 'Override withdrawal date must match its horizon',
        });
      }
    }
  });

export const BondComparisonScenarioPayloadSchema = z.union([
  NormalizedBondComparisonPayloadSchema,
  IndependentBondComparisonPayloadSchema,
]);

export const BondComparisonScenarioRequestSchema = z.object({
  kind: z.literal(ScenarioKind.BOND_COMPARISON),
  payload: BondComparisonScenarioPayloadSchema,
});

export const RetirementPlannerPayloadSchema = z.strictObject({
  initialCapital: money('initialCapital', 1),
  monthlyWithdrawal: money('monthlyWithdrawal', 1, 10_000_000),
  expectedInflation: percent('expectedInflation', -20, 100),
  expectedNbpRate: percent('expectedNbpRate', -10, 100).optional(),
  bondType: z.nativeEnum(BondType),
  taxStrategy: z.nativeEnum(TaxStrategy),
  horizonYears: finiteNumber('horizonYears').int().min(1).max(50),
  projectionStartDate: DateStringSchema.optional(),
});

export const BondOptimizerPayloadSchema = z
  .strictObject({
    initialInvestment: money('initialInvestment', 100),
    purchaseDate: DateStringSchema,
    withdrawalDate: DateStringSchema.optional(),
    investmentHorizonMonths: horizonMonths(360).optional(),
    expectedInflation: percent('expectedInflation', -20, 100),
    expectedNbpRate: percent('expectedNbpRate', -10, 100).optional(),
    taxStrategy: z.nativeEnum(TaxStrategy).optional(),
    includeFamilyBonds: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.withdrawalDate && !value.investmentHorizonMonths) {
      ctx.addIssue({
        code: 'custom',
        path: ['withdrawalDate'],
        message: 'Either withdrawalDate or investmentHorizonMonths is required',
      });
    }
    if (value.withdrawalDate) {
      if (parseISO(value.withdrawalDate).getTime() < parseISO(value.purchaseDate).getTime()) {
        ctx.addIssue({
          code: 'custom',
          path: ['withdrawalDate'],
          message: 'withdrawalDate must be on or after purchaseDate',
        });
      }
      if (
        parseISO(value.withdrawalDate).getTime() >
        addMonths(parseISO(value.purchaseDate), 360).getTime()
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['withdrawalDate'],
          message: 'Effective calculation horizon must not exceed 360 months',
        });
      }
      if (
        value.investmentHorizonMonths !== undefined &&
        Math.max(
          1,
          differenceInCalendarMonths(parseISO(value.withdrawalDate), parseISO(value.purchaseDate)),
        ) !== value.investmentHorizonMonths
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['investmentHorizonMonths'],
          message: 'investmentHorizonMonths must match the supplied calendar-date range',
        });
      }
    }
  });

export const PortfolioSimulationPayloadSchema = z
  .strictObject({
    investments: z
      .array(
        z.strictObject({
          bondType: z.nativeEnum(BondType),
          amount: money('investment amount', 1),
          purchaseDate: DateStringSchema,
          selectedSeriesId: z.string().uuid().nullable().optional(),
          isRebought: z.boolean().optional(),
          taxStrategy: z.nativeEnum(TaxStrategy).optional(),
          rollover: z.boolean().optional(),
        }),
      )
      .min(1)
      .max(500),
    expectedInflation: percent('expectedInflation', -20, 100),
    expectedNbpRate: percent('expectedNbpRate', -10, 100).optional(),
    withdrawalDate: DateStringSchema,
  })
  .superRefine((value, ctx) => {
    let estimatedLotMonths = 0;
    for (const [index, investment] of value.investments.entries()) {
      if (new Date(value.withdrawalDate).getTime() < new Date(investment.purchaseDate).getTime()) {
        ctx.addIssue({
          code: 'custom',
          path: ['investments', index, 'purchaseDate'],
          message: 'investment purchaseDate must be on or before withdrawalDate',
        });
      }
      if (
        parseISO(value.withdrawalDate).getTime() >
        addMonths(parseISO(investment.purchaseDate), 360).getTime()
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['investments', index, 'purchaseDate'],
          message: 'Portfolio lot horizon must not exceed 360 months',
        });
      }
      estimatedLotMonths += Math.max(
        1,
        differenceInCalendarMonths(
          parseISO(value.withdrawalDate),
          parseISO(investment.purchaseDate),
        ) + 1,
      );
    }
    if (estimatedLotMonths > 12_000) {
      ctx.addIssue({
        code: 'custom',
        path: ['investments'],
        message: 'Portfolio workload exceeds the 12,000 lot-month budget',
      });
    }
  });

const CalculationScenarioRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal(ScenarioKind.SINGLE_BOND),
    payload: SingleBondCalculationIntentSchema,
  }),
  z.object({
    kind: z.literal(ScenarioKind.REGULAR_INVESTMENT),
    payload: RegularInvestmentCalculationIntentSchema,
  }),
  z.object({
    kind: z.literal(ScenarioKind.BOND_COMPARISON),
    payload: BondComparisonScenarioPayloadSchema,
  }),
  z.object({
    kind: z.literal(ScenarioKind.PORTFOLIO_SIMULATION),
    payload: PortfolioSimulationPayloadSchema,
  }),
  z.object({
    kind: z.literal(ScenarioKind.BOND_OPTIMIZER),
    payload: BondOptimizerPayloadSchema,
  }),
  z.object({
    kind: z.literal(ScenarioKind.RETIREMENT_PLANNER),
    payload: RetirementPlannerPayloadSchema,
  }),
]);

export function parseCalculationScenarioRequest(input: unknown) {
  return CalculationScenarioRequestSchema.parse(input);
}
