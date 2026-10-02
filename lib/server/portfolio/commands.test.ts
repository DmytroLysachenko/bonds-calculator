import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lot: vi.fn(),
  portfolio: vi.fn(),
  resolve: vi.fn(),
  update: vi.fn(),
  updatePortfolio: vi.fn(),
}));
vi.mock('./access', () => ({ getOwnedLot: mocks.lot, getOwnedPortfolio: mocks.portfolio }));
vi.mock('@/lib/server/bonds/offer-terms', () => ({ resolveStoredBondLotContext: mocks.resolve }));
vi.mock('./repository', () => ({
  updateLotByOwner: mocks.update,
  updatePortfolioByOwner: mocks.updatePortfolio,
}));
import { updateOwnerLot, updateOwnerPortfolio } from './commands';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.lot.mockResolvedValue({
    id: 'lot',
    portfolioId: 'portfolio',
    bondType: 'COI',
    purchaseDate: '2026-01-01',
    bondTypeId: 'old-type',
    bondSeriesId: 'old-series',
  });
  mocks.portfolio.mockResolvedValue({ id: 'portfolio' });
  mocks.resolve.mockResolvedValue({ bondTypeId: 'new-type', bondSeriesId: 'new-series' });
  mocks.update.mockResolvedValue([{ id: 'lot' }]);
  mocks.updatePortfolio.mockResolvedValue([{ id: 'portfolio', name: 'Updated' }]);
});

describe('portfolio metadata edits', () => {
  it('scopes metadata updates to the authenticated owner', async () => {
    await expect(updateOwnerPortfolio('alice', 'portfolio', { name: 'Updated' })).resolves.toEqual({
      id: 'portfolio',
      name: 'Updated',
    });
    expect(mocks.updatePortfolio).toHaveBeenCalledWith('alice', 'portfolio', { name: 'Updated' });
  });

  it('reports a missing or foreign portfolio without fabricating a success', async () => {
    mocks.updatePortfolio.mockResolvedValue([]);
    await expect(updateOwnerPortfolio('alice', 'foreign', { name: 'Updated' })).rejects.toThrow(
      'Portfolio not found',
    );
  });
});
describe('coherent lot edits', () => {
  it.each([
    { bondType: 'EDO' },
    { purchaseDate: '2026-02-01' },
    { selectedSeriesId: 'new-series' },
  ])('reconciles dependent identity for %j', async (patch) => {
    await updateOwnerLot('alice', 'lot', patch);
    expect(mocks.resolve).toHaveBeenCalledWith(
      patch.bondType ?? 'COI',
      patch.purchaseDate ?? '2026-01-01',
      patch.selectedSeriesId,
    );
    expect(mocks.update).toHaveBeenCalledWith(
      'alice',
      'lot',
      expect.objectContaining({ bondTypeId: 'new-type', bondSeriesId: 'new-series' }),
    );
    expect(mocks.update.mock.calls[0][2]).not.toHaveProperty('selectedSeriesId');
  });
  it('preserves identity and omitted preferences for notes-only edits', async () => {
    await updateOwnerLot('alice', 'lot', { notes: 'Updated' });
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.update.mock.calls[0][2]).not.toHaveProperty('bondSeriesId');
    expect(mocks.update.mock.calls[0][2]).not.toHaveProperty('isRebought');
  });
  it('rejects an unavailable explicitly selected series without writing', async () => {
    mocks.resolve.mockResolvedValue({ bondTypeId: 'type', bondSeriesId: null });
    await expect(
      updateOwnerLot('alice', 'lot', { selectedSeriesId: 'missing' }),
    ).rejects.toMatchObject({ code: 'INVALID_BOND_SERIES' });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('rejects foreign source lots and destination portfolios before writing', async () => {
    mocks.lot.mockResolvedValueOnce(undefined);
    await expect(updateOwnerLot('alice', 'foreign', { notes: 'x' })).rejects.toThrow(
      'Lot not found',
    );
    mocks.portfolio.mockResolvedValueOnce(undefined);
    await expect(updateOwnerLot('alice', 'lot', { portfolioId: 'foreign' })).rejects.toThrow(
      'Portfolio not found',
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
