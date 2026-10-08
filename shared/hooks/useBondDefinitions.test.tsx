import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import { BondType } from '@/features/bond-core/types';

import { useBondDefinitions } from './useBondDefinitions';

const mocks = vi.hoisted(() => ({ useSWR: vi.fn() }));

vi.mock('swr', () => ({ default: mocks.useSWR }));

describe('useBondDefinitions first paint', () => {
  beforeEach(() => {
    mocks.useSWR.mockReset();
    mocks.useSWR.mockReturnValue({
      data: BOND_DEFINITIONS,
      isLoading: true,
      isValidating: true,
      error: undefined,
      mutate: vi.fn(),
    });
  });

  it('uses the server snapshot without blocking the first form paint', () => {
    const serverSnapshot = {
      ...BOND_DEFINITIONS,
      [BondType.EDO]: { ...BOND_DEFINITIONS[BondType.EDO], firstYearRate: 5.8 },
    };
    mocks.useSWR.mockReturnValue({
      data: serverSnapshot,
      isLoading: true,
      isValidating: true,
      error: undefined,
      mutate: vi.fn(),
    });
    const { result } = renderHook(() => useBondDefinitions(serverSnapshot));

    expect(mocks.useSWR.mock.calls[0][2].fallbackData).toBe(serverSnapshot);
    expect(result.current.definitions).toBe(serverSnapshot);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRefreshing).toBe(true);
  });

  it('keeps the client-only route loading state until its request finishes', () => {
    const { result } = renderHook(() => useBondDefinitions());

    expect(result.current.isLoading).toBe(true);
  });
});
