import { LotBreakdown, YearlyTimelinePoint } from '@/features/bond-core/types';

import { AppLanguage } from './bond-display';
import type { TimelineCsvMetadata } from './csv-bond';
import {
  convertComparisonToCSV,
  convertLotsToCSV,
  convertTimelineToCSV,
  downloadFile,
} from './csv-utils';

function todayStamp() {
  return new Date().toISOString().split('T')[0];
}

export function buildTimelineCsvFilename(
  scope: 'bond_simulation' | 'bond_comparison',
  bondType: string,
) {
  return `${scope}_${bondType}_${todayStamp()}.csv`;
}

export function buildCombinedComparisonCsvFilename(bondTypeA: string, bondTypeB: string) {
  return `bond_comparison_${bondTypeA}_vs_${bondTypeB}_${todayStamp()}.csv`;
}

export function buildLotsCsvFilename() {
  return `regular_investment_${todayStamp()}.csv`;
}

export function exportTimelineCsv(options: {
  timeline: YearlyTimelinePoint[];
  headers: Record<string, string>;
  language: AppLanguage;
  fileName: string;
  metadata?: TimelineCsvMetadata;
}) {
  const csv = convertTimelineToCSV(
    options.timeline,
    options.headers,
    options.language,
    options.metadata,
  );
  downloadFile(csv, options.fileName, 'text/csv;charset=utf-8');
}

export function exportLotsCsv(options: {
  lots: LotBreakdown[];
  headers: Record<string, string>;
  language: AppLanguage;
  fileName: string;
}) {
  const csv = convertLotsToCSV(options.lots, options.headers, options.language);
  downloadFile(csv, options.fileName, 'text/csv;charset=utf-8');
}

export function exportComparisonCsv(options: {
  timelineA: YearlyTimelinePoint[];
  timelineB: YearlyTimelinePoint[];
  headers: Record<string, string>;
  language: AppLanguage;
  fileName: string;
}) {
  const csv = convertComparisonToCSV(
    options.timelineA,
    options.timelineB,
    options.headers,
    options.language,
  );
  downloadFile(csv, options.fileName, 'text/csv;charset=utf-8');
}
