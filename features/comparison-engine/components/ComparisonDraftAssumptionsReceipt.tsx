'use client';

import { useAppI18n } from '@/i18n/client';
import { useDateFormatter, useNumberFormatter } from '@/shared/hooks/useLocalizedFormatters';
import { useMacroAssumptionDefaults } from '@/shared/hooks/useMacroAssumptionDefaults';

import type { ScenarioOverride, SharedComparisonConfig } from '../lib/comparison-calculator-state';

interface ComparisonDraftAssumptionsReceiptProps {
  sharedConfig: SharedComparisonConfig;
  scenarioA: ScenarioOverride;
  scenarioB: ScenarioOverride;
}

const dateOptions: Intl.DateTimeFormatOptions = { dateStyle: 'medium' };

export function ComparisonDraftAssumptionsReceipt({
  sharedConfig,
  scenarioA,
  scenarioB,
}: ComparisonDraftAssumptionsReceiptProps) {
  const { t, locale } = useAppI18n();
  const { defaults } = useMacroAssumptionDefaults();
  const numbers = useNumberFormatter(locale);
  const dates = useDateFormatter(locale, dateOptions);
  const formatPath = (path: number[] | undefined, fallback: number) =>
    path?.length
      ? t('comparison.draft_receipt.custom_path', {
          first: numbers.format(path[0]),
          last: numbers.format(path[path.length - 1]),
        })
      : `${numbers.format(fallback)}%`;
  const formatAsOf = (value: string | undefined) =>
    value ? dates.format(new Date(value)) : t('common.not_available');
  const taxLabel = (value: SharedComparisonConfig['taxStrategy']) =>
    t(
      value === 'IKE'
        ? 'bonds.tax_ike'
        : value === 'IKZE'
          ? 'bonds.tax_ikze'
          : 'bonds.tax_standard',
    );
  const policyLabel = (value: SharedComparisonConfig['strategyPolicy']) =>
    t(
      value === 'cash_after_maturity'
        ? 'comparison.maturity_cash'
        : value === 'hold_to_maturity'
          ? 'comparison.maturity_hold'
          : 'comparison.maturity_reinvest',
    );
  const couponLabel = (value: SharedComparisonConfig['couponDisposition']) =>
    t(value === 'cash' ? 'comparison.coupon_cash' : 'comparison.coupon_reinvest');
  const sideDetail = (side: 'A' | 'B', value: string) =>
    t('comparison.draft_receipt.side_override', { side, value });
  const sharedPolicy = sharedConfig.strategyPolicy ?? 'reinvest_until_horizon';
  const sharedCoupon = sharedConfig.couponDisposition ?? 'reinvest';
  const sharedTax = sharedConfig.taxStrategy;
  const horizonOverrides = [
    scenarioA.investmentHorizonMonths !== undefined
      ? sideDetail(
          'A',
          `${numbers.format(scenarioA.investmentHorizonMonths)} ${t('common.month_compact')}`,
        )
      : null,
    scenarioB.investmentHorizonMonths !== undefined
      ? sideDetail(
          'B',
          `${numbers.format(scenarioB.investmentHorizonMonths)} ${t('common.month_compact')}`,
        )
      : null,
  ].filter(Boolean);
  const policyOverrides = [
    scenarioA.strategyPolicy ? sideDetail('A', policyLabel(scenarioA.strategyPolicy)) : null,
    scenarioB.strategyPolicy ? sideDetail('B', policyLabel(scenarioB.strategyPolicy)) : null,
  ].filter(Boolean);
  const couponOverrides = [
    scenarioA.couponDisposition ? sideDetail('A', couponLabel(scenarioA.couponDisposition)) : null,
    scenarioB.couponDisposition ? sideDetail('B', couponLabel(scenarioB.couponDisposition)) : null,
  ].filter(Boolean);
  const taxOverrides = [
    scenarioA.taxStrategy ? sideDetail('A', taxLabel(scenarioA.taxStrategy)) : null,
    scenarioB.taxStrategy ? sideDetail('B', taxLabel(scenarioB.taxStrategy)) : null,
  ].filter(Boolean);
  const items = [
    {
      label: t('comparison.draft_receipt.scenarios'),
      value: `${t('comparison.scenario_a')}: ${scenarioA.bondType} · ${t('comparison.scenario_b')}: ${scenarioB.bondType}`,
    },
    {
      label: t('comparison.draft_receipt.amount_horizon'),
      value: [
        `${numbers.format(sharedConfig.initialInvestment)} PLN · ${numbers.format(sharedConfig.investmentHorizonMonths ?? 120)} ${t('common.month_compact')}`,
        ...horizonOverrides,
      ].join(' · '),
    },
    {
      label: t('comparison.maturity_policy'),
      value: [policyLabel(sharedPolicy), ...policyOverrides].join(' · '),
    },
    {
      label: t('comparison.coupon_policy'),
      value: [couponLabel(sharedCoupon), ...couponOverrides].join(' · '),
    },
    {
      label: t('comparison.draft_receipt.cpi'),
      value: formatPath(sharedConfig.customInflation, sharedConfig.expectedInflation),
    },
    {
      label: t('comparison.draft_receipt.nbp'),
      value: formatPath(sharedConfig.customNbpRate, sharedConfig.expectedNbpRate ?? 5.25),
    },
    {
      label: t('bonds.tax_strategy'),
      value: [taxLabel(sharedTax), ...taxOverrides].join(' · '),
    },
  ];

  return (
    <section
      className="ui-plan-region space-y-4 px-5 py-5 md:px-6"
      aria-labelledby="comparison-draft-receipt-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="comparison-draft-receipt-title" className="ui-card-title">
            {t('comparison.draft_receipt.title')}
          </h2>
          <p className="mt-1 text-base leading-6 text-muted-foreground">
            {t('comparison.draft_receipt.description')}
          </p>
        </div>
        <a
          className="ui-focus-ring text-sm font-semibold text-primary underline underline-offset-4"
          href="#comparison-assumptions-setup"
        >
          {t('comparison.draft_receipt.edit_assumptions')}
        </a>
      </div>
      <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 border-l-2 border-border pl-3">
            <dt className="ui-kicker text-muted-foreground">{item.label}</dt>
            <dd className="mt-1 break-words text-base font-semibold leading-6 text-foreground">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-border pt-3 text-base leading-6 text-muted-foreground">
        {t('comparison.draft_receipt.reference_defaults', {
          source: t(
            defaults.usedFallback
              ? 'comparison.draft_receipt.fallback_source'
              : 'comparison.draft_receipt.synced_source',
          ),
          cpiDate: formatAsOf(defaults.inflationAsOf),
          nbpDate: formatAsOf(defaults.nbpAsOf),
        })}
      </p>
    </section>
  );
}
