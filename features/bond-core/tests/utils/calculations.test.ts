import { describe, expect, it } from 'vitest';

import { BondType, InterestPayout, InvestmentFrequency, TaxStrategy } from '../../types';
import { calculateBondInvestment, calculateRegularInvestment } from '../../utils/calculations';

describe('Bond Calculations Engine (Modular)', () => {
  const baseInputs = {
    initialInvestment: 10000,
    firstYearRate: 6.0,
    expectedInflation: 2.0,
    margin: 1.5,
    duration: 4,
    earlyWithdrawalFee: 2.0,
    taxRate: 19,
    bondType: BondType.COI,
    isCapitalized: false,
    payoutFrequency: InterestPayout.YEARLY,
    purchaseDate: '2024-01-01',
    withdrawalDate: '2028-01-01',
    isRebought: false,
    rebuyDiscount: 0.1,
    taxStrategy: TaxStrategy.STANDARD,
  };

  describe('Single Investment', () => {
    it('calculates 3-month OTS bond correctly', () => {
      const inputs = {
        ...baseInputs,
        bondType: BondType.OTS,
        duration: 0.25,
        firstYearRate: 3.0,
        withdrawalDate: '2024-04-01',
      };
      const results = calculateBondInvestment(inputs);

      // 10000 * 3% * (3/12) = 75 gross interest
      // 75 * 19% tax = 14.25 tax
      // Rounded tax (official) = 14 (base 75 * 0.19 = 14.25 -> rounded to 14)
      // Tax is settled under the grosz rule: 75 * 19% = 14.25.
      expect(results.grossValue).toBeCloseTo(10075, 2);
      expect(results.totalProfit).toBeCloseTo(60.75, 2);
    });

    it('handles deflation correctly (floor at 0%)', () => {
      const inputs = {
        ...baseInputs,
        expectedInflation: -5.0, // Deflation
        firstYearRate: 1.0,
        margin: 1.0,
        duration: 2,
        withdrawalDate: '2026-01-01',
      };
      const results = calculateBondInvestment(inputs);

      // Index 0 is Year 0. Index 1 is Year 1.
      // Year 1: 1.0% (fixed)
      // Year 2: max(0, -5.0) + 1.0 = 1.0%
      expect(results.timeline[1].interestRate).toBe(1.0);
      expect(results.timeline[2].interestRate).toBe(1.0);
    });

    it('handles leap years correctly for interest periods', () => {
      const inputs = {
        ...baseInputs,
        purchaseDate: '2024-02-28', // Leap year
        withdrawalDate: '2025-02-28',
        duration: 1,
      };
      const results = calculateBondInvestment(inputs);
      expect(results.timeline.length).toBeGreaterThan(1);
      expect(results.timeline[1].isMaturity).toBe(true);
    });

    it('caps early withdrawal fee to accumulated interest', () => {
      const inputs = {
        ...baseInputs,
        withdrawalDate: '2024-02-01', // Withdraw after 1 month
        earlyWithdrawalFee: 2.0, // 200 PLN total fee
      };
      const results = calculateBondInvestment(inputs);

      // 10000 * 6% * (31/366) approx 50.81 interest
      // Fee should be 50.81, not 200
      expect(results.totalEarlyWithdrawalFee).toBeLessThanOrEqual(
        results.grossValue - results.initialInvestment + 0.01,
      );
      expect(results.netPayoutValue).toBeGreaterThanOrEqual(results.initialInvestment);
    });

    it('correctly calculates EDO 10-year early withdrawal fee boundaries', () => {
      const inputs = {
        ...baseInputs,
        bondType: BondType.EDO,
        duration: 10,
        firstYearRate: 7.0,
        earlyWithdrawalFee: 2.0,
        isCapitalized: true,
        payoutFrequency: InterestPayout.MATURITY,
        withdrawalDate: '2024-02-01', // 1 month in => Fee must be capped
      };
      const resultsCapped = calculateBondInvestment(inputs);
      expect(resultsCapped.totalEarlyWithdrawalFee).toBeLessThan(200);

      const inputsYear9 = {
        ...inputs,
        withdrawalDate: '2033-06-01', // 9.5 years in => Massive accumulated interest
      };
      const resultsNotCapped = calculateBondInvestment(inputsYear9);
      expect(resultsNotCapped.totalEarlyWithdrawalFee).toBeCloseTo(200, 1); // Full 2.00 fee applies perfectly
    });
  });

  describe('Regular Investment', () => {
    it('simulates monthly contributions correctly', () => {
      const inputs = {
        contributionAmount: 1000,
        frequency: InvestmentFrequency.MONTHLY,
        investmentHorizonMonths: 12,
        bondType: BondType.OTS,
        firstYearRate: 3.0,
        expectedInflation: 2.0,
        margin: 0,
        duration: 0.25,
        earlyWithdrawalFee: 0.7,
        taxRate: 19,
        isCapitalized: false,
        payoutFrequency: InterestPayout.MATURITY,
        purchaseDate: '2024-01-01',
        withdrawalDate: '2025-01-01',
        isRebought: false,
        rebuyDiscount: 0,
        taxStrategy: TaxStrategy.STANDARD,
      };

      const results = calculateRegularInvestment(inputs);

      // 12 months * 1000 = 12000 invested
      expect(results.totalInvested).toBe(12000);
      expect(results.lots.length).toBe(12);
    });

    it('handles quarterly frequency', () => {
      const inputs = {
        ...baseInputs,
        contributionAmount: 1000,
        frequency: InvestmentFrequency.QUARTERLY,
        investmentHorizonMonths: 12,
        purchaseDate: '2024-01-01',
        withdrawalDate: '2025-01-01',
      };
      const results = calculateRegularInvestment(inputs);

      // Q1, Q2, Q3, Q4 = 4 lots
      expect(results.lots.length).toBe(4);
    });
  });
});
