import { describe, expect, it } from 'vitest';

import { BOND_DEFINITIONS } from '../constants/bond-definitions';
import { BondType, InterestPayout, InvestmentFrequency, TaxStrategy } from '../types';
import { calculateBondInvestment, calculateRegularInvestment } from '../utils/calculations';

const purchaseDate = '2026-05-27T00:00:00.000Z';

function singleInputs(
  bondType: BondType,
  overrides: Partial<Parameters<typeof calculateBondInvestment>[0]> = {},
): Parameters<typeof calculateBondInvestment>[0] {
  const definition = BOND_DEFINITIONS[bondType];

  return {
    initialInvestment: 100000,
    firstYearRate: definition.firstYearRate,
    expectedInflation: 3.4,
    expectedNbpRate: 5.25,
    margin: definition.margin,
    duration: definition.duration,
    earlyWithdrawalFee: definition.earlyWithdrawalFee,
    taxRate: 19,
    bondType,
    isCapitalized: definition.isCapitalized,
    payoutFrequency: definition.payoutFrequency,
    purchaseDate,
    withdrawalDate: '2046-05-27T00:00:00.000Z',
    isRebought: false,
    rebuyDiscount: definition.rebuyDiscount,
    taxStrategy: TaxStrategy.STANDARD,
    timingMode: 'general',
    investmentHorizonMonths: 240,
    historicalData: {},
    ...overrides,
  };
}

function regularInputs(
  bondType: BondType,
  overrides: Partial<Parameters<typeof calculateRegularInvestment>[0]> = {},
): Parameters<typeof calculateRegularInvestment>[0] {
  const definition = BOND_DEFINITIONS[bondType];

  return {
    contributionAmount: 1000,
    frequency: InvestmentFrequency.MONTHLY,
    investmentHorizonMonths: 120,
    bondType,
    firstYearRate: definition.firstYearRate,
    expectedInflation: 3.4,
    expectedNbpRate: 5.25,
    margin: definition.margin,
    duration: definition.duration,
    earlyWithdrawalFee: definition.earlyWithdrawalFee,
    taxRate: 19,
    isCapitalized: definition.isCapitalized,
    payoutFrequency: definition.payoutFrequency,
    purchaseDate,
    withdrawalDate: '2036-05-27T00:00:00.000Z',
    isRebought: false,
    rebuyDiscount: definition.rebuyDiscount,
    taxStrategy: TaxStrategy.STANDARD,
    timingMode: 'general',
    historicalData: {},
    ...overrides,
  };
}

function finalCycleIndexes(result: ReturnType<typeof calculateBondInvestment>) {
  return new Set(result.timeline.slice(1).map((point) => point.cycleIndex));
}

function expectSingleBondAccountingIdentity(result: ReturnType<typeof calculateBondInvestment>) {
  expect(result.netPayoutValue).toBeCloseTo(
    result.grossValue - result.totalTax - result.totalEarlyWithdrawalFee,
    2,
  );
  expect(result.totalProfit).toBeCloseTo(result.netPayoutValue - result.initialInvestment, 2);
  expect(result.totalProfit + result.totalTax + result.totalEarlyWithdrawalFee).toBeCloseTo(
    result.grossValue - result.initialInvestment,
    2,
  );
  expect(result.timeline.at(-1)?.totalValue).toBeCloseTo(result.netPayoutValue, 2);
  expect(result.timeline.at(-1)?.realValue).toBeCloseTo(result.finalRealValue, 2);
}

