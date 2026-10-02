'use client';
import { Scale, ShieldCheck, Zap } from 'lucide-react';
import React from 'react';

import { BondInputs, CalculationResult, TaxStrategy } from '@/features/bond-core/types';
import { useAppI18n } from '@/i18n/client';
import { InfoTooltip } from '@/shared/components/feedback/InfoTooltip';
interface ComparisonVerdictProps {
  resultsA: CalculationResult;
  resultsB: CalculationResult;
  inputsA: BondInputs;
  inputsB: BondInputs;
  expectedInflation: number;
  taxStrategy?: TaxStrategy;
  formatCurrency: (val: number) => string;
}
function getVerdictDrivers({
  winner,
  loser,
  expectedInflation,
  t,
}: {
  winner: BondInputs;
  loser: BondInputs;
  expectedInflation: number;
  t: ReturnType<typeof useAppI18n>['t'];
}) {
  const drivers = [
    t('comparison.verdict.driver_mode', {
      mode: t('comparison.auto_rollover_mode_label'),
    }),
  ];
  if (winner.duration !== loser.duration) {
    drivers.push(
      t('comparison.verdict.driver_duration', {
        winner: winner.bondType,
        loser: loser.bondType,
      }),
    );
  }
  if (winner.isCapitalized !== loser.isCapitalized) {
    drivers.push(
      t('comparison.verdict.driver_capitalization', {
        winner: winner.bondType,
      }),
    );
  }
  if (expectedInflation > 5 && winner.expectedInflation > 0) {
    drivers.push(t('comparison.verdict.driver_inflation'));
  }
  return drivers.slice(0, 3);
}
export const ComparisonVerdict: React.FC<ComparisonVerdictProps> = ({
  resultsA,
  resultsB,
  inputsA,
  inputsB,
  expectedInflation,
  taxStrategy,
  formatCurrency,
}) => {
  const { t } = useAppI18n();
  const comparisonSnapshotLabel = t('comparison.verdict_snapshot_label');
  const higherText = t('comparison.verdict.higher_net_payout');
  const resultAValue = resultsA.netPayoutValue;
  const resultBValue = resultsB.netPayoutValue;
  const betterBondType = resultAValue > resultBValue ? inputsA.bondType : inputsB.bondType;
  const betterScenarioLabel =
    resultAValue > resultBValue ? t('comparison.scenario_a') : t('comparison.scenario_b');
  const winnerInputs = resultAValue > resultBValue ? inputsA : inputsB;
  const loserInputs = resultAValue > resultBValue ? inputsB : inputsA;
  const verdictDrivers = getVerdictDrivers({
    winner: winnerInputs,
    loser: loserInputs,
    expectedInflation,
    t,
  });
  const gap = Math.abs(resultAValue - resultBValue);
  const horizonYears = Math.max(
    resultsA.timeline.length / 12,
    resultsB.timeline.length / 12,
  ).toFixed(1);
  return (
    <section className="ui-section-divider ui-control-stack">
      <div className="flex items-center gap-2">
        <Scale className="h-5 w-5 text-foreground" aria-hidden="true" />
        <h2 className="ui-section-title">{t('comparison.summary') ?? 'Simulation Summary'}</h2>
      </div>
      <div className="ui-surface-flush flex flex-col gap-6 p-5 md:flex-row md:items-center md:p-6">
        <div className="min-w-0 flex-1 ui-control-stack">
          <div className="flex items-center gap-3">
            <div className="ui-surface-inset px-4 py-3">
              <span className="ui-large-metric">{betterBondType}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">
                {comparisonSnapshotLabel}
              </p>
              <p className="ui-section-title">
                {betterScenarioLabel} {higherText}
              </p>
            </div>
          </div>

          <div className="ui-control-stack">
            <p className="ui-body font-medium">
              {t('comparison.verdict.headline', {
                bond: betterBondType,
                outcome: higherText,
                gap: formatCurrency(gap),
                years: horizonYears,
              })}
            </p>
            <InfoTooltip
              content={
                <>
                  <p>
                    {t('comparison.verdict.mode_context', {
                      mode: t('comparison.auto_rollover_mode_label'),
                    })}
                  </p>
                  <p className="mt-2">{t('comparison.verdict.caution_text')}</p>
                </>
              }
            />
          </div>

          <div className="ui-control-group">
            <div className="flex items-center gap-1">
              <p className="ui-metadata font-semibold text-muted-foreground">
                {t('comparison.verdict.drivers_title')}
              </p>
              <InfoTooltip
                content={
                  <ul className="space-y-2">
                    {verdictDrivers.map((driver) => (
                      <li key={driver}>{driver}</li>
                    ))}
                  </ul>
                }
              />
            </div>
          </div>

          <div className="ui-action-row border-t border-border pt-4">
            {resultAValue > resultBValue ? (
              <span className="inline-flex items-center gap-2 border-l-2 border-border pl-3 text-xs font-semibold text-muted-foreground">
                <Scale className="h-3 w-3" aria-hidden="true" />
                {resultsA.timeline.length / 12 < 4
                  ? t('comparison.verdict_short_term')
                  : t('comparison.verdict_long_term')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 border-l-2 border-border pl-3 text-xs font-semibold text-muted-foreground">
                <Scale className="h-3 w-3" aria-hidden="true" />
                {resultsB.timeline.length / 12 < 4
                  ? t('comparison.verdict_short_term')
                  : t('comparison.verdict_long_term')}
              </span>
            )}

            {expectedInflation > 5 ? (
              <span className="inline-flex items-center gap-2 border-l-2 border-warning pl-3 text-base font-semibold leading-6 text-warning">
                <Zap className="h-3 w-3" aria-hidden="true" />
                {t('comparison.verdict_high_inflation_badge')}
              </span>
            ) : null}

            {taxStrategy !== TaxStrategy.STANDARD ? (
              <span className="inline-flex items-center gap-2 border-l-2 border-border pl-3 text-xs font-semibold text-muted-foreground">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                {t('comparison.verdict_tax_wrapper_badge')}
              </span>
            ) : null}
          </div>
        </div>

        <div className="w-full md:w-52">
          <div className="ui-status-note ui-status-note-success flex-col px-4 py-5 text-center">
            <p className="mb-1 text-sm font-semibold text-muted-foreground">
              {t('comparison.verdict_gap_label')}
            </p>
            <p className="ui-large-metric">
              {Math.abs((resultAValue / Math.max(1, resultBValue) - 1) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
