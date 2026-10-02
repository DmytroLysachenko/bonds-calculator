'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

import type { BondDefinition } from '@/features/bond-core/constants/bond-definitions';
import { BondType } from '@/features/bond-core/types';
import { isIsoCalendarDate } from '@/features/bond-core/types/iso-calendar-date';
import { generateCyclePeriods } from '@/features/bond-core/utils/engine/timeline-builder';
import { buildDefaultSharedConfig } from '@/features/comparison-engine/lib/comparison-calculator-state';
import { getIssueAvailability } from '@/features/education/lib/issue-availability';
import {
  applyDefinitionToInputs,
  buildFallbackInputs,
} from '@/features/single-calculator/lib/single-calculator-state';
import { useAppI18n } from '@/i18n/client';
import { useBondDefinitions } from '@/shared/context/BondDefinitionsContext';
import { bondSeriesClient, type BondSeriesMetadata } from '@/shared/lib/bond-series-client';
import { getHorizonMonths } from '@/shared/lib/date-timing';
import {
  createComparisonScenarioPackage,
  createSingleScenarioPackage,
  encodeScenarioForUrl,
} from '@/shared/lib/scenario-codec';

const comparisonAlternative: Record<BondType, BondType> = {
  [BondType.OTS]: BondType.ROR,
  [BondType.ROR]: BondType.DOR,
  [BondType.DOR]: BondType.ROR,
  [BondType.TOS]: BondType.COI,
  [BondType.COI]: BondType.EDO,
  [BondType.EDO]: BondType.COI,
  [BondType.ROS]: BondType.ROD,
  [BondType.ROD]: BondType.ROS,
};

function familyForSeries(code: string) {
  return Object.values(BondType).find((type) => code.toUpperCase().startsWith(type)) ?? null;
}

export { getIssueAvailability } from '@/features/education/lib/issue-availability';

export function getIssueSchedulePreview(issue: BondSeriesMetadata, definition: BondDefinition) {
  if (
    !issue.sellStartDate ||
    !issue.maturityDate ||
    !isIsoCalendarDate(issue.sellStartDate) ||
    !isIsoCalendarDate(issue.maturityDate)
  )
    return [];
  const purchase = new Date(`${issue.sellStartDate}T12:00:00Z`);
  const maturity = new Date(`${issue.maturityDate}T12:00:00Z`);
  if (Number.isNaN(purchase.getTime()) || Number.isNaN(maturity.getTime()) || maturity <= purchase)
    return [];
  const periods = generateCyclePeriods(purchase, maturity, maturity, definition.payoutFrequency);
  const checkpoints = periods
    .slice(0, 2)
    .map((period) => period.endDate.toISOString().slice(0, 10));
  const last = periods.at(-1);
  if (last) checkpoints.push(last.endDate.toISOString().slice(0, 10));
  return Array.from(new Set(checkpoints));
}

export function getIssueRateDescription(
  issue: BondSeriesMetadata,
  definition: BondDefinition,
  fixed: string,
  unverified: string,
) {
  const initialRate = Number(issue.firstYearRate);
  if (!Number.isFinite(initialRate)) return unverified;
  const initial = `${initialRate.toFixed(2)}%`;
  if (!definition.isFloating && !definition.isInflationIndexed) return `${initial} ${fixed}`;
  const margin =
    issue.baseMargin === null || issue.baseMargin === undefined ? null : Number(issue.baseMargin);
  const reset = definition.isFloating ? 'NBP' : 'CPI';
  return `${initial} → ${reset}${margin !== null && Number.isFinite(margin) ? ` + ${margin.toFixed(2)}%` : ` + ${unverified}`}`;
}

