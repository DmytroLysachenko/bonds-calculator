import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const getAccess = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/portfolio-client', () => ({ portfolioClient: { getAccess } }));
import { usePortfolioAccess } from './usePortfolioAccess';

afterEach(cleanup);
it('settles failed access safely without an unhandled rejection', async () => {
  const error = new Error('offline');
  getAccess.mockRejectedValueOnce(error);
  const { result } = renderHook(usePortfolioAccess);
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.error).toBe(error);
  expect(result.current.canManageWorkspace).toBe(false);
  expect(result.current.isGuestWorkspace).toBe(true);
});
