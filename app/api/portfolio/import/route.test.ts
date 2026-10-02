import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  importPortfolio: vi.fn(),
  withPortfolioCommand: vi.fn(),
}));

vi.mock('@/lib/server/portfolio/application', () => ({
  portfolioApplication: { importPortfolio: mocks.importPortfolio },
}));
vi.mock('@/lib/server/portfolio/http', () => ({
  withPortfolioCommand: mocks.withPortfolioCommand,
}));

import { POST } from './route';

const valid = {
  portfolio: {
    name: 'Imported bonds',
    lots: [{ bondType: 'COI', purchaseDate: '2026-07-30', amount: '100.00' }],
  },
};

describe('portfolio import endpoint', () => {
  beforeEach(() => {
    mocks.importPortfolio.mockReset();
    mocks.withPortfolioCommand.mockImplementation(async (_request, handler) =>
      handler({ ownerId: 'owner-1' }),
    );
  });

  it('passes a validated complete payload to the authenticated owner transaction', async () => {
    mocks.importPortfolio.mockResolvedValue({
      portfolio: { id: 'portfolio-1' },
      importedLots: 1,
    });

    const response = await POST(
      new NextRequest('https://example.test/api/portfolio/import', {
        method: 'POST',
        body: JSON.stringify(valid),
        headers: { 'content-type': 'application/json' },
      }) as never,
      {} as never,
    );

    expect(response.status).toBe(200);
    expect(mocks.importPortfolio).toHaveBeenCalledWith('owner-1', {
      ...valid.portfolio,
      lots: valid.portfolio.lots.map(({ amount, ...lot }) => ({
        ...lot,
        bondQuantity: amount,
      })),
    });
    await expect(response.json()).resolves.toMatchObject({ data: { importedLots: 1 } });
  });

  it.each([
    ['malformed JSON', '{'],
    ['missing lots', JSON.stringify({ portfolio: { name: 'bad' } })],
    [
      'invalid calendar date',
      JSON.stringify({
        ...valid,
        portfolio: {
          ...valid.portfolio,
          lots: [{ ...valid.portfolio.lots[0], purchaseDate: '2026-02-30' }],
        },
      }),
    ],
    [
      'unsupported bond encoding',
      JSON.stringify({
        ...valid,
        portfolio: {
          ...valid.portfolio,
          lots: [{ ...valid.portfolio.lots[0], bondType: 'UNKNOWN' }],
        },
      }),
    ],
  ])('does not invoke import for %s', async (_name, body) => {
    const response = await POST(
      new NextRequest('https://example.test/api/portfolio/import', {
        method: 'POST',
        body,
        headers: { 'content-type': 'application/json' },
      }) as never,
      {} as never,
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mocks.importPortfolio).not.toHaveBeenCalled();
  });

  it('rejects a declared oversize body before JSON parsing or import work', async () => {
    const response = await POST(
      new NextRequest('https://example.test/api/portfolio/import', {
        method: 'POST',
        body: '{}',
        headers: {
          'content-length': `${256 * 1024 + 1}`,
          'content-type': 'application/json',
        },
      }) as never,
      {} as never,
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    expect(mocks.importPortfolio).not.toHaveBeenCalled();
  });

  it.each([undefined, 'text/plain', 'application/x-www-form-urlencoded'])(
    'rejects an import body without a JSON content type (%s)',
    async (contentType) => {
      const headers = contentType ? { 'content-type': contentType } : undefined;
      const response = await POST(
        new NextRequest('https://example.test/api/portfolio/import', {
          method: 'POST',
          body: JSON.stringify(valid),
          headers,
        }) as never,
        {} as never,
      );

      expect(response.status).toBe(415);
      await expect(response.json()).resolves.toMatchObject({
        code: 'UNSUPPORTED_MEDIA_TYPE',
      });
      expect(mocks.importPortfolio).not.toHaveBeenCalled();
    },
  );

  it('does not accept duplicate input as a partial import', async () => {
    const response = await POST(
      new NextRequest('https://example.test/api/portfolio/import', {
        method: 'POST',
        body: JSON.stringify({
          ...valid,
          portfolio: {
            ...valid.portfolio,
            lots: [valid.portfolio.lots[0], valid.portfolio.lots[0]],
          },
        }),
      }) as never,
      {} as never,
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mocks.importPortfolio).not.toHaveBeenCalled();
  });
});
