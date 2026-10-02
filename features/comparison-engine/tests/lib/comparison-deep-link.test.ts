import { describe, expect, it } from 'vitest';

import { BondType, TaxStrategy } from '@/features/bond-core/types';

import { buildDefaultSharedConfig } from '../../lib/comparison-calculator-state';
import {
  parseComparisonBondPair,
  parseComparisonUrlState,
  withComparisonBondPair,
  withComparisonUrlState,
} from '../../lib/comparison-deep-link';
import {
  type PersistedComparisonState,
  restoreComparisonState,
} from '../../lib/comparison-persistence';

function persistedState(): PersistedComparisonState {
  return {
    sharedConfig: buildDefaultSharedConfig(),
    scenarioA: { bondType: BondType.OTS, isRebought: false },
    scenarioB: { bondType: BondType.EDO, isRebought: false },
    comparisonEnvelope: {} as PersistedComparisonState['comparisonEnvelope'],
    committedInputsA: {} as PersistedComparisonState['committedInputsA'],
    committedInputsB: {} as PersistedComparisonState['committedInputsB'],
    isDirty: false,
  };
}

describe('comparison deep-link state', () => {
  it('accepts supported bond pairs, including two strategies for one family', () => {
    expect(parseComparisonBondPair(new URLSearchParams('a=COI&b=EDO'))).toEqual([
      BondType.COI,
      BondType.EDO,
    ]);
    expect(parseComparisonBondPair(new URLSearchParams('a=COI&b=COI'))).toEqual([
      BondType.COI,
      BondType.COI,
    ]);
    expect(parseComparisonBondPair(new URLSearchParams('a=COI&b=NOPE'))).toBeNull();
    expect(parseComparisonBondPair(new URLSearchParams('a=COI'))).toBeNull();
  });

  it('gives a valid deep link precedence over persisted scenarios and results', () => {
    const restored = restoreComparisonState(persistedState(), [BondType.ROR, BondType.DOR]);

    expect(restored).toMatchObject({
      scenarioA: { bondType: BondType.ROR },
      scenarioB: { bondType: BondType.DOR },
      comparisonEnvelope: null,
      committedInputsA: null,
      committedInputsB: null,
      isDirty: true,
    });
  });

  it('changes the URL only when an interaction explicitly supplies a new pair', () => {
    const current = new URLSearchParams('view=compact&a=OTS&b=EDO');

    expect(withComparisonBondPair('/compare', current, [BondType.COI, BondType.EDO])).toBe(
      '/compare?view=compact&a=COI&b=EDO',
    );
  });

  it('round-trips the supported setup without leaking transient UI state', () => {
    const defaults = buildDefaultSharedConfig(new Date('2026-07-22T00:00:00.000Z'));
    const state = parseComparisonUrlState(
      new URLSearchParams(
        'a=ROR&b=EDO&amount=12500&timing=exact&purchase=2026-08-01&withdrawal=2031-08-01&horizon=60&tax=IKE&inflation=2.8&nbp=4.1&taxB=IKZE&horizonA=36',
      ),
      defaults,
    );

    expect(state).toMatchObject({
      sharedConfig: {
        initialInvestment: 12500,
        purchaseDate: '2026-08-01',
        withdrawalDate: '2031-08-01',
        investmentHorizonMonths: 60,
        timingMode: 'exact',
        taxStrategy: TaxStrategy.IKE,
        expectedInflation: 2.8,
        expectedNbpRate: 4.1,
      },
      scenarioA: { bondType: BondType.ROR, investmentHorizonMonths: 36 },
      scenarioB: { bondType: BondType.EDO, taxStrategy: TaxStrategy.IKZE },
    });
    expect(state).not.toBeNull();

    const url = withComparisonUrlState('/compare', new URLSearchParams('panel=chart'), state!);
    expect(url).toContain('panel=chart');
    expect(url).toContain('scenario=');
    expect(url).not.toContain('chartStep');
  });

  it('round-trips per-side cash and maturity policies for the same family', () => {
    const defaults = buildDefaultSharedConfig(new Date('2026-07-22T00:00:00.000Z'));
    const state = {
      sharedConfig: defaults,
      scenarioA: {
        bondType: BondType.ROR,
        strategyPolicy: 'hold_to_maturity' as const,
        couponDisposition: 'cash' as const,
      },
      scenarioB: {
        bondType: BondType.ROR,
        strategyPolicy: 'reinvest_until_horizon' as const,
        couponDisposition: 'reinvest' as const,
      },
    };
    const url = withComparisonUrlState('/compare', new URLSearchParams(), state);
    const decoded = parseComparisonUrlState(
      new URL(url, 'https://example.test').searchParams,
      defaults,
    );

    expect(decoded?.scenarioA).toMatchObject(state.scenarioA);
    expect(decoded?.scenarioB).toMatchObject(state.scenarioB);
  });

  it('rejects malformed supplied fields while retaining defaults for absent legacy fields', () => {
    const defaults = buildDefaultSharedConfig(new Date('2026-07-22T00:00:00.000Z'));
    expect(
      parseComparisonUrlState(
        new URLSearchParams(
          'a=ROR&b=EDO&amount=oops&purchase=not-a-date&horizon=9999&tax=nope&inflation=500&nbp=NaN&horizonA=-1',
        ),
        defaults,
      ),
    ).toBeNull();
    expect(parseComparisonUrlState(new URLSearchParams('a=ROR&b=EDO'), defaults)).toMatchObject({
      sharedConfig: {
        initialInvestment: defaults.initialInvestment,
        purchaseDate: defaults.purchaseDate,
        investmentHorizonMonths: defaults.investmentHorizonMonths,
        taxStrategy: defaults.taxStrategy,
        expectedInflation: defaults.expectedInflation,
      },
      scenarioA: { bondType: BondType.ROR },
      scenarioB: { bondType: BondType.EDO },
    });
    expect(parseComparisonUrlState(new URLSearchParams('a=BAD&b=EDO'), defaults)).toBeNull();
  });

  it('does not admit fractional or over-360-month URL horizons', () => {
    const defaults = buildDefaultSharedConfig(new Date('2026-07-22T00:00:00.000Z'));
    expect(
      parseComparisonUrlState(
        new URLSearchParams('a=ROR&b=EDO&horizon=12.5&horizonA=361&horizonB=24.5'),
        defaults,
      ),
    ).toBeNull();
  });

  it('rejects impossible calendar dates instead of substituting a different calculation', () => {
    const defaults = buildDefaultSharedConfig(new Date('2026-07-22T00:00:00.000Z'));
    const state = parseComparisonUrlState(
      new URLSearchParams('a=COI&b=EDO&purchase=2026-02-30&timing=exact&withdrawal=2027-02-30'),
      defaults,
    );

    expect(state).toBeNull();
  });

  it('does not replace an invalid portable intent with a legacy bond pair', () => {
    const defaults = buildDefaultSharedConfig(new Date('2026-07-22T00:00:00.000Z'));
    expect(
      parseComparisonUrlState(new URLSearchParams('scenario=broken&a=COI&b=EDO'), defaults),
    ).toBeNull();
  });

  it('derives an exact legacy horizon and rejects contradictory or ignored dates', () => {
    const defaults = buildDefaultSharedConfig(new Date('2026-07-22T00:00:00.000Z'));
    const exact = parseComparisonUrlState(
      new URLSearchParams('a=ROR&b=EDO&timing=exact&purchase=2026-08-01&withdrawal=2028-08-01'),
      defaults,
    );
    expect(exact?.sharedConfig).toMatchObject({
      investmentHorizonMonths: 24,
      withdrawalDate: '2028-08-01',
    });
    expect(
      parseComparisonUrlState(
        new URLSearchParams(
          'a=ROR&b=EDO&timing=exact&purchase=2026-08-01&withdrawal=2028-08-01&horizon=12',
        ),
        defaults,
      ),
    ).toBeNull();
    expect(
      parseComparisonUrlState(
        new URLSearchParams('a=ROR&b=EDO&purchase=2026-08-01&withdrawal=2028-08-01'),
        defaults,
      )?.sharedConfig,
    ).toMatchObject({ timingMode: 'exact', investmentHorizonMonths: 24 });
    expect(
      parseComparisonUrlState(
        new URLSearchParams('a=ROR&b=EDO&timing=general&withdrawal=2028-08-01'),
        defaults,
      ),
    ).toBeNull();
  });
});
