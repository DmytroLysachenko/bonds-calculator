import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { apiHandler } from '@/lib/server/http/api-handler';
import { observabilityRateLimitPolicy } from '@/lib/server/http/rate-limiter';
import { readJsonBody } from '@/lib/server/http/read-json-body';
import { createServerLogger } from '@/lib/server/logging';
import {
  recordVitalAggregate,
  shouldSampleVital,
  type ValidatedVital,
} from '@/lib/server/observability/vital-aggregates';
import { telemetryRoute } from '@/shared/lib/telemetry-route';

const logger = createServerLogger('WebVitals');
const MAX_METRIC_PAYLOAD_BYTES = 2_048;

const payloadSchema = z
  .object({
    name: z.enum(['CLS', 'INP', 'LCP']),
    value: z.number().finite().nonnegative().max(60_000),
    rating: z.enum(['good', 'needs-improvement', 'poor']),
    path: z
      .string()
      .regex(/^\/[a-z0-9/_-]*$/i)
      .max(160),
    navigationType: z.enum(['navigate', 'reload', 'back_forward', 'prerender']).default('navigate'),
  })
  .strict();

export const POST = apiHandler(
  async (request: NextRequest) => {
    const vital: ValidatedVital = await readJsonBody(request, payloadSchema, {
      maxBytes: MAX_METRIC_PAYLOAD_BYTES,
    });
    vital.path = telemetryRoute(vital.path);
    if (shouldSampleVital()) {
      try {
        await recordVitalAggregate(vital);
      } catch (error) {
        logger.error('Failed to persist web-vital aggregate', {
          errorType: error instanceof Error ? error.name : 'unknown',
          metric: vital.name,
          rating: vital.rating,
          path: vital.path,
        });
      }
    }

    // Safe fallback and local-development observability; never log user metadata.
    logger.info('web_vital', {
      event: 'web_vital',
      metric: vital.name,
      value: vital.value,
      rating: vital.rating,
      path: vital.path,
    });

    return new NextResponse(null, { status: 204 });
  },
  { rateLimitPolicy: observabilityRateLimitPolicy },
);
