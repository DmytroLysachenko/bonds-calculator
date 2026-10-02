import { apiHandler } from '@/lib/server/http/api-handler';
import { okJson } from '@/lib/server/http/responses';
import { portfolioApplication } from '@/lib/server/portfolio/application';
import { withPortfolioRead } from '@/lib/server/portfolio/http';

export const GET = apiHandler(async () => {
  return withPortfolioRead(
    async (owner) => {
      const summary = await portfolioApplication.summarizePortfolios(owner.ownerId);
      return okJson(summary);
    },
    () =>
      okJson({
        items: [],
        aggregatedTimeline: [],
        summary: { totalInvested: 0, totalNetValue: 0, totalRealValue: 0, totalProfit: 0 },
      }),
  );
});
