import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CalculatorWorkspace } from './CalculatorWorkspace';

vi.mock('@/i18n/client', () => ({
  useAppI18n: () => ({ t: (key: string) => key, locale: 'en' }),
}));

describe('calculator workspace focus transitions', () => {
  it('restores focus when a committed result replaces the controls', () => {
    const props = {
      controls: <input aria-label="Investment" />,
      results: <p>Value</p>,
      scenarioSummary: [{ label: 'Bond', value: 'EDO' }],
    };
    const view = render(<CalculatorWorkspace {...props} />);
    screen.getByRole('textbox', { name: 'Investment' }).focus();
    view.rerender(<CalculatorWorkspace {...props} hasResults />);
    expect(screen.getByRole('button', { name: 'common.edit_plan' })).toBe(document.activeElement);
    fireEvent.click(screen.getByRole('button', { name: 'common.edit_plan' }));
    expect(screen.getByRole('textbox', { name: 'Investment' })).toBe(document.activeElement);
    fireEvent.click(screen.getByRole('button', { name: 'common.close_plan' }));
    expect(screen.getByRole('button', { name: 'common.edit_plan' })).toBe(document.activeElement);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('focuses results when a focused submit action disappears after a successful run', () => {
    const props = {
      controls: <input aria-label="Investment" />,
      results: <p>Value</p>,
      scenarioSummary: [{ label: 'Bond', value: 'EDO' }],
    };
    const view = render(
      <>
        <CalculatorWorkspace {...props} isCalculating />
        <button type="button">Calculate</button>
      </>,
    );
    screen.getByRole('button', { name: 'Calculate' }).focus();
    view.rerender(<CalculatorWorkspace {...props} hasResults />);
    expect(document.activeElement).toBe(document.getElementById('calculator-results'));
  });

  it('recovers body focus when the result commits after loading already ended', () => {
    const props = {
      controls: <input aria-label="Investment" />,
      results: <p>Value</p>,
      scenarioSummary: [{ label: 'Bond', value: 'EDO' }],
    };
    const view = render(<CalculatorWorkspace {...props} />);
    view.rerender(<CalculatorWorkspace {...props} hasResults />);
    expect(document.activeElement).toBe(document.getElementById('calculator-results'));
  });

  it('keeps a newer edited draft open when an older result arrives', () => {
    const props = {
      controls: <input aria-label="Investment" />,
      results: <p>Value</p>,
      scenarioSummary: [{ label: 'Bond', value: 'EDO' }],
    };
    const view = render(<CalculatorWorkspace {...props} isCalculating isDirty />);
    screen.getByRole('textbox', { name: 'Investment' }).focus();
    view.rerender(<CalculatorWorkspace {...props} hasResults isDirty />);
    expect(screen.getByRole('textbox', { name: 'Investment' })).toBe(document.activeElement);
  });
});
