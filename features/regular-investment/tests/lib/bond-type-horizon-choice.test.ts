import { describe, expect, it } from 'vitest';

import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import { BondType } from '@/features/bond-core/types';
import {
  buildDefaultLadderInputs,
  resolveLadderBondTypeUpdate,
} from '@/features/ladder-strategy/lib/ladder-state';
import {
  buildRegularInvestmentFallbackInputs,
  resolveRegularInvestmentBondTypeUpdate,
} from '@/features/regular-investment/lib/regular-investment-state';

describe('bond family horizon choice', () => {
  const purchaseDate = new Date('2026-09-01T12:00:00Z');

  it.each([
    [
      'regular',
      buildRegularInvestmentFallbackInputs(purchaseDate),
      (
        inputs: ReturnType<typeof buildRegularInvestmentFallbackInputs>,
        choice: 'native' | 'preserve',
      ) =>
        resolveRegularInvestmentBondTypeUpdate(
          inputs,
          BondType.ROR,
          BOND_DEFINITIONS[BondType.ROR],
          choice,
        ),
    ],
    [
      'ladder',
      buildDefaultLadderInputs(purchaseDate),
      (inputs: ReturnType<typeof buildDefaultLadderInputs>, choice: 'native' | 'preserve') =>
        resolveLadderBondTypeUpdate(inputs, BondType.ROR, null, choice),
    ],
  ] as const)('%s requires an explicit native or preserved horizon', (_kind, inputs, update) => {
    const preserved = update(inputs, 'preserve');
    const native = update(inputs, 'native');

    expect(preserved.investmentHorizonMonths).toBe(120);
    expect(preserved.withdrawalDate).toBe(inputs.withdrawalDate);
    expect(native.investmentHorizonMonths).toBe(12);
    expect(native.withdrawalDate).toBe('2027-09-01');
  });
});
