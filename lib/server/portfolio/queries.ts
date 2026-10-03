import { MODEL_VERSION } from '@/features/bond-core/model-version';
import { BondType, TaxStrategy } from '@/features/bond-core/types';
import {
  PortfolioSimulationCalculationEnvelope,
  type PortfolioSimulationResult,
  ScenarioKind,
} from '@/features/bond-core/types/scenarios';
import { getMacroAssumptionDefaults } from '@/lib/data/market-data';
import { resolveStoredBondLotContext } from '@/lib/server/bonds/offer-terms';
import { calculationService } from '@/lib/server/calculation/composition';
import { getOwnedPortfolio } from '@/lib/server/portfolio/access';
import { PortfolioServiceError } from '@/lib/server/portfolio/errors';
import {
  listLotsByPortfolio,
  listLotsByPortfolioIds,
  listPortfoliosByOwner,
} from '@/lib/server/portfolio/repository';
import { buildPortfolioSimulationPayload } from '@/lib/server/portfolio/simulation';

const emptySimulationResult: PortfolioSimulationResult = {
  items: [],
  aggregatedTimeline: [],
  summary: {
    totalInvested: 0,
    totalNetValue: 0,
    totalRealValue: 0,
    totalProfit: 0,
  },
};

export async function listOwnerPortfolios(ownerId: string) {
  return listPortfoliosByOwner(ownerId);
}

export async function listPortfolioLots(ownerId: string, portfolioId: string) {
  const portfolio = await getOwnedPortfolio(ownerId, portfolioId);

  if (!portfolio) {
    throw new PortfolioServiceError('Portfolio not found', 404, 'NOT_FOUND');
  }

  return listLotsByPortfolio(portfolioId);
}

export async function simulateOwnerPortfolio(
  ownerId: string,
  portfolioId: string,
  options?: {
    expectedInflation?: number;
  },
) {
  const portfolio = await getOwnedPortfolio(ownerId, portfolioId);

  if (!portfolio) {
    throw new PortfolioServiceError('Portfolio not found', 404, 'NOT_FOUND');
  }

  const lots = await listLotsByPortfolio(portfolioId);

  if (lots.length === 0) {
    return emptySimulationResult;
  }

  const macroDefaults = await getMacroAssumptionDefaults();
  const envelope = await calculationService.calculate({
    kind: ScenarioKind.PORTFOLIO_SIMULATION,
    payload: buildPortfolioSimulationPayload(lots, {
      expectedInflation: options?.expectedInflation ?? macroDefaults.expectedInflation,
    }),
  });

  return envelope.result;
}

export async function exportOwnerPortfolio(
  ownerId: string,
  portfolioId: string,
  formatMode: 'portfolio' | 'package' = 'portfolio',
) {
  const portfolio = await getOwnedPortfolio(ownerId, portfolioId);

  if (!portfolio) {
    throw new PortfolioServiceError('Portfolio not found', 404, 'NOT_FOUND');
  }

  const lots = await listLotsByPortfolio(portfolioId);
  const macroDefaults = await getMacroAssumptionDefaults();
  const payload = buildPortfolioSimulationPayload(lots, {
    taxStrategy: TaxStrategy.STANDARD,
    rollover: true,
    expectedInflation: macroDefaults.expectedInflation,
    expectedNbpRate: macroDefaults.expectedNbpRate,
  });

  const simulation =
    lots.length > 0
      ? ((await calculationService.calculate({
          kind: ScenarioKind.PORTFOLIO_SIMULATION,
          payload,
        })) as PortfolioSimulationCalculationEnvelope)
      : null;

  const exportData = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    appVersion: MODEL_VERSION,
    packageType: formatMode === 'package' ? 'portfolio-package' : 'portfolio-export',
    assumptions: {
      expectedInflation: macroDefaults.expectedInflation,
      expectedNbpRate: macroDefaults.expectedNbpRate,
      taxStrategy: TaxStrategy.STANDARD,
      withdrawalDate: payload.withdrawalDate,
    },
    portfolio: {
      id: portfolio.id,
      name: portfolio.name,
      description: portfolio.description,
      lots: await Promise.all(
        lots.map(async (lot) => ({
          bondType: lot.bondType,
          bondTypeId: lot.bondTypeId,
          bondSeriesId: lot.bondSeriesId,
          seriesCode: (
            await resolveStoredBondLotContext(
              lot.bondType as BondType,
              lot.purchaseDate,
              lot.bondSeriesId,
            )
          ).seriesCode,
          purchaseDate: lot.purchaseDate,
          amount: lot.amount,
          isRebought: lot.isRebought,
          notes: lot.notes,
        })),
      ),
    },
    summary: simulation?.result.summary ?? null,
  };

  return {
    exportData,
    fileName: `${portfolio.name.replace(/\s+/g, '_').toLowerCase()}_${formatMode}.json`,
  };
}

export async function summarizeOwnerPortfolios(ownerId: string) {
  const portfolios = await listPortfoliosByOwner(ownerId);

  if (portfolios.length === 0) {
    return emptySimulationResult;
  }

  const lots = await listLotsByPortfolioIds(portfolios.map((portfolio) => portfolio.id));

  if (lots.length === 0) {
    return emptySimulationResult;
  }

  const envelope = await calculationService.calculate({
    kind: ScenarioKind.PORTFOLIO_SIMULATION,
    payload: buildPortfolioSimulationPayload(lots),
  });

  // The overview needs aggregate checkpoints, not every accounting event of
  // every holding. Full lot detail remains available through simulation/export.
  return { ...envelope.result, items: [] };
}
