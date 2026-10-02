import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RegularInvestmentInputs } from '@/features/bond-core/types';

import { RecurringGoalPlanner } from './RecurringGoalPlanner';

const postCalculation = vi.fn();
vi.mock('@/i18n/client', () => ({ useAppI18n: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/lib/calculation-client', () => ({
  postCalculation: (...args: unknown[]) => postCalculation(...args),
}));

describe('RecurringGoalPlanner', () => {
  beforeEach(() => postCalculation.mockReset());

  it('never sends a contribution below the API minimum', async () => {
    postCalculation.mockResolvedValue({ result: { finalNominalValue: 200 } });
    const user = userEvent.setup();
    render(
      <RecurringGoalPlanner
        inputs={{ contributionAmount: 100 } as RegularInvestmentInputs}
        onApply={vi.fn()}
      />,
    );
    await user.type(screen.getByRole('spinbutton', { name: 'Target amount in PLN' }), '100');
    await user.click(screen.getByRole('button', { name: 'Solve' }));
    await waitFor(() => expect(postCalculation).toHaveBeenCalled());
    expect(postCalculation.mock.calls[0][1].contributionAmount).toBe(100);
    expect(await screen.findByRole('status')).toBeTruthy();
  });

  it('reports an invalid target without sending a calculation request', async () => {
    const user = userEvent.setup();
    render(
      <RecurringGoalPlanner
        inputs={{ contributionAmount: 100 } as RegularInvestmentInputs}
        onApply={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Solve' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'bonds.simulation.regular_goal_invalid_target',
    );
    expect(postCalculation).not.toHaveBeenCalled();
  });
});
