import { describe, expect, it } from 'vitest';

import { BondType } from '@/features/bond-core/types';

import { resolveSingleCalculatorRestoration } from '../../lib/single-calculator-restoration';
import { buildFallbackInputs } from '../../lib/single-calculator-state';

describe('single calculator restoration', () => {
  const fallbackInputs = buildFallbackInputs(new Date('2026-06-16T00:00:00.000Z'));

  it('gives an explicit URL bond journey precedence over a persisted draft', () => {
    const restored = resolveSingleCalculatorRestoration({
      bondFromUrl: BondType.EDO,
      fallbackInputs,
      persistedState: {
        inputs: { ...fallbackInputs, bondType: BondType.OTS },
        envelope: null,
        selectedSeriesId: 'old-series',
        lastCommittedInputs: null,
        isDirty: false,
      },
    });

    expect(restored).toMatchObject({
      selectedSeriesId: 'current',
      isDirty: true,
      restoredFromPersistence: false,
      envelope: null,
    });
    expect(restored?.inputs.bondType).toBe(BondType.EDO);
    expect(restored?.inputs.investmentHorizonMonths).toBe(120);
  });

  it('returns null for an invalid persisted session when no URL journey is present', () => {
    expect(
      resolveSingleCalculatorRestoration({
        fallbackInputs,
        persistedState: {
          inputs: { ...fallbackInputs, initialInvestment: -1 },
          envelope: null,
          selectedSeriesId: 'current',
          lastCommittedInputs: null,
          isDirty: false,
        },
      }),
    ).toBeNull();
  });
});
