'use client';
import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Skeleton } from '@/components/ui/skeleton';
import { useAppI18n } from '@/i18n/client';
import { ChartContainer } from '@/shared/components/charts/ChartContainer';
import { ReferenceChartFrame } from '@/shared/components/charts/ReferenceChartFrame';
import { useChartData } from '@/shared/hooks/useChartData';
import { sampleSeriesPoints, sliceSeriesByPeriod } from '@/shared/lib/chart-series';
import { getReferenceMetaItems } from '@/shared/lib/data-reference';

import {
  ChartSeriesEnvelope,
  EconomicSeriesPoint,
  PeriodValue,
} from '../lib/economic-dashboard-model';

import { EconomicChartTooltip } from './EconomicChartTooltip';

export const NBPRateChart = ({ period = 'ALL' }: { period?: PeriodValue }) => {
  const { t, locale: language } = useAppI18n();
  const {
    data: response,
    isLoading,
    isError,
  } = useChartData<ChartSeriesEnvelope<EconomicSeriesPoint>>('/api/charts/nbp-rate');
  const chartData = React.useMemo(() => {
    const rawData = response?.data ?? [];
    return sampleSeriesPoints(sliceSeriesByPeriod(rawData, period), 160);
  }, [period, response?.data]);
  if (isLoading) {
    return <Skeleton className="h-[470px] w-full rounded-lg" />;
  }
  if (isError && !response) {
    return (
      <div
        className="flex h-[400px] w-full items-center justify-center text-destructive"
        role="status"
        aria-live="polite"
      >
        {t('economic.failed_to_load')}
      </div>
    );
  }
  return (
    <ReferenceChartFrame
      sourceLabel={t('economic.compact_source_header')}
      metaItems={getReferenceMetaItems(response, language)}
      fallbackNotice={
        response?.usedFallback
          ? t('economic.fallback_notices.nbp_warning')
          : t('economic.fallback_notices.nbp_live')
      }
      fallbackTone={response?.usedFallback ? 'warning' : 'good'}
      fallbackStatusLabel={t('economic.reference_state.fallback')}
      syncedStatusLabel={t('economic.reference_state.synced')}
      verificationHref="https://nbp.pl/podstawowe-stopy-procentowe-nbp/"
      verificationLabel={t('economic.verify_source')}
    >
      <ChartContainer
        height={420}
        ariaLabel={t('bonds.nbp_rate_short')}
        summary={t('economic.nbp_target')}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C89D4F" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#C89D4F" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis
              fontSize={12}
              tickFormatter={(value: number) => `${value}%`}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<EconomicChartTooltip metricLabel={t('bonds.nbp_rate_short')} />} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
            <Area
              type="stepAfter"
              dataKey="rate"
              stroke="#C89D4F"
              strokeWidth={2}
              fill="url(#colorRate)"
              activeDot={{ r: 6, strokeWidth: 0, fill: '#C89D4F' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    </ReferenceChartFrame>
  );
};
