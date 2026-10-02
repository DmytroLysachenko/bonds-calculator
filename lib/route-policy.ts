/** Public route identity and discovery policy, safe to share with client navigation. */
export const pageRoutePolicy = {
  home: { path: '/', indexable: true, navigation: false },
  single_calculator: { path: '/single-calculator', indexable: true, navigation: true },
  comparison: { path: '/compare', indexable: false, navigation: true },
  economic_data: { path: '/economic-data', indexable: true, navigation: true },
  education: { path: '/education', indexable: true, navigation: true },
  notebook: { path: '/notebook', indexable: false, navigation: true },
  login: { path: '/login', indexable: false, navigation: false },
  optimize: { path: '/optimize', indexable: false, navigation: false },
  regular_investment: { path: '/regular-investment', indexable: false, navigation: true },
  ladder: { path: '/ladder', indexable: false, navigation: true },
  multi_asset: { path: '/multi-asset', indexable: false, navigation: false },
  retirement: { path: '/retirement', indexable: false, navigation: false },
  recovery_lab: { path: '/recovery-lab', indexable: false, navigation: false },
} as const;

export const pageRouteByKey: Record<string, string> = Object.fromEntries(
  Object.entries(pageRoutePolicy).map(([key, policy]) => [key, policy.path]),
);

export function getIndexableRoutes() {
  return Object.values(pageRoutePolicy)
    .filter((policy) => policy.indexable)
    .map((policy) => policy.path);
}

export function isNavigationRoute(path: string) {
  return Object.values(pageRoutePolicy).some((policy) => policy.path === path && policy.navigation);
}
