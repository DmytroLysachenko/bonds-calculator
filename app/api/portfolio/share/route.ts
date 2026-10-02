import { NextRequest } from 'next/server';
import { z } from 'zod';

import { apiHandler } from '@/lib/server/http/api-handler';
import { readJsonBody } from '@/lib/server/http/read-json-body';
import { okJson } from '@/lib/server/http/responses';
import { portfolioApplication } from '@/lib/server/portfolio/application';
import { portfolioDomainErrorResponse, withPortfolioCommand } from '@/lib/server/portfolio/http';

const PortfolioSharePayloadSchema = z
  .object({
    portfolioId: z.string().uuid(),
    isPublic: z.boolean().optional(),
  })
  .strict();

export const POST = apiHandler(async (req: NextRequest) => {
  return withPortfolioCommand(req, async (owner) => {
    const { portfolioId, isPublic } = await readJsonBody(req, PortfolioSharePayloadSchema);

    try {
      const result = await portfolioApplication.setPortfolioVisibility(
        owner.ownerId,
        portfolioId,
        Boolean(isPublic),
      );
      return okJson(result);
    } catch (error) {
      const response = portfolioDomainErrorResponse(error);
      if (response) return response;

      throw error;
    }
  });
});
