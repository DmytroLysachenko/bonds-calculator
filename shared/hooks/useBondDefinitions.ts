'use client';

import useSWR from 'swr';

import { BOND_DEFINITIONS, BondDefinition } from '@/features/bond-core/constants/bond-definitions';
import { BondType } from '@/features/bond-core/types';
import { apiGet } from '@/shared/lib/api-client';

export function useBondDefinitions(initialDefinitions?: Record<BondType, BondDefinition>) {
  const resource = useSWR<Record<BondType, BondDefinition>>(
    '/api/bond-definitions',
    apiGet<Record<BondType, BondDefinition>>,
    {
      dedupingInterval: 15 * 60_000,
      focusThrottleInterval: 15 * 60_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      keepPreviousData: true,
      // Render a complete, safe baseline immediately; the API still refreshes
      // it with the current offer without blocking the calculator's first paint.
      fallbackData: initialDefinitions ?? BOND_DEFINITIONS,
    },
  );

  return {
    definitions: resource.data ?? null,
    // A request-scoped server snapshot is already authoritative for first paint.
    // SWR may still revalidate it, but should not hide the form while doing so.
    isLoading: resource.isLoading && !initialDefinitions,
    isRefreshing: resource.isValidating && resource.data !== undefined,
    error: resource.error ?? null,
    refresh: () => resource.mutate(),
    invalidate: () => resource.mutate(undefined, { revalidate: false }),
  };
}
