import { NextRequest, NextResponse } from 'next/server';

import { createServerLogger } from '@/lib/server/logging';

import { getClientIdentity } from './client-identity';
import { postgresRateLimitStore } from './postgres-rate-limit-store';
import { mapApiErrorToProblemDetails } from './problem-details';
import {
  AllowAllRateLimiter,
  BoundedMemoryRateLimiter,
  defaultApiRateLimitPolicy,
  type RateLimiter,
  type RateLimitPolicy,
  SharedStoreRateLimiter,
} from './rate-limiter';
import { addRequestIdToProblem, getRequestId, withCorrelatedRequestId } from './request-context';

const logger = createServerLogger('ApiHandler');
const rateLimiter =
  process.env.PLAYWRIGHT_SMOKE === '1'
    ? new AllowAllRateLimiter()
    : process.env.NODE_ENV === 'production'
      ? new SharedStoreRateLimiter(postgresRateLimitStore)
      : new BoundedMemoryRateLimiter();

export type ApiHandler<TContext = { params: Promise<Record<string, never>> }> = (
  req: NextRequest,
  context: TContext,
) => Promise<NextResponse> | NextResponse;

export interface ApiHandlerDependencies {
  rateLimiter: RateLimiter;
  getIdentity?: typeof getClientIdentity;
}

/**
 * Standardized API Route Handler wrapper.
 * Implements:
 * - Basic IP-based rate limiting
 * - Zod validation error handling (400)
 * - RFC 7807 Problem Details for 500 errors
 */
export function apiHandler<TContext = { params: Promise<Record<string, never>> }>(
  handler: ApiHandler<TContext>,
  { rateLimitPolicy = defaultApiRateLimitPolicy }: { rateLimitPolicy?: RateLimitPolicy } = {},
) {
  return createApiHandler({ rateLimiter })(handler, { rateLimitPolicy });
}

/**
 * Builds the correlated HTTP boundary with an explicit limiter dependency.
 * Production routes use `apiHandler`; tests can exercise a policy without
 * mutating module-global counters or relying on deployment configuration.
 */
export function createApiHandler({
  rateLimiter: configuredRateLimiter,
  getIdentity = getClientIdentity,
}: ApiHandlerDependencies) {
  return function withApiHandler<TContext = { params: Promise<Record<string, never>> }>(
    handler: ApiHandler<TContext>,
    { rateLimitPolicy = defaultApiRateLimitPolicy }: { rateLimitPolicy?: RateLimitPolicy } = {},
  ) {
    return async (req: NextRequest, context: TContext) => {
      const requestId = getRequestId(req);
      try {
        const rateLimit = await configuredRateLimiter.consume(getIdentity(req), rateLimitPolicy);

        if (!rateLimit.allowed) {
          return withCorrelatedRequestId(
            NextResponse.json(
              {
                type: 'https://api.obligacje.pl/errors/rate-limit-exceeded',
                title: 'Too Many Requests',
                status: 429,
                detail: 'Rate limit exceeded. Please try again in a minute.',
                code: 'RATE_LIMIT_EXCEEDED',
              },
              {
                status: 429,
                headers: {
                  'RateLimit-Limit': rateLimit.limit.toString(),
                  'RateLimit-Remaining': rateLimit.remaining.toString(),
                  'RateLimit-Reset': Math.ceil(rateLimit.resetAt / 1000).toString(),
                  'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
                },
              },
            ),
            requestId,
          );
        }

        return withCorrelatedRequestId(await handler(req, context), requestId);
      } catch (error) {
        const problem = addRequestIdToProblem(
          mapApiErrorToProblemDetails(error, {
            includeInternalMessage: process.env.NODE_ENV === 'development',
          }),
          requestId,
        );
        logger.error(`${req.method} ${req.nextUrl.pathname}`, error);

        return withCorrelatedRequestId(
          NextResponse.json(problem, { status: problem.status }),
          requestId,
        );
      }
    };
  };
}
