import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { isCalculatorInputEnter } from './calculator-keyboard-submit';

describe('calculator Enter shortcut', () => {
  it('accepts Enter from value inputs only, not mode buttons or date controls', () => {
    const calculate = vi.fn();
    render(
      <div onKeyDown={(event) => isCalculatorInputEnter(event) && calculate()}>
        <input aria-label="Amount" type="number" />
        <input aria-label="Date" type="date" />
        <button type="button">Advanced mode</button>
        <div role="dialog" aria-label="Edit">
          <input aria-label="Dialog amount" type="number" />
        </div>
      </div>,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'Advanced mode' }), { key: 'Enter' });
    fireEvent.keyDown(screen.getByLabelText('Date'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByLabelText('Dialog amount'), { key: 'Enter' });
    expect(calculate).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByLabelText('Amount'), { key: 'Enter' });
    expect(calculate).toHaveBeenCalledOnce();
  });
});
