import { LotBreakdown, YearlyTimelinePoint } from '@/features/bond-core/types';
import { translateMessage } from '@/i18n/translate';
import { AppLanguage, buildBondTimelineDisplayRows } from '@/shared/lib/bond-display';

import { CSV_SEPARATOR, formatCsvValue, formatExportDate } from './csv-format';

export interface TimelineCsvMetadata {
  calculationVersion?: string;
  taxRulesRevision?: string;
  offerSource?: string;
  offerSeries?: string;
  offerRevision?: string;
  offerDocument?: string;
  dataStatus?: string;
  dataSource?: string;
  dataLastSyncedAt?: string;
  coverageAsOf?: string;
  purchaseDate?: string;
  withdrawalDate?: string;
  taxStrategy?: string;
  cashPolicy?: string;
}

export function convertTimelineToCSV(
  timeline: YearlyTimelinePoint[],
  headers: Record<string, string>,
  language: AppLanguage = 'pl',
  metadata?: TimelineCsvMetadata,
): string {
  const csvRows: string[] = [];
  const displayRows = buildBondTimelineDisplayRows(timeline, language);
  const cashFlowHeader = displayRows[0]?.cashFlowLabel ?? headers.paidOutCash ?? 'Cash paid out';
  const columns = [
    { key: 'date', header: headers.date || 'Date' },
    { key: 'periodLabel', header: headers.period || 'Period' },
    { key: 'cycleLabel', header: headers.cycle || translateMessage(language, 'bonds.cycle') },
    {
      key: 'cadenceLabel',
      header: headers.cadence || translateMessage(language, 'common.meaning'),
    },
    {
      key: 'valueMeaningLabel',
      header: headers.meaning || 'Meaning',
    },
    { key: 'interestRateLabel', header: headers.rate || 'Rate' },
    { key: 'rateSourceLabel', header: headers.rateSource || 'Rate source' },
    { key: 'referenceLabel', header: headers.reference || 'Rate context' },
    {
      key: 'projectionLabel',
      header: headers.projection || 'Data mode',
    },
    { key: 'principalValue', header: headers.principalValue || 'Bond principal value' },
    { key: 'paidOutCash', header: cashFlowHeader },
    { key: 'totalWealth', header: headers.totalWealth || 'Total wealth' },
    { key: 'netProfit', header: headers.netProfit || 'Net profit' },
    { key: 'realValue', header: headers.realValue || 'Real value' },
    {
      key: 'earlyExitValue',
      header: headers.earlyExitValue || 'Early exit payout',
    },
    { key: 'eventLabels', header: headers.events || translateMessage(language, 'common.events') },
    ...(metadata
      ? [
          {
            key: 'calculationVersion',
            header: translateMessage(language, 'common.engine_version'),
          },
          {
            key: 'taxRulesRevision',
            header: translateMessage(language, 'export.single_bond_pdf.tax_rules_revision'),
          },
          {
            key: 'offerSource',
            header: translateMessage(language, 'export.single_bond_pdf.offer_source'),
          },
          {
            key: 'offerSeries',
            header: translateMessage(language, 'export.single_bond_pdf.issue_code'),
          },
          {
            key: 'offerRevision',
            header: translateMessage(language, 'export.single_bond_pdf.offer_revision'),
          },
          {
            key: 'offerDocument',
            header: translateMessage(language, 'export.single_bond_pdf.offer_document'),
          },
          { key: 'dataStatus', header: translateMessage(language, 'comparison.freshness_status') },
          { key: 'dataSource', header: translateMessage(language, 'comparison.offer_source') },
          {
            key: 'dataLastSyncedAt',
            header: translateMessage(language, 'admin.inventory.cols.last_sync'),
          },
          { key: 'coverageAsOf', header: translateMessage(language, 'common.coverage') },
          {
            key: 'purchaseDate',
            header: translateMessage(language, 'export.single_bond_pdf.purchase_date'),
          },
          {
            key: 'withdrawalDate',
            header: translateMessage(language, 'export.single_bond_pdf.exit_date'),
          },
          { key: 'taxStrategy', header: translateMessage(language, 'bonds.tax_strategy') },
          { key: 'cashPolicy', header: translateMessage(language, 'bonds.receipt_cash_policy') },
        ]
      : []),
  ];
  csvRows.push(columns.map((column) => column.header).join(CSV_SEPARATOR));
  for (const [index, point] of displayRows.entries()) {
    const exportRow = {
      date: formatExportDate(timeline[index]?.cycleEndDate),
      ...point,
      ...metadata,
    };
    const row = columns.map((column) =>
      formatCsvValue((exportRow as unknown as Record<string, unknown>)[column.key], language),
    );
    csvRows.push(row.join(CSV_SEPARATOR));
  }
  return csvRows.join('\r\n');
}

export function convertLotsToCSV(
  lots: LotBreakdown[],
  headers: Record<string, string>,
  language: AppLanguage = 'pl',
): string {
  const csvRows: string[] = [];
  const columns = [
    { key: 'purchaseDate', header: headers.purchaseDate || 'Purchase Date' },
    { key: 'maturityDate', header: headers.maturityDate || 'Maturity Date' },
    { key: 'investedAmount', header: headers.invested || 'Invested' },
    { key: 'accumulatedInterest', header: headers.interest || 'Interest' },
    { key: 'tax', header: headers.tax || 'Tax' },
    { key: 'earlyWithdrawalFee', header: headers.fee || 'Fee' },
    { key: 'netValue', header: headers.netValue || 'Net Value' },
  ];
  csvRows.push(columns.map((column) => column.header).join(CSV_SEPARATOR));
  for (const lot of lots) {
    const row = columns.map((column) => {
      const value = (lot as unknown as Record<string, unknown>)[column.key];
      if (typeof value === 'string' && value.includes('T')) {
        return `"${formatExportDate(value)}"`;
      }
      return formatCsvValue(value, language);
    });
    csvRows.push(row.join(CSV_SEPARATOR));
  }
  return csvRows.join('\r\n');
}
