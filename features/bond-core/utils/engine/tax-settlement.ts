import { Decimal } from 'decimal.js';

import { TaxStrategy } from '../../types';

/**
 * A settlement policy is deliberately data, rather than a "round it" flag.
 * Accrual remains precise; this policy is only applied when money is settled.
 */
export interface TaxSettlementPolicy {
  version: 'pl-interest-grosz-2026-01' | 'ike-exempt-v1' | 'ikze-withdrawal-v1';
  taxableBaseRounding: Decimal.Rounding;
  taxRounding: Decimal.Rounding;
  settlementUnit: number;
  timing: 'coupon-or-redemption' | 'retirement-withdrawal' | 'none';
}

export const STANDARD_INTEREST_TAX_POLICY: TaxSettlementPolicy = {
  version: 'pl-interest-grosz-2026-01',
  taxableBaseRounding: Decimal.ROUND_UP,
  taxRounding: Decimal.ROUND_UP,
  settlementUnit: 2,
  timing: 'coupon-or-redemption',
};

export const IKE_TAX_POLICY: TaxSettlementPolicy = {
  version: 'ike-exempt-v1',
  taxableBaseRounding: Decimal.ROUND_HALF_UP,
  taxRounding: Decimal.ROUND_HALF_UP,
  settlementUnit: 2,
  timing: 'none',
};

export const IKZE_WITHDRAWAL_TAX_POLICY: TaxSettlementPolicy = {
  version: 'ikze-withdrawal-v1',
  taxableBaseRounding: Decimal.ROUND_HALF_UP,
  taxRounding: Decimal.ROUND_HALF_UP,
  settlementUnit: 2,
  timing: 'retirement-withdrawal',
};

export function settlementPolicyFor(strategy: TaxStrategy): TaxSettlementPolicy {
  if (strategy === TaxStrategy.IKE) return IKE_TAX_POLICY;
  if (strategy === TaxStrategy.IKZE) return IKZE_WITHDRAWAL_TAX_POLICY;
  return STANDARD_INTEREST_TAX_POLICY;
}

/**
 * Calculates the tax based on the selected strategy.
 *
 * STANDARD: 19% Belka tax on interest.
 * IKE: 0% tax.
 * IKZE: 10% flat tax on the WHOLE withdrawal amount (principal + interest) at retirement.
 */
export function calculateTaxAmount(
  amount: Decimal,
  strategy: TaxStrategy,
  policy: TaxSettlementPolicy = settlementPolicyFor(strategy),
  standardTaxRate = 19,
): Decimal {
  if (amount.lte(0)) return new Decimal(0);

  if (strategy === TaxStrategy.IKE) return new Decimal(0);

  // IKZE is 10% flat tax on the total payout in the target scenario (retirement)
  const rate =
    strategy === TaxStrategy.IKZE ? new Decimal(0.1) : new Decimal(standardTaxRate).dividedBy(100);

  if (policy.timing === 'none') return new Decimal(0);
  const taxableBase = amount.toDecimalPlaces(policy.settlementUnit, policy.taxableBaseRounding);
  return taxableBase.times(rate).toDecimalPlaces(policy.settlementUnit, policy.taxRounding);
}

export function shouldWithholdPeriodicTax(strategy: TaxStrategy, isCapitalized: boolean): boolean {
  return strategy === TaxStrategy.STANDARD && !isCapitalized;
}
