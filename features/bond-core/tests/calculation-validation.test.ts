import { beforeEach, describe, expect, it, vi } from 'vitest';

import { calculationService } from '@/lib/server/calculation/composition';

import { BOND_DEFINITIONS } from '../constants/bond-definitions';
import {
  BondInputs,
  BondType,
  InterestPayout,
  RegularInvestmentInputs,
  TaxStrategy,
} from '../types';
import { normalizeCalculationScenarioRequest, ScenarioKind } from '../types/scenarios';
import {
  BondComparisonScenarioPayloadSchema,
  BondInputsSchema,
  BondOptimizerPayloadSchema,
  parseCalculationScenarioRequest,
  PortfolioSimulationPayloadSchema,
  RegularInvestmentInputsSchema,
  RetirementPlannerPayloadSchema,
} from '../types/schemas';
import { calculationCache } from '../utils/calculation-cache';

vi.mock('@/lib/data/market-data', async () => {
  const { BOND_DEFINITIONS: runtimeDefinitions } = await import('../constants/bond-definitions');

  return {
    getHistoricalDataMap: vi.fn().mockResolvedValue({}),
    getBondDefinitions: vi.fn().mockResolvedValue(Object.values(runtimeDefinitions)),
    getBondDefinitionsMap: vi.fn().mockResolvedValue(runtimeDefinitions),
    getGlobalDataFreshness: vi.fn().mockResolvedValue({
      status: 'fresh',
      asOf: '2026-05',
      lastCheck: '2026-05-30T00:00:00.000Z',
      usedFallback: false,
    }),
    getTaxRulesRevision: vi.fn().mockResolvedValue('tax-rules-2026'),
    getHistoricalAverages: vi.fn().mockResolvedValue({
      inflation: { '1y': 3, '5y': 3, '10y': 3 },
      nbpRate: { '1y': 5, '5y': 5, '10y': 5 },
    }),
    getTaxRulesForYear: vi.fn().mockResolvedValue({
      ikeLimit: '999999.00',
      ikzeLimit: '999999.00',
    }),
    getMultiAssetHistory: vi.fn(),
  };
});

const baseDefinition = BOND_DEFINITIONS[BondType.EDO];

function singlePayload(overrides: Partial<BondInputs> = {}) {
  return {
    bondType: BondType.EDO,
    initialInvestment: 10000,
    firstYearRate: baseDefinition.firstYearRate,
    expectedInflation: 3,
    expectedNbpRate: 5,
    margin: baseDefinition.margin,
    duration: baseDefinition.duration,
    earlyWithdrawalFee: baseDefinition.earlyWithdrawalFee,
    taxRate: 19,
    isCapitalized: baseDefinition.isCapitalized,
    payoutFrequency: baseDefinition.payoutFrequency,
    purchaseDate: '2026-05-30',
    withdrawalDate: '2036-05-30',
    isRebought: false,
    rebuyDiscount: baseDefinition.rebuyDiscount,
    taxStrategy: TaxStrategy.STANDARD,
    timingMode: 'exact' as const,
    investmentHorizonMonths: 120,
    ...overrides,
  };
}

function regularPayload(overrides: Partial<RegularInvestmentInputs> = {}) {
  return {
    contributionAmount: 1000,
    frequency: 'MONTHLY' as const,
    investmentHorizonMonths: 48,
    bondType: BondType.COI,
    firstYearRate: BOND_DEFINITIONS[BondType.COI].firstYearRate,
    expectedInflation: 3,
    expectedNbpRate: 5,
    margin: BOND_DEFINITIONS[BondType.COI].margin,
    duration: BOND_DEFINITIONS[BondType.COI].duration,
    earlyWithdrawalFee: BOND_DEFINITIONS[BondType.COI].earlyWithdrawalFee,
    taxRate: 19,
    isCapitalized: BOND_DEFINITIONS[BondType.COI].isCapitalized,
    payoutFrequency: BOND_DEFINITIONS[BondType.COI].payoutFrequency,
    purchaseDate: '2026-05-30',
    withdrawalDate: '2030-05-30',
    isRebought: false,
    rebuyDiscount: BOND_DEFINITIONS[BondType.COI].rebuyDiscount,
    taxStrategy: TaxStrategy.STANDARD,
    timingMode: 'general' as const,
    ...overrides,
  };
}

function expectInvalid(schemaName: string, parse: () => unknown) {
  expect(parse, schemaName).toThrow();
}

