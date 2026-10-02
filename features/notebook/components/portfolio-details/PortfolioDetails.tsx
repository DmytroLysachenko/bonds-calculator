'use client';
import dynamic from 'next/dynamic';
import React, { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePortfolioDetailsWorkspace } from '@/features/notebook/hooks/usePortfolioDetailsWorkspace';
import { useAppI18n } from '@/i18n/client';
import { ConfirmActionDialog } from '@/shared/components/feedback/ConfirmActionDialog';
import { FormInlineNotice } from '@/shared/components/forms/FormInlineNotice';
import { useBondDefinitions } from '@/shared/context/BondDefinitionsContext';
import { useCurrencyFormatter, useDateFormatter } from '@/shared/hooks/useLocalizedFormatters';
import { UserPortfolio } from '@/shared/types/portfolio';

import { PortfolioLotsTab } from './PortfolioLotsTab';
import { PortfolioOverviewHeader } from './PortfolioOverviewHeader';

const PortfolioAnalyticsTab = dynamic(
  () => import('./PortfolioAnalyticsTab').then((module) => module.PortfolioAnalyticsTab),
  {
    loading: () => (
      <div className="h-[360px] w-full animate-pulse rounded-lg bg-muted" role="status" />
    ),
  },
);

const detailTabTriggerClassName =
  'h-9 rounded-none border-b-2 border-transparent px-3.5 py-2 text-sm font-semibold data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none';

interface PortfolioDetailsProps {
  portfolio: UserPortfolio;
  onBack: () => void;
  onDelete?: (portfolio: UserPortfolio) => Promise<void> | void;
  onPortfolioUpdate?: (portfolio: UserPortfolio) => void;
  portfolios: UserPortfolio[];
}
export const PortfolioDetails: React.FC<PortfolioDetailsProps> = ({
  portfolio,
  onBack,
  onDelete,
  onPortfolioUpdate,
  portfolios,
}) => {
  const { t, locale: language } = useAppI18n();
  const { definitions, isLoading: isLoadingDefs } = useBondDefinitions();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const currencyFormatter = useCurrencyFormatter(language, {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  });
  const dateFormatter = useDateFormatter(language);
  const formatCurrency = useCallback(
    (value: number) => currencyFormatter.format(value),
    [currencyFormatter],
  );
  const {
    lots,
    isLoading,
    simulation,
    isSimulating,
    isPublic,
    isSharing,
    justCopied,
    maturityWindowDays,
    setMaturityWindowDays,
    totalValue,
    filteredMaturities,
    upcomingCashflow,
    nextMaturity,
    handleToggleShare,
    copyToClipboard,
    handleExport,
    createLot,
    updateLot,
    deleteLot,
    requestError,
    fetchLots,
    updatePortfolio,
  } = usePortfolioDetailsWorkspace({
    portfolio,
    definitions,
    onPortfolioUpdate,
  });
  const maturityWindowLabel = t('notebook.next_days_window', {
    days: String(maturityWindowDays),
  });
  if (isLoadingDefs || !definitions) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-40 rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="h-32 rounded bg-muted" />
          <div className="h-32 rounded bg-muted" />
          <div className="h-32 rounded bg-muted" />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6 pb-16">
      <PortfolioOverviewHeader
        portfolio={portfolio}
        lotsCount={lots.length}
        nextMaturityDate={nextMaturity?.maturityDate ?? null}
        nextMaturityType={nextMaturity?.bondType ?? null}
        totalInvestedValue={formatCurrency(totalValue)}
        isPublic={isPublic}
        isSharing={isSharing}
        justCopied={justCopied}
        formatDate={(value) => dateFormatter.format(value)}
        onBack={onBack}
        onExport={handleExport}
        onToggleShare={handleToggleShare}
        onCopyLink={copyToClipboard}
        onDeleteRequest={() => setIsDeleteDialogOpen(true)}
        canDelete={Boolean(onDelete)}
        t={t}
        onUpdatePortfolio={updatePortfolio}
      />
      {requestError ? (
        <FormInlineNotice
          tone="warning"
          description={requestError}
          action={
            <Button size="sm" variant="outline" onClick={() => void fetchLots()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : null}

      <Tabs defaultValue="lots" className="w-full">
        <TabsList className="mb-5 h-auto w-full justify-start gap-3 border-b border-border bg-transparent p-0 md:w-fit">
          <TabsTrigger value="lots" className={detailTabTriggerClassName}>
            {t('notebook.lots_tab')}
          </TabsTrigger>
          <TabsTrigger value="analytics" className={detailTabTriggerClassName}>
            {t('notebook.analytics_tab_short')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lots" className="space-y-6">
          <PortfolioLotsTab
            isLoading={isLoading}
            lots={lots}
            definitions={definitions}
            language={language}
            formatCurrency={formatCurrency}
            maturityWindowDays={maturityWindowDays}
            onWindowChange={setMaturityWindowDays}
            filteredMaturities={filteredMaturities}
            upcomingCashflow={upcomingCashflow}
            maturityWindowLabel={maturityWindowLabel}
            t={t}
            onCreateLot={createLot}
            onUpdateLot={updateLot}
            onDeleteLot={deleteLot}
            portfolios={portfolios}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <PortfolioAnalyticsTab
            simulation={simulation}
            isSimulating={isSimulating}
            formatCurrency={formatCurrency}
            t={t}
          />
        </TabsContent>
      </Tabs>

      <ConfirmActionDialog
        open={isDeleteDialogOpen}
        title={t('notebook.delete_portfolio')}
        description={t('notebook.confirm_delete_portfolio_full', {
          name: portfolio.name,
        })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={async () => {
          setIsDeleteDialogOpen(false);
          if (onDelete) {
            await onDelete(portfolio);
            onBack();
          }
        }}
      />
    </div>
  );
};
