import { describe, expect, it } from 'vitest';

import type { BondInputs } from '@/features/bond-core/types';
import type { SingleBondCalculationEnvelope } from '@/features/bond-core/types/scenarios';

import { buildSingleBondReportProvenance } from './report-provenance';

describe('single-bond export provenance', () => {
  const inputs = {
    purchaseDate: '2026-09-01',
    withdrawalDate: '2036-09-01',
    taxStrategy: 'STANDARD',
  } as BondInputs;

  it('uses committed engine policy and source revision for CSV and PDF', () => {
    const envelope = {
      calculationVersion: 'model-v7',
      taxRulesRevision: 'tax-2026',
      dataFreshness: {
        status: 'fresh',
        usedFallback: false,
        bondOfferSource: 'gov.pl',
        lastSyncedAt: '2026-09-01T10:00:00Z',
        coverageAsOf: '2026-09-01',
      },
      offerTerms: {
        source: 'series',
        seriesCode: 'EDO0936',
        termsRevision: 'terms-2026-09',
        termsAreVerified: true,
      },
      diagnostics: [{ code: 'auto_rollover', severity: 'assumption' }],
    } as SingleBondCalculationEnvelope;

    expect(buildSingleBondReportProvenance(inputs, envelope)).toMatchObject({
      calculationVersion: 'model-v7',
      taxRulesRevision: 'tax-2026',
      offerSeries: 'EDO0936',
      offerRevision: 'terms-2026-09',
      cashPolicy: 'rollover',
      dataSource: 'gov.pl',
      dataLastSyncedAt: '2026-09-01T10:00:00Z',
      coverageAsOf: '2026-09-01',
      purchaseDate: '2026-09-01',
      withdrawalDate: '2036-09-01',
    });
  });

  it('does not invent a model version or cash policy for an old result', () => {
    expect(buildSingleBondReportProvenance(inputs)).toMatchObject({
      calculationVersion: undefined,
      cashPolicy: undefined,
    });
  });

  it('does not mistake the ignored legacy single rollover flag for engine policy', () => {
    expect(buildSingleBondReportProvenance({ ...inputs, rollover: false })).toMatchObject({
      cashPolicy: undefined,
    });
    expect(
      buildSingleBondReportProvenance({ ...inputs, rollover: false }, {
        diagnostics: [{ code: 'auto_rollover', severity: 'assumption' }],
      } as SingleBondCalculationEnvelope),
    ).toMatchObject({ cashPolicy: 'rollover' });
  });
});
