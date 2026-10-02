import { NextRequest } from 'next/server';

import { apiHandler } from '@/lib/server/http/api-handler';
import { readBoundedJsonBody } from '@/lib/server/http/read-json-body';
import { okJson } from '@/lib/server/http/responses';
import { portfolioApplication } from '@/lib/server/portfolio/application';
import { withPortfolioCommand } from '@/lib/server/portfolio/http';
import { ImportPayloadSchema } from '@/lib/server/portfolio/import-schema';

const MAX_IMPORT_BYTES = 256 * 1024;

export const POST = apiHandler(async (req: NextRequest) => {
  return withPortfolioCommand(req, async (owner) => {
    const payload = await readBoundedJsonBody(req, ImportPayloadSchema, MAX_IMPORT_BYTES);
    const { portfolio } = payload;
    const importedPortfolio = await portfolioApplication.importPortfolio(owner.ownerId, portfolio);

    return okJson({
      portfolio: importedPortfolio.portfolio,
      importedLots: importedPortfolio.importedLots,
    });
  });
});
