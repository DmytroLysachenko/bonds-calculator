import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InvestmentFrequency, TaxStrategy } from '@/features/bond-core/types';
import { ContributionPlanSection } from '@/features/regular-investment/components/inputs/ContributionPlanSection';

vi.mock('@/i18n/client', () => ({ useAppI18n: () => ({ t: (key: string) => key, locale: 'pl' }) }));
vi.mock('@/shared/components/forms/FormSelect', () => ({ FormSelect: () => <div /> }));
vi.mock('@/shared/components/forms/RangeField', () => ({ RangeField: () => <div /> }));

const base = {
  contributionAmount: 100,
  initialLumpSum: 0,
  annualContributionIncreasePercent: 0,
  oneOffContributions: [],
  skippedContributionDates: [],
  contributionOverrides: [],
  previewRows: [{ date: '2026-10-01', amount: 1234.5, kind: 'base' as const }],
  investmentHorizonMonths: 12,
  language: 'pl' as const,
  frequency: InvestmentFrequency.MONTHLY,
  taxStrategy: TaxStrategy.STANDARD,
  t: (key: string) => key,
};

describe('contribution schedule edits', () => {
  it('keeps one quantity editor and a derived PLN value in the default view', () => {
    const onUpdate = vi.fn();
    const { rerender } = render(<ContributionPlanSection {...base} onUpdate={onUpdate} />);
    expect(screen.getAllByLabelText('bonds.bond_quantity')).toHaveLength(1);
    expect(
      screen.getByText('regular_investment_page.schedule_details').closest('details')?.open,
    ).toBe(false);
    expect(screen.getByTestId('regular-plan-summary').textContent).toContain('12');
    fireEvent.change(screen.getByLabelText('bonds.bond_quantity'), { target: { value: '3' } });
    expect(onUpdate).toHaveBeenCalledWith('contributionAmount', 300);
    rerender(<ContributionPlanSection {...base} contributionAmount={300} onUpdate={onUpdate} />);
    expect(screen.getByLabelText('regular_investment_page.equivalent_pln').textContent).toContain(
      '300',
    );
  });

  it('labels both inputs, explains actions, and formats preview for the chosen locale', async () => {
    render(<ContributionPlanSection {...base} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByText('regular_investment_page.schedule_details'));
    expect(screen.getByLabelText('regular_investment_page.topup_date')).toBeTruthy();
    expect(screen.getByLabelText('regular_investment_page.topup_amount')).toBeTruthy();
    expect(screen.getByText('regular_investment_page.skip_date_help')).toBeTruthy();
    expect(screen.getByText('regular_investment_page.date_format_hint')).toBeTruthy();
    expect(screen.getAllByText(/paź 2026/).length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(
        screen.getByText(
          (_, node) => node?.tagName === 'TD' && Boolean(node.textContent?.includes('234,50')),
        ),
      ).toBeTruthy(),
    );
  });

  it('shows adjacent errors and keeps skip date-only while add and replace require amounts', () => {
    const onUpdate = vi.fn();
    render(<ContributionPlanSection {...base} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText('regular_investment_page.schedule_details'));
    fireEvent.click(screen.getByRole('button', { name: 'regular_investment_page.add_topup' }));
    expect(screen.getByText('regular_investment_page.topup_date_error')).toBeTruthy();
    expect(screen.getByText('regular_investment_page.topup_amount_error')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('regular_investment_page.topup_date'), {
      target: { value: '2026-11-05' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'regular_investment_page.skip_date' }));
    expect(onUpdate).toHaveBeenCalledWith('skippedContributionDates', ['2026-11-05']);
    fireEvent.click(screen.getByRole('button', { name: 'regular_investment_page.override_date' }));
    expect(screen.getByText('regular_investment_page.override_amount_error')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('regular_investment_page.topup_amount'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'regular_investment_page.override_date' }));
    expect(onUpdate).toHaveBeenCalledWith('contributionOverrides', [
      { date: '2026-11-05', amount: 0 },
    ]);
  });
});
