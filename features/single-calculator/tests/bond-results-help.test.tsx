import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CalculationResult } from '@/features/bond-core/types';
import { MathDeepDive } from '@/shared/components/insights/MathDeepDive';

import { CalculationDetailsTrigger } from '../components/BondResultsSummary';

vi.mock('@/i18n/client', () => ({
  useAppI18n: () => ({ t: (key: string) => key, locale: 'en' }),
}));

vi.mock('@/shared/hooks/useLocalizedFormatters', () => ({
  useCurrencyFormatter: () =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PLN' }),
}));

describe('bond result calculation-details trigger', () => {
  it('is keyboard reachable and opens the calculation details sheet', async () => {
    const user = userEvent.setup();
    const results = {
      grossValue: 1200,
      initialInvestment: 1000,
      totalTax: 20,
      totalEarlyWithdrawalFee: 0,
      netPayoutValue: 1180,
    } as CalculationResult;

    render(
      <MathDeepDive
        results={results}
        inputs={{ margin: 1.5, isCapitalized: true }}
        trigger={<CalculationDetailsTrigger />}
      />,
    );

    const trigger = screen.getByRole('button', {
      name: 'bonds.results.show_calculation_details',
    });
    await user.tab();
    expect(document.activeElement).toBe(trigger);
    await user.keyboard('{Enter}');

    expect(await screen.findByText('bonds.how_calculated')).toBeTruthy();
    expect(screen.getByText('bonds.how_interest_works')).toBeTruthy();
  });
});
