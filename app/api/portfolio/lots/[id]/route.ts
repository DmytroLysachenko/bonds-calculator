import { NextRequest } from 'next/server';

import { InvestmentLotUpdateSchema } from '@/features/bond-core/types/portfolio-schemas';
import { apiHandler } from '@/lib/server/http/api-handler';
import { readJsonBody } from '@/lib/server/http/read-json-body';
import { errorJson, okJson } from '@/lib/server/http/responses';
import { createServerLogger } from '@/lib/server/logging';
import { portfolioApplication } from '@/lib/server/portfolio/application';
import { portfolioDomainErrorResponse, withPortfolioCommand } from '@/lib/server/portfolio/http';

const logger = createServerLogger('PortfolioLotApi');

export const PATCH = apiHandler<{ params: Promise<{ id: string }> }>(
  async (req: NextRequest, { params }) => {
    return withPortfolioCommand(req, async (owner) => {
      const { id } = await params;
      const validated = await readJsonBody(req, InvestmentLotUpdateSchema);

      try {
        const updatedLot = await portfolioApplication.updateLot(owner.ownerId, id, validated);
        return okJson(updatedLot);
      } catch (error) {
        const response = portfolioDomainErrorResponse(error);
        if (response) return response;

        logger.error('Failed to update lot', error);
        return errorJson('Database error', 'DATABASE_ERROR', undefined, { status: 500 });
      }
    });
  },
);

export const DELETE = apiHandler<{ params: Promise<{ id: string }> }>(
  async (req: NextRequest, { params }) => {
    return withPortfolioCommand(req, async (owner) => {
      const { id } = await params;

      try {
        await portfolioApplication.deleteLot(owner.ownerId, id);
        return okJson({ success: true });
      } catch (error) {
        const response = portfolioDomainErrorResponse(error);
        if (response) return response;

        logger.error('Failed to delete lot', error);
        return errorJson('Database error', 'DATABASE_ERROR', undefined, { status: 500 });
      }
    });
  },
);
