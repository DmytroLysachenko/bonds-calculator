'use client';

import { AlertTriangle, Database } from 'lucide-react';

import type { HistoricalReplayIssue } from '@/features/bond-core/utils/asset-calculations';
import { cn } from '@/lib/utils';
import { ScenarioReadyPanel } from '@/shared/components/feedback/ScenarioReadyPanel';

type Translate = (key: string, values?: Record<string, string | number>) => string;

interface MetaCellProps {
  label: string;
  value: string;
}

function MetaCell({ label, value }: MetaCellProps) {
  return (
    <div className="border-b border-dashed border-border px-4 py-3 last:border-b-0 md:border-b-0 md:border-r last:md:border-r-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

interface MultiAssetHistoryStatePanelProps {
  usedFallbackHistory: boolean;
  historyCoverageLabel: string;
  historySourceLabel: string;
  historyAsOfLabel: string;
  availabilitySummary: string;
  coverageGaps: string[];
  priceIndexIsApproximate: boolean;
  replayIssue: HistoricalReplayIssue | null;
  currencyBasis?: 'PLN' | 'mixed-USD-PLN';
  observationBasis?: 'observed' | 'illustrative';
  showRealValue: boolean;
  t: Translate;
}

export function MultiAssetHistoryStatePanel({
  usedFallbackHistory,
  historyCoverageLabel,
  historySourceLabel,
  historyAsOfLabel,
  availabilitySummary,
  coverageGaps,
  priceIndexIsApproximate,
  replayIssue,
  currencyBasis,
  observationBasis,
  showRealValue,
  t,
}: MultiAssetHistoryStatePanelProps) {
  return (
    <section
      className={cn(
        'space-y-4 rounded-lg px-5 py-5',
        usedFallbackHistory ? 'bg-warning/10' : 'bg-transparent',
      )}
    >
      <div className="flex items-start gap-3">
        {usedFallbackHistory ? (
          <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
        ) : (
          <Database className="mt-0.5 h-5 w-5 text-foreground" />
        )}
        <div className="space-y-2">
          <p className="font-semibold text-foreground">
            {usedFallbackHistory
              ? t('multi_asset_page.history_state.reference_only_title')
              : t('multi_asset_page.history_state.live_title')}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            {t('multi_asset_page.history_state.description')}
          </p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('multi_asset_page.history_state.basis', {
          currency:
            currencyBasis === 'PLN' ? 'PLN' : t('multi_asset_page.history_state.mixed_currency'),
          observation: t(
            `multi_asset_page.history_state.${observationBasis === 'observed' ? 'observed' : 'illustrative'}`,
          ),
          value: t(`multi_asset_page.history_state.${showRealValue ? 'real' : 'nominal'}`),
        })}
      </p>
      {replayIssue ? (
        <p className="text-sm text-warning" role="alert">
          {t(`multi_asset_page.history_state.replay_issue_${replayIssue}`)}
        </p>
      ) : null}
      <div className="grid gap-0 rounded-lg bg-card md:grid-cols-3">
        <MetaCell
          label={t('multi_asset_page.history_state.coverage_label')}
          value={historyCoverageLabel}
        />
        <MetaCell
          label={t('multi_asset_page.history_state.source_label')}
          value={historySourceLabel}
        />
        <MetaCell
          label={t('multi_asset_page.history_state.as_of_label')}
          value={historyAsOfLabel}
        />
      </div>
      {availabilitySummary ? (
        <p className="text-sm text-muted-foreground">
          {t('multi_asset_page.history_state.available_series_label')}{' '}
          <span className="font-medium text-foreground">{availabilitySummary}</span>
        </p>
      ) : null}
      {coverageGaps.length > 0 ? (
        <p className="text-sm text-warning">
          {t('multi_asset_page.history_state.coverage_gaps', { months: coverageGaps.join(', ') })}
        </p>
      ) : null}
      {priceIndexIsApproximate ? (
        <p className="text-sm text-warning">
          {t('multi_asset_page.history_state.price_index_approximation')}
        </p>
      ) : null}
      {usedFallbackHistory ? (
        <p className="text-sm text-warning">
          {t('multi_asset_page.history_state.fallback_warning')}
        </p>
      ) : null}
      {usedFallbackHistory ? (
        <p className="text-sm text-warning">
          {t('multi_asset_page.history_state.currency_unavailable')}
        </p>
      ) : null}
    </section>
  );
}

interface MultiAssetMetricsSnapshotProps {
  startYear: string;
  startMonth: string;
  totalInvested: number;
  leadingAsset: {
    name: string;
    value: number;
  };
  showRealValue: boolean;
  formatCurrency: (value: number) => string;
  t: Translate;
}

export function MultiAssetMetricsSnapshot({
  startYear,
  startMonth,
  totalInvested,
  leadingAsset,
  showRealValue,
  formatCurrency,
  t,
}: MultiAssetMetricsSnapshotProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <section className="px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t('multi_asset_page.metrics.committed_start_label')}
        </p>
        <p className="mt-2 text-lg font-semibold text-foreground">
          {startYear}-{startMonth}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {t('multi_asset_page.metrics.committed_start_detail')}
        </p>
      </section>
      <section className="px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t('multi_asset_page.metrics.total_invested_label')}
        </p>
        <p className="mt-2 text-lg font-semibold text-foreground">
          {formatCurrency(totalInvested)}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {t('multi_asset_page.metrics.total_invested_detail')}
        </p>
      </section>
      <section className="px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t('multi_asset_page.metrics.leading_ending_value_label')}
        </p>
        <p className="mt-2 text-lg font-semibold text-foreground">{leadingAsset.name}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {t('multi_asset_page.metrics.leading_ending_value_detail', {
            value: formatCurrency(leadingAsset.value),
            mode: showRealValue
              ? t('multi_asset_page.real_value_mode')
              : t('multi_asset_page.nominal_mode'),
          })}
        </p>
      </section>
    </div>
  );
}

export function MultiAssetReadyStatePanel({ t }: { t: Translate }) {
  return (
    <ScenarioReadyPanel
      badge={t('multi_asset_page.ready.badge')}
      title={t('multi_asset_page.ready.title')}
      description={t('multi_asset_page.ready.description')}
      steps={[
        {
          id: 'entry-point',
          title: t('multi_asset_page.ready.steps.entry_point.title'),
          description: t('multi_asset_page.ready.steps.entry_point.description'),
        },
        {
          id: 'cash-path',
          title: t('multi_asset_page.ready.steps.cash_path.title'),
          description: t('multi_asset_page.ready.steps.cash_path.description'),
        },
        {
          id: 'context-only',
          title: t('multi_asset_page.ready.steps.context_only.title'),
          description: t('multi_asset_page.ready.steps.context_only.description'),
        },
      ]}
      footerText={t('multi_asset_page.ready.footer')}
    />
  );
}
