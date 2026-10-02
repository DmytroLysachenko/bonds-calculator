import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ list: vi.fn(), access: vi.fn() }));
vi.mock('@/shared/lib/portfolio-client', () => ({
  portfolioClient: { listPortfolios: mocks.list, getAccess: mocks.access },
}));
import { useWorkspacePortfolios } from './useWorkspacePortfolios';

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  mocks.access.mockResolvedValue({
    ownerId: 'alice',
    isGuest: false,
    canManageWorkspace: true,
    authMode: 'authenticated',
  });
  mocks.list.mockResolvedValue([{ id: 'alice-portfolio', name: 'Alice' }]);
});
afterEach(cleanup);
function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 1000 }}>{children}</SWRConfig>
  );
}
it('deduplicates list/access reads for multiple subscribers and shares mutations', async () => {
  const { result } = renderHook(() => [useWorkspacePortfolios(), useWorkspacePortfolios()], {
    wrapper,
  });
  await waitFor(() => expect(result.current[0].portfolios).toHaveLength(1));
  expect(mocks.access).toHaveBeenCalledTimes(1);
  expect(mocks.list).toHaveBeenCalledTimes(1);
  act(() => result.current[0].removePortfolio('alice-portfolio'));
  await waitFor(() => expect(result.current[1].portfolios).toHaveLength(0));
});

it('restores persisted selection when authenticated portfolio data arrives', async () => {
  localStorage.setItem('obligacje.current-portfolio-id.v1', 'second');
  mocks.list.mockResolvedValue([
    { id: 'first', name: 'First' },
    { id: 'second', name: 'Second' },
  ]);

  const { result } = renderHook(useWorkspacePortfolios, { wrapper });
  await waitFor(() => expect(result.current.selectedPortfolioId).toBe('second'));
});
it('does not fetch or expose a disabled workspace', async () => {
  const { result } = renderHook(() => useWorkspacePortfolios({ enabled: false }), { wrapper });
  expect(result.current.isLoading).toBe(false);
  expect(result.current.portfolios).toEqual([]);
  expect(mocks.list).not.toHaveBeenCalled();
  expect(mocks.access).not.toHaveBeenCalled();
});
it('distinguishes a failed read from an empty successful portfolio list', async () => {
  mocks.list.mockRejectedValue(new Error('offline'));
  const { result } = renderHook(useWorkspacePortfolios, { wrapper });
  await waitFor(() => expect(result.current.requestError).toBeInstanceOf(Error));
  expect(result.current.portfolios).toEqual([]);
});
