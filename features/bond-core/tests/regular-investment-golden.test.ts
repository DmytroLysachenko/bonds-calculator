import { differenceInMonths, parseISO } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { calculationService } from '@/lib/server/calculation/composition';
import { getWithdrawalDateFromMonths, toDateString } from '@/shared/lib/date-timing';

import { BOND_DEFINITIONS } from '../constants/bond-definitions';
import { BondType, InvestmentFrequency, RegularInvestmentResult, TaxStrategy } from '../types';
import { ScenarioKind } from '../types/scenarios';
import { calculationCache } from '../utils/calculation-cache';
import { calculateBondInvestment, calculateRegularInvestment } from '../utils/calculations';

const today = new Date('2026-05-05T00:00:00.000Z');

vi.mock('@/lib/data/market-data', async () => {
  const { BOND_DEFINITIONS: runtimeDefinitions } = await import('../constants/bond-definitions');

  const historicalMap: Record<string, { inflation?: number; nbpRate?: number }> = {};
  const baseDate = new Date('2026-05-05T00:00:00.000Z');

  for (let offset = -24; offset <= 180; offset += 1) {
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() + offset);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    historicalMap[key] = {
      inflation: 3 + (offset % 6) * 0.1,
      nbpRate: 5 + (offset % 4) * 0.15,
    };
  }

  return {
    getHistoricalDataMap: vi.fn().mockImplementation(async () => historicalMap),
    getBondDefinitions: vi.fn().mockResolvedValue(Object.values(runtimeDefinitions)),
    getBondDefinitionsMap: vi.fn().mockResolvedValue(runtimeDefinitions),
    getGlobalDataFreshness: vi.fn().mockResolvedValue({
      status: 'fresh',
      asOf: '2026-04',
      lastCheck: '2026-05-05T00:00:00.000Z',
      usedFallback: false,
    }),
    getTaxRulesRevision: vi.fn().mockResolvedValue('tax-rules-2026'),
    getHistoricalAverages: vi.fn().mockResolvedValue({
      inflation: { '1y': 3.2, '5y': 4.1, '10y': 3.6 },
      nbpRate: { '1y': 5.4, '5y': 4.7, '10y': 4.1 },
    }),
    getTaxRulesForYear: vi.fn().mockResolvedValue({
      ikeLimit: '999999.00',
      ikzeLimit: '999999.00',
    }),
    getMultiAssetHistory: vi.fn(),
  };
});

function buildRegularPayload(
  bondType: BondType,
  options: {
    frequency?: InvestmentFrequency;
    investmentHorizonMonths?: number;
    contributionAmount?: number;
    taxStrategy?: TaxStrategy;
    timingMode?: 'general' | 'exact';
    purchaseDate?: string;
    withdrawalDate?: string;
    rollover?: boolean;
  } = {},
) {
  const {
    frequency = InvestmentFrequency.MONTHLY,
    investmentHorizonMonths = 36,
    contributionAmount = 1000,
    taxStrategy = TaxStrategy.STANDARD,
    timingMode = 'general',
    purchaseDate = toDateString(today),
    withdrawalDate,
    rollover,
  } = options;

  const definition = BOND_DEFINITIONS[bondType];
  const resolvedWithdrawalDate =
    withdrawalDate ?? getWithdrawalDateFromMonths(purchaseDate, investmentHorizonMonths);

  return {
    contributionAmount,
    frequency,
    investmentHorizonMonths,
    bondType,
    firstYearRate: definition.firstYearRate,
    expectedInflation: 3.5,
    expectedNbpRate: 5.25,
    margin: definition.margin,
    duration: definition.duration,
    earlyWithdrawalFee: definition.earlyWithdrawalFee,
    taxRate: 19,
    isCapitalized: definition.isCapitalized,
    payoutFrequency: definition.payoutFrequency,
    purchaseDate,
    withdrawalDate: resolvedWithdrawalDate,
    isRebought: false,
    rebuyDiscount: definition.rebuyDiscount,
    taxStrategy,
    timingMode,
    rollover,
  };
}

