import { describe, expect, it } from 'vitest';

import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import { BondType, TaxStrategy } from '@/features/bond-core/types';

import { applyGuardrailFix, getInputGuardrails } from './input-guardrails';

const bond = BOND_DEFINITIONS[BondType.TOS];
const baseInputs = {
  bondType: BondType.TOS,
  initialInvestment: 1_000,
  firstYearRate: bond.firstYearRate,
  expectedInflation: 3,
  expectedNbpRate: 5,
  margin: bond.margin,
  duration: bond.duration,
  earlyWithdrawalFee: bond.earlyWithdrawalFee,
  taxRate: 19,
  isCapitalized: bond.isCapitalized,
  payoutFrequency: bond.payoutFrequency,
  purchaseDate: '2026-01-01',
  withdrawalDate: '2029-01-01',
  isRebought: false,
  rebuyDiscount: bond.rebuyDiscount,
  taxStrategy: TaxStrategy.STANDARD,
};

describe('input guardrails', () => {
  it('blocks an investment below one bond and offers a safe correction', () => {
    const issue = getInputGuardrails({ ...baseInputs, initialInvestment: 50 }).find(
      ({ id }) => id === 'minimum-investment',
    );

    expect(issue?.severity).toBe('blocking');
    expect(
      applyGuardrailFix(issue!, { ...baseInputs, initialInvestment: 50 }).initialInvestment,
    ).toBe(100);
  });

  it('blocks withdrawal dates before purchase', () => {
    const issue = getInputGuardrails({ ...baseInputs, withdrawalDate: '2025-12-01' }).find(
      ({ id }) => id === 'date-order',
    );

    expect(issue?.severity).toBe('blocking');
    expect(
      applyGuardrailFix(issue!, { ...baseInputs, withdrawalDate: '2025-12-01' }).withdrawalDate,
    ).toBe('2026-02-01');
  });

  it('blocks partial bond quantities and rounds to the supported denomination', () => {
    const issue = getInputGuardrails({ ...baseInputs, initialInvestment: 1_250 }).find(
      ({ id }) => id === 'whole-bond-quantity',
    );

    expect(issue?.severity).toBe('blocking');
    expect(
      applyGuardrailFix(issue!, { ...baseInputs, initialInvestment: 1_250 }).initialInvestment,
    ).toBe(1_200);
  });
});
