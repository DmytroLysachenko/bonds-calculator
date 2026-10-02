import { NextRequest, NextResponse } from 'next/server';

const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,128}$/;

export function getRequestId(request: NextRequest): string {
  const supplied = request.headers.get(REQUEST_ID_HEADER);
  if (supplied && SAFE_REQUEST_ID.test(supplied)) return supplied;
  return crypto.randomUUID();
}

export function withRequestId(response: NextResponse, requestId: string) {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

/**
 * Adds the correlation ID to the response header and to JSON response bodies.
 * Wrapped success payloads expose it through `meta`; problem and legacy JSON
 * payloads receive a top-level field without disclosing server-only causes.
 */
export async function withCorrelatedRequestId(response: NextResponse, requestId: string) {
  if (
    response.status === 204 ||
    !response.headers.get('content-type')?.includes('application/json')
  ) {
    return withRequestId(response, requestId);
  }

  try {
    const payload: unknown = await response.clone().json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return withRequestId(response, requestId);
    }

    const body = payload as Record<string, unknown>;
    const meta = body.meta;
    const correlated =
      meta && typeof meta === 'object' && !Array.isArray(meta)
        ? { ...body, meta: { ...meta, requestId } }
        : { ...body, requestId: body.requestId ?? requestId };
    const result = NextResponse.json(correlated, {
      status: response.status,
      headers: response.headers,
    });
    return withRequestId(result, requestId);
  } catch {
    return withRequestId(response, requestId);
  }
}

export function addRequestIdToProblem<T extends object>(
  problem: T,
  requestId: string,
): T & { requestId: string } {
  return { ...problem, requestId };
}
