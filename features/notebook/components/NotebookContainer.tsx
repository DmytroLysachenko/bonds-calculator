'use client';
import { BookOpen } from 'lucide-react';
import React from 'react';

import { useNotebookWorkspaceController } from '@/features/notebook/hooks/useNotebookWorkspaceController';
import {
  buildNotebookFeedbackLabels,
  buildNotebookPortfolioListLabels,
} from '@/features/notebook/lib/notebook-container-labels';
import { useAppI18n } from '@/i18n/client';
import { Notice } from '@/shared/components/feedback/Notice';
import { CalculatorPageShell } from '@/shared/components/page/CalculatorPageShell';
import { SectionBlock } from '@/shared/components/page/SectionBlock';
import { MetricStrip } from '@/shared/components/results/MetricStrip';
import { useDateFormatter } from '@/shared/hooks/useLocalizedFormatters';

import { PortfolioDetails } from './portfolio-details/PortfolioDetails';
import { NotebookPortfolioListSection, NotebookScopeNote } from './NotebookContainerPanels';
import { EmptyPortfolioState, NotebookLoadingState } from './NotebookStates';
import { NotebookErrorNotice, NotebookWorkspaceFeedback } from './NotebookWorkspaceFeedback';
import { WorkspaceActionStrip } from './WorkspaceActionStrip';
import { WorkspaceStatusCard } from './WorkspaceStatusCard';
export const NotebookContainer: React.FC = () => {
  const { t, locale: language } = useAppI18n();
  const dateFormatter = useDateFormatter(language);
  const {
    view: {
      detailPortfolio,
      detailPortfolioId,
      emptyStateSteps,
      error,
      canManageWorkspace,
      isGuestWorkspace,
      isLoading,
      isMutating,
      notebookIntro,
      notebookStats,
      portfolios,
      portfolioPendingDelete,
      selectedPortfolio,
      statusMessage,
    },
    actions: {
      cancelPendingDelete,
      closePortfolio,
      confirmPendingDelete,
      createDefault,
      createDemo,
      deletePortfolio,
      importFile,
      mergePortfolio,
      openPortfolio,
      refresh,
      requestDelete,
      selectPortfolio,
      startImport,
      dismissStatus,
    },
    importRef,
  } = useNotebookWorkspaceController(t);

  if (detailPortfolioId && canManageWorkspace) {
    return detailPortfolio ? (
      <PortfolioDetails
        portfolio={detailPortfolio}
        onDelete={deletePortfolio}
        onPortfolioUpdate={mergePortfolio}
        onBack={closePortfolio}
        portfolios={portfolios}
      />
    ) : (
      <NotebookLoadingState />
    );
  }

  return (
    <CalculatorPageShell
      title={t('notebook.title')}
      description={t('notebook.subtitle')}
      icon={<BookOpen className="h-8 w-8" />}
      isCalculating={isLoading || isMutating}
      hasResults={portfolios.length > 0}
    >
      <input
        ref={importRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={importFile}
      />

      <NotebookErrorNotice error={error} retryLabel={t('common.retry')} onRetry={refresh} />

      <SectionBlock title={t('notebook.workspace_scope_title')} description={notebookIntro}>
        <div className="space-y-4">
          {isGuestWorkspace ? (
            <Notice tone="locked" title={t('workspace.sign_in_required_short')}>
              {t('workspace.locked_notebook_notice')}
            </Notice>
          ) : null}

          {canManageWorkspace ? (
            <>
              <WorkspaceStatusCard
                isGuestWorkspace={isGuestWorkspace}
                canManageWorkspace={canManageWorkspace}
                selectedPortfolio={selectedPortfolio}
                portfolios={portfolios}
                onActivePortfolioChange={selectPortfolio}
              />

              <WorkspaceActionStrip
                canManageWorkspace={canManageWorkspace}
                onImport={startImport}
                onCreateDemo={createDemo}
                onRefresh={refresh}
                onCreatePortfolio={createDefault}
              />

              <MetricStrip items={notebookStats} columns="grid-cols-1 md:grid-cols-3" />
            </>
          ) : null}
        </div>
      </SectionBlock>

      {isLoading ? (
        <NotebookLoadingState />
      ) : portfolios.length === 0 ? (
        <EmptyPortfolioState
          onCreate={canManageWorkspace ? createDefault : () => {}}
          onCreateDemo={canManageWorkspace ? createDemo : () => {}}
          onImport={canManageWorkspace ? startImport : () => {}}
          badgeLabel={t('notebook.empty_badge')}
          title={t('notebook.empty_title')}
          description={
            canManageWorkspace ? t('notebook.empty_desc') : t('workspace.empty_guest_description')
          }
          createLabel={
            canManageWorkspace ? t('notebook.create_first') : t('workspace.sign_in_required_short')
          }
          demoLabel={t('notebook.load_demo')}
          importLabel={t('notebook.import_json')}
          capabilitiesTitle={t('notebook.capabilities_title')}
          capabilities={emptyStateSteps}
          canManageWorkspace={canManageWorkspace}
        />
      ) : (
        <div className="space-y-8">
          <NotebookPortfolioListSection
            portfolios={portfolios}
            canManageWorkspace={canManageWorkspace}
            formatDate={(date) => dateFormatter.format(date)}
            labels={buildNotebookPortfolioListLabels(t)}
            onOpenPortfolio={openPortfolio}
            onRequestDelete={requestDelete}
          />

          <NotebookScopeNote
            title={t('notebook.scope_title')}
            description={t('notebook.scope_desc')}
          />
        </div>
      )}

      <NotebookWorkspaceFeedback
        portfolioPendingDelete={portfolioPendingDelete}
        statusMessage={statusMessage}
        labels={buildNotebookFeedbackLabels(t)}
        onCancelDelete={cancelPendingDelete}
        onConfirmDelete={confirmPendingDelete}
        onDismissToast={dismissStatus}
      />
    </CalculatorPageShell>
  );
};
