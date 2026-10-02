import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { BondType, InterestPayout, TaxStrategy } from '../../../types';
import { calculatePeriodAccrual } from '../../../utils/engine/accrual';
import { calculateTaxAmount, settlementPolicyFor } from '../../../utils/engine/tax-settlement';

describe('Bond Engine - Production Accuracy', () => {
  describe('Interest Accrual', () => {
    it('should calculate OTS (3-month) interest correctly (fixed 1/4 year)', () => {
      const principal = new Decimal(100);
      const rate = new Decimal(3.0); // 3%
      const result = calculatePeriodAccrual(
        principal,
        rate,
        90,
        90,
        BondType.OTS,
        InterestPayout.MATURITY,
      );
      // 100 * 0.03 * 3/12 = 0.75
      expect(result.interestEarned.toNumber()).toBe(0.75);
    });

    it('should calculate ROR (1-year) monthly payout exactly as rate/12', () => {
      const principal = new Decimal(100);
      const rate = new Decimal(6.0); // 6%
      const result = calculatePeriodAccrual(
        principal,
        rate,
        31,
        31,
        BondType.ROR,
        InterestPayout.MONTHLY,
      );
      // 100 * 0.06 / 12 = 0.50
      expect(result.interestEarned.toNumber()).toBe(0.5);
    });

    it('should handle partial months for ROR with Act/365 convention', () => {
      const principal = new Decimal(100);
      const rate = new Decimal(6.0); // 6%
      const result = calculatePeriodAccrual(
        principal,
        rate,
        15,
        31,
        BondType.ROR,
        InterestPayout.MONTHLY,
      );
      // 100 * 0.06 * 15/365 = 0.2465753424657534
      expect(result.interestEarned.toFixed(4)).toBe('0.2466');
    });
  });

  describe('Tax Settlement (Official Rounding)', () => {
    it('rounds standard interest tax upward to grosze', () => {
      // Article 63 § 1a exception: standard interest income does not use
      // whole-zloty rounding.

      const tax1 = calculateTaxAmount(
        new Decimal(10.49),
        TaxStrategy.STANDARD,
        settlementPolicyFor(TaxStrategy.STANDARD),
      );
      expect(tax1.toNumber()).toBe(2); // 10.49 * 19% = 1.9931 -> 2.00

      const tax2 = calculateTaxAmount(
        new Decimal(10.51),
        TaxStrategy.STANDARD,
        settlementPolicyFor(TaxStrategy.STANDARD),
      );
      expect(tax2.toNumber()).toBe(2); // 10.51 * 19% = 1.9969 -> 2.00

      const tax3 = calculateTaxAmount(
        new Decimal(15.0),
        TaxStrategy.STANDARD,
        settlementPolicyFor(TaxStrategy.STANDARD),
      );
      expect(tax3.toNumber()).toBe(2.85);

      const smallTax = calculateTaxAmount(
        new Decimal(0.33),
        TaxStrategy.STANDARD,
        settlementPolicyFor(TaxStrategy.STANDARD),
      );
      expect(smallTax.toNumber()).toBe(0.07);
    });

    it('should calculate IKZE 10% flat tax on whole amount with official rounding', () => {
      // 1000 PLN payout -> 100 PLN tax (10%)
      const tax = calculateTaxAmount(
        new Decimal(1000),
        TaxStrategy.IKZE,
        settlementPolicyFor(TaxStrategy.IKZE),
      );
      expect(tax.toNumber()).toBe(100);
    });
  });
});
