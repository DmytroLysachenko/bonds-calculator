import { NextRequest } from 'next/server';

import { InvestmentLotSchema } from '@/features/bond-core/types/portfolio-schemas';
import { apiHandler } from '@/lib/server/http/api-handler';
import { readJsonBody } from '@/lib/server/http/read-json-body';
import { createValidationErrorResponse, okJson } from '@/lib/server/http/responses';
import { portfolioApplication } from '@/lib/server/portfolio/application';
import {
  portfolioDomainErrorResponse,
  withPortfolioCommand,
  withPortfolioRead,
} from '@/lib/server/portfolio/http';

export const GET = apiHandler(async (req: NextRequest) => {
  return withPortfolioRead(async (owner) => {
    const url = new URL(req.url);
    const portfolioId = url.searchParams.get('portfolioId');

    if (!portfolioId) {
      return createValidationErrorResponse('Portfolio ID is required', 'MISSING_PARAM');
    }

    try {
      const lots = await portfolioApplication.listLots(owner.ownerId, portfolioId);
      return okJson(lots);
    } catch (error) {
      const response = portfolioDomainErrorResponse(error);
      if (response) return response;

      throw error;
    }
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  return withPortfolioCommand(req, async (owner) => {
    const validated = await readJsonBody(req, InvestmentLotSchema);

    try {
      const newLot = await portfolioApplication.createLot(owner.ownerId, validated);
      return okJson(newLot);
    } catch (error) {
      const response = portfolioDomainErrorResponse(error);
      if (response) return response;

      throw error;
    }
  });
});

export const DELETE = apiHandler(async (req: NextRequest) => {
  return withPortfolioCommand(req, async (owner) => {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return createValidationErrorResponse('Lot ID is required', 'MISSING_PARAM');
    }

    try {
      await portfolioApplication.deleteLot(owner.ownerId, id);
      return okJson({ success: true });
    } catch (error) {
      const response = portfolioDomainErrorResponse(error);
      if (response) return response;

      throw error;
    }
  });
});
