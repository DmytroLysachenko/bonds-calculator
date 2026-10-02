const STATIC_ROUTES = new Set([
  '/',
  '/single-calculator',
  '/compare',
  '/regular-investment',
  '/ladder',
  '/notebook',
  '/economic-data',
  '/education',
  '/settings',
  '/shared-portfolios',
  '/shared-scenarios',
]);

/** Aggregate labels never contain search parameters, fragments, identifiers or arbitrary paths. */
export function telemetryRoute(path: string): string {
  const pathname = path.split(/[?#]/, 1)[0];
  if (STATIC_ROUTES.has(pathname)) return pathname;
  if (pathname.startsWith('/shared-portfolios/')) return '/shared-portfolios';
  if (pathname.startsWith('/shared-scenarios/')) return '/shared-scenarios';
  return '/other';
}
