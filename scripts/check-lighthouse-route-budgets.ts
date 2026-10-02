import {
  type LighthouseRouteSummary,
  readCurrentLighthouseReports,
  summarizeLighthouseReports,
} from './lighthouse-summary';

/** Local mobile lab regression ceilings, not a claim of good field CWV. */
export const lighthouseRouteBudgets = [
  { route: '/', maxMedianLcpMs: 3500 },
  { route: '/education', maxMedianLcpMs: 4200 },
  { route: '/single-calculator', maxMedianLcpMs: 4600 },
  { route: '/economic-data', maxMedianLcpMs: 4500 },
  { route: '/compare', maxMedianLcpMs: 4300 },
  // 2 October 2026 CI median: 4225ms; allow 75ms of lab-run variance.
  { route: '/regular-investment', maxMedianLcpMs: 4300 },
] as const;

export function findLighthouseRouteBudgetFailures(
  summary: readonly LighthouseRouteSummary[],
  budgets: readonly { route: string; maxMedianLcpMs: number }[] = lighthouseRouteBudgets,
) {
  const routes = new Map(summary.map((item) => [item.route, item]));
  return budgets.flatMap(({ route, maxMedianLcpMs }) => {
    const result = routes.get(route);
    if (!result) return [`${route}: no Lighthouse reports in current manifest`];
    if (result.runs !== 3 || !result.lcpMs) {
      return [`${route}: expected three scored runs with LCP, got ${result.runs}`];
    }
    return result.lcpMs.median > maxMedianLcpMs
      ? [`${route}: median LCP ${Math.round(result.lcpMs.median)}ms exceeds ${maxMedianLcpMs}ms`]
      : [];
  });
}

if (process.argv[1]?.endsWith('check-lighthouse-route-budgets.ts')) {
  const summary = summarizeLighthouseReports(readCurrentLighthouseReports());
  const failures = findLighthouseRouteBudgetFailures(summary);
  if (failures.length > 0) {
    throw new Error(`Lighthouse route budgets failed:\n${failures.join('\n')}`);
  }
  process.stdout.write(
    `Lighthouse route budgets passed for ${lighthouseRouteBudgets.length} routes.\n`,
  );
}
