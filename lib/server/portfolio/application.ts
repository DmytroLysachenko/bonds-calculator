import { toHoldingLot } from '@/shared/types/portfolio';

import {
  createOwnerPortfolio,
  createPortfolioLot,
  createPortfolioLotWithBuyTransaction,
  deleteOwnerLot,
  deleteOwnerPortfolio,
  importOwnerPortfolio,
  toggleOwnerPortfolioSharing,
  updateOwnerLot,
  updateOwnerPortfolio,
} from './commands';
import {
  exportOwnerPortfolio,
  listOwnerPortfolios,
  listPortfolioLots,
  simulateOwnerPortfolio,
  summarizeOwnerPortfolios,
} from './queries';
import { getPublicSharedPortfolioPageData } from './shared-page-service';

/**
 * Application interface for portfolio intentions. Route controllers depend on
 * this one module; authorization and HTTP decoding stay outside, while owner
 * checks, offer lookup, transactions, and export encoding remain behind it.
 */
export const portfolioApplication = {
  createPortfolio: createOwnerPortfolio,
  deletePortfolio: deleteOwnerPortfolio,
  updatePortfolio: updateOwnerPortfolio,
  listPortfolios: listOwnerPortfolios,
  async createLot(...args: Parameters<typeof createPortfolioLot>) {
    return toHoldingLot(await createPortfolioLot(...args));
  },
  async createLotWithTransaction(...args: Parameters<typeof createPortfolioLotWithBuyTransaction>) {
    return toHoldingLot(await createPortfolioLotWithBuyTransaction(...args));
  },
  async updateLot(...args: Parameters<typeof updateOwnerLot>) {
    return toHoldingLot(await updateOwnerLot(...args));
  },
  deleteLot: deleteOwnerLot,
  async listLots(...args: Parameters<typeof listPortfolioLots>) {
    return (await listPortfolioLots(...args)).map(toHoldingLot);
  },
  importPortfolio: importOwnerPortfolio,
  setPortfolioVisibility: toggleOwnerPortfolioSharing,
  simulatePortfolio: simulateOwnerPortfolio,
  exportPortfolio: exportOwnerPortfolio,
  summarizePortfolios: summarizeOwnerPortfolios,
  loadSharedPortfolio: getPublicSharedPortfolioPageData,
};
