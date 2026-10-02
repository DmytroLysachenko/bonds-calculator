'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BondType, RegularInvestmentInputs } from '@/features/bond-core/types';
import { type FieldUpdater } from '@/shared/types/field-updater';

export function AllocationStrategySection({
  inputs,
  onUpdate,
  t,
}: {
  inputs: RegularInvestmentInputs;
  onUpdate: FieldUpdater<RegularInvestmentInputs>;
  t: (key: string) => string;
}) {
  const targets = inputs.allocationTargets ?? [];
  const enabled = targets.length > 1;
  const benchmark = inputs.cashBenchmark ?? {
    annualRate: 0,
    capitalization: 'monthly' as const,
    taxRate: 19,
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onUpdate(
              'allocationTargets',
              enabled
                ? undefined
                : [
                    { bondType: BondType.COI, percent: 50 },
                    { bondType: BondType.EDO, percent: 50 },
                  ],
            )
          }
        >
          {enabled ? t('common.remove') : t('regular_investment_page.enable_allocation')}
        </Button>
      </div>
      {enabled ? (
        <>
          <p className="ui-meta text-muted-foreground">
            {t('regular_investment_page.allocation_note')}
          </p>
          {targets.map((target, index) => (
            <div className="grid grid-cols-2 gap-2" key={target.bondType}>
              <label htmlFor={`allocation-${target.bondType}`}>{target.bondType}</label>
              <Input
                id={`allocation-${target.bondType}`}
                type="number"
                min={0}
                max={100}
                value={target.percent}
                onChange={(event) =>
                  onUpdate(
                    'allocationTargets',
                    targets.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, percent: Number(event.target.value) } : item,
                    ),
                  )
                }
              />
            </div>
          ))}
          <div className="grid gap-2 sm:grid-cols-3">
            <label>
              {t('regular_investment_page.cash_rate')}
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={benchmark.annualRate}
                onChange={(event) =>
                  onUpdate('cashBenchmark', {
                    ...benchmark,
                    annualRate: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              {t('regular_investment_page.cash_capitalization')}
              <select
                className="mt-1 w-full rounded border border-input bg-background p-2"
                value={benchmark.capitalization}
                onChange={(event) =>
                  onUpdate('cashBenchmark', {
                    ...benchmark,
                    capitalization: event.target.value as 'monthly' | 'yearly',
                  })
                }
              >
                <option value="monthly">{t('regular_investment_page.monthly')}</option>
                <option value="yearly">{t('regular_investment_page.yearly')}</option>
              </select>
            </label>
            <label>
              {t('regular_investment_page.cash_tax')}
              <Input
                type="number"
                min={0}
                max={100}
                value={benchmark.taxRate}
                onChange={(event) =>
                  onUpdate('cashBenchmark', { ...benchmark, taxRate: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <p className="ui-meta text-muted-foreground">{t('regular_investment_page.cash_note')}</p>
        </>
      ) : null}
    </div>
  );
}
