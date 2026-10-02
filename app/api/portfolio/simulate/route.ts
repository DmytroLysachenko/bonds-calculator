import { NextRequest } from 'next/server';
import { z } from 'zod';

import { apiHandler } from '@/lib/server/http/api-handler';
import { readJsonBody } from '@/lib/server/http/read-json-body';
import { okJson } from '@/lib/server/http/responses';
import { portfolioApplication } from '@/lib/server/portfolio/application';
import { portfolioDomainErrorResponse, withPortfolioCommand } from '@/lib/server/portfolio/http';

const PortfolioSimulationPayloadSchema = z
  .object({
    portfolioId: z.string().uuid(),
    expectedInflation: z.number().finite().min(-20).max(100).optional(),
  })
  .strict();

export const POST = apiHandler(async (req: NextRequest) => {
  return withPortfolioCommand(req, async (owner) => {
    const { portfolioId, expectedInflation = 3.5 } = await readJsonBody(
      req,
      PortfolioSimulationPayloadSchema,
    );

    try {
      const result = await portfolioApplication.simulatePortfolio(owner.ownerId, portfolioId, {
        expectedInflation,
      });
      return okJson(result);
    } catch (error) {
      const response = portfolioDomainErrorResponse(error);
      if (response) return response;

      throw error;
    }
  });
});
