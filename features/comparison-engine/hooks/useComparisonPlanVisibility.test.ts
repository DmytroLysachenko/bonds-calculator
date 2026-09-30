import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useComparisonPlanVisibility } from './useComparisonPlanVisibility';

describe('useComparisonPlanVisibility', () => {
  it('opens while there are no results and closes after a committed calculation', () => {
    const { result, rerender } = renderHook(
      ({ hasResults, isDirty }) => useComparisonPlanVisibility(hasResults, isDirty),
      { initialProps: { hasResults: false, isDirty: true } },
    );

    expect(result.current.isPlanOpen).toBe(true);

    act(() => rerender({ hasResults: true, isDirty: false }));
    expect(result.current.isPlanOpen).toBe(false);
  });

  it('does not hide a newer draft when an older calculation completes', () => {
    const { result, rerender } = renderHook(
      ({ hasResults, isDirty }) => useComparisonPlanVisibility(hasResults, isDirty),
      { initialProps: { hasResults: false, isDirty: true } },
    );
    act(() => rerender({ hasResults: true, isDirty: true }));
    expect(result.current.isPlanOpen).toBe(true);
  });
});