async function getRegularResult(
  bondType: BondType,
  options?: Parameters<typeof buildRegularPayload>[1],
) {
  const envelope = await calculationService.calculate({
    kind: ScenarioKind.REGULAR_INVESTMENT,
    payload: buildRegularPayload(bondType, options),
  });

  return envelope.result as RegularInvestmentResult;
}

describe('Regular investment golden regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calculationCache.clear();
  });

  it('keeps TOS frequency scenarios ordered by contribution cadence', async () => {
    const monthly = await getRegularResult(BondType.TOS, {
      frequency: InvestmentFrequency.MONTHLY,
      investmentHorizonMonths: 36,
    });
    const quarterly = await getRegularResult(BondType.TOS, {
      frequency: InvestmentFrequency.QUARTERLY,
      investmentHorizonMonths: 36,
    });
    const yearly = await getRegularResult(BondType.TOS, {
      frequency: InvestmentFrequency.YEARLY,
      investmentHorizonMonths: 36,
    });

    expect(monthly.totalInvested).toBe(36000);
    expect(monthly.finalNominalValue).toBeGreaterThan(37000);
    expect(monthly.totalProfit).toBeGreaterThan(1800);
    expect(monthly.totalTax).toBeGreaterThan(400);
    expect(monthly.lots).toHaveLength(36);

    expect(quarterly.totalInvested).toBe(12000);
    expect(quarterly.finalNominalValue).toBeGreaterThan(12500);
    expect(quarterly.totalProfit).toBeGreaterThan(600);
    expect(quarterly.totalTax).toBeGreaterThan(100);
    expect(quarterly.lots).toHaveLength(12);

    expect(yearly.totalInvested).toBe(3000);
    expect(yearly.finalNominalValue).toBeGreaterThan(3200);
    expect(yearly.totalProfit).toBeGreaterThan(200);
    expect(yearly.totalTax).toBeGreaterThan(40);
    expect(yearly.lots).toHaveLength(3);

    expect(monthly.totalProfit).toBeGreaterThan(quarterly.totalProfit);
    expect(quarterly.totalProfit).toBeGreaterThan(yearly.totalProfit);
  });

  it('uses resolved issuer terms instead of caller-supplied rate fields', async () => {
    const trusted = await getRegularResult(BondType.EDO, {
      investmentHorizonMonths: 36,
      purchaseDate: '2026-05-05',
      withdrawalDate: '2029-05-05',
      timingMode: 'exact',
    });
    const callerTamperedPayload = {
      ...buildRegularPayload(BondType.EDO, {
        investmentHorizonMonths: 36,
        purchaseDate: '2026-05-05',
        withdrawalDate: '2029-05-05',
        timingMode: 'exact',
      }),
      firstYearRate: 99,
      margin: 99,
      duration: 99,
      earlyWithdrawalFee: 0,
    };
    const envelope = await calculationService.calculate({
      kind: ScenarioKind.REGULAR_INVESTMENT,
      payload: callerTamperedPayload,
    });
    const sanitized = envelope.result as RegularInvestmentResult;

    expect(sanitized.finalNominalValue).toBeCloseTo(trusted.finalNominalValue, 8);
    expect(sanitized.totalProfit).toBeCloseTo(trusted.totalProfit, 8);
    expect(sanitized.totalTax).toBeCloseTo(trusted.totalTax, 8);
  });

  it('keeps the EDO wrapper spread ordered by tax treatment', async () => {
    const standard = await getRegularResult(BondType.EDO, {
      investmentHorizonMonths: 60,
      taxStrategy: TaxStrategy.STANDARD,
    });
    const ike = await getRegularResult(BondType.EDO, {
      investmentHorizonMonths: 60,
      taxStrategy: TaxStrategy.IKE,
    });
    const ikze = await getRegularResult(BondType.EDO, {
      investmentHorizonMonths: 60,
      taxStrategy: TaxStrategy.IKZE,
    });

    expect(standard.finalNominalValue).toBeGreaterThan(65000);
    expect(standard.totalProfit).toBeGreaterThan(5000);
    expect(standard.totalTax).toBeGreaterThan(1000);

    expect(ike.finalNominalValue).toBeGreaterThan(standard.finalNominalValue);
    expect(ike.totalProfit).toBeGreaterThan(standard.totalProfit);
    expect(ike.totalTax).toBe(0);

    expect(ikze.finalNominalValue).toBeLessThan(ike.finalNominalValue);
    expect(ikze.totalProfit).toBeLessThan(standard.totalProfit);
    expect(ikze.totalTax).toBeGreaterThan(standard.totalTax);

    expect(ike.totalProfit).toBeGreaterThan(standard.totalProfit);
    expect(standard.totalProfit).toBeGreaterThan(ikze.totalProfit);
  });

  it('keeps exact and general COI timing aligned for the same dates', async () => {
    const purchaseDate = '2026-05-05';
    const withdrawalDate = '2030-05-05';
    const exact = await getRegularResult(BondType.COI, {
      investmentHorizonMonths: 48,
      purchaseDate,
      withdrawalDate,
      timingMode: 'exact',
    });
    const general = await getRegularResult(BondType.COI, {
      investmentHorizonMonths: 48,
      purchaseDate,
      withdrawalDate,
      timingMode: 'general',
    });

    expect(exact.finalNominalValue).toBeGreaterThan(48000);
    expect(exact.totalProfit).toBeGreaterThan(3000);
    // COI coupons settle tax at the annual issuer event, rather than applying
    // a monthly approximation. The exact amount is intentionally below the
    // old monthly-accrual threshold.
    expect(exact.totalTax).toBeGreaterThan(600);
    expect(exact.lots).toHaveLength(48);

    expect(general.finalNominalValue).toBeCloseTo(exact.finalNominalValue, 8);
    expect(general.totalProfit).toBeCloseTo(exact.totalProfit, 8);
    expect(general.totalTax).toBeCloseTo(exact.totalTax, 8);
    expect(general.lots).toHaveLength(48);
  });

  it('keeps contribution lots anchored to the purchase date cadence', async () => {
    const monthly = await getRegularResult(BondType.TOS, {
      frequency: InvestmentFrequency.MONTHLY,
      investmentHorizonMonths: 12,
      purchaseDate: '2026-05-05',
      withdrawalDate: '2027-05-05',
      timingMode: 'exact',
    });
    const quarterly = await getRegularResult(BondType.TOS, {
      frequency: InvestmentFrequency.QUARTERLY,
      investmentHorizonMonths: 24,
      purchaseDate: '2026-05-05',
      withdrawalDate: '2028-05-05',
      timingMode: 'exact',
    });

    expect(monthly.lots).toHaveLength(12);
    expect(monthly.lots[0].purchaseDate).toBe(monthly.timeline[0].date);
    expect(monthly.lots.at(-1)?.purchaseDate).toBe(monthly.timeline[11].date);
    expect(monthly.timeline.at(-1)?.month).toBe(12);

    expect(quarterly.lots).toHaveLength(8);
    expect(quarterly.lots.map((lot) => lot.purchaseDate)).toEqual(
      [0, 3, 6, 9, 12, 15, 18, 21].map((month) => quarterly.timeline[month].date),
    );
  });

  it('keeps ladder-style EDO maturities spaced by contribution month', async () => {
    const ladder = await getRegularResult(BondType.EDO, {
      frequency: InvestmentFrequency.MONTHLY,
      investmentHorizonMonths: 120,
      purchaseDate: '2026-05-05',
      withdrawalDate: '2036-05-05',
      timingMode: 'exact',
      rollover: false,
    });

    expect(ladder.lots).toHaveLength(120);
    for (const lot of ladder.lots.slice(0, 4)) {
      expect(differenceInMonths(parseISO(lot.maturityDate), parseISO(lot.purchaseDate))).toBe(120);
    }
    expect(
      differenceInMonths(
        parseISO(ladder.lots[3].maturityDate),
        parseISO(ladder.lots[0].maturityDate),
      ),
    ).toBe(3);
    expect(ladder.timeline.at(-1)?.nominalValue).toBeCloseTo(ladder.finalNominalValue, 8);
  });

  it('keeps short-duration ROR rollover handling aligned', async () => {
    const withoutRollover = await getRegularResult(BondType.ROR, {
      investmentHorizonMonths: 24,
      rollover: false,
    });
    const withRollover = await getRegularResult(BondType.ROR, {
      investmentHorizonMonths: 24,
      rollover: true,
    });

    expect(withoutRollover.totalContributions).toBe(24000);
    expect(withoutRollover.finalNominalValue).toBeGreaterThan(24000);

    expect(withRollover.totalContributions).toBe(withoutRollover.totalContributions);
    expect(withRollover.finalNominalValue).toBeGreaterThan(withoutRollover.finalNominalValue);
  });

  it.each([
    [BondType.OTS, 3, 3],
    [BondType.ROR, 6, 6],
    [BondType.COI, 12, 12],
  ])(
    'records one final withdrawal and no post-horizon contribution for %s',
    async (bondType, investmentHorizonMonths, expectedLots) => {
      const result = await getRegularResult(bondType, {
        investmentHorizonMonths,
        purchaseDate: '2026-05-05',
        withdrawalDate: getWithdrawalDateFromMonths('2026-05-05', investmentHorizonMonths),
        timingMode: 'exact',
        rollover: false,
      });

      expect(result.lots).toHaveLength(expectedLots);
      expect(result.timeline).toHaveLength(investmentHorizonMonths + 1);
      expect(
        result.timeline.at(-1)?.events?.filter((event) => event.type === 'WITHDRAWAL'),
      ).toHaveLength(1);
      expect(result.timeline.at(-1)?.totalInvested).toBe(expectedLots * 1000);
    },
  );

  it('charges early-exit fees without reducing the recorded invested amount', async () => {
    const result = await getRegularResult(BondType.EDO, {
      investmentHorizonMonths: 12,
      purchaseDate: '2026-05-05',
      withdrawalDate: '2027-05-05',
      timingMode: 'exact',
      rollover: false,
    });

    expect(result.totalInvested).toBe(12_000);
    expect(result.totalEarlyWithdrawalFees).toBeGreaterThan(0);
    expect(result.finalNominalValue).toBeGreaterThan(0);
  });

  it('settles an off-grid terminal withdrawal into paid-out value exactly once', async () => {
    const result = await getRegularResult(BondType.TOS, {
      investmentHorizonMonths: 6,
      purchaseDate: '2026-05-05',
      withdrawalDate: '2026-11-20',
      timingMode: 'exact',
      rollover: false,
    });

    const terminal = result.timeline.at(-1);
    expect(terminal?.date).toBe('2026-11-20');
    expect(result.terminalNetSettlement).toBe(result.paidOutValue);
    expect(result.terminalWealth).toBe(0);
    expect(result.cashBalance).toBe(0);
    expect(terminal?.events?.filter((event) => event.type === 'WITHDRAWAL')).toHaveLength(1);
  });

  it('conserves fractional-bond contribution residuals and records their source', async () => {
    const result = await getRegularResult(BondType.TOS, {
      contributionAmount: 150,
      investmentHorizonMonths: 1,
      purchaseDate: '2026-05-05',
      withdrawalDate: '2026-06-05',
      timingMode: 'exact',
      rollover: false,
    });

    expect(result.totalContributions).toBe(150);
    expect(result.lots).toHaveLength(1);
    expect(result.timeline[0]?.cashBalance).toBe(50);
    expect(result.timeline[0]?.events?.some((event) => event.type === 'CONTRIBUTION')).toBe(true);
    expect(result.paidOutValue).toBeGreaterThanOrEqual(50);
  });

  it.each([
    BondType.OTS,
    BondType.TOS,
    BondType.COI,
    BondType.ROS,
    BondType.EDO,
    BondType.ROD,
    BondType.ROR,
    BondType.DOR,
  ])('uses the same issuer-period outcome as one matching single %s lot', (bondType) => {
    const definition = BOND_DEFINITIONS[bondType];
    const common = {
      bondType,
      firstYearRate: definition.firstYearRate,
      expectedInflation: 3.5,
      expectedNbpRate: 5.25,
      margin: definition.margin,
      duration: definition.duration,
      earlyWithdrawalFee: definition.earlyWithdrawalFee,
      taxRate: 19,
      isCapitalized: definition.isCapitalized,
      payoutFrequency: definition.payoutFrequency,
      purchaseDate: '2026-05-05',
      withdrawalDate: '2027-05-05',
      isRebought: false,
      rebuyDiscount: definition.rebuyDiscount,
      taxStrategy: TaxStrategy.STANDARD,
    };
    const single = calculateBondInvestment({ ...common, initialInvestment: 100 });
    const recurring = calculateRegularInvestment({
      ...common,
      contributionAmount: 100,
      frequency: InvestmentFrequency.YEARLY,
      investmentHorizonMonths: 12,
    });

    expect(recurring.lots).toHaveLength(1);
    expect(recurring.finalNominalValue).toBeCloseTo(single.netPayoutValue, 8);
    expect(recurring.lots[0]?.issuerCompletedPeriods).toBe(
      bondType === BondType.ROR || bondType === BondType.DOR ? 12 : 1,
    );
  });

  it.each(['2026-06-14', '2026-07-01', '2026-07-14'])(
    'reconciles a one-lot ROR issuer-period redemption on %s',
    (withdrawalDate) => {
      // ROR1225 issuer rule: first monthly period caps at accrued interest;
      // later periods may charge the 0.50 PLN fee against principal.
      // https://www.obligacjeskarbowe.pl/oferta-obligacji/obligacje-roczne-ror/ror1225/
      const common = {
        bondType: BondType.ROR,
        firstYearRate: 5.25,
        expectedInflation: 3.5,
        expectedNbpRate: 5.25,
        margin: 0,
        duration: 1,
        earlyWithdrawalFee: 0.5,
        redemptionFeeCap: 'first-interest-then-principal' as const,
        taxRate: 19,
        isCapitalized: false,
        payoutFrequency: BOND_DEFINITIONS[BondType.ROR].payoutFrequency,
        purchaseDate: '2026-06-01',
        withdrawalDate,
        isRebought: false,
        rebuyDiscount: 0.1,
        taxStrategy: TaxStrategy.STANDARD,
      };
      const single = calculateBondInvestment({ ...common, initialInvestment: 100 });
      const recurring = calculateRegularInvestment({
        ...common,
        contributionAmount: 100,
        frequency: InvestmentFrequency.YEARLY,
        investmentHorizonMonths: 1,
      });

      expect(recurring.lots).toHaveLength(1);
      expect(recurring.totalEarlyWithdrawalFees).toBeCloseTo(single.totalEarlyWithdrawalFee, 8);
      expect(recurring.finalNominalValue).toBeCloseTo(single.netPayoutValue, 8);
    },
  );

  it('keeps a CPI reset tied to the lot anniversary under a custom path', () => {
    const definition = BOND_DEFINITIONS[BondType.EDO];
    const common = {
      bondType: BondType.EDO,
      firstYearRate: definition.firstYearRate,
      expectedInflation: 3.5,
      margin: definition.margin,
      duration: definition.duration,
      earlyWithdrawalFee: definition.earlyWithdrawalFee,
      taxRate: 19,
      isCapitalized: definition.isCapitalized,
      payoutFrequency: definition.payoutFrequency,
      purchaseDate: '2024-02-29',
      withdrawalDate: '2026-02-28',
      isRebought: false,
      rebuyDiscount: definition.rebuyDiscount,
      taxStrategy: TaxStrategy.STANDARD,
      customInflation: [2, 8],
    };
    const single = calculateBondInvestment({ ...common, initialInvestment: 100 });
    const recurring = calculateRegularInvestment({
      ...common,
      contributionAmount: 100,
      frequency: InvestmentFrequency.YEARLY,
      investmentHorizonMonths: 24,
    });
    const firstLot = recurring.lots[0];

    expect(firstLot?.netValue).toBeCloseTo(single.netPayoutValue, 8);
    expect(firstLot?.ratePeriodIndex).toBe(1);
    expect(firstLot?.lockedAnnualRate).toBeCloseTo(4, 8);
  });
});
