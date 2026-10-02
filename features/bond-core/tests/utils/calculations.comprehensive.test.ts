import { describe, expect, it } from 'vitest';

import { BondType, InterestPayout, TaxStrategy } from '../../types';
import { calculateBondInvestment } from '../../utils/calculations';

describe('Comprehensive Bond Calculations', () => {
  const baseInputs = {
    initialInvestment: 10000,
    firstYearRate: 5.0,
    expectedInflation: 3.0,
    expectedNbpRate: 5.0,
    margin: 1.5,
    duration: 4,
    earlyWithdrawalFee: 2.0,
    taxRate: 19,
    bondType: BondType.COI,
    isCapitalized: false,
    payoutFrequency: InterestPayout.YEARLY,
    purchaseDate: '2026-03-01T00:00:00.000Z',
    withdrawalDate: '2030-03-01T00:00:00.000Z',
    isRebought: false,
    rebuyDiscount: 0.1,
    taxStrategy: TaxStrategy.STANDARD,
  };

  it('OTS: 3-month fixed rate, no early interest', () => {
    const inputs = {
      ...baseInputs,
      bondType: BondType.OTS,
      duration: 0.25,
      firstYearRate: 2.5,
      withdrawalDate: '2026-06-01T00:00:00.000Z',
    };
    const results = calculateBondInvestment(inputs);

    // 100 bonds * 100 PLN = 10000
    // interest = 10000 * 2.5% * (3/12) = 62.5 PLN gross
    // tax = 62.5 * 19% = 11.875 -> 12 PLN (rounded to full PLN)
    // Tax is settled to grosze under the standard interest-tax rule.
    expect(results.grossValue).toBeCloseTo(10062.5, 1);
    expect(results.totalProfit).toBeCloseTo(50.62, 1);

    // Early withdrawal before 3 months
    const earlyInputs = {
      ...inputs,
      withdrawalDate: '2026-05-01T00:00:00.000Z',
    };
    const earlyResults = calculateBondInvestment(earlyInputs);
    expect(earlyResults.totalProfit).toBe(0); // OTS loses all interest on early exit
  });

  it('ROR: first-month rate applies to the first month, then NBP rate applies', () => {
    const inputs = {
      ...baseInputs,
      bondType: BondType.ROR,
      duration: 1,
      firstYearRate: 4.25,
      expectedNbpRate: -1.0,
      margin: 0.0,
      payoutFrequency: InterestPayout.MONTHLY,
      withdrawalDate: '2027-03-01T00:00:00.000Z',
    };
    const results = calculateBondInvestment(inputs);

    expect(results.timeline[1].interestRate).toBe(4.25); // First month (end of month 1)
    expect(results.timeline[2].interestRate).toBe(0); // Month 2 uses NBP (-1.0, floored to 0) + margin 0
    expect(results.timeline[12].interestRate).toBe(0); // Month 12
    expect(results.totalProfit).toBeGreaterThan(0);
  });

  it('uses checkpoint dates rather than whole-cycle end dates for monthly payout timeline rows', () => {
    const inputs = {
      ...baseInputs,
      bondType: BondType.ROR,
      duration: 1,
      firstYearRate: 4.25,
      expectedNbpRate: 5.25,
      margin: 0,
      payoutFrequency: InterestPayout.MONTHLY,
      purchaseDate: '2026-03-01T00:00:00.000Z',
      withdrawalDate: '2027-03-01T00:00:00.000Z',
    };
    const results = calculateBondInvestment(inputs);

    const firstCheckpoint = new Date(results.timeline[1].cycleEndDate).getTime();
    const secondCheckpoint = new Date(results.timeline[2].cycleEndDate).getTime();
    const finalCheckpoint = new Date(
      results.timeline[results.timeline.length - 1].cycleEndDate,
    ).getTime();

    expect(secondCheckpoint).toBeGreaterThan(firstCheckpoint);
    expect(finalCheckpoint).toBeGreaterThan(secondCheckpoint);
    expect(results.timeline[1].periodLabel).toContain('Apr');
    expect(results.timeline[2].periodLabel).toContain('May');
  });

  it('DOR outperforms ROR under the same NBP path because of the extra margin', () => {
    const commonBase = {
      ...baseInputs,
      purchaseDate: '2026-03-01T00:00:00.000Z',
      withdrawalDate: '2028-03-01T00:00:00.000Z',
      payoutFrequency: InterestPayout.MONTHLY,
    };

    const rorResults = calculateBondInvestment({
      ...commonBase,
      bondType: BondType.ROR,
      duration: 1,
      firstYearRate: 4.0,
      expectedNbpRate: 3.75,
      margin: 0,
    });

    const dorResults = calculateBondInvestment({
      ...commonBase,
      bondType: BondType.DOR,
      duration: 2,
      firstYearRate: 4.15,
      expectedNbpRate: 3.75,
      margin: 0.15,
    });

    expect(dorResults.netPayoutValue).toBeGreaterThan(rorResults.netPayoutValue);
    expect(dorResults.totalProfit).toBeGreaterThan(rorResults.totalProfit);
  });

  it('caps payout-bond early redemption fee at earned interest instead of zeroing the exit path', () => {
    const inputs = {
      ...baseInputs,
      bondType: BondType.ROR,
      duration: 1,
      firstYearRate: 4.0,
      expectedNbpRate: 3.75,
      margin: 0,
      payoutFrequency: InterestPayout.MONTHLY,
      earlyWithdrawalFee: 0.5,
      purchaseDate: '2026-03-01T00:00:00.000Z',
      withdrawalDate: '2026-07-02T00:00:00.000Z',
    };
    const results = calculateBondInvestment(inputs);
    const finalPoint = results.timeline[results.timeline.length - 1];

    expect(results.totalEarlyWithdrawalFee).toBeGreaterThan(0);
    expect(results.totalEarlyWithdrawalFee).toBeLessThanOrEqual(
      results.grossValue - results.initialInvestment,
    );
    expect(finalPoint.earlyWithdrawalValue).toBeGreaterThan(0);
    expect(finalPoint.earlyWithdrawalValue).toBeLessThanOrEqual(finalPoint.totalValue);
  });

  it('supports multi-cycle rollover for short-duration bonds across a longer horizon', () => {
    const inputs = {
      ...baseInputs,
      bondType: BondType.ROR,
      duration: 1,
      firstYearRate: 4.25,
      expectedNbpRate: 5.25,
      margin: 0,
      payoutFrequency: InterestPayout.MONTHLY,
      purchaseDate: '2026-03-01T00:00:00.000Z',
      withdrawalDate: '2031-03-01T00:00:00.000Z',
      rollover: true,
    };

    const results = calculateBondInvestment(inputs);

    expect(results.timeline.length).toBeGreaterThan(40);
    expect(results.maturityDate).toBe('2031-03-01T00:00:00.000Z');
    expect(results.netPayoutValue).toBeGreaterThan(results.initialInvestment);
    expect(
      new Set(results.timeline.slice(1).map((point) => point.cycleIndex)).size,
    ).toBeGreaterThan(1);
  });

  it('adds calculation audit metadata to timeline points', () => {
    const inputs = {
      ...baseInputs,
      bondType: BondType.EDO,
      duration: 10,
      firstYearRate: 5.6,
      expectedInflation: 4.0,
      margin: 2.0,
      isCapitalized: true,
      payoutFrequency: InterestPayout.MATURITY,
      purchaseDate: '2026-03-01T00:00:00.000Z',
      withdrawalDate: '2028-03-01T00:00:00.000Z',
      rollover: false,
    };

    const results = calculateBondInvestment(inputs);
    const initialPoint = results.timeline[0];
    const firstAccrualPoint = results.timeline[1];
    const secondAccrualPoint = results.timeline[2];

    expect(initialPoint.rateSource).toBe('initial_principal');
    expect(firstAccrualPoint.rateSource).toBe('first_year_fixed');
    expect(firstAccrualPoint.cycleIndex).toBe(1);
    expect(firstAccrualPoint.cycleStartDate).toBe('2026-03-01T00:00:00.000Z');
    expect(secondAccrualPoint.rateSource).toMatch(/cpi|fixed/);
    expect(Array.isArray(results.calculationNotes)).toBe(true);
    expect(Array.isArray(results.dataQualityFlags)).toBe(true);
  });

  it('shows the invested principal as the immediate early-exit payout', () => {
    const results = calculateBondInvestment(baseInputs);
    const purchasePoint = results.timeline[0];

    expect(purchasePoint.earlyWithdrawalValue).toBe(results.initialInvestment);
  });

  it('marks projected macro segments when historical data is unavailable', () => {
    const inputs = {
      ...baseInputs,
      bondType: BondType.ROR,
      duration: 1,
      firstYearRate: 4.25,
      expectedNbpRate: 5.25,
      payoutFrequency: InterestPayout.MONTHLY,
      purchaseDate: '2026-03-01T00:00:00.000Z',
      withdrawalDate: '2027-03-01T00:00:00.000Z',
      historicalData: {},
    };

    const results = calculateBondInvestment(inputs);
    const projectedPoints = results.timeline.filter((point) => point.usedProjectedRate);

    expect(projectedPoints.length).toBeGreaterThan(0);
    expect(projectedPoints.some((point) => point.rateSource === 'projected_nbp')).toBe(true);
    expect(results.dataQualityFlags).toContain('projected_rate_segment');
  });

  it('does not mark fixed first-year indexed segments as projected macro segments', () => {
    const inputs = {
      ...baseInputs,
      bondType: BondType.EDO,
      duration: 10,
      firstYearRate: 5.6,
      expectedInflation: 4.0,
      margin: 2.0,
      isCapitalized: true,
      payoutFrequency: InterestPayout.MATURITY,
      purchaseDate: '2026-03-01T00:00:00.000Z',
      withdrawalDate: '2028-03-01T00:00:00.000Z',
      historicalData: {},
    };

    const results = calculateBondInvestment(inputs);

    expect(results.timeline[1].rateSource).toBe('first_year_fixed');
    expect(results.timeline[1].isProjected).toBe(false);
    expect(results.timeline[2].rateSource).toBe('projected_cpi');
    expect(results.timeline[2].isProjected).toBe(true);
  });

  it('EDO: 10-year inflation-indexed, capitalization, tax at end', () => {
    const inputs = {
      ...baseInputs,
      bondType: BondType.EDO,
      duration: 10,
      firstYearRate: 5.6,
      expectedInflation: 4.0,
      margin: 2.0,
      isCapitalized: true,
      payoutFrequency: InterestPayout.MATURITY,
      withdrawalDate: '2036-03-01T00:00:00.000Z',
    };
    const results = calculateBondInvestment(inputs);

    // timeline[0] = initial
    // timeline[1] = Year 1: 10000 * 1.056 = 10560
    // timeline[2] = Year 2: 10560 * (1 + (4+2)%) = 10560 * 1.06 = 11193.6
    expect(results.timeline[1].nominalValueAfterInterest).toBeCloseTo(10560, 1);
    expect(results.timeline[2].nominalValueBeforeInterest).toBeCloseTo(10560, 1);
    expect(results.timeline[2].nominalValueAfterInterest).toBeCloseTo(11193.6, 1);

    // Final tax uses the statutory grosz settlement exception.
    const totalEarned = results.grossValue - 10000;
    expect(results.totalTax).toBeCloseTo(Math.ceil(totalEarned * 19) / 100, 2);
  });

  it('Early withdrawal fee protection: investor never gets less than nominal', () => {
    const inputs = {
      ...baseInputs,
      bondType: BondType.EDO,
      duration: 10,
      earlyWithdrawalFee: 3.0,
      withdrawalDate: '2026-04-01T00:00:00.000Z', // Withdraw very soon (1 month)
    };
    const results = calculateBondInvestment(inputs);

    // 1 month interest: 10000 * 5.0% * (31 / 365) = 42.4657... PLN
    // Max fee: 100 bonds * 3.0 = 300 PLN
    // Fee should be capped at interest earned (42.47)
    expect(results.totalEarlyWithdrawalFee).toBeCloseTo(42.47, 1);
    expect(results.netPayoutValue).toBeGreaterThanOrEqual(10000);
  });

  it('does not apply early withdrawal fee when the bond is held to maturity', () => {
    const inputs = {
      ...baseInputs,
      bondType: BondType.COI,
      duration: 4,
      earlyWithdrawalFee: 2.0,
      purchaseDate: '2026-03-01T00:00:00.000Z',
      withdrawalDate: '2030-03-01T00:00:00.000Z',
      payoutFrequency: InterestPayout.YEARLY,
      isCapitalized: false,
    };

    const results = calculateBondInvestment(inputs);
    const finalPoint = results.timeline[results.timeline.length - 1];

    expect(results.totalEarlyWithdrawalFee).toBe(0);
    expect(finalPoint.isMaturity).toBe(true);
  });

  it('tracks periodic withholding tax for payout bonds without taxing again at exit', () => {
    const inputs = {
      ...baseInputs,
      bondType: BondType.COI,
      duration: 4,
      firstYearRate: 5.0,
      expectedInflation: 3.0,
      margin: 1.5,
      payoutFrequency: InterestPayout.YEARLY,
      isCapitalized: false,
      purchaseDate: '2026-03-01T00:00:00.000Z',
      withdrawalDate: '2030-03-01T00:00:00.000Z',
    };

    const results = calculateBondInvestment(inputs);
    const timelineTax = results.timeline.reduce((sum, point) => sum + point.taxDeducted, 0);

    expect(results.totalTax).toBeCloseTo(timelineTax, 2);
    expect(results.netPayoutValue).toBeCloseTo(
      results.grossValue - results.totalTax - results.totalEarlyWithdrawalFee,
      2,
    );
  });

  it('Deflation: inflation floor of 0% applied to indexed bonds', () => {
    const inputs = {
      ...baseInputs,
      bondType: BondType.COI,
      duration: 4,
      firstYearRate: 5.0,
      expectedInflation: -2.0, // Deflation
      margin: 1.5,
      withdrawalDate: '2030-03-01T00:00:00.000Z',
    };
    const results = calculateBondInvestment(inputs);

    // timeline[0] = initial
    // timeline[1] = Year 1: 5%
    // timeline[2] = Year 2+: max(0, -2) + 1.5 = 1.5%
    expect(results.timeline[1].interestRate).toBe(5.0);
    expect(results.timeline[2].interestRate).toBe(1.5);
  });

  it('IKZE applies exit tax to withdrawal value rather than periodic payout tax', () => {
    const inputs = {
      ...baseInputs,
      bondType: BondType.EDO,
      duration: 10,
      firstYearRate: 5.6,
      expectedInflation: 4.0,
      margin: 2.0,
      isCapitalized: true,
      payoutFrequency: InterestPayout.MATURITY,
      withdrawalDate: '2036-03-01T00:00:00.000Z',
      taxStrategy: TaxStrategy.IKZE,
    };

    const results = calculateBondInvestment(inputs);

    expect(results.totalTax).toBeGreaterThan(0);
    expect(results.timeline.every((point) => point.taxDeducted === 0)).toBe(true);
  });

  it('uses the configured standard withdrawal tax rate when calculating net payout', () => {
    const standardTax = calculateBondInvestment({
      ...baseInputs,
      bondType: BondType.EDO,
      duration: 10,
      firstYearRate: 5.6,
      expectedInflation: 4.0,
      margin: 2.0,
      isCapitalized: true,
      payoutFrequency: InterestPayout.MATURITY,
      withdrawalDate: '2036-03-01T00:00:00.000Z',
      taxRate: 19,
      taxStrategy: TaxStrategy.STANDARD,
    });
    const reducedTax = calculateBondInvestment({
      ...baseInputs,
      bondType: BondType.EDO,
      duration: 10,
      firstYearRate: 5.6,
      expectedInflation: 4.0,
      margin: 2.0,
      isCapitalized: true,
      payoutFrequency: InterestPayout.MATURITY,
      withdrawalDate: '2036-03-01T00:00:00.000Z',
      taxRate: 10,
      taxStrategy: TaxStrategy.STANDARD,
    });

    expect(reducedTax.totalTax).toBeLessThan(standardTax.totalTax);
    expect(reducedTax.netPayoutValue).toBeGreaterThan(standardTax.netPayoutValue);
  });

  it('keeps the initial purchase at nominal price even when rollover swap discount is enabled', () => {
    const inputs = {
      ...baseInputs,
      initialInvestment: 1000,
      isRebought: true,
      rebuyDiscount: 0.1,
    };
    const results = calculateBondInvestment(inputs);

    expect(results.initialInvestment).toBe(1000);
    expect(results.timeline[1].nominalValueBeforeInterest).toBe(1000);
  });

  it('applies rebuy discount only on eligible rollover purchases', () => {
    const inputs = {
      ...baseInputs,
      bondType: BondType.COI,
      duration: 4,
      purchaseDate: '2026-03-01T00:00:00.000Z',
      withdrawalDate: '2034-03-01T00:00:00.000Z',
      isRebought: true,
      rebuyDiscount: 0.1,
      rollover: true,
    };

    const results = calculateBondInvestment(inputs);
    const cycleIndexes = new Set(results.timeline.slice(1).map((point) => point.cycleIndex));

    expect(cycleIndexes.size).toBeGreaterThan(1);
    expect(results.netPayoutValue).toBeGreaterThan(results.initialInvestment);
  });

  it('carries leftover cash through discounted ROR rollovers instead of resetting profit', () => {
    const results = calculateBondInvestment({
      ...baseInputs,
      bondType: BondType.ROR,
      initialInvestment: 100,
      duration: 1,
      firstYearRate: 4,
      expectedNbpRate: 3.75,
      margin: 0,
      isCapitalized: false,
      payoutFrequency: InterestPayout.MONTHLY,
      earlyWithdrawalFee: 0.5,
      purchaseDate: '2026-06-15T00:00:00.000Z',
      withdrawalDate: '2028-06-15T00:00:00.000Z',
      isRebought: true,
      rebuyDiscount: 0.1,
      rollover: true,
      historicalData: {},
    });

    const firstMaturity = results.timeline.find(
      (point) => point.cycleIndex === 1 && point.isMaturity,
    );
    const secondCycleFirstPoint = results.timeline.find((point) => point.cycleIndex === 2);

    expect(firstMaturity?.totalValue).toBeGreaterThan(100);
    expect(secondCycleFirstPoint?.totalValue).toBeGreaterThan(firstMaturity?.totalValue ?? 0);
    expect(secondCycleFirstPoint?.netProfit).toBeGreaterThan(firstMaturity?.netProfit ?? 0);
  });

  it('shows negative real CAGR when ROR yield trails inflation after tax', () => {
    const results = calculateBondInvestment({
      ...baseInputs,
      bondType: BondType.ROR,
      initialInvestment: 100,
      duration: 1,
      firstYearRate: 4,
      expectedInflation: 3.8,
      expectedNbpRate: 3.75,
      margin: 0,
      isCapitalized: false,
      payoutFrequency: InterestPayout.MONTHLY,
      earlyWithdrawalFee: 0.5,
      purchaseDate: '2026-06-16T00:00:00.000Z',
      withdrawalDate: '2036-06-16T00:00:00.000Z',
      isRebought: true,
      rebuyDiscount: 0.1,
      rollover: true,
      historicalData: {},
    });

    expect(results.netPayoutValue).toBeGreaterThan(results.initialInvestment);
    expect(results.finalRealValue).toBeLessThan(results.initialInvestment);
    expect(results.realAnnualizedReturn).toBeLessThan(0);
  });

  it('keeps OTS rollover cycles on the fixed OTS rate across long horizons', () => {
    const results = calculateBondInvestment({
      ...baseInputs,
      bondType: BondType.OTS,
      initialInvestment: 1000,
      duration: 0.25,
      firstYearRate: 2,
      expectedNbpRate: 3.75,
      margin: 0,
      isCapitalized: false,
      payoutFrequency: InterestPayout.MATURITY,
      earlyWithdrawalFee: 0,
      purchaseDate: '2026-06-15T00:00:00.000Z',
      withdrawalDate: '2027-06-15T00:00:00.000Z',
      rollover: true,
      historicalData: {},
    });

    const nonInitialPoints = results.timeline.filter((point) => point.cycleIndex > 0);

    expect(new Set(nonInitialPoints.map((point) => point.interestRate))).toEqual(new Set([2]));
    expect(nonInitialPoints.every((point) => point.rateSource === 'fixed_rate')).toBe(true);
  });

  it('uses global projected CPI path years across EDO rollover cycles', () => {
    const results = calculateBondInvestment({
      ...baseInputs,
      bondType: BondType.EDO,
      initialInvestment: 100000,
      duration: 10,
      firstYearRate: 5.35,
      margin: 2,
      isCapitalized: true,
      payoutFrequency: InterestPayout.MATURITY,
      purchaseDate: '2026-05-27T00:00:00.000Z',
      withdrawalDate: '2046-05-27T00:00:00.000Z',
      investmentHorizonMonths: 240,
      rollover: true,
      historicalData: {},
      customInflation: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
    });

    const secondCycleIndexedPoint = results.timeline.find(
      (point) => point.cycleIndex === 2 && point.rateSource === 'projected_cpi',
    );

    expect(secondCycleIndexedPoint?.inflationReference).toBe(8);
    expect(secondCycleIndexedPoint?.interestRate).toBe(10);
  });

  it('keeps EDO nominal payout positive while real CAGR can be negative under high inflation', () => {
    const results = calculateBondInvestment({
      ...baseInputs,
      bondType: BondType.EDO,
      initialInvestment: 100000,
      duration: 10,
      firstYearRate: 5.35,
      expectedInflation: 5,
      margin: 2,
      isCapitalized: true,
      payoutFrequency: InterestPayout.MATURITY,
      purchaseDate: '2026-05-27T00:00:00.000Z',
      withdrawalDate: '2046-05-27T00:00:00.000Z',
      investmentHorizonMonths: 240,
      rollover: true,
      historicalData: {},
      customInflation: [1, 3, 4, 5, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7, 7, 6, 5, 4, 3],
    });

    expect(results.netPayoutValue).toBeGreaterThan(results.initialInvestment);
    expect(results.totalProfit).toBeGreaterThan(0);
    expect(results.finalRealValue).toBeLessThan(results.netPayoutValue);
    expect(results.realAnnualizedReturn).toBeLessThan(results.nominalAnnualizedReturn);
  });

  it('uses global projected NBP path years across ROR rollover cycles', () => {
    const results = calculateBondInvestment({
      ...baseInputs,
      bondType: BondType.ROR,
      initialInvestment: 100000,
      duration: 1,
      firstYearRate: 4,
      expectedNbpRate: 3.75,
      margin: 0,
      isCapitalized: false,
      payoutFrequency: InterestPayout.MONTHLY,
      purchaseDate: '2026-05-27T00:00:00.000Z',
      withdrawalDate: '2030-05-27T00:00:00.000Z',
      investmentHorizonMonths: 48,
      rollover: true,
      historicalData: {},
      customNbpRate: [3, 4, 5, 6],
    });

    const secondCycleNbpPoint = results.timeline.find(
      (point) => point.cycleIndex === 2 && point.rateSource === 'projected_nbp',
    );
    const fourthYearNbpPoint = results.timeline.find(
      (point) => point.cycleIndex === 4 && point.rateSource === 'projected_nbp',
    );

    expect(secondCycleNbpPoint?.nbpReference).toBe(4);
    expect(secondCycleNbpPoint?.interestRate).toBe(4);
    expect(fourthYearNbpPoint?.nbpReference).toBe(6);
    expect(fourthYearNbpPoint?.interestRate).toBe(6);
  });

  it('does not treat chart granularity as a calculation input', () => {
    const yearly = calculateBondInvestment({
      ...baseInputs,
      bondType: BondType.EDO,
      duration: 10,
      firstYearRate: 5.6,
      expectedInflation: 4.0,
      margin: 2.0,
      isCapitalized: true,
      payoutFrequency: InterestPayout.MATURITY,
      withdrawalDate: '2036-03-01T00:00:00.000Z',
      chartStep: 'yearly',
    });
    const monthly = calculateBondInvestment({
      ...baseInputs,
      bondType: BondType.EDO,
      duration: 10,
      firstYearRate: 5.6,
      expectedInflation: 4.0,
      margin: 2.0,
      isCapitalized: true,
      payoutFrequency: InterestPayout.MATURITY,
      withdrawalDate: '2036-03-01T00:00:00.000Z',
      chartStep: 'monthly',
    });

    expect(monthly.netPayoutValue).toBeCloseTo(yearly.netPayoutValue, 8);
    expect(monthly.totalTax).toBeCloseTo(yearly.totalTax, 8);
    expect(monthly.finalRealValue).toBeCloseTo(yearly.finalRealValue, 8);
    expect(monthly.timeline).toHaveLength(yearly.timeline.length);
  });
});
