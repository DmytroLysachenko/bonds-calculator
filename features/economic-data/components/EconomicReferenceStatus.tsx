'use client';

import {
  ReferenceStatusPanel,
  type ReferenceStatusPanelProps,
} from '@/features/economic-data/components/EconomicDashboardSections';
import {
  type ChartSeriesEnvelope,
  type EconomicSeriesPoint,
} from '@/features/economic-data/lib/economic-dashboard-model';
import { useChartData } from '@/shared/hooks/useChartData';

type EconomicReferenceStatusProps = Pick<ReferenceStatusPanelProps, 'labels' | 'language'>;

export function EconomicReferenceStatus({ labels, language }: EconomicReferenceStatusProps) {
  const { data: inflationMeta, isLoading: isLoadingInflation } =
    useChartData<ChartSeriesEnvelope<EconomicSeriesPoint>>('/api/charts/inflation');
  const { data: nbpMeta, isLoading: isLoadingNbp } =
    useChartData<ChartSeriesEnvelope<EconomicSeriesPoint>>('/api/charts/nbp-rate');

  return (
    <ReferenceStatusPanel
      inflationMeta={inflationMeta}
      nbpMeta={nbpMeta}
      isLoadingInflation={isLoadingInflation}
      isLoadingNbp={isLoadingNbp}
      labels={labels}
      language={language}
    />
  );
}
