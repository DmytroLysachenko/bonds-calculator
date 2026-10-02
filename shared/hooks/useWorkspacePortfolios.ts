'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';

import { portfolioClient } from '@/shared/lib/portfolio-client';
import {
  persistSelectedPortfolioId,
  removePortfolioFromNotebookState,
  resolveSelectedPortfolioId,
  upsertPortfolioInNotebookState,
} from '@/shared/lib/workspace/notebook-state';
import { resolveWorkspacePortfolioSelection } from '@/shared/lib/workspace/portfolio-selection';
import { UserPortfolio } from '@/shared/types/portfolio';

import { usePortfolioAccess } from './usePortfolioAccess';

interface UseWorkspacePortfoliosOptions {
  enabled?: boolean;
}

export function useWorkspacePortfolios({ enabled = true }: UseWorkspacePortfoliosOptions = {}) {
  const access = usePortfolioAccess(enabled);
  const ownerId = access.canManageWorkspace ? access.access?.ownerId : null;
  const resource = useSWR(
    enabled && ownerId ? ['/api/portfolio', ownerId] : null,
    () => portfolioClient.listPortfolios(),
    { keepPreviousData: false, shouldRetryOnError: false },
  );
  const portfolios = resource.data ?? [];
  const [selectedPortfolioId, setSelectedPortfolioIdState] = useState<string | null>(null);
  const isLoading = enabled && (access.isLoading || resource.isLoading);
  const requestError: unknown = resource.error ?? access.error ?? null;
  const mutate = resource.mutate;
  const setPortfoliosState = useCallback(
    (next: UserPortfolio[] | ((current: UserPortfolio[]) => UserPortfolio[])) => {
      void mutate((current) => (typeof next === 'function' ? next(current ?? []) : next), {
        revalidate: false,
      });
    },
    [mutate],
  );

  const setSelectedPortfolioId = useCallback((portfolioId: string | null) => {
    setSelectedPortfolioIdState(portfolioId);
    persistSelectedPortfolioId(portfolioId);
  }, []);

  const replacePortfolios = useCallback(
    (nextPortfolios: UserPortfolio[]) => {
      setPortfoliosState(nextPortfolios);
      setSelectedPortfolioIdState((currentSelection) => {
        const nextSelection = resolveWorkspacePortfolioSelection(
          currentSelection,
          nextPortfolios,
        ).portfolioId;
        persistSelectedPortfolioId(nextSelection);
        return nextSelection;
      });
    },
    [setPortfoliosState],
  );

  const refetch = useCallback(async () => {
    if (!enabled || !ownerId) return [];
    try {
      return (await mutate()) ?? [];
    } catch {
      return [];
    }
  }, [enabled, ownerId, mutate]);

  useEffect(() => {
    setSelectedPortfolioIdState((currentSelection) =>
      resolveSelectedPortfolioId(currentSelection, resource.data ?? []),
    );
  }, [ownerId, resource.data]);

  const upsertPortfolio = useCallback(
    (portfolio: UserPortfolio) => {
      setPortfoliosState((current) => {
        const nextPortfolios = upsertPortfolioInNotebookState(current, portfolio);
        setSelectedPortfolioIdState((currentSelection) => {
          const nextSelection = resolveWorkspacePortfolioSelection(
            currentSelection,
            nextPortfolios,
          ).portfolioId;
          persistSelectedPortfolioId(nextSelection);
          return nextSelection;
        });
        return nextPortfolios;
      });
    },
    [setPortfoliosState],
  );

  const removePortfolio = useCallback(
    (portfolioId: string) => {
      setPortfoliosState((current) => {
        const nextPortfolios = removePortfolioFromNotebookState(current, portfolioId);
        setSelectedPortfolioIdState((currentSelection) => {
          const nextSelection = resolveWorkspacePortfolioSelection(
            currentSelection,
            nextPortfolios,
          ).portfolioId;
          persistSelectedPortfolioId(nextSelection);
          return nextSelection;
        });
        return nextPortfolios;
      });
    },
    [setPortfoliosState],
  );

  const selectedPortfolio = selectedPortfolioId
    ? (portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ?? null)
    : null;

  return {
    canManageWorkspace: access.canManageWorkspace,
    isGuestWorkspace: access.isGuestWorkspace,
    portfolios,
    selectedPortfolioId,
    selectedPortfolio,
    isLoading,
    requestError,
    refetch,
    replacePortfolios,
    setSelectedPortfolioId,
    upsertPortfolio,
    removePortfolio,
  };
}
