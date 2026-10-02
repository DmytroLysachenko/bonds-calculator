import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BondType, TaxStrategy } from '@/features/bond-core/types';

import { buildDefaultSharedConfig } from '../lib/comparison-calculator-state';

import { ComparisonDraftAssumptionsReceipt } from './ComparisonDraftAssumptionsReceipt';

vi.mock('@/i18n/client', () => ({
  useAppI18n: () => ({
    locale: 'en',
    t: (key: string, values?: Record<string, string | number>) =>
      values ? `${key} ${Object.values(values).join(' · ')}` : key,
  }),
}));

vi.mock('@/shared/hooks/useMacroAssumptionDefaults', () => ({
  useMacroAssumptionDefaults: () => ({
    defaults: {
      expectedInflation: 2.5,
      expectedNbpRate: 5.25,
      inflationAsOf: '2026-08-01',
      nbpAsOf: '2026-09-01',
      usedFallback: true,
    },
  }),
}));

describe('ComparisonDraftAssumptionsReceipt', () => {
  it('shows the active draft separately from fallback reference dates before Calculate', () => {
    render(
      <ComparisonDraftAssumptionsReceipt
        sharedConfig={{
          ...buildDefaultSharedConfig(new Date('2026-09-29')),
          initialInvestment: 25_000,
          investmentHorizonMonths: 60,
          expectedInflation: 3.5,
          expectedNbpRate: 4.25,
          taxStrategy: TaxStrategy.IKE,
        }}
        scenarioA={{ bondType: BondType.EDO, isRebought: false }}
        scenarioB={{ bondType: BondType.ROR, isRebought: false }}
      />,
    );

    const receipt = screen.getByRole('region', {
      name: 'comparison.draft_receipt.title',
    });
    expect(receipt.textContent).toContain('EDO');
    expect(receipt.textContent).toContain('ROR');
    expect(receipt.textContent).toContain('25,000 PLN');
    expect(receipt.textContent).toContain('60 common.month_compact');
    expect(receipt.textContent).toContain('3.5%');
    expect(receipt.textContent).toContain('4.25%');
    expect(receipt.textContent).toContain('bonds.tax_ike');
    expect(receipt.textContent).toContain('comparison.draft_receipt.fallback_source');
    expect(receipt.textContent).toContain('1 Aug 2026');
    expect(receipt.textContent).toContain('1 Sept 2026');
    expect(
      screen
        .getByRole('link', { name: 'comparison.draft_receipt.edit_assumptions' })
        .getAttribute('href'),
    ).toBe('#comparison-assumptions-setup');
  });

  it('identifies custom CPI and NBP paths instead of reporting only flat values', () => {
    render(
      <ComparisonDraftAssumptionsReceipt
        sharedConfig={{
          ...buildDefaultSharedConfig(new Date('2026-09-29')),
          customInflation: [3, 4, 5],
          customNbpRate: [5, 4, 3],
        }}
        scenarioA={{ bondType: BondType.EDO, isRebought: false }}
        scenarioB={{
          bondType: BondType.ROR,
          isRebought: false,
          taxStrategy: TaxStrategy.IKZE,
          investmentHorizonMonths: 36,
          strategyPolicy: 'cash_after_maturity',
        }}
      />,
    );

    const paths = screen.getAllByText(/comparison.draft_receipt.custom_path/);
    expect(paths).toHaveLength(2);
    expect(paths[0].textContent).toContain('3 · 5');
    expect(paths[1].textContent).toContain('5 · 3');
    const receipt = screen.getByRole('region', { name: 'comparison.draft_receipt.title' });
    expect(receipt.textContent).toContain('36 common.month_compact');
    expect(receipt.textContent).toContain('comparison.maturity_cash');
    expect(receipt.textContent).toContain('bonds.tax_ikze');
  });
});
