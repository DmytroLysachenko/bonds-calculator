import { describe, expect, it } from 'vitest';

import { ImportPayloadSchema } from '@/lib/server/portfolio/import-schema';

const valid = {
  portfolio: {
    name: 'Long-term bonds',
    description: 'A sensible imported portfolio',
    lots: [{ bondType: 'COI', purchaseDate: '2026-07-30', amount: '100' }],
  },
};

describe('portfolio import schema', () => {
  it('accepts a bounded, well-formed import', () => {
    expect(ImportPayloadSchema.parse(valid)).toEqual({
      portfolio: {
        ...valid.portfolio,
        lots: valid.portfolio.lots.map(({ amount, ...lot }) => ({
          ...lot,
          bondQuantity: amount,
        })),
      },
    });
  });

  it('accepts its versioned export envelope and preserves the issued-series identity', () => {
    const parsed = ImportPayloadSchema.parse({
      version: '2.0',
      packageType: 'portfolio-export',
      exportedAt: '2026-09-15T10:00:00.000Z',
      appVersion: '3.0.0-tax-calendar-inflation',
      portfolio: {
        ...valid.portfolio,
        lots: [
          { ...valid.portfolio.lots[0], bondSeriesId: 'c1af1c0f-fb73-4e25-a1e1-7838b38703e1' },
        ],
      },
    });

    expect(parsed.portfolio.lots[0].bondSeriesId).toBe('c1af1c0f-fb73-4e25-a1e1-7838b38703e1');
  });

  it('decodes a real package export without restoring database or calculated fields', () => {
    const parsed = ImportPayloadSchema.parse({
      version: '2.0',
      packageType: 'portfolio-package',
      exportedAt: '2026-09-15T10:00:00.000Z',
      appVersion: '3.0.0-tax-calendar-inflation',
      assumptions: { expectedInflation: 3.5 },
      summary: { totalNetValue: 123_456 },
      portfolio: {
        id: 'c1af1c0f-fb73-4e25-a1e1-7838b38703e1',
        name: 'Portable package',
        description: null,
        lots: [
          {
            bondType: 'EDO',
            bondTypeId: 'c1af1c0f-fb73-4e25-a1e1-7838b38703e1',
            bondSeriesId: 'c1af1c0f-fb73-4e25-a1e1-7838b38703e1',
            seriesCode: 'EDO1036',
            purchaseDate: '2026-09-15',
            amount: '100.00',
            isRebought: false,
            notes: null,
          },
        ],
      },
    });

    expect(parsed).toEqual({
      version: '2.0',
      packageType: 'portfolio-package',
      exportedAt: '2026-09-15T10:00:00.000Z',
      appVersion: '3.0.0-tax-calendar-inflation',
      portfolio: {
        name: 'Portable package',
        description: undefined,
        lots: [
          {
            bondType: 'EDO',
            purchaseDate: '2026-09-15',
            bondSeriesId: 'c1af1c0f-fb73-4e25-a1e1-7838b38703e1',
            seriesCode: 'EDO1036',
            isRebought: false,
            notes: undefined,
            bondQuantity: '100.00',
          },
        ],
      },
    });
  });

  it.each([
    [
      'invalid date shape',
      {
        ...valid,
        portfolio: {
          ...valid.portfolio,
          lots: [{ ...valid.portfolio.lots[0], purchaseDate: '30.07.2026' }],
        },
      },
    ],
    [
      'fractional quantity',
      {
        ...valid,
        portfolio: { ...valid.portfolio, lots: [{ ...valid.portfolio.lots[0], amount: '1.001' }] },
      },
    ],
    [
      'zero amount',
      {
        ...valid,
        portfolio: { ...valid.portfolio, lots: [{ ...valid.portfolio.lots[0], amount: 0 }] },
      },
    ],
    [
      'excessive amount',
      {
        ...valid,
        portfolio: {
          ...valid.portfolio,
          lots: [{ ...valid.portfolio.lots[0], amount: '10000000.01' }],
        },
      },
    ],
    [
      'unknown lot property',
      {
        ...valid,
        portfolio: { ...valid.portfolio, lots: [{ ...valid.portfolio.lots[0], injected: true }] },
      },
    ],
    [
      'too many lots',
      {
        ...valid,
        portfolio: {
          ...valid.portfolio,
          lots: Array.from({ length: 501 }, () => valid.portfolio.lots[0]),
        },
      },
    ],
    [
      'overlong note',
      {
        ...valid,
        portfolio: {
          ...valid.portfolio,
          lots: [{ ...valid.portfolio.lots[0], notes: 'x'.repeat(2001) }],
        },
      },
    ],
    ['unknown payload property', { ...valid, unexpected: true }],
  ])('rejects %s', (_name, payload) => {
    expect(() => ImportPayloadSchema.parse(payload)).toThrow();
  });

  it.each(['2026-02-30', '2025-02-29', '2026-00-10', '2026-13-01', '2026-01-00'])(
    'rejects impossible calendar date %s at the transport boundary',
    (purchaseDate) => {
      expect(
        ImportPayloadSchema.safeParse({
          ...valid,
          portfolio: { ...valid.portfolio, lots: [{ ...valid.portfolio.lots[0], purchaseDate }] },
        }).success,
      ).toBe(false);
    },
  );

  it.each(['1', 1, 10000000, '9999999'])('accepts permitted amount %s', (amount) => {
    expect(
      ImportPayloadSchema.safeParse({
        ...valid,
        portfolio: { ...valid.portfolio, lots: [{ ...valid.portfolio.lots[0], amount }] },
      }).success,
    ).toBe(true);
  });

  it.each(['-1', '+1', '1e3', 'NaN', 'Infinity', '', ' 1', '1 ', '.5', '0.00', '1.5'])(
    'rejects unsafe amount encoding %s',
    (amount) => {
      expect(
        ImportPayloadSchema.safeParse({
          ...valid,
          portfolio: { ...valid.portfolio, lots: [{ ...valid.portfolio.lots[0], amount }] },
        }).success,
      ).toBe(false);
    },
  );

  it('enforces documented string boundaries', () => {
    expect(
      ImportPayloadSchema.safeParse({
        ...valid,
        portfolio: { ...valid.portfolio, name: 'n'.repeat(120) },
      }).success,
    ).toBe(true);
    expect(
      ImportPayloadSchema.safeParse({
        ...valid,
        portfolio: { ...valid.portfolio, name: 'n'.repeat(121) },
      }).success,
    ).toBe(false);
    expect(
      ImportPayloadSchema.safeParse({
        ...valid,
        portfolio: { ...valid.portfolio, description: 'd'.repeat(2000) },
      }).success,
    ).toBe(true);
    expect(
      ImportPayloadSchema.safeParse({
        ...valid,
        portfolio: { ...valid.portfolio, description: 'd'.repeat(2001) },
      }).success,
    ).toBe(false);
  });

  it('rejects malformed portfolio envelopes', () => {
    const cases = [
      null,
      [],
      {},
      { portfolio: null },
      { portfolio: {} },
      { portfolio: { name: 'x', lots: 'not-an-array' } },
      { portfolio: { name: '', lots: valid.portfolio.lots } },
      { portfolio: { name: '   ', lots: valid.portfolio.lots } },
      {
        portfolio: { name: 'x', lots: [{ bondType: '', purchaseDate: '2026-01-01', amount: '1' }] },
      },
      { portfolio: { name: 'x', lots: [{ bondType: 'COI', purchaseDate: '', amount: '1' }] } },
      {
        portfolio: {
          name: 'x',
          lots: [{ bondType: 'COI', purchaseDate: '2026-01-01', amount: null }],
        },
      },
    ];

    for (const payload of cases) {
      expect(ImportPayloadSchema.safeParse(payload).success).toBe(false);
    }
  });

  it('supports an empty portfolio backup', () => {
    expect(ImportPayloadSchema.safeParse({ portfolio: { name: 'x', lots: [] } }).success).toBe(
      true,
    );
  });

  it('does not coerce unknown keys away', () => {
    const payload = {
      ...valid,
      portfolio: {
        ...valid.portfolio,
        lots: [{ ...valid.portfolio.lots[0], metadata: { source: 'untrusted' } }],
      },
    };
    const result = ImportPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects a bond type outside the supported financial product set', () => {
    expect(
      ImportPayloadSchema.safeParse({
        ...valid,
        portfolio: { ...valid.portfolio, lots: [{ ...valid.portfolio.lots[0], bondType: 'GOVT' }] },
      }).success,
    ).toBe(false);
  });

  it('rejects duplicated lots rather than silently importing a partial portfolio', () => {
    expect(
      ImportPayloadSchema.safeParse({
        ...valid,
        portfolio: { ...valid.portfolio, lots: [valid.portfolio.lots[0], valid.portfolio.lots[0]] },
      }).success,
    ).toBe(false);
  });
});
