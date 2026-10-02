import { writeRouteBundleReport } from './route-bundle-report';

export interface RouteBundleBudget {
  route: string;
  maxBytes: number;
}

/** Initial ceilings are intentionally above the measured clean-build baseline. */
export const calculatorRouteBundleBudgets: readonly RouteBundleBudget[] = [
  { route: '/compare', maxBytes: 1_100_000 },
  { route: '/ladder', maxBytes: 1_950_000 },
  { route: '/regular-investment', maxBytes: 1_100_000 },
  { route: '/single-calculator', maxBytes: 1_200_000 },
];

export function findBundleBudgetFailures(
  report: ReadonlyArray<{ route: string; bytes: number }>,
  budgets = calculatorRouteBundleBudgets,
): string[] {
  const bytesByRoute = new Map(report.map(({ route, bytes }) => [route, bytes]));

  return budgets.flatMap(({ route, maxBytes }) => {
    const bytes = bytesByRoute.get(route);
    if (bytes === undefined) return [`${route}: route missing from bundle report`];
    return bytes > maxBytes ? [`${route}: ${bytes} bytes exceeds ${maxBytes} bytes`] : [];
  });
}

if (process.argv[1]?.endsWith('check-route-bundle-budgets.ts')) {
  const report = writeRouteBundleReport();
  const failures = findBundleBudgetFailures(report);
  if (failures.length > 0) {
    throw new Error(`Route bundle budgets failed:\n${failures.join('\n')}`);
  }
  process.stdout.write(
    `Route bundle budgets passed for ${calculatorRouteBundleBudgets.length} calculator routes.\n`,
  );
}
