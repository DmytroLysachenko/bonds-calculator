import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { BondType } from '../../types';

import { calculateEarlyWithdrawalFee } from './redemption';

describe('issued redemption fee policy', () => {
  it('caps an interest-basis fee at current accrued interest', () => {
    expect(
      calculateEarlyWithdrawalFee(
        BondType.ROR,
        true,
        false,
        new Decimal('0.40'),
        new Decimal(1),
        2,
        'interest',
      ).toString(),
    ).toBe('0.4');
  });

  it('allows an evidenced principal-basis later-period fee without recharging paid coupons', () => {
    expect(
      calculateEarlyWithdrawalFee(
        BondType.ROR,
        true,
        false,
        new Decimal('0.40'),
        new Decimal(2),
        2,
        'principal',
      ).toString(),
    ).toBe('4');
  });
});
