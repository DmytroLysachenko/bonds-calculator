'use client';

import { BondDefinition } from '@/features/bond-core/constants/bond-definitions';
import { BondType } from '@/features/bond-core/types';
import { CreatePortfolioLotInput } from '@/shared/lib/portfolio-client';
import { UserInvestmentLot, UserPortfolio } from '@/shared/types/portfolio';

import {
  PortfolioLiquidityPanel,
  PortfolioLotsTableSection,
  type PortfolioMaturityItem,
} from './PortfolioLotsTabSections';

type PortfolioLotsTabProps = {
  isLoading: boolean;
  lots: UserInvestmentLot[];
  definitions: Record<BondType, BondDefinition>;
  language: 'en' | 'pl';
  formatCurrency: (value: number) => string;
  maturityWindowDays: 30 | 90 | 180;
  onWindowChange: (value: 30 | 90 | 180) => void;
  filteredMaturities: PortfolioMaturityItem[];
  upcomingCashflow: number;
  maturityWindowLabel: string;
  t: (key: string, values?: Record<string, string>) => string;
  onCreateLot: (
    input: Omit<CreatePortfolioLotInput, 'portfolioId'> & { portfolioId?: string; notes?: string },
  ) => Promise<unknown>;
  onUpdateLot: (
    lotId: string,
    input: Omit<CreatePortfolioLotInput, 'portfolioId'> & { portfolioId?: string; notes?: string },
  ) => Promise<unknown>;
  onDeleteLot: (lotId: string) => Promise<unknown>;
  portfolios: UserPortfolio[];
};

export function PortfolioLotsTab({
  isLoading,
  lots,
  definitions,
  language,
  formatCurrency,
  maturityWindowDays,
  onWindowChange,
  filteredMaturities,
  upcomingCashflow,
  maturityWindowLabel,
  t,
  onCreateLot,
  onUpdateLot,
  onDeleteLot,
  portfolios,
}: PortfolioLotsTabProps) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <PortfolioLotsTableSection
        isLoading={isLoading}
        lots={lots}
        definitions={definitions}
        language={language}
        formatCurrency={formatCurrency}
        t={t}
        onCreateLot={onCreateLot}
        onUpdateLot={onUpdateLot}
        onDeleteLot={onDeleteLot}
        portfolios={portfolios}
      />

      <PortfolioLiquidityPanel
        definitions={definitions}
        language={language}
        formatCurrency={formatCurrency}
        maturityWindowDays={maturityWindowDays}
        onWindowChange={onWindowChange}
        filteredMaturities={filteredMaturities}
        upcomingCashflow={upcomingCashflow}
        maturityWindowLabel={maturityWindowLabel}
        t={t}
      />
    </div>
  );
}
