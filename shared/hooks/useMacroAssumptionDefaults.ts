'use client';

import useSWR from 'swr';

import type { MacroAssumptionDefaults } from '@/lib/data/market-data';
import { apiGet } from '@/shared/lib/api-client';
import { logClientError } from '@/shared/lib/client-logger';

const FALLBACK_DEFAULTS: MacroAssumptionDefaults = {
  expectedInflation: 2.5,
  expectedNbpRate: 5.25,
  usedFallback: true,
};

export function useMacroAssumptionDefaults() {
  const resource = useSWR<MacroAssumptionDefaults>(
    '/api/calculation-defaults',
    async (endpoint: string) => {
      try {
        return await apiGet<MacroAssumptionDefaults>(endpoint);
      } catch (error) {
        logClientError('Failed to fetch macro assumption defaults:', error);
        throw error;
      }
    },
    {
      dedupingInterval: 10 * 60_000,
      focusThrottleInterval: 10 * 60_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      keepPreviousData: true,
    },
  );

  return {
    defaults: resource.data ?? FALLBACK_DEFAULTS,
    isLoading: resource.isLoading,
    isRefreshing: resource.isValidating && resource.data !== undefined,
    error: resource.error ?? null,
    refresh: () => resource.mutate(),
    invalidate: () => resource.mutate(undefined, { revalidate: false }),
  };
}