describe('calculation request validation hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calculationCache.clear();
  });

  it('rejects non-finite single-bond values instead of sanitizing them', () => {
    expectInvalid('infinite investment', () =>
      BondInputsSchema.parse(singlePayload({ initialInvestment: Number.POSITIVE_INFINITY })),
    );
    expectInvalid('nan inflation', () =>
      BondInputsSchema.parse(singlePayload({ expectedInflation: Number.NaN })),
    );
    expectInvalid('nan path', () =>
      BondInputsSchema.parse(
        singlePayload({
          customInflation: [3, Number.NaN, 3, 3, 3, 3, 3, 3, 3, 3],
        }),
      ),
    );
  });

  it('rejects negative monetary values across every calculator payload', () => {
    expectInvalid('negative single-bond investment', () =>
      BondInputsSchema.parse(singlePayload({ initialInvestment: -100 })),
    );
    expectInvalid('negative savings goal', () =>
      BondInputsSchema.parse(singlePayload({ savingsGoal: -1 })),
    );
    expectInvalid('negative regular contribution', () =>
      RegularInvestmentInputsSchema.parse(regularPayload({ contributionAmount: -100 })),
    );
    expectInvalid('negative comparison investment', () =>
      BondComparisonScenarioPayloadSchema.parse({
        mode: 'normalized',
        bondTypes: [BondType.EDO],
        initialInvestment: -100,
        purchaseDate: '2026-05-30',
        withdrawalDate: '2028-05-30',
        expectedInflation: 3,
      }),
    );
    expectInvalid('negative optimizer investment', () =>
      BondOptimizerPayloadSchema.parse({
        initialInvestment: -100,
        purchaseDate: '2026-05-30',
        investmentHorizonMonths: 24,
        expectedInflation: 3,
      }),
    );
    expectInvalid('negative retirement capital', () =>
      RetirementPlannerPayloadSchema.parse({
        initialCapital: -100,
        monthlyWithdrawal: 2500,
        expectedInflation: 3,
        bondType: BondType.EDO,
        horizonYears: 20,
      }),
    );
    expectInvalid('negative portfolio lot amount', () =>
      PortfolioSimulationPayloadSchema.parse({
        investments: [{ bondType: BondType.EDO, amount: -100, purchaseDate: '2026-05-30' }],
        expectedInflation: 3,
        withdrawalDate: '2028-05-30',
      }),
    );
  });

  it('rejects legacy normalized reinvest rather than silently ignoring its policy', () => {
    expectInvalid('unsupported normalized reinvest', () =>
      BondComparisonScenarioPayloadSchema.parse({
        mode: 'normalized',
        bondTypes: [BondType.EDO, BondType.ROR],
        initialInvestment: 10000,
        purchaseDate: '2026-05-30',
        withdrawalDate: '2028-05-30',
        expectedInflation: 3,
        reinvest: false,
      }),
    );
  });

  it('rejects date order and impossible horizon combinations', () => {
    expectInvalid('exact date just beyond the maximum horizon', () =>
      BondInputsSchema.parse(
        singlePayload({
          purchaseDate: '2026-01-31',
          withdrawalDate: '2056-02-01',
          investmentHorizonMonths: undefined,
        }),
      ),
    );
    expectInvalid('optimizer reversed dates', () =>
      BondOptimizerPayloadSchema.parse({
        initialInvestment: 1000,
        purchaseDate: '2027-01-01',
        withdrawalDate: '2026-01-01',
        expectedInflation: 3,
      }),
    );
    expectInvalid('retirement tax mode omitted', () =>
      RetirementPlannerPayloadSchema.parse({
        initialCapital: 100,
        monthlyWithdrawal: 10,
        expectedInflation: 3,
        bondType: BondType.EDO,
        horizonYears: 1,
      }),
    );
    expectInvalid('unsupported retirement family', () =>
      RetirementPlannerPayloadSchema.parse({
        initialCapital: 100,
        monthlyWithdrawal: 10,
        expectedInflation: 3,
        bondType: BondType.ROS,
        taxStrategy: TaxStrategy.STANDARD,
        horizonYears: 1,
      }),
    );
    expectInvalid('reversed dates', () =>
      BondInputsSchema.parse(
        singlePayload({
          purchaseDate: '2030-01-01',
          withdrawalDate: '2029-01-01',
        }),
      ),
    );
    expectInvalid('fractional horizon', () =>
      BondInputsSchema.parse(singlePayload({ investmentHorizonMonths: 12.5 })),
    );
    expectInvalid('too long regular horizon', () =>
      RegularInvestmentInputsSchema.parse(regularPayload({ investmentHorizonMonths: 601 })),
    );
    expectInvalid('independent override reverses effective dates', () =>
      BondComparisonScenarioPayloadSchema.parse({
        mode: 'independent',
        sharedConfig: {
          initialInvestment: 10000,
          purchaseDate: '2026-01-01',
          withdrawalDate: '2028-01-01',
          investmentHorizonMonths: 24,
          timingMode: 'exact',
          expectedInflation: 3,
        },
        scenarioA: { bondType: BondType.EDO, purchaseDate: '2029-01-01' },
        scenarioB: { bondType: BondType.ROR },
      }),
    );
    expectInvalid('optimizer conflicting date and horizon', () =>
      BondOptimizerPayloadSchema.parse({
        initialInvestment: 1000,
        purchaseDate: '2026-01-01',
        withdrawalDate: '2028-01-01',
        investmentHorizonMonths: 12,
        expectedInflation: 3,
      }),
    );
  });

  it('rejects independent overrides that would be silently rewritten', () => {
    const sharedConfig = {
      initialInvestment: 10000,
      purchaseDate: '2026-01-01',
      withdrawalDate: '2028-01-01',
      investmentHorizonMonths: 24,
      timingMode: 'general',
      expectedInflation: 3,
    };
    const scenarioB = { bondType: BondType.ROR };
    for (const scenarioA of [
      { bondType: BondType.EDO, withdrawalDate: '2027-01-01' },
      { bondType: BondType.EDO, timingMode: 'exact' },
      { bondType: BondType.EDO, investmentHorizonMonths: 12, withdrawalDate: '2029-01-01' },
      { bondType: BondType.EDO, investmentHorizonMonths: 12, timingMode: 'exact' },
    ]) {
      expectInvalid('rewritten independent override', () =>
        BondComparisonScenarioPayloadSchema.parse({
          mode: 'independent',
          sharedConfig,
          scenarioA,
          scenarioB,
        }),
      );
    }
  });

  it('rejects unknown comparison policy fields instead of silently stripping them', () => {
    const sharedConfig = {
      initialInvestment: 10000,
      purchaseDate: '2026-01-01',
      withdrawalDate: '2028-01-01',
      investmentHorizonMonths: 24,
      expectedInflation: 3,
    };
    const independent = {
      mode: 'independent',
      sharedConfig,
      scenarioA: { bondType: BondType.EDO },
      scenarioB: { bondType: BondType.ROR },
    };
    expect(
      BondComparisonScenarioPayloadSchema.safeParse({
        ...independent,
        rollover: false,
      }).success,
    ).toBe(false);
    expect(
      BondComparisonScenarioPayloadSchema.safeParse({
        ...independent,
        sharedConfig: { ...sharedConfig, reinvest: false },
      }).success,
    ).toBe(false);
    expect(
      BondComparisonScenarioPayloadSchema.safeParse({
        mode: 'normalized',
        bondTypes: [BondType.EDO],
        initialInvestment: 10000,
        purchaseDate: '2026-01-01',
        withdrawalDate: '2028-01-01',
        expectedInflation: 3,
        rollover: false,
      }).success,
    ).toBe(false);
  });

  it('rejects unmodeled policy fields in portfolio, optimizer and retirement requests', () => {
    expect(
      PortfolioSimulationPayloadSchema.safeParse({
        investments: [
          {
            bondType: BondType.EDO,
            amount: 100,
            purchaseDate: '2026-01-01',
            strategyPolicy: 'cash_after_maturity',
          },
        ],
        expectedInflation: 3,
        withdrawalDate: '2027-01-01',
      }).success,
    ).toBe(false);
    expect(
      BondOptimizerPayloadSchema.safeParse({
        initialInvestment: 1000,
        purchaseDate: '2026-01-01',
        investmentHorizonMonths: 12,
        expectedInflation: 3,
        rollover: false,
      }).success,
    ).toBe(false);
    expect(
      RetirementPlannerPayloadSchema.safeParse({
        initialCapital: 10000,
        monthlyWithdrawal: 100,
        expectedInflation: 3,
        bondType: BondType.EDO,
        taxStrategy: TaxStrategy.STANDARD,
        horizonYears: 10,
        rollover: false,
      }).success,
    ).toBe(false);
  });

  it('accepts a valid exact partial month under a one-month work horizon', () => {
    expect(
      BondInputsSchema.safeParse(
        singlePayload({
          purchaseDate: '2026-05-01',
          withdrawalDate: '2026-05-15',
          investmentHorizonMonths: 1,
        }),
      ).success,
    ).toBe(true);
    expect(
      BondOptimizerPayloadSchema.safeParse({
        initialInvestment: 1000,
        purchaseDate: '2026-05-01',
        withdrawalDate: '2026-05-15',
        investmentHorizonMonths: 1,
        expectedInflation: 3,
      }).success,
    ).toBe(true);
  });

  it.each(['2026-02-30', '2025-02-29', '2026-13-01', '2026-01-01T00:00:00Z'])(
    'rejects non-calendar calculation date %s',
    (purchaseDate) => {
      expectInvalid(`invalid calculation date ${purchaseDate}`, () =>
        BondInputsSchema.parse(singlePayload({ purchaseDate })),
      );
    },
  );

  it('rejects custom CPI and NBP paths that do not match the scenario horizon', () => {
    expectInvalid('single CPI path too short', () =>
      BondInputsSchema.parse(singlePayload({ customInflation: [3, 3] })),
    );
    expectInvalid('single NBP path too short', () =>
      BondInputsSchema.parse(singlePayload({ customNbpRate: [5, 5] })),
    );
    expectInvalid('regular CPI path too short', () =>
      RegularInvestmentInputsSchema.parse(regularPayload({ customInflation: [3, 3] })),
    );
    expectInvalid('comparison CPI path too short', () =>
      BondComparisonScenarioPayloadSchema.parse({
        mode: 'normalized',
        bondTypes: [BondType.EDO, BondType.ROR],
        initialInvestment: 10000,
        purchaseDate: '2026-05-30',
        withdrawalDate: '2036-05-30',
        expectedInflation: 3,
        expectedNbpRate: 5,
        customInflation: [3, 3],
        taxStrategy: TaxStrategy.STANDARD,
      }),
    );
  });

  it('accepts exact custom paths that match the scenario horizon', () => {
    expect(
      BondInputsSchema.parse(
        singlePayload({
          customInflation: Array.from({ length: 10 }, () => 3),
          customNbpRate: Array.from({ length: 10 }, () => 5),
        }),
      ).customInflation,
    ).toHaveLength(10);

    expect(
      RegularInvestmentInputsSchema.parse(
        regularPayload({
          customInflation: Array.from({ length: 4 }, () => 3),
        }),
      ).customInflation,
    ).toHaveLength(4);
  });

  it('strips legacy chart granularity from single-bond calculation requests', () => {
    const parsed = BondInputsSchema.parse({
      ...singlePayload(),
      chartStep: 'monthly',
    });

    expect('chartStep' in parsed).toBe(false);
  });

  it('strips legacy chart granularity during full single-bond request parsing', () => {
    const parsed = parseCalculationScenarioRequest({
      kind: ScenarioKind.SINGLE_BOND,
      payload: {
        ...singlePayload(),
        chartStep: 'quarterly',
      },
    });

    expect(parsed.kind).toBe(ScenarioKind.SINGLE_BOND);
    if (parsed.kind !== ScenarioKind.SINGLE_BOND) {
      throw new Error('expected single-bond request');
    }
    expect('chartStep' in parsed.payload).toBe(false);
    expect('firstYearRate' in parsed.payload).toBe(false);
    expect('duration' in parsed.payload).toBe(false);
    expect('earlyWithdrawalFee' in parsed.payload).toBe(false);
  });

  it('makes a legacy retirement request time-explicit before cache identity', () => {
    const request = normalizeCalculationScenarioRequest(
      {
        kind: ScenarioKind.RETIREMENT_PLANNER,
        payload: {
          initialCapital: 500000,
          monthlyWithdrawal: 2500,
          expectedInflation: 3,
          bondType: BondType.EDO,
          taxStrategy: TaxStrategy.STANDARD,
          horizonYears: 20,
        },
      },
      '2026-05-30',
    );

    expect((request.payload as { projectionStartDate?: string }).projectionStartDate).toBe(
      '2026-05-30',
    );
  });

  it('keeps regular investment intent independent from display and issuer fields', () => {
    const parsed = parseCalculationScenarioRequest({
      kind: ScenarioKind.REGULAR_INVESTMENT,
      payload: {
        ...regularPayload(),
        chartStep: 'yearly',
        firstYearRate: 99,
        margin: 99,
        duration: 99,
        earlyWithdrawalFee: 99,
      },
    });

    if (parsed.kind !== ScenarioKind.REGULAR_INVESTMENT) {
      throw new Error('expected regular-investment request');
    }
    expect('chartStep' in parsed.payload).toBe(false);
    expect('firstYearRate' in parsed.payload).toBe(false);
    expect('margin' in parsed.payload).toBe(false);
    expect('duration' in parsed.payload).toBe(false);
    expect('earlyWithdrawalFee' in parsed.payload).toBe(false);
  });

  it('rejects optimizer requests without any horizon definition', () => {
    expectInvalid('optimizer missing horizon', () =>
      BondOptimizerPayloadSchema.parse({
        initialInvestment: 10000,
        purchaseDate: '2026-05-30',
        expectedInflation: 3,
        expectedNbpRate: 5,
        taxStrategy: TaxStrategy.STANDARD,
      }),
    );
  });

  it('rejects empty portfolio simulation and lots after the withdrawal date', () => {
    expectInvalid('empty portfolio simulation', () =>
      PortfolioSimulationPayloadSchema.parse({
        investments: [],
        expectedInflation: 3,
        expectedNbpRate: 5,
        withdrawalDate: '2030-05-30',
      }),
    );
    expectInvalid('lot after withdrawal date', () =>
      PortfolioSimulationPayloadSchema.parse({
        investments: [
          {
            bondType: BondType.EDO,
            amount: 10000,
            purchaseDate: '2031-05-30',
          },
        ],
        expectedInflation: 3,
        expectedNbpRate: 5,
        withdrawalDate: '2030-05-30',
      }),
    );
  });

  it('rejects retirement scenarios with zero capital or zero withdrawal', () => {
    expectInvalid('zero retirement capital', () =>
      RetirementPlannerPayloadSchema.parse({
        initialCapital: 0,
        monthlyWithdrawal: 2500,
        expectedInflation: 3,
        expectedNbpRate: 5,
        bondType: BondType.EDO,
        taxStrategy: TaxStrategy.STANDARD,
        horizonYears: 20,
      }),
    );
    expectInvalid('zero retirement withdrawal', () =>
      RetirementPlannerPayloadSchema.parse({
        initialCapital: 500000,
        monthlyWithdrawal: 0,
        expectedInflation: 3,
        expectedNbpRate: 5,
        bondType: BondType.EDO,
        taxStrategy: TaxStrategy.STANDARD,
        horizonYears: 20,
      }),
    );
  });

  it('rejects portfolio work beyond the lot-month budget before calculation', () => {
    expectInvalid('portfolio workload', () =>
      PortfolioSimulationPayloadSchema.parse({
        investments: Array.from({ length: 100 }, () => ({
          bondType: BondType.ROR,
          amount: 100,
          purchaseDate: '2026-01-01',
        })),
        expectedInflation: 3,
        withdrawalDate: '2046-01-01',
      }),
    );
    expectInvalid('portfolio exact-date bypass', () =>
      PortfolioSimulationPayloadSchema.parse({
        investments: [{ bondType: BondType.ROR, amount: 100, purchaseDate: '2026-01-01' }],
        expectedInflation: 3,
        withdrawalDate: '2056-01-02',
      }),
    );
  });

  it('validates the full discriminated calculation request before service execution', async () => {
    const parsed = parseCalculationScenarioRequest({
      kind: ScenarioKind.SINGLE_BOND,
      payload: singlePayload(),
    });

    expect(parsed.kind).toBe(ScenarioKind.SINGLE_BOND);

    await expect(
      calculationService.calculate({
        kind: ScenarioKind.SINGLE_BOND,
        payload: singlePayload({ initialInvestment: Number.POSITIVE_INFINITY }),
      }),
    ).rejects.toThrow();
  });

  it('rejects invalid enum and unsupported payout values', () => {
    expectInvalid('invalid bond type', () =>
      BondInputsSchema.parse(singlePayload({ bondType: 'BAD' as BondType })),
    );
    expectInvalid('invalid payout value', () =>
      BondInputsSchema.parse(singlePayload({ payoutFrequency: 'DAILY' as InterestPayout })),
    );
  });

  it('requires unique mixed-allocation targets totaling 100 percent', () => {
    expectInvalid('underallocated targets', () =>
      RegularInvestmentInputsSchema.parse(
        regularPayload({
          allocationTargets: [
            { bondType: BondType.COI, percent: 40 },
            { bondType: BondType.EDO, percent: 40 },
          ],
        }),
      ),
    );
    expect(
      RegularInvestmentInputsSchema.parse(
        regularPayload({
          allocationTargets: [
            { bondType: BondType.COI, percent: 50 },
            { bondType: BondType.EDO, percent: 50 },
          ],
        }),
      ).allocationTargets,
    ).toHaveLength(2);
  });
});
