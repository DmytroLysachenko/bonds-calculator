import { describe, expect, it } from 'vitest';

import {
  InvestmentLotSchema,
  InvestmentLotUpdateSchema,
  PORTFOLIO_LIMITS,
  PortfolioLotTransactionSchema,
  PortfolioSchema,
} from './portfolio-schemas';

const validLot = {
  portfolioId: '00000000-0000-4000-8000-000000000001',
  bondType: 'COI',
  purchaseDate: '2026-02-28',
  bondQuantity: 100.25,
  selectedSeriesId: null,
  isRebought: false,
  notes: 'Long-term allocation',
};

describe('portfolio command schemas', () => {
  describe('portfolio creation', () => {
    it('accepts a trimmed bounded name and optional description', () => {
      expect(
        PortfolioSchema.parse({
          name: ' Family bonds ',
          description: ' Goal-oriented holdings ',
        }),
      ).toEqual({ name: 'Family bonds', description: 'Goal-oriented holdings' });
    });

    it.each([
      ['', 'blank name'],
      [' '.repeat(4), 'whitespace-only name'],
      ['x'.repeat(PORTFOLIO_LIMITS.nameLength + 1), 'overlong name'],
    ])('rejects %s', (name) => {
      expect(PortfolioSchema.safeParse({ name }).success).toBe(false);
    });

    it('rejects description beyond the documented boundary', () => {
      expect(
        PortfolioSchema.safeParse({
          name: 'Bonds',
          description: 'x'.repeat(PORTFOLIO_LIMITS.descriptionLength + 1),
        }).success,
      ).toBe(false);
    });

    it('rejects unrecognized command fields', () => {
      expect(
        PortfolioSchema.safeParse({ name: 'Bonds', ownerId: 'attacker-controlled' }).success,
      ).toBe(false);
    });
  });

  describe('portfolio lot creation', () => {
    it('accepts canonical supported lot input', () => {
      expect(InvestmentLotSchema.parse(validLot)).toEqual(validLot);
    });

    it('defaults an omitted rebuy flag only on creation', () => {
      const withoutFlag = { ...validLot };
      delete (withoutFlag as Partial<typeof validLot>).isRebought;
      expect(InvestmentLotSchema.parse(withoutFlag)).toMatchObject({ isRebought: false });
    });

    it.each(['UNKNOWN', 'coi', '', 'COI '])('rejects unsupported bond type %j', (bondType) => {
      expect(InvestmentLotSchema.safeParse({ ...validLot, bondType }).success).toBe(false);
    });

    it.each(['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-01', 'not-a-date'])(
      'rejects impossible calendar date %s',
      (purchaseDate) => {
        expect(InvestmentLotSchema.safeParse({ ...validLot, purchaseDate }).success).toBe(false);
      },
    );

    it.each([
      [0, 'zero'],
      [-100, 'negative'],
      [Number.NaN, 'NaN'],
      [Number.POSITIVE_INFINITY, 'infinity'],
      [PORTFOLIO_LIMITS.lotAmount + 0.01, 'over business ceiling'],
      [100.001, 'three fractional digits'],
      [0.0001, 'sub-grosz amount'],
    ])('rejects %s bond quantity', (bondQuantity) => {
      expect(InvestmentLotSchema.safeParse({ ...validLot, bondQuantity }).success).toBe(false);
    });

    it.each([0.01, 1, 100, 100.1, 100.25, PORTFOLIO_LIMITS.lotAmount])(
      'accepts valid bond quantity %s',
      (bondQuantity) => {
        expect(InvestmentLotSchema.safeParse({ ...validLot, bondQuantity }).success).toBe(true);
      },
    );

    it('rejects an invalid selected series identifier', () => {
      expect(
        InvestmentLotSchema.safeParse({ ...validLot, selectedSeriesId: 'not-a-uuid' }).success,
      ).toBe(false);
    });

    it('accepts no selected series identifier or an explicit null', () => {
      const withoutSeries = { ...validLot };
      delete (withoutSeries as Partial<typeof validLot>).selectedSeriesId;
      expect(InvestmentLotSchema.safeParse(withoutSeries).success).toBe(true);
      expect(
        InvestmentLotSchema.safeParse({ ...withoutSeries, selectedSeriesId: null }).success,
      ).toBe(true);
    });

    it('trims notes and enforces their maximum length', () => {
      expect(InvestmentLotSchema.parse({ ...validLot, notes: ' note ' }).notes).toBe('note');
      expect(
        InvestmentLotSchema.safeParse({
          ...validLot,
          notes: 'x'.repeat(PORTFOLIO_LIMITS.lotNotesLength + 1),
        }).success,
      ).toBe(false);
    });

    it.each([
      { extra: true },
      { portfolioId: undefined },
      { amount: '100.00' },
      { isRebought: 'false' },
    ])('rejects weakly typed or unknown input %j', (override) => {
      expect(InvestmentLotSchema.safeParse({ ...validLot, ...override }).success).toBe(false);
    });
  });

  describe('portfolio lot updates', () => {
    it('accepts a focused field update without injecting create defaults', () => {
      expect(InvestmentLotUpdateSchema.parse({ notes: 'Reviewed' })).toEqual({ notes: 'Reviewed' });
      expect(InvestmentLotUpdateSchema.parse({ bondQuantity: 200 })).toEqual({
        bondQuantity: 200,
      });
    });

    it('rejects an empty patch command', () => {
      expect(InvestmentLotUpdateSchema.safeParse({}).success).toBe(false);
    });

    it('rejects unknown fields in a patch command', () => {
      expect(InvestmentLotUpdateSchema.safeParse({ unknown: true }).success).toBe(false);
    });

    it.each([
      { bondQuantity: 1.001 },
      { bondQuantity: -1 },
      { bondType: 'UNKNOWN' },
      { purchaseDate: '2026-02-30' },
      { portfolioId: 'not-a-uuid' },
    ])('applies create invariants to every mutable field: %j', (update) => {
      expect(InvestmentLotUpdateSchema.safeParse(update).success).toBe(false);
    });

    it('allows moving a lot to a validated portfolio', () => {
      expect(
        InvestmentLotUpdateSchema.parse({
          portfolioId: '00000000-0000-4000-8000-000000000002',
        }),
      ).toEqual({ portfolioId: '00000000-0000-4000-8000-000000000002' });
    });

    it('allows clearing a selected series explicitly', () => {
      expect(InvestmentLotUpdateSchema.parse({ selectedSeriesId: null })).toEqual({
        selectedSeriesId: null,
      });
    });
  });

  describe('portfolio buy transactions', () => {
    it('shares strict canonical lot constraints with direct lot creation', () => {
      const transaction = { ...validLot };
      delete (transaction as Partial<typeof validLot>).selectedSeriesId;
      expect(PortfolioLotTransactionSchema.parse(transaction)).toEqual(transaction);
    });

    it('does not accept a series identifier unsupported by the buy transaction command', () => {
      expect(
        PortfolioLotTransactionSchema.safeParse({
          ...validLot,
          selectedSeriesId: '00000000-0000-4000-8000-000000000002',
        }).success,
      ).toBe(false);
    });

    it.each([
      { bondQuantity: 10.001 },
      { bondType: 'UNKNOWN' },
      { purchaseDate: '2026-02-30' },
      { notes: 'x'.repeat(PORTFOLIO_LIMITS.lotNotesLength + 1) },
      { unexpected: true },
    ])('rejects invalid buy-transaction payload %j', (override) => {
      const transaction = { ...validLot };
      delete (transaction as Partial<typeof validLot>).selectedSeriesId;
      expect(PortfolioLotTransactionSchema.safeParse({ ...transaction, ...override }).success).toBe(
        false,
      );
    });
  });
});