describe('production scenario calculation regressions', () => {
  it('keeps a 20-year EDO rollover nominally profitable while real value reflects purchasing power', () => {
    const result = calculateBondInvestment(
      singleInputs(BondType.EDO, {
        rollover: true,
        customInflation: [1, 3, 4, 5, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7, 7, 6, 5, 4, 3],
      }),
    );
    const finalPoint = result.timeline.at(-1);

    expect(finalPoint?.isWithdrawal).toBe(true);
    expectSingleBondAccountingIdentity(result);
    expect(finalPoint?.cycleEndDate).toBe('2046-05-27T00:00:00.000Z');
    expect(finalCycleIndexes(result).size).toBe(2);
    expect(result.netPayoutValue).toBeGreaterThan(result.initialInvestment);
    expect(result.totalProfit).toBeGreaterThan(0);
    expect(result.totalTax).toBeGreaterThan(0);
    expect(result.finalRealValue).toBeLessThan(result.netPayoutValue);
    expect(result.realAnnualizedReturn).toBeLessThan(result.nominalAnnualizedReturn);
    expect(result.calculationNotes?.join('\n')).toContain('Simulation covered 2 bond cycles');
  });

  it('uses the previous projected CPI year for indexed annual reset rates', () => {
    const result = calculateBondInvestment(
      singleInputs(BondType.EDO, {
        rollover: false,
        withdrawalDate: '2036-05-27T00:00:00.000Z',
        investmentHorizonMonths: 120,
        customInflation: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      }),
    );
    const firstFixedPoint = result.timeline[1];
    const secondYearPoint = result.timeline[2];
    const thirdYearPoint = result.timeline[3];

    expectSingleBondAccountingIdentity(result);
    expect(firstFixedPoint.rateSource).toBe('first_year_fixed');
    expect(secondYearPoint.rateSource).toBe('projected_cpi');
    expect(secondYearPoint.inflationReference).toBe(2);
    expect(secondYearPoint.interestRate).toBeCloseTo(4, 8);
    expect(thirdYearPoint.inflationReference).toBe(3);
    expect(thirdYearPoint.interestRate).toBeCloseTo(5, 8);
  });

  it('keeps ROR rollover on global yearly NBP path indexes instead of restarting per cycle', () => {
    const result = calculateBondInvestment(
      singleInputs(BondType.ROR, {
        duration: 1,
        firstYearRate: 4,
        expectedNbpRate: 3.75,
        margin: 0,
        isCapitalized: false,
        payoutFrequency: InterestPayout.MONTHLY,
        withdrawalDate: '2030-05-27T00:00:00.000Z',
        investmentHorizonMonths: 48,
        rollover: true,
        customNbpRate: [3, 4, 5, 6],
      }),
    );
    const cycleTwoProjectedNbp = result.timeline.find(
      (point) => point.cycleIndex === 2 && point.rateSource === 'projected_nbp',
    );
    const cycleFourProjectedNbp = result.timeline.find(
      (point) => point.cycleIndex === 4 && point.rateSource === 'projected_nbp',
    );

    expectSingleBondAccountingIdentity(result);
    expect(finalCycleIndexes(result).size).toBeGreaterThanOrEqual(4);
    expect(cycleTwoProjectedNbp?.nbpReference).toBe(4);
    expect(cycleTwoProjectedNbp?.interestRate).toBe(4);
    expect(cycleFourProjectedNbp?.nbpReference).toBe(6);
    expect(cycleFourProjectedNbp?.interestRate).toBe(6);
  });

  it('keeps ROR rollover wealth cumulative while per-cycle retained interest resets', () => {
    const result = calculateBondInvestment(
      singleInputs(BondType.ROR, {
        initialInvestment: 100,
        duration: 1,
        firstYearRate: 4,
        expectedInflation: 3.8,
        expectedNbpRate: 3.75,
        margin: 0,
        isCapitalized: false,
        payoutFrequency: InterestPayout.MONTHLY,
        withdrawalDate: '2036-05-27T00:00:00.000Z',
        investmentHorizonMonths: 120,
        rollover: true,
        isRebought: true,
        rebuyDiscount: 0.1,
      }),
    );
    const firstMaturity = result.timeline.find(
      (point) => point.cycleIndex === 1 && point.isMaturity,
    );
    const firstRolloverMonth = result.timeline.find(
      (point) =>
        point.cycleIndex === 2 && point.events?.some((event) => event.type === 'ROLLOVER_PURCHASE'),
    );
    const finalPoint = result.timeline.at(-1);

    expectSingleBondAccountingIdentity(result);
    // Grosz-level tax settlement changes this small monthly-coupon fixture.
    expect(firstMaturity?.accumulatedNetInterest).toBeGreaterThan(2.9);
    expect(firstRolloverMonth?.accumulatedNetInterest).toBeLessThan(1);
    expect(firstRolloverMonth?.totalValue).toBeGreaterThan(firstMaturity?.totalValue ?? 0);
    expect(finalPoint?.totalValue).toBeCloseTo(result.netPayoutValue, 2);
    // This is a cash-conserving rollover witness, not a fixture for a
    // particular historical tax-rounding implementation.
    expect(result.netPayoutValue).toBeGreaterThan(130);
    expect(result.totalProfit).toBeCloseTo(result.netPayoutValue - 100, 2);
  });

  it('shows low-value ROR nominal gain can still lose real purchasing power', () => {
    const result = calculateBondInvestment(
      singleInputs(BondType.ROR, {
        initialInvestment: 100,
        duration: 1,
        firstYearRate: 4,
        expectedInflation: 3.8,
        expectedNbpRate: 3.75,
        margin: 0,
        isCapitalized: false,
        payoutFrequency: InterestPayout.MONTHLY,
        withdrawalDate: '2036-05-27T00:00:00.000Z',
        investmentHorizonMonths: 120,
        rollover: true,
      }),
    );

    expect(result.netPayoutValue).toBeGreaterThan(result.initialInvestment);
    expect(result.finalRealValue).toBeLessThan(result.initialInvestment);
    expect(result.realAnnualizedReturn).toBeLessThan(0);
    expect(result.finalRealValue).toBeLessThan(result.netPayoutValue);
  });

  it('keeps early-exit payout value at or above principal when official fee is capped by earned interest', () => {
    const result = calculateBondInvestment(
      singleInputs(BondType.EDO, {
        initialInvestment: 10000,
        withdrawalDate: '2026-06-27T00:00:00.000Z',
        investmentHorizonMonths: 1,
        rollover: false,
      }),
    );
    const finalPoint = result.timeline.at(-1);

    expect(result.isEarlyWithdrawal).toBe(true);
    expectSingleBondAccountingIdentity(result);
    expect(result.netPayoutValue).toBeGreaterThanOrEqual(result.initialInvestment);
    expect(result.totalEarlyWithdrawalFee).toBeGreaterThan(0);
    expect(result.totalEarlyWithdrawalFee).toBeLessThan(100);
    expect(finalPoint?.earlyWithdrawalValue).toBeGreaterThanOrEqual(result.initialInvestment);
  });

  it('includes paid monthly coupons in the hypothetical early-exit amount', () => {
    const result = calculateBondInvestment(
      singleInputs(BondType.ROR, {
        initialInvestment: 10000,
        withdrawalDate: '2027-05-27T00:00:00.000Z',
        investmentHorizonMonths: 12,
        rollover: false,
      }),
    );

    const monthlyPayout = result.timeline.find((point) => point.accumulatedNetInterest > 0);

    expect(monthlyPayout?.earlyWithdrawalValue).toBeGreaterThan(result.initialInvestment);
    expect(monthlyPayout?.earlyWithdrawalValue).toBe(monthlyPayout?.totalValue);
  });

  it('keeps monthly EDO regular investment lots and maturity buckets stable', () => {
    const result = calculateRegularInvestment(regularInputs(BondType.EDO));
    const firstLot = result.lots[0];
    const lastLot = result.lots.at(-1);
    const firstTimelinePoint = result.timeline[0];
    const finalTimelinePoint = result.timeline.at(-1);

    expect(result.totalInvested).toBe(120000);
    expect(result.lots).toHaveLength(120);
    expect(firstLot.purchaseDate).toBe('2026-05-27');
    expect(firstLot.maturityDate).toBe('2036-05-27');
    expect(lastLot?.purchaseDate).toBe('2036-04-27');
    expect(lastLot?.maturityDate).toBe('2046-04-27');
    expect(firstTimelinePoint.totalInvested).toBe(1000);
    expect(finalTimelinePoint?.totalInvested).toBe(120000);
    expect(result.finalNominalValue).toBeGreaterThan(result.totalInvested);
    expect(result.finalRealValue).toBeLessThan(result.finalNominalValue);
  });

  it('keeps chart granularity display-only for single and regular calculations', () => {
    const singleYearly = calculateBondInvestment(
      singleInputs(BondType.EDO, {
        chartStep: 'yearly',
        rollover: true,
      }),
    );
    const singleMonthly = calculateBondInvestment(
      singleInputs(BondType.EDO, {
        chartStep: 'monthly',
        rollover: true,
      }),
    );
    const regularYearly = calculateRegularInvestment(
      regularInputs(BondType.EDO, {
        chartStep: 'yearly',
      }),
    );
    const regularMonthly = calculateRegularInvestment(
      regularInputs(BondType.EDO, {
        chartStep: 'monthly',
      }),
    );

    expect(singleMonthly.netPayoutValue).toBeCloseTo(singleYearly.netPayoutValue, 8);
    expect(singleMonthly.totalTax).toBeCloseTo(singleYearly.totalTax, 8);
    expect(singleMonthly.timeline).toHaveLength(singleYearly.timeline.length);
    expect(regularMonthly.finalNominalValue).toBeCloseTo(regularYearly.finalNominalValue, 8);
    expect(regularMonthly.totalTax).toBeCloseTo(regularYearly.totalTax, 8);
    expect(regularMonthly.timeline).toHaveLength(regularYearly.timeline.length);
  });
});
