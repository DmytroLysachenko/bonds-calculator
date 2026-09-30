import jsPDF from 'jspdf';

import { BondInputs, CalculationResult } from '@/features/bond-core/types';
import type { SingleBondCalculationEnvelope } from '@/features/bond-core/types/scenarios';
import { translateMessage } from '@/i18n/translate';
import { fetchPublicTextAsset } from '@/shared/lib/api-client';
import {
  localizeCalculationDiagnostic,
  localizeLegacyCalculationMessage,
} from '@/shared/lib/calculation-evidence';
import { createCurrencyFormatter, createDateFormatter } from '@/shared/lib/formatters';
import { buildSingleBondReportProvenance } from '@/shared/lib/report-provenance';

type ReportLanguage = 'pl' | 'en';

const page = { width: 210, height: 297, margin: 18, bottom: 278 };

function formatCurrency(value: number, language: ReportLanguage) {
  return createCurrencyFormatter(language, {
    style: 'currency',
    currency: 'PLN',
  }).format(value);
}

function formatDate(value: string, language: ReportLanguage) {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : createDateFormatter(language, { dateStyle: 'long' }).format(date);
}

function buildReportRows(results: CalculationResult, inputs: BondInputs, language: ReportLanguage) {
  return [
    [translateMessage(language, 'export.single_bond_pdf.bond_type'), inputs.bondType],
    [
      translateMessage(language, 'export.single_bond_pdf.purchase_date'),
      formatDate(inputs.purchaseDate, language),
    ],
    [
      translateMessage(language, 'export.single_bond_pdf.exit_date'),
      formatDate(inputs.withdrawalDate, language),
    ],
    [
      translateMessage(language, 'export.single_bond_pdf.initial_investment'),
      formatCurrency(results.initialInvestment, language),
    ],
    [
      translateMessage(language, 'export.single_bond_pdf.net_payout'),
      formatCurrency(results.netPayoutValue, language),
    ],
    [
      translateMessage(language, 'export.single_bond_pdf.net_profit'),
      formatCurrency(results.totalProfit, language),
    ],
    [
      translateMessage(language, 'export.single_bond_pdf.total_tax'),
      formatCurrency(results.totalTax, language),
    ],
    [
      translateMessage(language, 'export.single_bond_pdf.real_value'),
      formatCurrency(results.finalRealValue, language),
    ],
    [
      translateMessage(language, 'export.single_bond_pdf.real_annualized_return'),
      `${results.realAnnualizedReturn.toFixed(2)}%`,
    ],
  ] as const;
}

