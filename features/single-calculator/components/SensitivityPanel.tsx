'use client';

import { useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import type {
  SensitivityResponse,
  SensitivityVariable,
} from '@/features/bond-core/handlers/single-bond';
import type { BondInputs } from '@/features/bond-core/types';
import { useAppI18n } from '@/i18n/client';
import { postCalculation } from '@/shared/lib/calculation-client';

const presets: Record<SensitivityVariable, { before: number; after: number; step: number }> = {
  inflation: { before: 2, after: 2, step: 1 },
  nbp_rate: { before: 2, after: 2, step: 1 },
  horizon_months: { before: 12, after: 12, step: 6 },
};

export function SensitivityPanel({
  inputs,
  onPrepareDraft,
}: {
  inputs: BondInputs;
  onPrepareDraft: (inputs: BondInputs) => void;
}) {
  const { t } = useAppI18n();
  const [variable, setVariable] = useState<SensitivityVariable>('inflation');
  const [response, setResponse] = useState<SensitivityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const baseline = useMemo(() => {
    if (variable === 'inflation') return inputs.expectedInflation;
    if (variable === 'nbp_rate') return inputs.expectedNbpRate ?? 0;
    return inputs.investmentHorizonMonths ?? 12;
  }, [inputs.expectedInflation, inputs.expectedNbpRate, inputs.investmentHorizonMonths, variable]);

  const run = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const preset = presets[variable];
    const start = Math.max(variable === 'horizon_months' ? 1 : -20, baseline - preset.before);
    const end = Math.min(variable === 'horizon_months' ? 360 : 100, baseline + preset.after);
    setIsRunning(true);
    setError(null);
    try {
      const next = await postCalculation<SensitivityResponse>(
        '/api/calculate/sensitivity',
        { inputs, variable, start, end, step: preset.step },
        controller.signal,
      );
      if (!controller.signal.aborted) setResponse(next);
    } catch (caught) {
      if (!controller.signal.aborted)
        setError(
          caught instanceof Error ? caught.message : t('bonds.simulation.sensitivity.failed'),
        );
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      if (!controller.signal.aborted) setIsRunning(false);
    }
  };
  const cancel = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsRunning(false);
  };
  const prepare = (value: number) => {
    if (variable === 'inflation') onPrepareDraft({ ...inputs, expectedInflation: value });
    else if (variable === 'nbp_rate') onPrepareDraft({ ...inputs, expectedNbpRate: value });
    else {
      const date = new Date(`${inputs.purchaseDate}T00:00:00`);
      date.setMonth(date.getMonth() + value);
      onPrepareDraft({
        ...inputs,
        investmentHorizonMonths: value,
        withdrawalDate: date.toISOString().slice(0, 10),
      });
    }
  };

  return (
    <section
      className="rounded-lg border border-border bg-card p-4"
      aria-labelledby="sensitivity-title"
    >
      <h2 id="sensitivity-title" className="ui-heading-sm">
        {t('bonds.simulation.sensitivity.title')}
      </h2>
      <p className="ui-meta mt-1 text-muted-foreground">
        {t('bonds.simulation.sensitivity.description')}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="ui-meta" htmlFor="sensitivity-variable">
          {t('bonds.simulation.sensitivity.variable')}
        </label>
        <select
          id="sensitivity-variable"
          className="rounded border border-input bg-background px-2 py-1 text-sm"
          value={variable}
          disabled={isRunning}
          onChange={(event) => {
            setVariable(event.target.value as SensitivityVariable);
            setResponse(null);
          }}
        >
          <option value="inflation">{t('bonds.simulation.sensitivity.inflation')}</option>
          <option value="nbp_rate">{t('bonds.simulation.sensitivity.nbp_rate')}</option>
          <option value="horizon_months">{t('bonds.simulation.sensitivity.horizon')}</option>
        </select>
        {isRunning ? (
          <Button type="button" variant="outline" onClick={cancel}>
            {t('common.cancel')}
          </Button>
        ) : (
          <Button type="button" onClick={run}>
            {t('bonds.simulation.sensitivity.run')}
          </Button>
        )}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {response ? (
        <div className="mt-4 overflow-x-auto">
          <p className="ui-meta mb-2 text-muted-foreground">
            {t('bonds.simulation.sensitivity.snapshot')}
          </p>
          <div
            className="mb-3 flex h-16 items-end gap-1 border-b border-border px-1"
            role="img"
            aria-label={t('bonds.simulation.sensitivity.chart_label')}
          >
            {response.points.map((point) => {
              const values = response.points
                .map((item) => item.netPayoutValue)
                .filter((item): item is number => item !== undefined);
              const min = Math.min(...values);
              const max = Math.max(...values);
              const height =
                point.netPayoutValue === undefined || max === min
                  ? 4
                  : 8 + ((point.netPayoutValue - min) / (max - min)) * 52;
              return (
                <div
                  key={point.value}
                  className="min-w-2 flex-1 rounded-t bg-primary"
                  style={{ height: `${height}px` }}
                  title={`${point.value}: ${point.netPayoutValue?.toFixed(2) ?? point.error}`}
                />
              );
            })}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th scope="col">{t('bonds.simulation.sensitivity.value')}</th>
                <th scope="col">{t('bonds.simulation.sensitivity.payout')}</th>
                <th scope="col">{t('bonds.simulation.sensitivity.profit')}</th>
                <th scope="col">
                  <span className="sr-only">{t('bonds.simulation.sensitivity.prepare')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {response.points.map((point) => (
                <tr key={point.value} className="border-b">
                  <td className="py-2">
                    {point.value}
                    {variable === 'horizon_months' ? ` ${t('common.month_compact')}` : '%'}
                  </td>
                  <td>{point.error ? '—' : point.netPayoutValue?.toFixed(2)}</td>
                  <td>{point.error ? point.error : point.totalProfit?.toFixed(2)}</td>
                  <td>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={Boolean(point.error)}
                      onClick={() => prepare(point.value)}
                    >
                      {t('bonds.simulation.sensitivity.prepare')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ui-meta mt-2 text-muted-foreground">
            {t('bonds.simulation.sensitivity.draft_notice')}
          </p>
          {response.crossings.length ? (
            <p className="ui-meta mt-2">
              {t('bonds.simulation.sensitivity.crossings', { count: response.crossings.length })}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
