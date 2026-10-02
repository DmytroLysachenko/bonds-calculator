import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Database,
  ShieldAlert,
  Sparkles,
  TrendingDown,
} from 'lucide-react';

import { Accordion } from '@/components/ui/accordion';
import {
  type ChartSeriesEnvelope,
  ECONOMIC_RANGE_OPTIONS,
  type EconomicSeriesPoint,
  type PeriodValue,
} from '@/features/economic-data/lib/economic-dashboard-model';
import type {
  EconomicSeriesKey,
  InflationScaleMode,
} from '@/features/economic-data/lib/economic-view';
import { useAppI18n } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { InfoTooltip } from '@/shared/components/feedback/InfoTooltip';
import { ReferenceGuideRail } from '@/shared/components/reference/ReferenceGuideRail';
import { ReferenceNoteCard } from '@/shared/components/reference/ReferenceNoteCard';

import { EconomicSeriesStatusCard } from './EconomicSeriesStatusCard';

interface RangeActionsProps {
  period: PeriodValue;
  setPeriod: (value: PeriodValue) => void;
  series: EconomicSeriesKey;
  setSeries: (value: EconomicSeriesKey) => void;
  scale: InflationScaleMode;
  setScale: (value: InflationScaleMode) => void;
  rangeLabel: string;
  hint: string;
}

interface UsageGuidePanelProps {
  usageGuide: string[];
  labels: {
    howToUse: string;
    dataQuality: string;
  };
}

export interface ReferenceStatusPanelProps {
  inflationMeta?: ChartSeriesEnvelope<EconomicSeriesPoint>;
  nbpMeta?: ChartSeriesEnvelope<EconomicSeriesPoint>;
  isLoadingInflation: boolean;
  isLoadingNbp: boolean;
  labels: {
    referenceRail: string;
    statusRail: string;
    pageScope: string;
  };
  language: 'pl' | 'en';
}

export function RangeActions({
  period,
  setPeriod,
  series,
  setSeries,
  scale,
  setScale,
  rangeLabel,
  hint,
}: RangeActionsProps) {
  const { t } = useAppI18n();

  return (
    <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-[auto_1fr_auto]">
      <div className="space-y-1.5">
        <p className="ui-label">{t('economic.toolbar_series')}</p>
        <div
          className="inline-flex rounded-md bg-muted/45 p-1"
          role="group"
          aria-label={t('economic.toolbar_series')}
        >
          <button
            type="button"
            aria-pressed={series === 'cpi'}
            onClick={() => setSeries('cpi')}
            className={cn(
              'min-h-11 rounded px-3 py-1.5 text-xs font-semibold ui-focus-ring',
              series === 'cpi'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <TrendingDown className="mr-1 inline size-3.5" aria-hidden="true" /> CPI
          </button>
          <button
            type="button"
            aria-pressed={series === 'nbp'}
            onClick={() => setSeries('nbp')}
            className={cn(
              'min-h-11 rounded px-3 py-1.5 text-xs font-semibold ui-focus-ring',
              series === 'nbp'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            NBP
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="ui-label inline-flex items-center gap-1">
          <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" /> {rangeLabel}
        </p>
        <div className="flex flex-wrap gap-1" role="group" aria-label={rangeLabel}>
          {ECONOMIC_RANGE_OPTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={period === item.value}
              onClick={() => setPeriod(item.value)}
              className={cn(
                'min-h-11 rounded px-3 py-1.5 text-sm transition-colors ui-focus-ring',
                period === item.value
                  ? 'bg-foreground font-semibold text-background'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5 sm:col-span-2 xl:col-span-1">
        <p className="ui-label">{t('economic.toolbar_scale_cpi')}</p>
        {series === 'cpi' ? (
          <div
            className="inline-flex rounded-md border border-border p-1"
            role="group"
            aria-label={t('economic.toolbar_scale_cpi')}
          >
            {(['readable', 'full'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={scale === mode}
                onClick={() => setScale(mode)}
                className={cn(
                  'min-h-11 rounded px-2.5 py-1 text-xs font-semibold ui-focus-ring',
                  scale === mode
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {mode === 'readable' ? t('economic.readable_scale') : t('economic.full_scale')}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('economic.toolbar_scale_unavailable')}</p>
        )}
        <InfoTooltip content={hint} />
      </div>
    </div>
  );
}

export function UsageGuidePanel({ usageGuide, labels }: UsageGuidePanelProps) {
  const { t } = useAppI18n();

  return (
    <div className="space-y-6">
      <section className="space-y-5 border-t border-border py-5 md:py-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="ui-section-title">{labels.howToUse}</h3>
        </div>
        <div className="grid gap-x-8 gap-y-4 border-y border-border py-4 lg:grid-cols-2">
          {usageGuide.map((item) => (
            <div key={item} className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <div className="space-y-1">
                <p className="ui-body">{item}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <ReferenceNoteCard
        icon={<AlertTriangle className="h-4 w-4 text-warning" />}
        title={labels.dataQuality}
        description={t('economic.data_quality_description')}
        tone="warning"
      />
    </div>
  );
}

export function ReferenceStatusPanel({
  inflationMeta,
  nbpMeta,
  isLoadingInflation,
  isLoadingNbp,
  labels,
  language,
}: ReferenceStatusPanelProps) {
  const { t } = useAppI18n();

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid gap-6 lg:grid-cols-2">
        <EconomicSeriesStatusCard
          title={t('economic.inflation_title')}
          meta={inflationMeta}
          isLoading={isLoadingInflation}
          language={language}
        />

        <EconomicSeriesStatusCard
          title={t('economic.nbp_rate_title')}
          meta={nbpMeta}
          isLoading={isLoadingNbp}
          language={language}
        />
      </div>

      <Accordion type="multiple" defaultValue={['scope', 'status']} className="space-y-4">
        <ReferenceGuideRail
          value="scope"
          icon={<ShieldAlert className="h-4 w-4 text-primary" />}
          title={labels.referenceRail}
        >
          <ReferenceNoteCard
            icon={<ShieldAlert className="h-4 w-4 text-primary" />}
            title={labels.pageScope}
            description={t('economic.page_scope_description')}
          />
        </ReferenceGuideRail>

        <ReferenceGuideRail
          value="status"
          icon={<Database className="h-4 w-4 text-primary" />}
          title={labels.statusRail}
        >
          <ReferenceNoteCard
            icon={<Database className="h-4 w-4 text-primary" />}
            title={t('economic.reference_panel')}
            description={t('economic.reference_status_description')}
          />
        </ReferenceGuideRail>
      </Accordion>
    </div>
  );
}
