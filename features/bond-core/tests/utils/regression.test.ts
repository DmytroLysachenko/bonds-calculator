import { describe, expect, it } from 'vitest';

import { BondType, InterestPayout, InvestmentFrequency, TaxStrategy } from '../../types';
import { calculateBondInvestment, calculateRegularInvestment } from '../../utils/calculations';

describe('Bond Core Regression Tests', () => {
  const baseInputs = {
    bondType: BondType.EDO,
    initialInvestment: 10000,
    firstYearRate: 7.5,
    expectedInflation: 15.0, // High inflation case
    margin: 1.5,
    duration: 10,
    earlyWithdrawalFee: 2.0,
    taxRate: 19,
    isCapitalized: true,
    payoutFrequency: InterestPayout.YEARLY,
    purchaseDate: '2023-01-01',
    withdrawalDate: '2033-01-01',
    isRebought: false,
    rebuyDiscount: 0,
    taxStrategy: TaxStrategy.STANDARD,
  };

  describe('Edge Cases: Early Withdrawal Fee Caps', () => {
    it('caps early withdrawal fee at accumulated interest (short duration)', () => {
      const inputs = {
        ...baseInputs,
        withdrawalDate: '2023-02-01', // Only 1 month in
      };
      const result = calculateBondInvestment(inputs);
      // 10000 * 0.075 / 365 * 31 days = 63.69
      expect(result.totalEarlyWithdrawalFee).toBeCloseTo(63.7, 1);
      expect(result.netPayoutValue).toBe(10000); // Should get initial capital back if tax is 0 or handled
    });

    it('applies full fee when interest exceeds cap (long duration)', () => {
      const inputs = {
        ...baseInputs,
        withdrawalDate: '2028-01-01', // 5 years in
      };
      const result = calculateBondInvestment(inputs);
      expect(result.totalEarlyWithdrawalFee).toBe(200); // 100 bonds * 2.00
      expect(result.netPayoutValue).toBeGreaterThan(10000);
    });
  });

  describe('Edge Cases: Rollover / Reinvestment Chains', () => {
    it('simulates long rollover chains without accumulation errors', () => {
      const inputs = {
        ...baseInputs,
        bondType: BondType.OTS, // 3-month bond
        duration: 0.25,
        rollover: true,
        investmentHorizonMonths: 24, // 2 years = 8 cycles
        purchaseDate: '2024-01-01',
        withdrawalDate: '2026-01-01',
      };
      const result = calculateBondInvestment(inputs);
      // Check if we have multiple cycles in the timeline
      expect(result.timeline.length).toBeGreaterThan(2);
      expect(result.netPayoutValue).toBeGreaterThan(11000); // Roughly 5% annual yield
    });
  });

  describe('Regular Investment: Horizon Mismatches', () => {
    it('handles short horizon on long duration bonds', () => {
      const inputs = {
        contributionAmount: 1000,
        frequency: InvestmentFrequency.MONTHLY,
        investmentHorizonMonths: 1, // Only 1 month to ensure fee > interest
        bondType: BondType.EDO, // 10-year bond
        firstYearRate: 7.5,
        expectedInflation: 2.0,
        margin: 1.5,
        duration: 10,
        earlyWithdrawalFee: 2.0,
        taxRate: 19,
        isCapitalized: true,
        payoutFrequency: InterestPayout.YEARLY,
        purchaseDate: '2024-01-01',
        withdrawalDate: '2024-02-01',
        isRebought: false,
        rebuyDiscount: 0,
        taxStrategy: TaxStrategy.IKE,
      };
      const result = calculateRegularInvestment(inputs);
      // Fee should cap interest to 0 profit
      expect(result.totalProfit).toBe(0);
      // Terminal output is the net settlement after the early-exit charge.
      expect(result.finalNominalValue).toBeGreaterThanOrEqual(result.totalInvested);
    });

    it('handles long horizon with many small lots', () => {
      const inputs = {
        contributionAmount: 100,
        frequency: InvestmentFrequency.MONTHLY,
        investmentHorizonMonths: 120, // 10 years = 120 lots
        bondType: BondType.ROR,
        firstYearRate: 6.0,
        expectedInflation: 2.0,
        margin: 0,
        duration: 1,
        earlyWithdrawalFee: 0.7,
        taxRate: 19,
        isCapitalized: false,
        payoutFrequency: InterestPayout.MONTHLY,
        purchaseDate: '2024-01-01',
        withdrawalDate: '2034-01-01',
        isRebought: false,
        rebuyDiscount: 0,
        taxStrategy: TaxStrategy.STANDARD,
      };
      const result = calculateRegularInvestment(inputs);
      expect(result.lots.length).toBe(120);
      expect(result.totalInvested).toBe(12000);
      expect(result.finalNominalValue).toBeGreaterThan(12000);
    });
  });

  describe('Tax Strategies: IKE / IKZE', () => {
    it('applies 0% tax for IKE strategy', () => {
      const inputs = {
        ...baseInputs,
        taxStrategy: TaxStrategy.IKE,
      };
      const result = calculateBondInvestment(inputs);
      expect(result.totalTax).toBe(0);
    });

    it('applies standard tax for STANDARD strategy', () => {
      const inputs = {
        ...baseInputs,
        taxStrategy: TaxStrategy.STANDARD,
      };
      const result = calculateBondInvestment(inputs);
      expect(result.totalTax).toBeGreaterThan(0);
    });
  });
});
