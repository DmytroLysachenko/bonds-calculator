import { NextRequest } from 'next/server';
import { z } from 'zod';

import { apiHandler } from '@/lib/server/http/api-handler';
import { readJsonBody } from '@/lib/server/http/read-json-body';
import { okJson } from '@/lib/server/http/responses';
import { withPortfolioCommand, withPortfolioRead } from '@/lib/server/portfolio/http';
import { getOwnerSettings, updateOwnerSettings } from '@/lib/server/settings/service';

const UserSettingsUpdateSchema = z
  .object({
    currency: z.literal('PLN').optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    defaultInflationScenario: z.enum(['low', 'base', 'high']).optional(),
    chartType: z.enum(['area', 'line', 'bar']).optional(),
  })
  .strict();

const SETTINGS_MAX_BODY_BYTES = 8 * 1024;

export const GET = apiHandler(async () =>
  withPortfolioRead(async (owner) => {
    return okJson(await getOwnerSettings(owner.ownerId));
  }),
);

export const PATCH = apiHandler(async (req: NextRequest) =>
  withPortfolioCommand(req, async (owner) => {
    const validated = await readJsonBody(req, UserSettingsUpdateSchema, {
      maxBytes: SETTINGS_MAX_BODY_BYTES,
    });
    return okJson(await updateOwnerSettings(owner.ownerId, validated));
  }),
);
