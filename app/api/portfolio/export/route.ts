import { NextRequest } from 'next/server';

import { apiHandler } from '@/lib/server/http/api-handler';
import { createValidationErrorResponse, okJson } from '@/lib/server/http/responses';
import { portfolioApplication } from '@/lib/server/portfolio/application';
import { portfolioDomainErrorResponse, withPortfolioCommand } from '@/lib/server/portfolio/http';

export const GET = apiHandler(async (req: NextRequest) => {
  return withPortfolioCommand(req, async (owner) => {
    const { searchParams } = new URL(req.url);
    const portfolioId = searchParams.get('portfolioId');
    const formatMode = searchParams.get('format') ?? 'portfolio';

    if (!portfolioId) {
      return createValidationErrorResponse('Portfolio ID is required', 'MISSING_PARAM');
    }

    try {
      const { exportData, fileName } = await portfolioApplication.exportPortfolio(
        owner.ownerId,
        portfolioId,
        formatMode === 'package' ? 'package' : 'portfolio',
      );

      return okJson(exportData, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'X-Export-Format': formatMode,
        },
      });
    } catch (error) {
      const response = portfolioDomainErrorResponse(error);
      if (response) return response;

      throw error;
    }
  });
});
