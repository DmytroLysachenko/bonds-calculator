import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ComparisonPlanReceipt } from './ComparisonPlanReceipt';

const summary = [
  { label: 'Quantity', value: '100 bonds', editTargetId: 'comparison-shared-setup' },
  { label: 'Horizon', value: '10 years' },
];

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function renderReceipt(isOpen: boolean, onOpenChange = vi.fn()) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <ComparisonPlanReceipt
        isOpen={isOpen}
        planLabel="Scenario plan"
        editLabel="Edit plan"
        closeLabel="Close plan"
        summary={summary}
        onOpenChange={onOpenChange}
        jumpToResultsLabel="Jump to results"
      />,
    );
  });

  return onOpenChange;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('ComparisonPlanReceipt', () => {
  it('shows committed plan facts and reopens editing on request', () => {
    const onOpenChange = renderReceipt(false);

    expect(container?.querySelector('section')?.getAttribute('aria-label')).toBe('Scenario plan');
    expect(container?.textContent).toContain('100 bonds');

    act(() => {
      (
        Array.from(container?.querySelectorAll('button') ?? []).find((button) =>
          button.textContent?.includes('Edit plan: Quantity'),
        ) as HTMLButtonElement
      ).click();
    });

    expect(onOpenChange).toHaveBeenCalledWith(true, 'comparison-shared-setup');
    expect(container?.querySelector('a')?.getAttribute('href')).toBe('#comparison-results');
  });

  it('keeps close-plan control separate from receipt facts', () => {
    const onOpenChange = renderReceipt(true);

    expect(container?.querySelector('section')).toBeNull();
    expect(container?.textContent).toContain('Close plan');

    act(() => {
      (container?.querySelector('button') as HTMLButtonElement).click();
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
