import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import { BondType } from '@/features/bond-core/types';
import { portfolioClient } from '@/shared/lib/portfolio-client';
import { UserPortfolio } from '@/shared/types/portfolio';

import { usePortfolioDetailsWorkspace } from './usePortfolioDetailsWorkspace';

vi.mock('@/shared/lib/portfolio-client', () => ({
  portfolioClient: {
    listLots: vi.fn(),
    simulatePortfolio: vi.fn(),
    createLot: vi.fn(),
    updateLot: vi.fn(),
    deleteLot: vi.fn(),
    updatePortfolio: vi.fn(),
    toggleSharing: vi.fn(),
    exportPortfolio: vi.fn(),
  },
}));

const mockedClient = vi.mocked(portfolioClient);
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};
const portfolio = (id: string): UserPortfolio => ({
  id,
  userId: 'owner',
  name: id,
  description: null,
  isPublic: false,
  shareId: id,
  createdAt: new Date(),
  updatedAt: new Date(),
});
const lot = (id: string, portfolioId: string, quantity = '1') => ({
  id,
  portfolioId,
  bondType: BondType.OTS,
  bondTypeId: null,
  bondSeriesId: null,
  purchaseDate: '2026-01-01',
  bondQuantity: quantity,
  isRebought: false,
  notes: null,
  createdAt: new Date(),
});

describe('usePortfolioDetailsWorkspace', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('does not apply a late response from a previously selected portfolio', async () => {
    const first = deferred<ReturnType<typeof lot>[]>();
    const secondLots = [lot('b', 'b')];
    mockedClient.listLots
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(secondLots);
    mockedClient.simulatePortfolio.mockResolvedValue(null as never);
    const { result, rerender } = renderHook(
      ({ selected }) =>
        usePortfolioDetailsWorkspace({ portfolio: selected, definitions: BOND_DEFINITIONS }),
      { initialProps: { selected: portfolio('a') } },
    );
    rerender({ selected: portfolio('b') });
    await waitFor(() => expect(result.current.lots).toEqual(secondLots));
    await act(async () => first.resolve([lot('a', 'a')]));
    expect(result.current.lots).toEqual(secondLots);
  });

  it('refreshes after an unchanged-count holding edit', async () => {
    mockedClient.listLots.mockResolvedValue([lot('a', 'a', '1')]);
    mockedClient.simulatePortfolio.mockResolvedValue(null as never);
    mockedClient.updateLot.mockResolvedValue(lot('a', 'a', '2'));
    const { result } = renderHook(() =>
      usePortfolioDetailsWorkspace({ portfolio: portfolio('a'), definitions: BOND_DEFINITIONS }),
    );
    await waitFor(() => expect(result.current.lots).toHaveLength(1));
    await act(async () => {
      await result.current.updateLot('a', { bondQuantity: 2 });
    });
    expect(mockedClient.listLots).toHaveBeenCalledTimes(2);
  });
});
