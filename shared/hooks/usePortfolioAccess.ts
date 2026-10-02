'use client';

import useSWR from 'swr';

import { portfolioClient } from '@/shared/lib/portfolio-client';

/** One deduplicated access resource. Failed revalidation never grants a cached capability. */
export function usePortfolioAccess(enabled = true) {
  const resource = useSWR(
    enabled ? '/api/portfolio/access' : null,
    () => portfolioClient.getAccess(),
    {
      shouldRetryOnError: false,
      revalidateOnFocus: true,
      keepPreviousData: false,
    },
  );
  const access = resource.error ? null : (resource.data ?? null);
  return {
    access,
    error: resource.error ?? null,
    isLoading: resource.isLoading,
    refresh: resource.mutate,
    canManageWorkspace: access?.canManageWorkspace ?? false,
    isGuestWorkspace: access?.isGuest ?? true,
  };
}
