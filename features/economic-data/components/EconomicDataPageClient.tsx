'use client';

import { Activity, Database, Info } from 'lucide-react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useMemo, useState } from 'react';

import { BondType } from '@/features/bond-core/types';
import {
  RangeActions,
  UsageGuidePanel,
} from '@/features/economic-data/components/EconomicDashboardSections';
import {
  buildEconomicPageLabels,
  buildEconomicUsageGuide,
} from '@/features/economic-data/lib/economic-page-model';
import {
  type EconomicView,
  parseEconomicView,
  serializeEconomicView,
} from '@/features/economic-data/lib/economic-view';
import { useAppI18n } from '@/i18n/client';
import { ChartSection } from '@/shared/components/charts/ChartSection';
import { CalculatorPageShell } from '@/shared/components/page/CalculatorPageShell';
import { SectionBlock } from '@/shared/components/page/SectionBlock';
import { ReferenceDashboardHero } from '@/shared/components/reference/ReferenceDashboardHero';
import { useBondDefinitions } from '@/shared/context/BondDefinitionsContext';
import { getBondRateContextCopy } from '@/shared/lib/bond-rate-context';

const ChartLoading = () => (
  <div
    className="h-[470px] w-full animate-pulse rounded-lg bg-muted"
    role="status"
    aria-label="Loading chart"
  />
);

const InflationChart = dynamic(
  () =>
    import('@/features/economic-data/components/InflationChart').then(
      (module) => module.InflationChart,
    ),
  { loading: ChartLoading },
);
const NBPRateChart = dynamic(
  () =>
    import('@/features/economic-data/components/NBPRateChart').then(
      (module) => module.NBPRateChart,
    ),
  { loading: ChartLoading },
);
const EconomicReferenceStatus = dynamic(
  () =>
    import('@/features/economic-data/components/EconomicReferenceStatus').then(
      (module) => module.EconomicReferenceStatus,
    ),
  { loading: () => <div className="h-44 animate-pulse rounded-lg bg-muted" /> },
);

export function EconomicDataPageClient({ initialView }: { initialView: EconomicView }) {
  const { t, locale: language } = useAppI18n();
  const { definitions } = useBondDefinitions();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = useMemo(() => {
    const query = searchParams.toString();
    return query ? parseEconomicView(new URLSearchParams(query)) : initialView;
  }, [initialView, searchParams]);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const labels = buildEconomicPageLabels(t);

  const pageIntro = t('economic.page_intro');
  const floatingRateContext = getBondRateContextCopy(
    BondType.ROR,
    definitions?.[BondType.ROR]?.firstYearRate ?? 4,
    0,
    t,
  );
  const usageGuide = buildEconomicUsageGuide(t, floatingRateContext);
  const updateView = useCallback(
    (patch: Partial<EconomicView>) => {
      const next = { ...view, ...patch };
      if (next.series === 'nbp') next.scale = 'readable';
      router.push(`${pathname}?${serializeEconomicView(next)}`, { scroll: false });
    },
    [pathname, router, view],
  );
  const selectedChart =
    view.series === 'cpi' ? (
      <ChartSection
        title={t('economic.inflation_title')}
        description={t('economic.inflation_desc')}
      >
        <InflationChart
          period={view.range}
          scaleMode={view.scale}
          onShowFullScale={() => updateView({ scale: 'full' })}
        />
      </ChartSection>
    ) : (
      <ChartSection title={t('economic.nbp_rate_title')} description={t('economic.nbp_rate_desc')}>
        <NBPRateChart period={view.range} />
      </ChartSection>
    );

  return (
    <CalculatorPageShell
      title={t('nav.economic_data')}
      description={t('economic.subtitle')}
      icon={<Activity className="h-8 w-8" />}
      isCalculating={false}
      hasResults={false}
    >
      <div className="ui-page-flow">
        <ReferenceDashboardHero
          badge={
            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-muted-foreground">
              <Database className="h-3.5 w-3.5 text-foreground" />
              {labels.panel}
            </div>
          }
          title={t('economic.macro_support_title')}
          description={pageIntro}
          decisionTrace={<p className="text-sm leading-6 text-muted-foreground">{usageGuide[1]}</p>}
        />

        <SectionBlock
          title={t('economic.chart_dashboard_title')}
          description={t('economic.chart_dashboard_description')}
          icon={<Info className="h-4 w-4" />}
          action={
            <RangeActions
              period={view.range}
              setPeriod={(range) => updateView({ range })}
              series={view.series}
              setSeries={(series) => updateView({ series })}
              scale={view.scale}
              setScale={(scale) => updateView({ scale })}
              rangeLabel={t('economic.range_data')}
              hint={t('economic.range_hint')}
            />
          }
          headerClassName="sm:!flex-col 2xl:!flex-row"
          contentClassName="space-y-5"
        >
          {selectedChart}
        </SectionBlock>
        <details
          className="border-t border-border pt-5"
          onToggle={(event) => setIsStatusOpen(event.currentTarget.open)}
        >
          <summary className="ui-focus-ring cursor-pointer text-sm font-semibold text-foreground">
            {t('economic.status_dashboard_title')}
          </summary>
          <div className="mt-5">
            {isStatusOpen ? <EconomicReferenceStatus labels={labels} language={language} /> : null}
          </div>
        </details>
        <details className="border-t border-border pt-5">
          <summary className="ui-focus-ring cursor-pointer text-sm font-semibold text-foreground">
            {t('economic.guide_dashboard_title')}
          </summary>
          <div className="mt-5">
            <UsageGuidePanel
              usageGuide={usageGuide}
              labels={{ howToUse: labels.howToUse, dataQuality: labels.dataQuality }}
            />
          </div>
        </details>
      </div>
    </CalculatorPageShell>
  );
}
