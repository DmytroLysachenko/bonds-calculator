import useSWR from 'swr';

import { apiGet } from '@/shared/lib/api-client';

interface ErrorWithContext extends Error {
  code?: string;
  details?: unknown;
}

export function useChartData<T>(endpoint: string | null) {
  const { data, error, isLoading } = useSWR<T>(endpoint, apiGet<T>, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    keepPreviousData: true,
  });

  return {
    data,
    isLoading,
    isError: !!error,
    errorDetails: error as ErrorWithContext | undefined,
  };
}
