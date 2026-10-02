import { describe, expect, it } from 'vitest';

import { BondType, TaxStrategy } from '@/features/bond-core/types';
import { buildDefaultSharedConfig } from '@/features/comparison-engine/lib/comparison-calculator-state';
import {
  parseComparisonUrlState,
  withComparisonUrlState,
} from '@/features/comparison-engine/lib/comparison-deep-link';

describe('comparison deep links', () => {
  it('serializes an independently configured pair into a shareable setup URL', () => {
    const defaults = buildDefaultSharedConfig();
    const url = withComparisonUrlState('/compare', new URLSearchParams('utm_source=share'), {
      sharedConfig: {
        ...defaults,
        initialInvestment: 25_000,
        purchaseDate: '2026-08-17',
        withdrawalDate: '2031-08-17',
        investmentHorizonMonths: 60,
        taxStrategy: TaxStrategy.IKE,
        expectedInflation: 3.5,
        expectedNbpRate: 4.25,
      },
      scenarioA: { bondType: BondType.EDO, isRebought: false },
      scenarioB: {
        bondType: BondType.TOS,
        isRebought: false,
        taxStrategy: TaxStrategy.IKZE,
        investmentHorizonMonths: 36,
      },
    });

    expect(url).toContain('utm_source=share');
    expect(url).toContain('scenario=');
    const roundTrip = parseComparisonUrlState(
      new URL(url, 'https://example.test').searchParams,
      defaults,
    );
    expect(roundTrip).toMatchObject({
      sharedConfig: { initialInvestment: 25_000 },
      scenarioA: { bondType: BondType.EDO },
      scenarioB: {
        bondType: BondType.TOS,
        taxStrategy: TaxStrategy.IKZE,
        investmentHorizonMonths: 36,
      },
    });
  });

  it('restores serialized setup state without accepting invalid query values', () => {
    const defaults = buildDefaultSharedConfig();
    const state = parseComparisonUrlState(
      new URLSearchParams(
        'a=EDO&b=TOS&amount=25000&purchase=2026-08-17&withdrawal=2031-08-17&horizon=60&tax=IKE&inflation=3.5&nbp=4.25&taxB=IKZE&horizonB=36',
      ),
      defaults,
    );

    expect(state).toMatchObject({
      sharedConfig: {
        initialInvestment: 25_000,
        purchaseDate: '2026-08-17',
        withdrawalDate: '2031-08-17',
        investmentHorizonMonths: 60,
        taxStrategy: TaxStrategy.IKE,
      },
      scenarioA: { bondType: BondType.EDO },
      scenarioB: {
        bondType: BondType.TOS,
        taxStrategy: TaxStrategy.IKZE,
        investmentHorizonMonths: 36,
      },
    });

    expect(
      parseComparisonUrlState(new URLSearchParams('a=not-a-bond&b=TOS&amount=-1'), defaults),
    ).toBeNull();
  });

  it('uses calculated withdrawal date for general-horizon links', () => {
    const state = parseComparisonUrlState(
      new URLSearchParams('a=EDO&b=TOS&purchase=2026-08-17&horizon=12&timing=general'),
      buildDefaultSharedConfig(),
    );

    expect(state?.sharedConfig.withdrawalDate).toBe('2027-08-17');
  });
});
