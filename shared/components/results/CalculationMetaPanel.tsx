'use client';

import { AlertTriangle, DatabaseZap, FileText, ShieldAlert, Target } from 'lucide-react';
import React from 'react';

import {
  CalculationDataFreshness,
  CalculationDiagnostic,
  CalculationEnvelope,
} from '@/features/bond-core/types/scenarios';
import { useAppI18n } from '@/i18n/client';
import {
  localizeCalculationDiagnostic,
  localizeLegacyCalculationMessage,
} from '@/shared/lib/calculation-evidence';
import {
  getBondOfferFreshnessState,
  getCalculationFreshnessMetaState,
  getCalculationReferenceMeta,
} from '@/shared/lib/data-freshness-display';
import { buildReferenceProvenanceViewModel } from '@/shared/lib/data-reference';

interface CalculationMetaPanelProps {
  warnings?: string[];
  assumptions?: string[];
  calculationNotes?: string[];
  dataQualityFlags?: string[];
  dataFreshness?: CalculationDataFreshness;
  calculationVersion?: string;
  taxRulesRevision?: string;
  offerTerms?: CalculationEnvelope<unknown>['offerTerms'];
  diagnostics?: CalculationDiagnostic[];
  compact?: boolean;
}

const MetaSection = ({
  title,
  icon,
  items,
  className,
  formatItem,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  className: string;
  formatItem?: (item: string) => string;
}) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className={className}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="ui-meta font-semibold">{title}</p>
      </div>
      <ul className="divide-y divide-dashed divide-current/15 text-sm leading-6">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="px-0 py-2.5 first:pt-0 last:pb-0">
            {formatItem ? formatItem(item) : item}
          </li>
        ))}
      </ul>
    </section>
  );
};

function humanizeFlag(
  value: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const knownFlag = t(`bonds.data_quality_flags.${value}`);

  if (knownFlag && knownFlag !== `bonds.data_quality_flags.${value}`) {
    return knownFlag;
  }

  return value
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export const CalculationMetaPanel: React.FC<CalculationMetaPanelProps> = ({
  warnings = [],
  assumptions = [],
  calculationNotes = [],
  dataQualityFlags = [],
  dataFreshness,
  calculationVersion,
  taxRulesRevision,
  offerTerms,
  diagnostics,
  compact = false,
}) => {
  const { t, locale } = useAppI18n();
  const hasTypedEngineNotes = diagnostics?.some(
    (item) => item.code === 'rollover_cycles' || item.code === 'rollover_disabled',
  );

  const hasContent =
    warnings.length > 0 ||
    assumptions.length > 0 ||
    Boolean(diagnostics?.length) ||
    calculationNotes.length > 0 ||
    dataQualityFlags.length > 0 ||
    Boolean(dataFreshness);

  if (!hasContent) {
    return null;
  }

  const freshnessMeta = dataFreshness ? getCalculationFreshnessMetaState(dataFreshness) : null;
  const bondOffer = getBondOfferFreshnessState(dataFreshness);
  const provenance = buildReferenceProvenanceViewModel(
    getCalculationReferenceMeta(dataFreshness),
    locale,
  );

  return (
    <div className="space-y-5">
      {freshnessMeta ? (
        <div className={`border-l-2 px-4 py-3 text-sm leading-6 ${freshnessMeta?.toneClass}`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <span className={`h-2.5 w-2.5 rounded-full ${freshnessMeta?.dotClass}`} />
              <span>{t('comparison.freshness_status')}:</span>
              <span>{t(`comparison.status_${freshnessMeta.status}`)}</span>
            </div>
            {freshnessMeta?.coverageLabel ? (
              <div>
                {t('common.coverage')}:{' '}
                <span className="font-semibold">{freshnessMeta.coverageLabel}</span>
              </div>
            ) : null}
            {freshnessMeta?.lastSyncLabel ? (
              <div>
                {t('admin.inventory.cols.last_sync')}:{' '}
                <span className="font-semibold">{freshnessMeta.lastSyncLabel}</span>
              </div>
            ) : null}
            {freshnessMeta?.usedFallback ? (
              <div className="font-semibold">{t('comparison.fallback_used')}</div>
            ) : null}
            <div>
              {t('comparison.offer_source')}:{' '}
              <span className="font-semibold">{provenance.source}</span>
            </div>
            {bondOffer.isDegraded ? (
              <div className="font-semibold">{t('comparison.offer_degraded_warning')}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={`grid grid-cols-1 gap-x-6 gap-y-5 ${
          compact ? 'xl:grid-cols-2' : 'md:grid-cols-2'
        }`}
      >
        <MetaSection
          title={t('common.warnings')}
          items={
            diagnostics
              ? diagnostics
                  .filter((item) => item.severity === 'warning')
                  .map((item) => localizeCalculationDiagnostic(item, t))
              : warnings.map((item) => localizeLegacyCalculationMessage(item, t))
          }
          icon={<AlertTriangle className="h-4 w-4" />}
          className="space-y-3 bg-warning/5 px-4 py-3 text-foreground"
        />
        <MetaSection
          title={t('common.assumptions')}
          items={
            diagnostics
              ? diagnostics
                  .filter((item) => item.severity === 'assumption')
                  .map((item) => localizeCalculationDiagnostic(item, t))
              : assumptions.map((item) => localizeLegacyCalculationMessage(item, t))
          }
          icon={<Target className="h-4 w-4" />}
          className="space-y-3 bg-muted/20 px-4 py-3 text-foreground"
        />
        <MetaSection
          title={t('common.notes')}
          items={
            hasTypedEngineNotes
              ? []
              : calculationNotes.map((item) => localizeLegacyCalculationMessage(item, t))
          }
          icon={<FileText className="h-4 w-4" />}
          className="space-y-3 bg-muted/20 px-4 py-3 text-foreground"
        />
        <MetaSection
          title={t('common.data_quality')}
          items={dataQualityFlags}
          icon={<ShieldAlert className="h-4 w-4" />}
          className="space-y-3 bg-warning/5 px-4 py-3 text-foreground"
          formatItem={(item) => humanizeFlag(item, t)}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-3 text-sm leading-6 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <DatabaseZap className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground">{t('common.calculation_audit')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>{t('comparison.live_calculation')}</span>
          {calculationVersion ? (
            <span>
              {t('common.engine_version')}:{' '}
              <span className="font-semibold text-foreground">{calculationVersion}</span>
            </span>
          ) : null}
          {taxRulesRevision ? (
            <span>
              {t('export.single_bond_pdf.tax_rules_revision')}:{' '}
              <span className="font-semibold text-foreground">{taxRulesRevision}</span>
            </span>
          ) : null}
          {offerTerms ? (
            <span>
              {t('export.single_bond_pdf.offer_source')}:{' '}
              <span className="font-semibold text-foreground">
                {offerTerms.seriesCode ??
                  t(`export.single_bond_pdf.offer_source_${offerTerms.source}`)}
              </span>
              {offerTerms.termsRevision ? ` · ${offerTerms.termsRevision}` : null}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
