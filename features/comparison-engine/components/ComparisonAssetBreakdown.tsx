'use client';

import { Activity, TrendingUp } from 'lucide-react';
import React from 'react';

import { useAppI18n } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { chartColorClass } from '@/shared/components/charts/chart-color-class';
import { InfoTooltip } from '@/shared/components/feedback/InfoTooltip';

import { ComparisonAssetBreakdownProps } from '../types/multi-asset';

export const ComparisonAssetBreakdown: React.FC<ComparisonAssetBreakdownProps> = ({
  assets,
  totalInvested,
  showRealValue,
  formatCurrency,
}) => {
  const { t, locale: language } = useAppI18n();
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {assets.map((asset) => {
        const last = asset.series[asset.series.length - 1];
        const maxDrawdown = Math.max(
          ...asset.series.map((s) => (Number.isFinite(s.drawdown) ? s.drawdown : 0)),
        );
        const finalValue = showRealValue ? last.realValue! : last.value;
        const netProfit = finalValue - totalInvested;
        const isProfit = netProfit >= 0;

        return (
          <article
            key={asset.metadata.id}
            className="flex h-full flex-col justify-between gap-5 border-t border-border py-5"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-6 w-2 rounded-full ${chartColorClass(asset.metadata.color)}`}
                  />
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    {asset.metadata.name}
                  </p>
                </div>
                <InfoTooltip content={asset.metadata.description[language]} />
              </div>

              <div className="space-y-2">
                <p className="text-2xl font-semibold tracking-tight text-foreground">
                  {formatCurrency(finalValue)}
                </p>
                <div
                  className={cn(
                    'flex items-center gap-1.5 text-sm font-semibold',
                    isProfit ? 'text-success' : 'text-destructive',
                  )}
                >
                  {isProfit ? <TrendingUp className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                  {isProfit ? '+' : ''}
                  {formatCurrency(netProfit)}
                </div>
              </div>
            </div>

            <div className="divide-y divide-dashed divide-border">
              <div className="flex items-center justify-between gap-4 py-3 text-xs">
                <span className="font-medium text-muted-foreground">
                  {t('comparison.max_drawdown')}
                </span>
                <span className="font-semibold text-destructive">-{maxDrawdown.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-3 text-xs">
                <span className="font-medium text-muted-foreground">
                  {t('comparison.total_return')}
                </span>
                <span className="font-semibold text-success">
                  +{((finalValue / totalInvested - 1) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
};
