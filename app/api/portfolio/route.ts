import { NextRequest } from 'next/server';

import {
  PortfolioSchema,
  PortfolioUpdateSchema,
} from '@/features/bond-core/types/portfolio-schemas';
import { apiHandler } from '@/lib/server/http/api-handler';
import { readJsonBody } from '@/lib/server/http/read-json-body';
import { createValidationErrorResponse, okJson } from '@/lib/server/http/responses';
import { portfolioApplication } from '@/lib/server/portfolio/application';
import {
  portfolioDomainErrorResponse,
  withPortfolioCommand,
  withPortfolioRead,
} from '@/lib/server/portfolio/http';

export const GET = apiHandler(async () => {
  return withPortfolioRead(
    async (owner) => {
      const portfolios = await portfolioApplication.listPortfolios(owner.ownerId);
      return okJson(portfolios);
    },
    () => okJson([]),
  );
});

export const POST = apiHandler(async (req: NextRequest) => {
  return withPortfolioCommand(req, async (owner) => {
    const validated = await readJsonBody(req, PortfolioSchema);
    const newPortfolio = await portfolioApplication.createPortfolio(owner.ownerId, validated);

    return okJson(newPortfolio);
  });
});

export const DELETE = apiHandler(async (req: NextRequest) => {
  return withPortfolioCommand(req, async (owner) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return createValidationErrorResponse('Missing portfolio id.');
    }

    try {
      const deletedPortfolio = await portfolioApplication.deletePortfolio(owner.ownerId, id);

      return okJson(deletedPortfolio);
    } catch (error) {
      const response = portfolioDomainErrorResponse(error);
      if (response) return response;

      throw error;
    }
  });
});

export const PATCH = apiHandler(async (req: NextRequest) => {
  return withPortfolioCommand(req, async (owner) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return createValidationErrorResponse('Missing portfolio id.');
    const validated = await readJsonBody(req, PortfolioUpdateSchema);
    try {
      return okJson(await portfolioApplication.updatePortfolio(owner.ownerId, id, validated));
    } catch (error) {
      const response = portfolioDomainErrorResponse(error);
      if (response) return response;
      throw error;
    }
  });
});
