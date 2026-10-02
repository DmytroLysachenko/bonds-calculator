'use client';

import { useCallback, useEffect } from 'react';

import { useNotebookContainerWorkspace } from '@/features/notebook/hooks/useNotebookContainerWorkspace';
import { useNotebookWorkspaceActions } from '@/features/notebook/hooks/useNotebookWorkspaceActions';
import { buildNotebookWorkspaceActionLabels } from '@/features/notebook/lib/notebook-container-labels';
import { buildNotebookWorkspaceViewModel } from '@/features/notebook/lib/notebook-workspace-model';
import type { useAppI18n } from '@/i18n/client';
import { useWorkspacePortfolios } from '@/shared/hooks/useWorkspacePortfolios';

type Translate = ReturnType<typeof useAppI18n>['t'];

/** One feature boundary for notebook selection, mutations, feedback, and view state. */
export function useNotebookWorkspaceController(t: Translate) {
  const workspace = useWorkspacePortfolios();
  const navigation = useNotebookContainerWorkspace({
    fetchPortfolios: workspace.refetch,
    setSelectedPortfolioId: workspace.setSelectedPortfolioId,
  });
  const actions = useNotebookWorkspaceActions({
    labels: buildNotebookWorkspaceActionLabels(t),
    fetchPortfolios: workspace.refetch,
    mergePortfolioIntoState: workspace.upsertPortfolio,
    removePortfolioFromState: workspace.removePortfolio,
    setSelectedPortfolioId: workspace.setSelectedPortfolioId,
    clearDetailPortfolio: navigation.clearDetailPortfolio,
  });

  const { setError, resolvePortfolioError } = actions;

  useEffect(() => {
    if (workspace.requestError) {
      setError(resolvePortfolioError(workspace.requestError as { error?: string; code?: string }));
      return;
    }
    setError(null);
  }, [resolvePortfolioError, setError, workspace.requestError]);

  const view = buildNotebookWorkspaceViewModel({
    portfolios: workspace.portfolios,
    detailPortfolioId: navigation.detailPortfolioId,
    t,
  });

  const cancelPendingDelete = useCallback(() => {
    navigation.setPortfolioPendingDelete(null);
  }, [navigation]);

  const confirmPendingDelete = useCallback(async () => {
    const portfolio = navigation.portfolioPendingDelete;
    if (!portfolio) return;
    navigation.setPortfolioPendingDelete(null);
    await actions.handleDeletePortfolio(portfolio);
  }, [actions, navigation]);

  return {
    view: {
      ...view,
      canManageWorkspace: workspace.canManageWorkspace,
      detailPortfolioId: navigation.detailPortfolioId,
      error: actions.error,
      isGuestWorkspace: workspace.isGuestWorkspace,
      isLoading: workspace.isLoading,
      isMutating: actions.isMutating,
      portfolios: workspace.portfolios,
      portfolioPendingDelete: navigation.portfolioPendingDelete,
      selectedPortfolio: workspace.selectedPortfolio,
      statusMessage: actions.statusMessage,
    },
    actions: {
      cancelPendingDelete,
      closePortfolio: navigation.handleClosePortfolioDetails,
      confirmPendingDelete,
      createDefault: actions.handleCreateDefault,
      createDemo: actions.handleCreateDemo,
      deletePortfolio: actions.handleDeletePortfolio,
      importFile: actions.handleImportFile,
      mergePortfolio: workspace.upsertPortfolio,
      openPortfolio: navigation.handleOpenPortfolio,
      requestDelete: navigation.setPortfolioPendingDelete,
      selectPortfolio: workspace.setSelectedPortfolioId,
      startImport: navigation.handleImportClick,
      refresh: workspace.refetch,
      dismissStatus: () => actions.setStatusMessage(null),
    },
    importRef: navigation.importRef,
  };
}
