'use client';
import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppI18n } from '@/i18n/client';
import { ChartContainer } from '@/shared/components/charts/ChartContainer';
import { ReferenceChartFrame } from '@/shared/components/charts/ReferenceChartFrame';
import { useChartData } from '@/shared/hooks/useChartData';
import { useDateFormatter, useNumberFormatter } from '@/shared/hooks/useLocalizedFormatters';
import { sliceSeriesByPeriod } from '@/shared/lib/chart-series';
import { getReferenceMetaItems } from '@/shared/lib/data-reference';

import {
  ChartSeriesEnvelope,
  EconomicSeriesPoint,
  PeriodValue,
} from '../lib/economic-dashboard-model';
import { buildInflationChartModel, type InflationPlotPoint } from '../lib/inflation-chart-model';

import { EconomicChartTooltip } from './EconomicChartTooltip';

const peakDateOptions: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
const peakNumberOptions: Intl.NumberFormatOptions = { maximumFractionDigits: 1 };

export const InflationChart = ({
  period = 'ALL',
  scaleMode = 'readable',
  onShowFullScale,
}: {
  period?: PeriodValue;
  scaleMode?: 'readable' | 'full';
  onShowFullScale?: () => void;
}) => {
  const { t, locale: language } = useAppI18n();
  const dates = useDateFormatter(language, peakDateOptions);
  const numbers = useNumberFormatter(language, peakNumberOptions);
  const {
    data: response,
    isLoading,
    isError,
  } = useChartData<ChartSeriesEnvelope<EconomicSeriesPoint>>('/api/charts/inflation');
  const model = React.useMemo(() => {
    const rawData = response?.data ?? [];
    return buildInflationChartModel(sliceSeriesByPeriod(rawData, period), scaleMode);
  }, [period, response?.data, scaleMode]);
  const peakLabel = model.peak
    ? t('economic.inflation_peak', {
        max: numbers.format(model.peak.rate),
        date: dates.format(new Date(model.peak.date)),
      })
    : undefined;
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
      notice={
        model.isClipped
          ? t('economic.inflation_scale_notice', { cap: numbers.format(model.cap) })
          : undefined
      }
      noticeAction={
        model.isClipped && onShowFullScale ? (
          <Button type="button" size="sm" variant="outline" onClick={onShowFullScale}>
            {t('economic.full_scale')}
          </Button>
        ) : undefined
      }
      noticeTone="warning"
      fallbackNotice={
        response?.usedFallback
          ? t('economic.fallback_notices.inflation_warning')
          : t('economic.fallback_notices.inflation_live')
      }
      fallbackTone={response?.usedFallback ? 'warning' : 'good'}
      fallbackStatusLabel={t('economic.reference_state.fallback')}
      syncedStatusLabel={t('economic.reference_state.synced')}
      verificationHref="https://stat.gov.pl/obszary-tematyczne/ceny-handel/wskazniki-cen/"
      verificationLabel={t('economic.verify_source')}
    >
      {peakLabel ? (
        <p className="text-sm font-semibold text-foreground" data-testid="inflation-peak">
          {peakLabel}
        </p>
      ) : null}
      <ChartContainer
        height={420}
        ariaLabel={t('bonds.inflation.rate')}
        summary={
          model.isClipped
            ? `${peakLabel}. ${t('economic.inflation_scale_notice', { cap: numbers.format(model.cap) })}`
            : peakLabel
        }
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
          <LineChart data={model.chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis
              fontSize={12}
              tickFormatter={(value: number) => `${value}%`}
              tickLine={false}
              axisLine={false}
              domain={model.domain}
              allowDataOverflow={model.isClipped}
            />
            <Tooltip
              content={
                <EconomicChartTooltip
                  metricLabel={t('bonds.inflation.rate')}
                  minWidthClassName="min-w-[140px]"
                />
              }
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
            <ReferenceLine
              y={2.5}
              label={{
                value: t('economic.nbp_target'),
                position: 'right',
                fontSize: 10,
                fill: '#C89D4F',
              }}
              stroke="#C89D4F"
              strokeDasharray="3 3"
            />
            <Line
              type="monotone"
              dataKey="plotRate"
              stroke="var(--chart-series-primary)"
              strokeWidth={2}
              dot={<InflationPointMarker showAll={model.chartData.length <= 24} />}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </ReferenceChartFrame>
  );
};

function InflationPointMarker({
  cx,
  cy,
  payload,
  showAll = false,
}: {
  cx?: number;
  cy?: number;
  payload?: InflationPlotPoint;
  showAll?: boolean;
}) {
  if (cx === undefined || cy === undefined || !payload) return <g />;
  if (payload.clippedMarker) {
    return (
      <g data-testid="inflation-clipped-marker" aria-hidden="true">
        <circle
          cx={cx}
          cy={cy + 9}
          r={7}
          fill="var(--color-warning)"
          stroke="var(--color-card)"
          strokeWidth={2}
        />
        <path
          d={`M ${cx - 3} ${cy + 11} L ${cx} ${cy + 6} L ${cx + 3} ${cy + 11}`}
          fill="none"
          stroke="var(--color-warning-foreground)"
          strokeWidth={2}
        />
      </g>
    );
  }
  return showAll ? <circle cx={cx} cy={cy} r={3} fill="var(--chart-series-primary)" /> : <g />;
}
