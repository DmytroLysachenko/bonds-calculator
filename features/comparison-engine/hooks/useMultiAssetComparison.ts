import { useCallback, useMemo, useState } from 'react';

import { useChartData } from '@/shared/hooks/useChartData';
import { useQuerySync } from '@/shared/hooks/useQuerySync';
import {
  getReferenceAsOfLabel,
  getReferenceCoverageLabel,
  getReferenceSourceLabel,
} from '@/shared/lib/data-reference';

import { HISTORICAL_RETURNS, type MonthlyReturn } from '../../bond-core/constants/historical-data';
import {
  calculateAssetPerformance,
  calculateBondsPerformance,
  calculateSavingsPerformance,
  getHistoricalReplayIssue,
} from '../../bond-core/utils/asset-calculations';
import { createMonthlyPriceIndexPath } from '../../bond-core/utils/engine/price-index';
import { ASSETS_METADATA } from '../constants/multi-asset';
import {
  buildMultiAssetDraftStateFromQuery,
  getDefaultMultiAssetDraftState,
  type MultiAssetDraftState,
} from '../lib/multi-asset-state';

interface MultiAssetHistoryResponse {
  data: MonthlyReturn[];
  source: 'database' | 'fallback';
  usedFallback: boolean;
  coverageStart: string;
  coverageEnd: string;
  lastSyncedAt?: string;
  seriesAvailability?: {
    sp500: boolean;
    gold: boolean;
    inflation: boolean;
    nbpRate: boolean;
  };
  currencyBasis?: 'PLN' | 'mixed-USD-PLN';
  observationBasis?: 'observed' | 'illustrative';
  coverageGaps?: string[];
}

