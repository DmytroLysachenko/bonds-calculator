'use client';

import { format } from 'date-fns';
import { Loader2, TrendingUp } from 'lucide-react';
import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ValueType } from 'recharts/types/component/DefaultTooltipContent';

import { PortfolioSimulationResult } from '@/features/bond-core/types/scenarios';
import { ChartContainer } from '@/shared/components/charts/ChartContainer';
import { ChartSupportNote } from '@/shared/components/charts/ChartSupportNote';
import { FormInlineNotice } from '@/shared/components/forms/FormInlineNotice';

type PortfolioAnalyticsTabProps = {
  simulation: PortfolioSimulationResult | null;
  isSimulating: boolean;
  formatCurrency: (value: number) => string;
  t: (key: string, values?: Record<string, string>) => string;
};

export function PortfolioAnalyticsTab({
  simulation,
  isSimulating,
  formatCurrency,
  t,
}: PortfolioAnalyticsTabProps) {
  const latestPoint = simulation?.aggregatedTimeline?.at(-1);
  return (
    <>
      <section className="space-y-4 border-t border-border py-5">
        <div className="space-y-2">
          <h2 className="ui-section-title">{t('notebook.projection_title')}</h2>
          <p className="ui-body text-muted-foreground">{t('notebook.projection_desc')}</p>
        </div>
        <ChartSupportNote
          title={t('notebook.projection_read_title')}
          description={t('notebook.projection_read_desc')}
        />
        {latestPoint ? (
          <dl className="grid grid-cols-1 gap-px border-y border-border bg-border sm:grid-cols-4">
            <div className="space-y-1 bg-background p-4">
              <dt className="ui-meta font-semibold text-muted-foreground">
                {t('notebook.total_value_label')}
              </dt>
              <dd className="financial-number text-lg font-semibold text-foreground">
                {formatCurrency(latestPoint.totalNetValue)}
              </dd>
            </div>
            <div className="space-y-1 bg-background p-4">
              <dt className="ui-meta font-semibold text-muted-foreground">
                {t('bonds.real_value_inflation')}
              </dt>
              <dd className="financial-number text-lg font-semibold text-foreground">
                {formatCurrency(latestPoint.totalRealValue)}
              </dd>
            </div>
            <div className="space-y-1 bg-background p-4">
              <dt className="ui-meta font-semibold text-muted-foreground">
                {t('common.net_profit')}
              </dt>
              <dd className="financial-number text-lg font-semibold text-foreground">
                {formatCurrency(latestPoint.totalProfit)}
              </dd>
            </div>
            <div className="space-y-1 bg-background p-4">
              <dt className="ui-meta font-semibold text-muted-foreground">
                {t('comparison.table_tax_paid')}
              </dt>
              <dd className="financial-number text-lg font-semibold text-foreground">
                {formatCurrency(latestPoint.totalTax)}
              </dd>
            </div>
          </dl>
        ) : null}
        {isSimulating ? (
          <div className="flex min-h-[320px] items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('notebook.simulating_projection')}
          </div>
        ) : simulation?.aggregatedTimeline ? (
          <>
            <ChartContainer
              height={360}
              ariaLabel={t('notebook.projection_title')}
              summary={t('notebook.projection_desc')}
            >
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                <AreaChart
                  data={
                    simulation.aggregatedTimeline.length > 240
                      ? simulation.aggregatedTimeline.filter((_, index) => index % 2 === 0)
                      : simulation.aggregatedTimeline
                  }
                  margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="portfolioNet" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--chart-series-primary)"
                        stopOpacity={0.14}
                      />
                      <stop offset="95%" stopColor="var(--chart-series-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => format(new Date(value), 'yyyy')}
                    minTickGap={48}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                  />
                  <Tooltip
                    labelFormatter={(value) => format(new Date(value as string), 'MMMM yyyy')}
                    formatter={(value: ValueType | undefined) => [
                      formatCurrency(Number(value ?? 0)),
                      t('notebook.total_value_label'),
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalNetValue"
                    stroke="var(--chart-series-primary)"
                    strokeWidth={2}
                    fill="url(#portfolioNet)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
            <details className="rounded-md border border-border p-3">
              <summary className="ui-focus-ring cursor-pointer font-semibold">
                {t('notebook.projection_data_table')}
              </summary>
              <div className="mt-3 max-h-96 overflow-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">{t('notebook.projection_title')}</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="p-2">
                        {t('common.date')}
                      </th>
                      <th scope="col" className="p-2">
                        {t('notebook.total_value_label')}
                      </th>
                      <th scope="col" className="p-2">
                        {t('common.net_profit')}
                      </th>
                      <th scope="col" className="p-2">
                        {t('comparison.table_tax_paid')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulation.aggregatedTimeline.map((point) => (
                      <tr key={point.date} className="border-t border-border">
                        <th scope="row" className="p-2 font-medium">
                          {point.date}
                        </th>
                        <td className="p-2 financial-number">
                          {formatCurrency(point.totalNetValue)}
                        </td>
                        <td className="p-2 financial-number">
                          {formatCurrency(point.totalProfit)}
                        </td>
                        <td className="p-2 financial-number">{formatCurrency(point.totalTax)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
            {t('notebook.projection_empty')}
          </div>
        )}
      </section>

      <section className="border-t border-border py-5">
        <FormInlineNotice
          tone="success"
          title={
            <span className="inline-flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              {t('notebook.descriptive_title')}
            </span>
          }
          description={t('notebook.descriptive_desc')}
        />
      </section>
    </>
  );
}