export function BondIssueExplorer() {
  const { t, locale } = useAppI18n();
  const { definitions } = useBondDefinitions();
  const {
    data: issues = [],
    isLoading: loading,
    error,
  } = useSWR<BondSeriesMetadata[]>('/api/calculate/bond-series', () => bondSeriesClient.listAll(), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  const [duration, setDuration] = useState('all');
  const [cashFlow, setCashFlow] = useState('all');
  const [eligibility, setEligibility] = useState('all');
  const rateFor = (issue: BondSeriesMetadata, definition: BondDefinition) =>
    getIssueRateDescription(
      issue,
      definition,
      t('education.issue_explorer.fixed'),
      t('education.issue_explorer.unverified_rate'),
    );
  const payoutFor = (definition: BondDefinition) =>
    definition.isCapitalized
      ? t('education.issue_explorer.capitalized')
      : t(`education.issue_explorer.payout_${definition.payoutFrequency.toLowerCase()}`);
  const exitRuleFor = (issue: BondSeriesMetadata, definition: BondDefinition) => {
    const fee = issue.earlyWithdrawalFee;
    const amount =
      fee === null || fee === undefined
        ? t('education.issue_explorer.exit_unverified')
        : `${Number(fee).toFixed(2)} PLN / ${definition.nominalValue} PLN`;
    const cap =
      issue.redemptionFeeCap === 'first-interest-then-principal'
        ? t('education.issue_explorer.exit_first_then_principal')
        : issue.redemptionFeeCap === 'interest'
          ? t('education.issue_explorer.exit_interest_cap')
          : issue.redemptionFeeCap === 'principal'
            ? t('education.issue_explorer.exit_principal_cap')
            : t('education.issue_explorer.exit_policy_unverified');
    return { amount, cap };
  };

  const visible = useMemo(
    () =>
      issues.filter((issue) => {
        const family = familyForSeries(issue.seriesCode);
        const definition = family ? definitions?.[family] : null;
        if (!definition) return false;
        if (
          duration !== 'all' &&
          (duration === 'short' ? definition.duration > 3 : definition.duration <= 3)
        )
          return false;
        if (
          cashFlow !== 'all' &&
          (cashFlow === 'income' ? definition.isCapitalized : !definition.isCapitalized)
        )
          return false;
        if (eligibility === 'general' && definition.isFamilyOnly) return false;
        if (eligibility === 'family' && !definition.isFamilyOnly) return false;
        return true;
      }),
    [issues, definitions, duration, cashFlow, eligibility],
  );
  const unsupportedIssues = issues.filter((issue) => {
    const family = familyForSeries(issue.seriesCode);
    return !family || !definitions?.[family];
  });

  const linksFor = (issue: BondSeriesMetadata) => {
    const family = familyForSeries(issue.seriesCode);
    const definition = family ? definitions?.[family] : null;
    if (!family || !definition || !issue.sellStartDate || !issue.maturityDate) return null;
    const base = buildFallbackInputs();
    const purchaseDate = issue.sellStartDate;
    const horizonMonths = getHorizonMonths(purchaseDate, issue.maturityDate);
    if (horizonMonths > 360) return null;
    const intent = applyDefinitionToInputs(
      {
        ...base,
        bondType: family,
        purchaseDate,
        withdrawalDate: issue.maturityDate,
        investmentHorizonMonths: horizonMonths,
        selectedSeriesId: issue.id,
      },
      definition,
      issue.id,
    );
    const encoded = encodeScenarioForUrl(createSingleScenarioPackage(intent));
    const alternative = comparisonAlternative[family];
    const comparisonEncoded = definitions?.[alternative]
      ? encodeScenarioForUrl(
          createComparisonScenarioPackage({
            mode: 'independent',
            sharedConfig: {
              ...buildDefaultSharedConfig(),
              initialInvestment: intent.initialInvestment,
              purchaseDate,
              withdrawalDate: intent.withdrawalDate,
              investmentHorizonMonths: horizonMonths,
              timingMode: 'exact',
            },
            scenarioA: { bondType: family, selectedSeriesId: issue.id, purchaseDate },
            scenarioB: { bondType: alternative, purchaseDate },
          }),
        )
      : null;
    return {
      calculate: encoded ? `/single-calculator?scenario=${encoded}` : null,
      compare: comparisonEncoded ? `/compare?scenario=${comparisonEncoded}` : null,
    };
  };

  return (
    <section
      aria-labelledby="issue-explorer-title"
      className="space-y-4 border-t border-border pt-7"
    >
      <div>
        <h3 id="issue-explorer-title" className="ui-section-title">
          {t('education.issue_explorer.title')}
        </h3>
        <p className="ui-body text-muted-foreground">{t('education.issue_explorer.description')}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="space-y-1 text-sm font-medium">
          <span>{t('education.issue_explorer.duration')}</span>
          <select
            className="ui-focus-ring block rounded-md border border-border bg-card px-3 py-2"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          >
            <option value="all">{t('education.issue_explorer.all')}</option>
            <option value="short">{t('education.issue_explorer.short')}</option>
            <option value="long">{t('education.issue_explorer.long')}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span>{t('education.issue_explorer.cash_flow')}</span>
          <select
            className="ui-focus-ring block rounded-md border border-border bg-card px-3 py-2"
            value={cashFlow}
            onChange={(event) => setCashFlow(event.target.value)}
          >
            <option value="all">{t('education.issue_explorer.all')}</option>
            <option value="income">{t('education.issue_explorer.income')}</option>
            <option value="capitalized">{t('education.issue_explorer.capitalized')}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span>{t('education.issue_explorer.eligibility')}</span>
          <select
            className="ui-focus-ring block rounded-md border border-border bg-card px-3 py-2"
            value={eligibility}
            onChange={(event) => setEligibility(event.target.value)}
          >
            <option value="all">{t('education.issue_explorer.all')}</option>
            <option value="general">{t('education.issue_explorer.general')}</option>
            <option value="family">{t('education.issue_explorer.family')}</option>
          </select>
        </label>
      </div>
      {loading ? (
        <p role="status">{t('common.calculating')}</p>
      ) : error ? (
        <p role="status" className="ui-status-note">
          {t('education.issue_explorer.load_failed')}
        </p>
      ) : issues.length === 0 ? (
        <div role="status" className="ui-status-note space-y-2">
          <p>{t('education.issue_explorer.fallback_only')}</p>
          <a
            href="#choose-a-path"
            className="ui-focus-ring inline-block font-semibold underline underline-offset-4"
          >
            {t('education.back_to_choices')}
          </a>
        </div>
      ) : visible.length === 0 ? (
        <p role="status" className="ui-status-note">
          {t('education.issue_explorer.unavailable')}
        </p>
      ) : (
        <div>
          <div className="space-y-3 lg:hidden">
            {visible.map((issue) => {
              const family = familyForSeries(issue.seriesCode)!;
              const definition = definitions![family];
              const status = getIssueAvailability(issue);
              const schedule = getIssueSchedulePreview(issue, definition);
              const links = linksFor(issue);
              const exitRule = exitRuleFor(issue, definition);
              return (
                <article key={issue.id} className="rounded-lg border border-border bg-card p-4">
                  <h4 className="font-semibold">
                    {issue.seriesCode}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {t(`education.issue_explorer.${status}`)}
                    </span>
                  </h4>
                  <p className="text-sm text-muted-foreground">{definition.fullName[locale]}</p>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                    <dt>{t('education.issue_explorer.sale')}</dt>
                    <dd>
                      {issue.sellStartDate ?? '—'} – {issue.sellEndDate ?? '—'}
                    </dd>
                    <dt>{t('education.issue_explorer.maturity')}</dt>
                    <dd>{issue.maturityDate ?? '—'}</dd>
                    <dt>{t('education.issue_explorer.rate')}</dt>
                    <dd>{rateFor(issue, definition)}</dd>
                    <dt>{t('education.issue_explorer.cash_flow')}</dt>
                    <dd>{payoutFor(definition)}</dd>
                    <dt>{t('education.issue_explorer.exit')}</dt>
                    <dd>
                      {exitRule.amount}
                      <span className="block text-base leading-6 text-muted-foreground">
                        {exitRule.cap}
                      </span>
                    </dd>
                    {definition.isFamilyOnly ? (
                      <>
                        <dt>{t('education.issue_explorer.eligibility')}</dt>
                        <dd>{t('education.issue_explorer.family')}</dd>
                      </>
                    ) : null}
                  </dl>
                  {schedule.length ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {t('education.issue_explorer.schedule')}: {schedule.join(' · ')}
                    </p>
                  ) : null}
                  <p className="mt-1 text-base leading-6 text-muted-foreground">
                    {issue.termsSourceUrl && issue.termsRevision
                      ? issue.termsRevision
                      : t('education.issue_explorer.unverified_source')}
                    {' · '}
                    {t('education.issue_explorer.freshness_unknown')}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm">
                    {status !== 'upcoming' && status !== 'issue_unavailable' && links?.calculate ? (
                      <Link
                        className="ui-focus-ring font-semibold underline"
                        href={links.calculate}
                      >
                        {t('education.issue_explorer.calculate')}
                      </Link>
                    ) : null}
                    {status !== 'upcoming' && status !== 'issue_unavailable' && links?.compare ? (
                      <Link className="ui-focus-ring font-semibold underline" href={links.compare}>
                        {t('education.issue_explorer.compare')}
                      </Link>
                    ) : null}
                    {issue.termsSourceUrl ? (
                      <a
                        className="ui-focus-ring underline"
                        href={issue.termsSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('education.issue_explorer.source')}
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">{t('education.issue_explorer.title')}</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="p-2">
                    {t('education.issue_explorer.issue')}
                  </th>
                  <th scope="col" className="p-2">
                    {t('education.issue_explorer.sale')}
                  </th>
                  <th scope="col" className="p-2">
                    {t('education.issue_explorer.rate')}
                  </th>
                  <th scope="col" className="p-2">
                    {t('education.issue_explorer.exit')}
                  </th>
                  <th scope="col" className="p-2">
                    {t('education.issue_explorer.action')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((issue) => {
                  const family = familyForSeries(issue.seriesCode)!;
                  const definition = definitions![family];
                  const status = getIssueAvailability(issue);
                  const schedule = getIssueSchedulePreview(issue, definition);
                  const links = linksFor(issue);
                  const exitRule = exitRuleFor(issue, definition);
                  return (
                    <tr key={issue.id} className="border-b border-border align-top">
                      <th scope="row" className="p-2 font-semibold">
                        {issue.seriesCode}{' '}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {t(`education.issue_explorer.${status}`)} · {definition.fullName[locale]}
                        </span>
                      </th>
                      <td className="p-2">
                        {issue.sellStartDate ?? '—'} – {issue.sellEndDate ?? '—'}
                        <span className="block">
                          {t('education.issue_explorer.maturity')}: {issue.maturityDate ?? '—'}
                        </span>
                      </td>
                      <td className="p-2">
                        {rateFor(issue, definition)}
                        <span className="block">{payoutFor(definition)}</span>
                        {schedule.length ? (
                          <span className="block text-xs">
                            {t('education.issue_explorer.schedule')}: {schedule.join(' · ')}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-2">
                        {exitRule.amount}
                        <span className="block text-base leading-6 text-muted-foreground">
                          {exitRule.cap}
                        </span>
                        {definition.isFamilyOnly ? (
                          <span className="block">{t('bonds.family_bond')}</span>
                        ) : null}
                      </td>
                      <td className="p-2">
                        {status !== 'upcoming' &&
                        status !== 'issue_unavailable' &&
                        links?.calculate ? (
                          <Link
                            className="ui-focus-ring font-semibold underline"
                            href={links.calculate}
                          >
                            {t('education.issue_explorer.calculate')}
                          </Link>
                        ) : null}
                        {status !== 'upcoming' &&
                        status !== 'issue_unavailable' &&
                        links?.compare ? (
                          <Link
                            className="ui-focus-ring block font-semibold underline"
                            href={links.compare}
                          >
                            {t('education.issue_explorer.compare')}
                          </Link>
                        ) : null}
                        <span className="block text-base leading-6 text-muted-foreground">
                          {issue.termsSourceUrl && issue.termsRevision
                            ? issue.termsRevision
                            : t('education.issue_explorer.unverified_source')}
                          {' · '}
                          {t('education.issue_explorer.freshness_unknown')}
                        </span>
                        {issue.termsSourceUrl ? (
                          <a
                            className="mt-2 block underline"
                            href={issue.termsSourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t('education.issue_explorer.source')}
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!loading && !error && unsupportedIssues.length > 0 ? (
        <p role="status" className="ui-status-note">
          {t('education.issue_explorer.unsupported_family')}:{' '}
          {unsupportedIssues.map((issue) => issue.seriesCode).join(', ')}
        </p>
      ) : null}
    </section>
  );
}
