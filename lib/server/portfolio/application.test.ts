import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createOwnerPortfolio: vi.fn(),
  deleteOwnerPortfolio: vi.fn(),
  createPortfolioLot: vi.fn(),
  createPortfolioLotWithBuyTransaction: vi.fn(),
  deleteOwnerLot: vi.fn(),
  importOwnerPortfolio: vi.fn(),
  toggleOwnerPortfolioSharing: vi.fn(),
  updateOwnerLot: vi.fn(),
  updateOwnerPortfolio: vi.fn(),
  exportOwnerPortfolio: vi.fn(),
  listOwnerPortfolios: vi.fn(),
  listPortfolioLots: vi.fn(),
  simulateOwnerPortfolio: vi.fn(),
  summarizeOwnerPortfolios: vi.fn(),
}));

vi.mock('./commands', () => ({
  createOwnerPortfolio: mocks.createOwnerPortfolio,
  deleteOwnerPortfolio: mocks.deleteOwnerPortfolio,
  createPortfolioLot: mocks.createPortfolioLot,
  createPortfolioLotWithBuyTransaction: mocks.createPortfolioLotWithBuyTransaction,
  deleteOwnerLot: mocks.deleteOwnerLot,
  importOwnerPortfolio: mocks.importOwnerPortfolio,
  toggleOwnerPortfolioSharing: mocks.toggleOwnerPortfolioSharing,
  updateOwnerLot: mocks.updateOwnerLot,
  updateOwnerPortfolio: mocks.updateOwnerPortfolio,
}));
vi.mock('./queries', () => ({
  exportOwnerPortfolio: mocks.exportOwnerPortfolio,
  listOwnerPortfolios: mocks.listOwnerPortfolios,
  listPortfolioLots: mocks.listPortfolioLots,
  simulateOwnerPortfolio: mocks.simulateOwnerPortfolio,
  summarizeOwnerPortfolios: mocks.summarizeOwnerPortfolios,
}));

import { portfolioApplication } from './application';

describe('portfolio application interface', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['createPortfolio', 'createOwnerPortfolio', ['owner-1', { name: 'Taxable' }]],
    ['deletePortfolio', 'deleteOwnerPortfolio', ['owner-1', 'portfolio-1']],
    ['updatePortfolio', 'updateOwnerPortfolio', ['owner-1', 'portfolio-1', { name: 'Edited' }]],
    ['listPortfolios', 'listOwnerPortfolios', ['owner-1']],
    [
      'createLot',
      'createPortfolioLot',
      [
        'owner-1',
        {
          portfolioId: 'portfolio-1',
          bondType: 'EDO',
          purchaseDate: '2026-01-01',
          bondQuantity: 100,
          isRebought: false,
        },
      ],
    ],
    [
      'createLotWithTransaction',
      'createPortfolioLotWithBuyTransaction',
      [
        'owner-1',
        {
          portfolioId: 'portfolio-1',
          bondType: 'EDO',
          purchaseDate: '2026-01-01',
          bondQuantity: 100,
        },
      ],
    ],
    ['updateLot', 'updateOwnerLot', ['owner-1', 'lot-1', { bondQuantity: 200 }]],
    ['deleteLot', 'deleteOwnerLot', ['owner-1', 'lot-1']],
    ['listLots', 'listPortfolioLots', ['owner-1', 'portfolio-1']],
    ['importPortfolio', 'importOwnerPortfolio', ['owner-1', { name: 'Imported', lots: [] }]],
    ['setPortfolioVisibility', 'toggleOwnerPortfolioSharing', ['owner-1', 'portfolio-1', true]],
    [
      'simulatePortfolio',
      'simulateOwnerPortfolio',
      ['owner-1', 'portfolio-1', { expectedInflation: 3 }],
    ],
    ['exportPortfolio', 'exportOwnerPortfolio', ['owner-1', 'portfolio-1', 'package']],
    ['summarizePortfolios', 'summarizeOwnerPortfolios', ['owner-1']],
  ] as const)('%s delegates complete owner context to %s', async (operation, dependency, args) => {
    const expected = { operation };
    const storedLot = {
      ...expected,
      id: 'lot-1',
      portfolioId: 'portfolio-1',
      bondType: 'EDO',
      bondTypeId: null,
      bondSeriesId: null,
      purchaseDate: '2026-01-01',
      amount: '100',
      isRebought: false,
      notes: null,
      createdAt: null,
    };
    const mapsHolding =
      operation === 'createLot' ||
      operation === 'createLotWithTransaction' ||
      operation === 'updateLot' ||
      operation === 'listLots';
    mocks[dependency].mockResolvedValue(operation === 'listLots' ? [storedLot] : storedLot);
    const invoke = portfolioApplication[operation] as (...input: unknown[]) => Promise<unknown>;

    const result = await invoke(...args);

    expect(result).toEqual(
      mapsHolding
        ? operation === 'listLots'
          ? [expect.objectContaining({ bondQuantity: '100' })]
          : expect.objectContaining({ bondQuantity: '100' })
        : storedLot,
    );
    expect(mocks[dependency]).toHaveBeenCalledWith(...args);
  });

  it('does not reinterpret domain failures from adapters', async () => {
    const failure = new Error('owner scope rejected');
    mocks.deleteOwnerLot.mockRejectedValue(failure);

    await expect(portfolioApplication.deleteLot('other-owner', 'lot-1')).rejects.toBe(failure);
  });
});
