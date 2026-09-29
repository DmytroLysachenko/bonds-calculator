import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdvancedRatePathSection } from './AdvancedRatePathSection';
import { ProjectedRatePathEditor } from './ProjectedRatePathEditor';

describe('projected rate path fields', () => {
  it('associates unique visible labels and distinct accessible names', () => {
    render(
      <>
        <ProjectedRatePathEditor
          values={[3, 4]}
          prefix="Y"
          variableLabel="Inflation"
          min={-20}
          max={100}
          step={0.1}
          onChange={() => {}}
        />
        <ProjectedRatePathEditor
          values={[5, 6]}
          prefix="Y"
          variableLabel="NBP reference rate"
          min={-10}
          max={100}
          step={0.1}
          onChange={() => {}}
        />
      </>,
    );
    expect(screen.getByRole('spinbutton', { name: 'Inflation, Y1' }).id).not.toBe(
      screen.getByRole('spinbutton', { name: 'NBP reference rate, Y1' }).id,
    );
    expect(screen.getAllByText('Y1')).toHaveLength(2);
  });

  it('associates the advanced-path help with every yearly input', () => {
    render(
      <AdvancedRatePathSection
        title="Inflation path"
        description="Enter an annual CPI assumption for each year."
        emptyNote="No path"
        values={[2, 3]}
        min={-20}
        max={100}
        step={0.1}
        onChange={() => {}}
      />,
    );
    for (const field of screen.getAllByRole('spinbutton')) {
      expect(
        document.getElementById(field.getAttribute('aria-describedby') ?? '')?.textContent,
      ).toBe('Enter an annual CPI assumption for each year.');
    }
  });
});