export async function buildSingleBondReportPdf(
  results: CalculationResult,
  inputs: BondInputs,
  language: ReportLanguage,
  envelope?: SingleBondCalculationEnvelope,
) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const provenance = buildSingleBondReportProvenance(inputs, envelope);
  pdf.setProperties({
    title: translateMessage(language, 'export.single_bond_pdf.title'),
    subject: [provenance.calculationVersion, provenance.offerSeries, provenance.offerRevision]
      .filter(Boolean)
      .join(' | '),
  });
  const fontBase64 = (await fetchPublicTextAsset('/fonts/Geist-Regular.ttf.base64')).replace(
    /\s/g,
    '',
  );
  pdf.addFileToVFS('Geist-Regular.ttf', fontBase64);
  pdf.addFont('Geist-Regular.ttf', 'Geist', 'normal');
  pdf.addFont('Geist-Regular.ttf', 'Geist', 'bold');
  const contentWidth = page.width - page.margin * 2;
  let y = page.margin;

  const ensureSpace = (height: number) => {
    if (y + height <= page.bottom) return;
    pdf.addPage();
    y = page.margin;
  };
  const writeWrapped = (text: string, width = contentWidth, fontSize = 10, bold = false) => {
    pdf.setFont('Geist', bold ? 'bold' : 'normal');
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, width);
    const lineHeight = fontSize * 0.46;
    for (const line of lines) {
      ensureSpace(lineHeight);
      pdf.text(line, page.margin, y);
      y += lineHeight;
    }
  };
  const heading = (text: string) => {
    ensureSpace(13);
    if (y > page.margin) y += 4;
    pdf.setDrawColor(221, 215, 202);
    pdf.line(page.margin, y, page.margin + contentWidth, y);
    y += 6;
    writeWrapped(text, contentWidth, 12, true);
    y += 2;
  };
  const row = (label: string, value: string) => {
    const labelWidth = 58;
    const valueWidth = contentWidth - labelWidth - 5;
    pdf.setFontSize(9);
    const labelLines = pdf.splitTextToSize(label, labelWidth);
    const valueLines = pdf.splitTextToSize(value, valueWidth);
    for (let index = 0; index < Math.max(labelLines.length, valueLines.length); index += 1) {
      ensureSpace(5.2);
      if (labelLines[index]) {
        pdf.setFont('Geist', 'normal');
        pdf.text(labelLines[index], page.margin, y);
      }
      if (valueLines[index]) {
        pdf.setFont('Geist', 'bold');
        pdf.text(valueLines[index], page.margin + labelWidth + 5, y);
      }
      y += 5.2;
    }
    y += 3;
  };

  pdf.setFont('Geist', 'bold');
  pdf.setFontSize(20);
  pdf.text(translateMessage(language, 'export.single_bond_pdf.title'), page.margin, y);
  y += 9;
  writeWrapped(
    `${translateMessage(language, 'export.single_bond_pdf.generated_label')}: ${formatDate(new Date().toISOString().slice(0, 10), language)}`,
    contentWidth,
    9,
  );
  y += 4;
  pdf.setFillColor(248, 246, 241);
  const disclaimer = translateMessage(language, 'export.single_bond_pdf.informational_disclaimer');
  const disclaimerLines = pdf.splitTextToSize(disclaimer, contentWidth - 8);
  const disclaimerHeight = disclaimerLines.length * 4.6 + 8;
  ensureSpace(disclaimerHeight);
  pdf.rect(page.margin, y, contentWidth, disclaimerHeight, 'F');
  pdf.setTextColor(82, 75, 66);
  pdf.setFont('Geist', 'normal');
  pdf.setFontSize(9);
  pdf.text(disclaimerLines, page.margin + 4, y + 5);
  pdf.setTextColor(0, 0, 0);
  y += disclaimerHeight;

  heading(translateMessage(language, 'export.single_bond_pdf.summary_heading'));
  for (const [label, value] of buildReportRows(results, inputs, language)) row(label, value);
  if (envelope) {
    if (provenance.calculationVersion)
      row(translateMessage(language, 'common.engine_version'), provenance.calculationVersion);
    if (provenance.taxRulesRevision) {
      row(
        translateMessage(language, 'export.single_bond_pdf.tax_rules_revision'),
        provenance.taxRulesRevision,
      );
    }
    if (provenance.dataStatus)
      row(
        translateMessage(language, 'comparison.freshness_status'),
        translateMessage(language, `comparison.status_${provenance.dataStatus}`),
      );
    if (provenance.dataSource)
      row(translateMessage(language, 'comparison.offer_source'), provenance.dataSource);
    if (provenance.dataLastSyncedAt)
      row(
        translateMessage(language, 'admin.inventory.cols.last_sync'),
        provenance.dataLastSyncedAt,
      );
    if (provenance.coverageAsOf) {
      row(translateMessage(language, 'common.coverage'), provenance.coverageAsOf);
    }
    if (provenance.offerSource) {
      row(
        translateMessage(language, 'export.single_bond_pdf.offer_source'),
        translateMessage(language, `export.single_bond_pdf.offer_source_${provenance.offerSource}`),
      );
      if (provenance.offerSeries)
        row(
          translateMessage(language, 'export.single_bond_pdf.issue_code'),
          provenance.offerSeries,
        );
      if (provenance.offerRevision)
        row(
          translateMessage(language, 'export.single_bond_pdf.offer_revision'),
          provenance.offerRevision,
        );
      if (provenance.offerDocument)
        row(
          translateMessage(language, 'export.single_bond_pdf.offer_document'),
          provenance.offerDocument,
        );
      row(
        translateMessage(language, 'export.single_bond_pdf.offer_verified'),
        translateMessage(
          language,
          provenance.offerVerified
            ? 'export.single_bond_pdf.offer_verified_yes'
            : 'export.single_bond_pdf.offer_verified_no',
        ),
      );
    }
  }

  const hasTypedEngineNotes = envelope?.diagnostics?.some(
    (item) => item.code === 'rollover_cycles' || item.code === 'rollover_disabled',
  );
  const notes = hasTypedEngineNotes
    ? []
    : results.calculationNotes?.length
      ? results.calculationNotes
      : [translateMessage(language, 'export.single_bond_pdf.no_notes')];
  heading(translateMessage(language, 'export.single_bond_pdf.run_notes'));
  for (const note of notes) {
    writeWrapped(
      `• ${localizeLegacyCalculationMessage(note, (key, params) => translateMessage(language, key, params))}`,
      contentWidth - 3,
      9,
    );
    y += 2;
  }
  if (envelope) {
    const evidence = envelope.diagnostics
      ? envelope.diagnostics.map((diagnostic) =>
          localizeCalculationDiagnostic(diagnostic, (key, params) =>
            translateMessage(language, key, params),
          ),
        )
      : [...envelope.assumptions, ...envelope.warnings].map((note) =>
          localizeLegacyCalculationMessage(note, (key, params) =>
            translateMessage(language, key, params),
          ),
        );
    for (const note of evidence) {
      writeWrapped(`• ${note}`, contentWidth - 3, 9);
      y += 2;
    }
  }

  heading(translateMessage(language, 'common.assumptions'));
  row(
    translateMessage(language, 'retirement_page.expected_inflation'),
    `${inputs.expectedInflation}%`,
  );
  if (inputs.expectedNbpRate !== undefined) {
    row(
      translateMessage(language, 'retirement_page.expected_nbp_rate'),
      `${inputs.expectedNbpRate}%`,
    );
  }
  row(
    translateMessage(language, 'bonds.tax_strategy'),
    translateMessage(
      language,
      provenance.taxStrategy === 'IKE'
        ? 'bonds.tax_ike'
        : provenance.taxStrategy === 'IKZE'
          ? 'bonds.tax_ikze'
          : 'bonds.tax_standard',
    ),
  );
  row(
    translateMessage(language, 'bonds.is_rebought'),
    translateMessage(
      language,
      inputs.isRebought
        ? 'export.single_bond_pdf.offer_verified_yes'
        : 'export.single_bond_pdf.offer_verified_no_plain',
    ),
  );
  if (inputs.inflationScenario)
    row(
      translateMessage(language, 'bonds.inflation.scenarios.label'),
      translateMessage(language, `bonds.inflation.scenarios.${inputs.inflationScenario}`),
    );
  if (provenance.cashPolicy)
    row(
      translateMessage(language, 'bonds.receipt_cash_policy'),
      translateMessage(
        language,
        provenance.cashPolicy === 'rollover'
          ? 'bonds.receipt_rollover'
          : 'bonds.receipt_no_rollover',
      ),
    );
  if (inputs.customInflation?.length)
    row(
      translateMessage(language, 'export.single_bond_pdf.cpi_path'),
      inputs.customInflation.join(', '),
    );
  if (inputs.customNbpRate?.length)
    row(
      translateMessage(language, 'export.single_bond_pdf.nbp_path'),
      inputs.customNbpRate.join(', '),
    );

  heading(translateMessage(language, 'export.single_bond_pdf.data_context'));
  writeWrapped(
    translateMessage(language, 'export.single_bond_pdf.data_context_note'),
    contentWidth,
    9,
  );
  writeWrapped(
    translateMessage(language, 'export.single_bond_pdf.scenario_not_history_note'),
    contentWidth,
    9,
  );

  const pageCount = pdf.getNumberOfPages();
  for (let index = 1; index <= pageCount; index += 1) {
    pdf.setPage(index);
    pdf.setDrawColor(221, 215, 202);
    pdf.line(page.margin, 284, page.margin + contentWidth, 284);
    pdf.setFont('Geist', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(102, 95, 85);
    pdf.text(
      translateMessage(language, 'export.single_bond_pdf.footer_disclaimer'),
      page.margin,
      289,
    );
    pdf.text(`${index}/${pageCount}`, page.margin + contentWidth, 289, { align: 'right' });
    pdf.setTextColor(0, 0, 0);
  }
  return pdf;
}

export async function generateSingleBondReportPdf(
  results: CalculationResult,
  inputs: BondInputs,
  language: ReportLanguage,
  filename = 'bond-report.pdf',
  envelope?: SingleBondCalculationEnvelope,
) {
  const pdf = await buildSingleBondReportPdf(results, inputs, language, envelope);
  pdf.save(filename);
}
