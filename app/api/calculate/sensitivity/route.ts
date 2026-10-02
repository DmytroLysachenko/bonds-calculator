import { NextRequest } from 'next/server';

import { SensitivityRequestSchema } from '@/features/bond-core/handlers/single-bond';
import { getBondDefinitionsMap, getGlobalDataFreshness } from '@/lib/data/market-data';
import { singleBondHandler } from '@/lib/server/calculation/composition';
import { apiHandler } from '@/lib/server/http/api-handler';
import { calculationRateLimitPolicy } from '@/lib/server/http/rate-limiter';
import { readJsonBody } from '@/lib/server/http/read-json-body';
import { okJson } from '@/lib/server/http/responses';

export const POST = apiHandler(
  async (req: NextRequest) => {
    const payload = await readJsonBody(req, SensitivityRequestSchema);
    // Load exactly once, then pass that same immutable authority context to every point.
    const [dataFreshness, dbDefinitions] = await Promise.all([
      getGlobalDataFreshness(),
      getBondDefinitionsMap(),
    ]);
    return okJson(
      await singleBondHandler.calculateSensitivity(payload, { dataFreshness, dbDefinitions }),
    );
  },
  { rateLimitPolicy: calculationRateLimitPolicy },
);
