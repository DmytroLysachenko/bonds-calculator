import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RetirementMonthlyTable } from '@/features/retirement/components/RetirementMonthlyTable';

describe('retirement monthly table', () => {
  it('shows the initial and exhaustion rows with only the amount actually paid', () => {
    render(
      <RetirementMonthlyTable
        timeline={[
          { year: 0, month: 0, date: '2026-01-01', balance: 100, withdrawal: 0 },
          { year: 0, month: 1, date: '2026-02-01', balance: 10, withdrawal: 90 },
          { year: 0, month: 2, date: '2026-03-01', balance: 0, withdrawal: 10 },
        ]}
        title="Monthly balance and withdrawals"
        description="Actual paid withdrawals"
        dateLabel="Date"
        balanceLabel="Balance"
        withdrawalLabel="Withdrawal"
        formatCurrency={(value) => `${value} PLN`}
      />,
    );
    fireEvent.click(screen.getByText('Monthly balance and withdrawals', { selector: 'summary' }));
    const table = screen.getByRole('table', { name: 'Monthly balance and withdrawals' });
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getByRole('row', { name: /2026-01-01/ }).textContent).toContain('0 PLN');
    expect(within(table).getByRole('row', { name: /2026-03-01/ }).textContent).toContain('10 PLN');
    expect(within(table).getByRole('row', { name: /2026-03-01/ }).textContent).toContain('0 PLN');
  });
});
