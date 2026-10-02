import { NextRequest, NextResponse } from 'next/server';

import { isTrustedMutationOrigin, requiresOriginCheck } from '@/lib/server/http/mutation-origin';
import { createDomainErrorResponse, createUnauthorizedResponse } from '@/lib/server/http/responses';

import { type PortfolioOwnerContext, resolvePortfolioOwner } from './access';
import { PortfolioServiceError } from './errors';

export interface PortfolioRouteContext {
  owner: PortfolioOwnerContext;
}

export async function getPortfolioRouteContext(): Promise<PortfolioRouteContext> {
  return {
    owner: await resolvePortfolioOwner(),
  };
}

async function getAuthenticatedPortfolioRouteContext(): Promise<
  { ok: true; context: PortfolioRouteContext } | { ok: false; response: NextResponse }
> {
  const context = await getPortfolioRouteContext();

  if (context.owner.authMode !== 'authenticated' || context.owner.isGuest) {
    return {
      ok: false,
      response: createUnauthorizedResponse(),
    };
  }

  return {
    ok: true,
    context,
  };
}

/** Private reads only receive verified authenticated ownership. */
export async function withPortfolioRead(
  handler: (owner: PortfolioOwnerContext) => Promise<NextResponse> | NextResponse,
  onGuest: () => NextResponse = createUnauthorizedResponse,
) {
  const { owner } = await getPortfolioRouteContext();
  if (owner.isGuest || owner.authMode !== 'authenticated') return onGuest();
  return handler(owner);
}

async function withAuthenticatedPortfolioOwner(
  request: NextRequest,
  handler: (owner: PortfolioOwnerContext) => Promise<NextResponse> | NextResponse,
) {
  if (requiresOriginCheck(request.method) && !isTrustedMutationOrigin(request)) {
    return createUnauthorizedResponse();
  }
  const authContext = await getAuthenticatedPortfolioRouteContext();
  if (!authContext.ok) return authContext.response;

  const { owner } = authContext.context;
  const response = await handler(owner);

  return response;
}

/**
 * Command routes share mutation-origin enforcement, authenticated ownership,
 * without trusting guest cookies. Keep schemas and domain errors in each route.
 */
export const withPortfolioCommand = withAuthenticatedPortfolioOwner;

export function portfolioDomainErrorResponse(error: unknown) {
  if (!(error instanceof PortfolioServiceError)) {
    return null;
  }

  const response = createDomainErrorResponse(error);
  return response;
}
