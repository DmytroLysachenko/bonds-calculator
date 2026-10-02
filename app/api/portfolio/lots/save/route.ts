import { NextRequest } from 'next/server';

import { PortfolioLotTransactionSchema } from '@/features/bond-core/types/portfolio-schemas';
import { apiHandler } from '@/lib/server/http/api-handler';
import { readJsonBody } from '@/lib/server/http/read-json-body';
import { errorJson, okJson } from '@/lib/server/http/responses';
import { createServerLogger } from '@/lib/server/logging';
import { portfolioApplication } from '@/lib/server/portfolio/application';
import { portfolioDomainErrorResponse, withPortfolioCommand } from '@/lib/server/portfolio/http';

const logger = createServerLogger('PortfolioLotSaveApi');

export const POST = apiHandler(async (req: NextRequest) => {
  return withPortfolioCommand(req, async (owner) => {
    try {
      const { portfolioId, bondType, purchaseDate, bondQuantity, isRebought, notes } =
        await readJsonBody(req, PortfolioLotTransactionSchema);

      const result = await portfolioApplication.createLotWithTransaction(owner.ownerId, {
        portfolioId,
        bondType,
        purchaseDate,
        bondQuantity,
        isRebought,
        notes,
      });

      return okJson(result);
    } catch (error) {
      const response = portfolioDomainErrorResponse(error);
      if (response) return response;

      logger.error('Failed to save lot transactionally', error);
      return errorJson('Internal error', 'INTERNAL_ERROR', undefined, { status: 500 });
    }
  });
});
