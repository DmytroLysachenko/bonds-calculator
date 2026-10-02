import { NextRequest } from 'next/server';

/**
 * Cookie-authenticated APIs are same-origin only.  This deliberately keeps
 * CORS closed: a future trusted cross-origin client must use CSRF tokens and a
 * separately reviewed policy instead of relaxing this check.
 */
export function isTrustedMutationOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  // `Sec-Fetch-Site` is browser supplied and gives a useful early rejection.
  // Origin remains the authority whenever browsers send it: same-site is not
  // enough because sibling subdomains can be separately controlled.
  if (fetchSite === 'cross-site' || fetchSite === 'none') return false;

  const origin = request.headers.get('origin');
  // Browsers send Origin for CORS-relevant mutations. Some non-browser service
  // clients do not; their authentication is a separate server-side boundary.
  if (!origin) return fetchSite === null || fetchSite === 'same-origin';

  try {
    const host = request.headers.get('host');
    const requestOrigin = host ? `${request.nextUrl.protocol}//${host}` : request.nextUrl.origin;
    return new URL(origin).origin === requestOrigin;
  } catch {
    return false;
  }
}

export function requiresOriginCheck(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}
