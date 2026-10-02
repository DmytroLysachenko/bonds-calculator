import { describe, expect, it } from 'vitest';

import { bondSeriesOfferConflictValues } from './offer-terms-repository';

const rateRefresh = {
  bondTypeId: '11111111-1111-4111-8111-111111111111',
  seriesCode: 'ROR1027',
  emissionMonth: '2026-10-01',
  sellStartDate: '2026-10-01',
  sellEndDate: '2026-10-31',
  maturityDate: '2027-10-01',
  firstYearRate: '5.00',
  margin: '0.00',
};

describe('issued-series rate refresh', () => {
  it('leaves reviewed fee policy and source revision untouched when sync has rates only', () => {
    expect(bondSeriesOfferConflictValues(rateRefresh)).toEqual({
      firstYearRate: '5.00',
      baseMargin: '0.00',
      sellStartDate: '2026-10-01',
      sellEndDate: '2026-10-31',
      maturityDate: '2027-10-01',
    });
  });

  it('updates explicit issued-rule evidence together with rates', () => {
    expect(
      bondSeriesOfferConflictValues({
        ...rateRefresh,
        earlyWithdrawalFee: '0.50',
        redemptionFeeCap: 'first-interest-then-principal',
        termsSourceUrl: 'https://www.obligacjeskarbowe.pl/example',
        termsRevision: 'ROR1027',
      }),
    ).toMatchObject({
      earlyWithdrawalFee: '0.50',
      redemptionFeeCap: 'first-interest-then-principal',
      termsSourceUrl: 'https://www.obligacjeskarbowe.pl/example',
      termsRevision: 'ROR1027',
    });
  });
});
