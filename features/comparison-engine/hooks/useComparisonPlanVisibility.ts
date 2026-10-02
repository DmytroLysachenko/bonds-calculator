'use client';

import { useEffect, useRef, useState } from 'react';

/** Owns the plan/results visibility transition independently from the comparison view. */
export function useComparisonPlanVisibility(hasResults: boolean, isDirty: boolean) {
  const [isPlanOpen, setIsPlanOpen] = useState(!hasResults);
  const previousHasResults = useRef(hasResults);
  const previousIsDirty = useRef(isDirty);

  useEffect(() => {
    const receivedFirstResult = !previousHasResults.current && hasResults;
    const committedEditedPlan = previousIsDirty.current && !isDirty && hasResults;

    if (!hasResults) {
      setIsPlanOpen(true);
    } else if (!isDirty && (receivedFirstResult || committedEditedPlan)) {
      setIsPlanOpen(false);
    }

    previousHasResults.current = hasResults;
    previousIsDirty.current = isDirty;
  }, [hasResults, isDirty]);

  return { isPlanOpen, setIsPlanOpen };
}
