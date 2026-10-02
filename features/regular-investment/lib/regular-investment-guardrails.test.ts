import { describe, expect, it } from 'vitest';

import { getRegularInvestmentGuardrails } from './regular-investment-guardrails';

describe('regular investment guardrails', () => {
  const base = {
    purchaseDate: '2026-05-01',
    withdrawalDate: '2028-05-01',
    contributionAmount: 1_000,
  };

  it('blocks a withdrawal before the first planned contribution', () => {
    expect(
      getRegularInvestmentGuardrails({ ...base, withdrawalDate: '2026-04-30' }).map(
        (issue) => issue.id,
      ),
    ).toContain('date-order');
  });

  it('blocks contribution amounts that cannot buy whole bonds', () => {
    expect(
      getRegularInvestmentGuardrails({ ...base, contributionAmount: 1_050 }).find(
        (issue) => issue.id === 'whole-bond-quantity',
      )?.severity,
    ).toBe('blocking');
  });
});