export function useMultiAssetComparison() {
  const { data: historyResponse, isLoading } = useChartData<MultiAssetHistoryResponse>(
    '/api/charts/multi-asset-history',
  );

  // Never substitute the illustrative fallback beneath an observed response.
  const sourceData = historyResponse ? historyResponse.data : HISTORICAL_RETURNS;
  const effectiveCoverageStart =
    historyResponse?.coverageStart ?? HISTORICAL_RETURNS[0]?.date ?? '2020-01';
  const effectiveCoverageEnd =
    historyResponse?.coverageEnd ??
    HISTORICAL_RETURNS[HISTORICAL_RETURNS.length - 1]?.date ??
    '2024-06';

  const defaultState = useMemo(() => getDefaultMultiAssetDraftState(sourceData), [sourceData]);
  const [draft, setDraft] = useState<MultiAssetDraftState>(defaultState);
  const [committed, setCommitted] = useState<MultiAssetDraftState>(defaultState);
  const [isDirty, setIsDirty] = useState(true);

  const setDraftPartial = useCallback((patch: Partial<MultiAssetDraftState>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setIsDirty(true);
  }, []);

  const updateInitialSum = useCallback(
    (value: number) => {
      setDraftPartial({ initialSum: value });
    },
    [setDraftPartial],
  );

  const updateMonthlyContribution = useCallback(
    (value: number) => {
      setDraftPartial({ monthlyContribution: value });
    },
    [setDraftPartial],
  );

  const updateStartYear = useCallback(
    (value: string) => {
      setDraftPartial({ startYear: value });
    },
    [setDraftPartial],
  );

  const updateStartMonth = useCallback(
    (value: string) => {
      setDraftPartial({ startMonth: value });
    },
    [setDraftPartial],
  );

  const updateShowRealValue = useCallback((value: boolean) => {
    setDraft((current) => ({ ...current, showRealValue: value }));
  }, []);

  const recalculate = useCallback(() => {
    setCommitted(draft);
    setIsDirty(false);
  }, [draft]);

  useQuerySync(
    {
      sum: draft.initialSum,
      monthly: draft.monthlyContribution,
      year: draft.startYear || undefined,
      month: draft.startMonth || undefined,
      real: draft.showRealValue,
    },
    (initial) => {
      const nextDraft = buildMultiAssetDraftStateFromQuery(initial, defaultState);

      setDraft(nextDraft);
      setCommitted(nextDraft);
      setIsDirty(false);
    },
  );

  const filteredData = useMemo(() => {
    const effectiveStartDate = `${committed.startYear}-${committed.startMonth}`;
    return sourceData.filter((row) => row.date >= effectiveStartDate);
  }, [committed.startMonth, committed.startYear, sourceData]);

  const historyReplayIssue = useMemo(() => {
    if (
      !historyResponse ||
      historyResponse.currencyBasis !== 'PLN' ||
      historyResponse.observationBasis !== 'observed'
    )
      return null;
    return getHistoricalReplayIssue(filteredData);
  }, [filteredData, historyResponse]);
  const canReplay =
    historyResponse?.currencyBasis === 'PLN' &&
    historyResponse.observationBasis === 'observed' &&
    !historyReplayIssue;

  const sp500 = useMemo(
    () =>
      canReplay
        ? calculateAssetPerformance(
            committed.initialSum,
            committed.monthlyContribution,
            'sp500',
            ASSETS_METADATA.sp500,
            filteredData,
          )
        : null,
    [canReplay, committed.initialSum, committed.monthlyContribution, filteredData],
  );

  const gold = useMemo(
    () =>
      canReplay
        ? calculateAssetPerformance(
            committed.initialSum,
            committed.monthlyContribution,
            'gold',
            ASSETS_METADATA.gold,
            filteredData,
          )
        : null,
    [canReplay, committed.initialSum, committed.monthlyContribution, filteredData],
  );

  const bonds = useMemo(
    () =>
      canReplay
        ? calculateBondsPerformance(
            committed.initialSum,
            committed.monthlyContribution,
            ASSETS_METADATA.bonds,
            filteredData,
          )
        : null,
    [canReplay, committed.initialSum, committed.monthlyContribution, filteredData],
  );

  const savings = useMemo(
    () =>
      canReplay
        ? calculateSavingsPerformance(
            committed.initialSum,
            committed.monthlyContribution,
            ASSETS_METADATA.savings,
            filteredData,
          )
        : null,
    [canReplay, committed.initialSum, committed.monthlyContribution, filteredData],
  );

  const purchasingPowerLoss = useMemo(() => {
    if (!canReplay) return 0;

    const priceIndexPath = createMonthlyPriceIndexPath(
      filteredData.map((row) => ({
        date: row.date,
        changePercent: row.inflation,
        kind: row.inflationKind,
      })),
    );
    const startDate = new Date(`${filteredData[0].date}-01T00:00:00`);
    let nominalContributions = committed.initialSum;
    let realContributions = committed.initialSum;

    for (const row of filteredData) {
      // Monthly contributions are made at the beginning of their month, so
      // their purchasing power is not deflated by that same month's CPI.
      const contributionDate = new Date(`${row.date}-01T00:00:00`);
      nominalContributions += committed.monthlyContribution;
      realContributions += priceIndexPath
        .deflate(committed.monthlyContribution, startDate, contributionDate)
        .toNumber();
    }

    return nominalContributions - realContributions;
  }, [canReplay, committed.initialSum, committed.monthlyContribution, filteredData]);

  const years = useMemo(() => {
    const uniqueYears = Array.from(new Set(sourceData.map((row) => row.date.substring(0, 4))));
    return uniqueYears.sort((left, right) => right.localeCompare(left));
  }, [sourceData]);

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, index) => (index + 1).toString().padStart(2, '0')),
    [],
  );

  return {
    initialSum: draft.initialSum,
    updateInitialSum,
    monthlyContribution: draft.monthlyContribution,
    updateMonthlyContribution,
    startDate: `${committed.startYear}-${committed.startMonth}`,
    startYear: draft.startYear,
    updateStartYear,
    startMonth: draft.startMonth,
    updateStartMonth,
    years,
    months,
    showRealValue: draft.showRealValue,
    updateShowRealValue,
    isDirty,
    isLoading,
    recalculate,
    assets: canReplay && sp500 && gold && bonds && savings ? [sp500, gold, bonds, savings] : [],
    purchasingPowerLoss,
    historyReplayIssue,
    historyCurrencyBasis: historyResponse?.currencyBasis,
    historyObservationBasis: historyResponse?.observationBasis,
    metadata: ASSETS_METADATA,
    availableDates: sourceData.map((row) => row.date),
    historySource: historyResponse?.source ?? 'fallback',
    historySourceLabel: getReferenceSourceLabel(historyResponse),
    historyCoverageLabel: getReferenceCoverageLabel(historyResponse),
    historyAsOfLabel: getReferenceAsOfLabel(historyResponse),
    historyCoverageStart: effectiveCoverageStart,
    historyCoverageEnd: effectiveCoverageEnd,
    usedFallbackHistory: historyResponse?.usedFallback ?? true,
    historyLastSyncedAt: historyResponse?.lastSyncedAt,
    historySeriesAvailability: historyResponse?.seriesAvailability,
    historyCoverageGaps: historyResponse?.coverageGaps ?? [],
    priceIndexIsApproximate: sourceData.some((row) => row.inflationKind === 'year_over_year'),
    historyData: filteredData,
    committedScenario: committed,
  };
}
