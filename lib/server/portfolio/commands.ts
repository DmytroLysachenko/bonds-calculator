import { BondType } from '@/features/bond-core/types';
import { resolveStoredBondLotContext } from '@/lib/server/bonds/offer-terms';
import { getOwnedLot, getOwnedPortfolio } from '@/lib/server/portfolio/access';
import { PortfolioServiceError } from '@/lib/server/portfolio/errors';
import {
  createLot,
  createLotWithBuyTransaction,
  createPortfolio,
  deleteLotByOwner,
  deletePortfolioByOwner,
  importPortfolioAtomically,
  updateLotByOwner,
  updatePortfolioByOwner,
  updatePortfolioVisibility,
} from '@/lib/server/portfolio/repository';

export async function createOwnerPortfolio(
  ownerId: string,
  input: { name: string; description?: string },
) {
  const [portfolio] = await createPortfolio(ownerId, input.name, input.description);
  return portfolio;
}

export async function deleteOwnerPortfolio(ownerId: string, portfolioId: string) {
  const [deletedPortfolio] = await deletePortfolioByOwner(ownerId, portfolioId);
  if (!deletedPortfolio) throw new PortfolioServiceError('Portfolio not found', 404, 'NOT_FOUND');
  return deletedPortfolio;
}

export async function updateOwnerPortfolio(
  ownerId: string,
  portfolioId: string,
  input: { name?: string; description?: string },
) {
  const [portfolio] = await updatePortfolioByOwner(ownerId, portfolioId, input);
  if (!portfolio) throw new PortfolioServiceError('Portfolio not found', 404, 'NOT_FOUND');
  return portfolio;
}

export async function createPortfolioLot(
  ownerId: string,
  input: {
    portfolioId: string;
    bondType: string;
    purchaseDate: string;
    bondQuantity: number;
    selectedSeriesId?: string | null;
    isRebought: boolean;
    notes?: string;
  },
) {
  const portfolio = await getOwnedPortfolio(ownerId, input.portfolioId);

  if (!portfolio) {
    throw new PortfolioServiceError('Portfolio not found', 404, 'NOT_FOUND');
  }

  const resolvedLotContext = await resolveStoredBondLotContext(
    input.bondType as BondType,
    input.purchaseDate,
    input.selectedSeriesId,
  );

  const [newLot] = await createLot({
    portfolioId: input.portfolioId,
    bondType: input.bondType,
    bondTypeId: resolvedLotContext.bondTypeId,
    bondSeriesId: resolvedLotContext.bondSeriesId,
    purchaseDate: input.purchaseDate,
    amount: input.bondQuantity.toString(),
    isRebought: input.isRebought,
    notes: input.notes,
  });

  return newLot;
}

export async function createPortfolioLotWithBuyTransaction(
  ownerId: string,
  input: {
    portfolioId: string;
    bondType: string;
    purchaseDate: string;
    bondQuantity: string | number;
    isRebought?: boolean;
    notes?: string;
  },
) {
  const portfolio = await getOwnedPortfolio(ownerId, input.portfolioId);

  if (!portfolio) {
    throw new PortfolioServiceError('Portfolio not found', 404, 'NOT_FOUND');
  }

  return createLotWithBuyTransaction({
    portfolioId: input.portfolioId,
    bondType: input.bondType,
    purchaseDate: input.purchaseDate,
    amount: String(input.bondQuantity),
    isRebought: Boolean(input.isRebought),
    notes: input.notes,
  });
}

export async function updateOwnerLot(
  ownerId: string,
  lotId: string,
  input: Partial<{
    portfolioId: string;
    bondType: string;
    purchaseDate: string;
    bondQuantity: number;
    selectedSeriesId: string | null;
    isRebought: boolean;
    notes?: string;
  }>,
) {
  const existingLot = await getOwnedLot(ownerId, lotId);

  if (!existingLot) {
    throw new PortfolioServiceError('Lot not found', 404, 'NOT_FOUND');
  }

  if (input.portfolioId) {
    const targetPortfolio = await getOwnedPortfolio(ownerId, input.portfolioId);

    if (!targetPortfolio) {
      throw new PortfolioServiceError('Portfolio not found', 404, 'NOT_FOUND');
    }
  }

  const { selectedSeriesId, ...columns } = input;
  const updateData: Parameters<typeof updateLotByOwner>[2] = {
    ...columns,
    amount: input.bondQuantity === undefined ? undefined : String(input.bondQuantity),
  };
  if (
    input.bondType !== undefined ||
    input.purchaseDate !== undefined ||
    selectedSeriesId !== undefined
  ) {
    const resolved = await resolveStoredBondLotContext(
      (input.bondType ?? existingLot.bondType) as BondType,
      input.purchaseDate ?? existingLot.purchaseDate,
      selectedSeriesId,
    );
    if (!resolved.bondTypeId || (selectedSeriesId && !resolved.bondSeriesId)) {
      throw new PortfolioServiceError(
        'Selected bond series is unavailable',
        422,
        'INVALID_BOND_SERIES',
      );
    }
    updateData.bondTypeId = resolved.bondTypeId;
    updateData.bondSeriesId = resolved.bondSeriesId;
  }

  if (input.bondQuantity !== undefined) {
    updateData.amount = input.bondQuantity.toString();
  }

  const [updatedLot] = await updateLotByOwner(ownerId, lotId, updateData);

  if (!updatedLot) {
    throw new PortfolioServiceError('Lot not found', 404, 'NOT_FOUND');
  }

  return updatedLot;
}

export async function deleteOwnerLot(ownerId: string, lotId: string) {
  const [deletedLot] = await deleteLotByOwner(ownerId, lotId);

  if (!deletedLot) {
    throw new PortfolioServiceError('Lot not found', 404, 'NOT_FOUND');
  }
}

export async function toggleOwnerPortfolioSharing(
  ownerId: string,
  portfolioId: string,
  isPublic: boolean,
) {
  const portfolio = await getOwnedPortfolio(ownerId, portfolioId);

  if (!portfolio) {
    throw new PortfolioServiceError('Portfolio not found', 404, 'NOT_FOUND');
  }

  await updatePortfolioVisibility(ownerId, portfolioId, isPublic);

  return {
    success: true,
    shareId: portfolio.shareId,
    isPublic,
  };
}

export async function importOwnerPortfolio(
  ownerId: string,
  input: {
    name: string;
    description?: string;
    lots: Array<{
      bondType: string;
      purchaseDate: string;
      bondQuantity: string | number;
      bondSeriesId?: string | null;
      seriesCode?: string;
      isRebought?: boolean;
      notes?: string;
    }>;
  },
) {
  const preparedLots = await Promise.all(
    input.lots.map(async (lot) => {
      const resolvedLotContext = await resolveStoredBondLotContext(
        lot.bondType as BondType,
        lot.purchaseDate,
        lot.bondSeriesId,
        lot.seriesCode,
      );

      if (!resolvedLotContext.bondTypeId) {
        throw new PortfolioServiceError('Unsupported bond type', 422, 'UNSUPPORTED_BOND');
      }

      return {
        bondType: lot.bondType,
        bondTypeId: resolvedLotContext.bondTypeId,
        bondSeriesId: resolvedLotContext.bondSeriesId,
        purchaseDate: lot.purchaseDate,
        amount: String(lot.bondQuantity),
        isRebought: lot.isRebought ?? false,
        notes: lot.notes,
      };
    }),
  );

  return importPortfolioAtomically(ownerId, {
    name: input.name,
    description: input.description ?? 'Imported portfolio package',
    lots: preparedLots,
  });
}
