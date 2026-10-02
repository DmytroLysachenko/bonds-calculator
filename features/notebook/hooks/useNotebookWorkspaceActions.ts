'use client';

import React, { useCallback, useState } from 'react';

import {
  NOTEBOOK_DEMO_LOTS,
  resolveNotebookPortfolioError,
} from '@/features/notebook/lib/notebook-workspace-model';
import { ApiClientError } from '@/shared/lib/api-client';
import { logClientError } from '@/shared/lib/client-logger';
import { portfolioClient } from '@/shared/lib/portfolio-client';
import { UserPortfolio } from '@/shared/types/portfolio';

interface NotebookWorkspaceActionLabels {
  myFirstPortfolio: string;
  defaultDescription: string;
  demoName: string;
  demoDescription: string;
  createdSuccess: string;
  demoLoadedSuccess: string;
  importCompleted: (count: string) => string;
  importFailed: string;
  deleteSuccess: string;
  deleteFailed: string;
  storageUnavailable: string;
  createError: string;
}

interface UseNotebookWorkspaceActionsInput {
  labels: NotebookWorkspaceActionLabels;
  fetchPortfolios: () => Promise<unknown>;
  mergePortfolioIntoState: (portfolio: UserPortfolio) => void;
  removePortfolioFromState: (portfolioId: string) => void;
  setSelectedPortfolioId: (portfolioId: string) => void;
  clearDetailPortfolio: (portfolioId: string) => void;
}

export function useNotebookWorkspaceActions({
  labels,
  fetchPortfolios,
  mergePortfolioIntoState,
  removePortfolioFromState,
  setSelectedPortfolioId,
  clearDetailPortfolio,
}: UseNotebookWorkspaceActionsInput) {
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const resolvePortfolioError = useCallback(
    (
      payload?: {
        error?: string;
        code?: string;
      } | null,
    ) =>
      resolveNotebookPortfolioError(payload, {
        storageUnavailable: labels.storageUnavailable,
        createError: labels.createError,
      }),
    [labels.createError, labels.storageUnavailable],
  );

  const resolveCaughtPortfolioError = useCallback(
    (caughtError: unknown) => {
      if (caughtError instanceof ApiClientError) {
        return resolvePortfolioError({
          error: caughtError.message,
          code: caughtError.code,
        });
      }
      return labels.createError;
    },
    [labels.createError, resolvePortfolioError],
  );

  const handleCreateDefault = async () => {
    setIsMutating(true);
    try {
      const created = await portfolioClient.createPortfolio({
        name: labels.myFirstPortfolio,
        description: labels.defaultDescription,
      });
      setError(null);
      setStatusMessage(labels.createdSuccess);
      if (created?.id) {
        mergePortfolioIntoState(created);
        setSelectedPortfolioId(created.id);
      } else {
        await fetchPortfolios();
      }
    } catch (caughtError) {
      logClientError('Notebook portfolio creation failed:', caughtError);
      setError(resolveCaughtPortfolioError(caughtError));
    } finally {
      setIsMutating(false);
    }
  };

  const handleCreateDemo = async () => {
    setIsMutating(true);
    try {
      const imported = await portfolioClient.importPortfolio({
        version: '2.0',
        packageType: 'portfolio-package',
        portfolio: {
          name: labels.demoName,
          description: labels.demoDescription,
          lots: NOTEBOOK_DEMO_LOTS,
        },
      });
      const createdPortfolio = imported?.portfolio;
      if (!createdPortfolio?.id) {
        await fetchPortfolios();
        return;
      }
      mergePortfolioIntoState(createdPortfolio);
      setSelectedPortfolioId(createdPortfolio.id);
      setStatusMessage(labels.demoLoadedSuccess);
    } catch (caughtError) {
      logClientError('Notebook demo portfolio creation failed:', caughtError);
      setError(resolveCaughtPortfolioError(caughtError));
    } finally {
      setIsMutating(false);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      setIsMutating(true);
      const text = await file.text();
      const parsed = JSON.parse(text);
      const preview = readPortfolioImportPreview(parsed);
      const accepted = window.confirm(
        `Import “${preview.name}” with ${preview.lotCount} lot${preview.lotCount === 1 ? '' : 's'}?`,
      );
      if (!accepted) return;
      const importPayload = await portfolioClient.importPortfolio(parsed);
      setError(null);
      if (importPayload?.portfolio?.id) {
        mergePortfolioIntoState(importPayload.portfolio);
        setSelectedPortfolioId(importPayload.portfolio.id);
        setStatusMessage(labels.importCompleted(String(importPayload.importedLots ?? 0)));
      } else {
        await fetchPortfolios();
      }
    } catch (caughtError) {
      logClientError('Notebook portfolio import failed:', caughtError);
      setError(labels.importFailed);
    } finally {
      setIsMutating(false);
      event.target.value = '';
    }
  };

  const handleDeletePortfolio = async (portfolio: UserPortfolio) => {
    setIsMutating(true);
    try {
      await portfolioClient.deletePortfolio(portfolio.id);
      removePortfolioFromState(portfolio.id);
      clearDetailPortfolio(portfolio.id);
      setError(null);
      setStatusMessage(labels.deleteSuccess);
    } catch (caughtError) {
      logClientError('Notebook portfolio deletion failed:', caughtError);
      setError(
        caughtError instanceof ApiClientError
          ? resolveCaughtPortfolioError(caughtError)
          : labels.deleteFailed,
      );
    } finally {
      setIsMutating(false);
    }
  };

  return {
    error,
    setError,
    statusMessage,
    setStatusMessage,
    isMutating,
    resolvePortfolioError,
    handleCreateDefault,
    handleCreateDemo,
    handleImportFile,
    handleDeletePortfolio,
  };
}

/**
 * A local, no-write preview is deliberately lightweight; the authoritative
 * schema still runs at the API boundary before the atomic import. It prevents
 * accidental selection of an unrelated JSON file and gives the user an
 * explicit count before creating any records.
 */
function readPortfolioImportPreview(value: unknown) {
  if (
    !value ||
    typeof value !== 'object' ||
    !('portfolio' in value) ||
    !value.portfolio ||
    typeof value.portfolio !== 'object' ||
    !('name' in value.portfolio) ||
    typeof value.portfolio.name !== 'string' ||
    !('lots' in value.portfolio) ||
    !Array.isArray(value.portfolio.lots)
  ) {
    throw new Error('The selected file is not a portfolio package.');
  }

  return { name: value.portfolio.name, lotCount: value.portfolio.lots.length };
}
