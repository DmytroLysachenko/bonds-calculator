import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

type LighthouseReport = {
  requestedUrl?: string;
  finalUrl?: string;
  categories?: Record<string, { score?: number | null }>;
  audits?: Record<string, { numericValue?: number }>;
};

export interface LighthouseRouteSummary {
  route: string;
  runs: number;
  performanceScore: { min: number; median: number; max: number } | null;
  lcpMs: { min: number; median: number; max: number } | null;
  cls: { min: number; median: number; max: number } | null;
}

function metricSummary(values: readonly number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return {
    min: sorted[0],
    median: sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle],
    max: sorted.at(-1)!,
  };
}

function routeFromReport(report: LighthouseReport) {
  const url = report.finalUrl ?? report.requestedUrl;
  if (!url) return null;
  return new URL(url).pathname || '/';
}

type LighthouseManifestEntry = { jsonPath?: unknown };

export function reportNamesFromManifest(entries: readonly LighthouseManifestEntry[]) {
  return entries.map((entry) => {
    if (typeof entry.jsonPath !== 'string' || !entry.jsonPath.endsWith('.report.json')) {
      throw new Error('Lighthouse manifest contains an invalid report path');
    }
    return basename(entry.jsonPath);
  });
}

export function readCurrentLighthouseReports(inputDirectory = '.lighthouseci'): LighthouseReport[] {
  const manifestPath = resolve(inputDirectory, 'manifest.json');
  if (!existsSync(manifestPath)) return [];
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest)) {
    throw new Error('Lighthouse manifest must be a list of reports');
  }
  return reportNamesFromManifest(manifest).map(
    (file) => JSON.parse(readFileSync(resolve(inputDirectory, file), 'utf8')) as LighthouseReport,
  );
}

export function summarizeLighthouseReports(reports: readonly LighthouseReport[]) {
  const metricsByRoute = new Map<
    string,
    { performanceScore: number[]; lcpMs: number[]; cls: number[] }
  >();

  for (const report of reports) {
    const route = routeFromReport(report);
    if (!route) continue;
    const metrics = metricsByRoute.get(route) ?? {
      performanceScore: [],
      lcpMs: [],
      cls: [],
    };
    const score = report.categories?.performance?.score;
    const lcp = report.audits?.['largest-contentful-paint']?.numericValue;
    const cls = report.audits?.['cumulative-layout-shift']?.numericValue;
    if (typeof score === 'number') metrics.performanceScore.push(score);
    if (typeof lcp === 'number') metrics.lcpMs.push(lcp);
    if (typeof cls === 'number') metrics.cls.push(cls);
    metricsByRoute.set(route, metrics);
  }

  return [...metricsByRoute]
    .map(([route, metrics]): LighthouseRouteSummary => ({
      route,
      runs: metrics.performanceScore.length,
      performanceScore: metricSummary(metrics.performanceScore),
      lcpMs: metricSummary(metrics.lcpMs),
      cls: metricSummary(metrics.cls),
    }))
    .sort((left, right) => left.route.localeCompare(right.route));
}

function formatMetric(metric: LighthouseRouteSummary['lcpMs'], digits: number) {
  return metric ? metric.median.toFixed(digits) : 'n/a';
}

export function formatLighthouseSummary(summary: readonly LighthouseRouteSummary[]) {
  return [
    '# Lighthouse route summary',
    '',
    '| Route | Runs | Performance median | LCP median (ms) | CLS median |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...summary.map(
      (route) =>
        `| ${route.route} | ${route.runs} | ${formatMetric(route.performanceScore, 2)} | ${formatMetric(route.lcpMs, 0)} | ${formatMetric(route.cls, 3)} |`,
    ),
    '',
  ].join('\n');
}

export function writeLighthouseSummary({
  inputDirectory = '.lighthouseci',
  outputDirectory = 'artifacts',
}: {
  inputDirectory?: string;
  outputDirectory?: string;
} = {}) {
  const summary = summarizeLighthouseReports(readCurrentLighthouseReports(inputDirectory));
  const jsonPath = resolve(outputDirectory, 'lighthouse-summary.json');
  const markdownPath = resolve(outputDirectory, 'lighthouse-summary.md');
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(markdownPath, formatLighthouseSummary(summary));
  return { summary, jsonPath, markdownPath };
}

if (process.argv[1]?.endsWith('lighthouse-summary.ts')) {
  const { summary, markdownPath } = writeLighthouseSummary();
  process.stdout.write(
    `Wrote Lighthouse summary for ${summary.length} route(s) to ${markdownPath}\n`,
  );
}
