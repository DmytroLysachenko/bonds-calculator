import { describe, expect, it } from 'vitest';

import { type BondSeries, type PolishBond } from '@/db/schema';
import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import { BondType, InterestPayout } from '@/features/bond-core/types';
import { mergeBondDefinitionsWithSeries } from '@/lib/data/market-data';

function makeBond(overrides: Partial<PolishBond> = {}): PolishBond {
  return {
    id: 'bond-ror',
    symbol: BondType.ROR,
    fullName: 'Roczne Oszczednosciowe Referencyjne',
    fullNameEn: 'One-year reference savings bond',
    description: 'DB description',
    descriptionEn: 'DB description EN',
    durationDays: 365,
    nominalValue: '100.00',
    capitalizationFreqDays: 0,
    payoutFreqDays: 30,
    interestType: 'floating_nbp',
    firstYearRate: '3.75',
    baseMargin: '0.00',
    withdrawalFee: '0.50',
    withdrawalFeeCap: true,
    rolloverDiscount: '0.10',
    isFamilyOnly: false,
    updatedAt: new Date('2026-05-10T00:00:00.000Z'),
    ...overrides,
  };
}

function makeSeries(overrides: Partial<BondSeries> = {}): BondSeries {
  return {
    id: 'series-ror-0527',
    bondTypeId: 'bond-ror',
    seriesCode: 'ROR0527',
    emissionMonth: '2026-05-01',
    sellStartDate: '2026-05-01',
    sellEndDate: '2026-05-31',
    maturityDate: '2027-05-01',
    firstYearRate: '4.00',
    baseMargin: '0.00',
    earlyWithdrawalFee: null,
    redemptionFeeCap: null,
    termsSourceUrl: null,
    termsRevision: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('mergeBondDefinitionsWithSeries', () => {
  it('keeps the dated curated rate table aligned with the September 2026 Ministry offer', () => {
    const published: Record<BondType, { openingRate: number; margin: number }> = {
      [BondType.OTS]: { openingRate: 2, margin: 0 },
      [BondType.ROR]: { openingRate: 4, margin: 0 },
      [BondType.DOR]: { openingRate: 4.15, margin: 0.15 },
      [BondType.TOS]: { openingRate: 4.4, margin: 0 },
      [BondType.COI]: { openingRate: 4.75, margin: 1.5 },
      [BondType.ROS]: { openingRate: 5, margin: 2 },
      [BondType.EDO]: { openingRate: 5.35, margin: 2 },
      [BondType.ROD]: { openingRate: 5.6, margin: 2.5 },
    };
    for (const bondType of Object.values(BondType)) {
      expect(BOND_DEFINITIONS[bondType].firstYearRate).toBe(published[bondType].openingRate);
      expect(BOND_DEFINITIONS[bondType].margin).toBe(published[bondType].margin);
    }
  });

  it('uses the latest active issued series terms for current floating bonds', () => {
    const defs = mergeBondDefinitionsWithSeries(
      [makeBond()],
      [
        makeSeries({
          id: 'series-ror-0427',
          seriesCode: 'ROR0427',
          emissionMonth: '2026-04-01',
          sellStartDate: '2026-04-01',
          sellEndDate: '2026-04-30',
          maturityDate: '2027-04-01',
          firstYearRate: '3.75',
        }),
        makeSeries(),
      ],
      BOND_DEFINITIONS,
      '2026-05-16',
    );

    expect(defs).toHaveLength(1);
    expect(defs[0].type).toBe(BondType.ROR);
    expect(defs[0].firstYearRate).toBe(4);
    expect(defs[0].rateProvenance).toEqual({
      kind: 'issued-series',
      asOf: '2026-05-01',
      seriesCode: 'ROR0527',
    });
    expect(defs[0].margin).toBe(0);
    expect(defs[0].payoutFrequency).toBe(InterestPayout.MONTHLY);
    expect(defs[0].description.pl).toBe('DB description');
  });

  it('ignores future issued series that are not yet active', () => {
    const defs = mergeBondDefinitionsWithSeries(
      [makeBond()],
      [
        makeSeries(),
        makeSeries({
          id: 'series-ror-0627',
          seriesCode: 'ROR0627',
          emissionMonth: '2026-06-01',
          sellStartDate: '2026-06-01',
          sellEndDate: '2026-06-30',
          maturityDate: '2027-06-01',
          firstYearRate: '4.50',
        }),
      ],
      BOND_DEFINITIONS,
      '2026-05-16',
    );

    expect(defs[0].firstYearRate).toBe(4);
  });

  it('does not label an expired series as the current issued offer', () => {
    const defs = mergeBondDefinitionsWithSeries(
      [makeBond()],
      [makeSeries()],
      BOND_DEFINITIONS,
      '2026-06-16',
    );
    expect(defs[0].rateProvenance?.kind).not.toBe('issued-series');
  });

  it('does not label an invalid issued rate as the displayed rate source', () => {
    const defs = mergeBondDefinitionsWithSeries(
      [makeBond()],
      [makeSeries({ firstYearRate: 'invalid' })],
      BOND_DEFINITIONS,
      '2026-05-16',
    );
    expect(defs[0].rateProvenance?.kind).not.toBe('issued-series');
  });

  it('does not treat a future-dated database update as a current rate record', () => {
    const defs = mergeBondDefinitionsWithSeries(
      [makeBond({ updatedAt: new Date('2026-07-01T00:00:00.000Z') })],
      [],
      BOND_DEFINITIONS,
      '2026-05-16',
    );
    expect(defs[0].rateProvenance).toEqual({ kind: 'curated-reference' });
  });

  it('dates curated opening rates only on or after the documented sale period', () => {
    const earlier = mergeBondDefinitionsWithSeries([], [], BOND_DEFINITIONS, '2026-08-31');
    const documented = mergeBondDefinitionsWithSeries([], [], BOND_DEFINITIONS, '2026-10-01');

    expect(earlier.every((definition) => definition.rateProvenance?.asOf === undefined)).toBe(true);
    expect(documented).toHaveLength(Object.values(BondType).length);
    for (const definition of documented) {
      expect(definition.rateProvenance).toEqual({
        kind: 'curated-reference',
        asOf: '2026-09-01',
        sourceUrl:
          'https://www.gov.pl/web/finanse/podaz-skarbowych-papierow-wartosciowych-we-wrzesniu-2026',
      });
    }
  });

  it('retains the dated curated source when stale database rates are ignored', () => {
    const [definition] = mergeBondDefinitionsWithSeries(
      [makeBond({ updatedAt: new Date('2026-05-10T00:00:00.000Z') })],
      [],
      BOND_DEFINITIONS,
      '2026-10-01',
    );
    expect(definition.firstYearRate).toBe(BOND_DEFINITIONS[BondType.ROR].firstYearRate);
    expect(definition.rateProvenance?.asOf).toBe('2026-09-01');
    expect(definition.rateProvenance?.kind).toBe('curated-reference');
  });

  it('falls back cleanly to family-level bond metadata when there is no active series', () => {
    const defs = mergeBondDefinitionsWithSeries(
      [
        makeBond({
          id: 'bond-coi',
          symbol: BondType.COI,
          fullName: 'Czteroletnie Oszczednosciowe Indeksowane',
          fullNameEn: 'Four-year inflation-linked savings bond',
          description: null,
          descriptionEn: null,
          durationDays: 1460,
          payoutFreqDays: 0,
          capitalizationFreqDays: 365,
          interestType: 'inflation_linked',
          firstYearRate: '6.30',
          baseMargin: '1.50',
          withdrawalFee: '0.70',
          rolloverDiscount: '0.10',
        }),
      ],
      [],
      BOND_DEFINITIONS,
      '2026-05-16',
    );

    expect(defs[0].type).toBe(BondType.COI);
    expect(defs[0].firstYearRate).toBe(6.3);
    expect(defs[0].rateProvenance).toEqual({ kind: 'database-reference', asOf: '2026-05-10' });
    expect(defs[0].margin).toBe(1.5);
    expect(defs[0].isInflationIndexed).toBe(true);
    expect(defs[0].description.pl).toBe(BOND_DEFINITIONS[BondType.COI].description.pl);
  });

  it('falls back to curated current offer data when database bond terms are stale', () => {
    const defs = mergeBondDefinitionsWithSeries(
      [
        makeBond({
          id: 'bond-edo',
          symbol: BondType.EDO,
          fullName: 'Emerytalne Dziesiecioletnie Oszczednosciowe',
          fullNameEn: 'Ten-year inflation-linked savings bond',
          description: null,
          descriptionEn: null,
          durationDays: 3650,
          payoutFreqDays: 0,
          capitalizationFreqDays: 365,
          interestType: 'inflation_linked',
          firstYearRate: '7.25',
          baseMargin: '1.25',
          withdrawalFee: '3.00',
          rolloverDiscount: '0.10',
          updatedAt: new Date('2026-01-10T00:00:00.000Z'),
        }),
      ],
      [],
      BOND_DEFINITIONS,
      '2026-05-16',
    );

    expect(defs[0].type).toBe(BondType.EDO);
    expect(defs[0].firstYearRate).toBe(BOND_DEFINITIONS[BondType.EDO].firstYearRate);
    expect(defs[0].rateProvenance).toEqual({ kind: 'curated-reference' });
    expect(defs[0].margin).toBe(BOND_DEFINITIONS[BondType.EDO].margin);
  });

  it('prefers bootstrap first-month offer rates for floating bonds when no active issued series exists', () => {
    const defs = mergeBondDefinitionsWithSeries(
      [
        makeBond({
          firstYearRate: '5.75',
          baseMargin: '0.00',
        }),
      ],
      [],
      BOND_DEFINITIONS,
      '2026-05-16',
    );

    expect(defs[0].type).toBe(BondType.ROR);
    expect(defs[0].firstYearRate).toBe(BOND_DEFINITIONS[BondType.ROR].firstYearRate);
    expect(defs[0].rateProvenance).toEqual({ kind: 'curated-reference' });
    expect(defs[0].margin).toBe(0);
  });
});
