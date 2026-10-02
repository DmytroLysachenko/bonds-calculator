import { apiHandler } from '@/lib/server/http/api-handler';
import { okJson } from '@/lib/server/http/responses';
import { createPortfolioAccessPayload } from '@/lib/server/portfolio/access-payload';
import { getPortfolioRouteContext } from '@/lib/server/portfolio/http';

export const GET = apiHandler(async () => {
  const { owner } = await getPortfolioRouteContext();
  return okJson(createPortfolioAccessPayload(owner));
});
