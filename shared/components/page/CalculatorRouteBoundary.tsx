import { type ReactNode, Suspense } from 'react';

import type { BondDefinition } from '@/features/bond-core/constants/bond-definitions';
import type { BondType } from '@/features/bond-core/types';
import { PageSuspenseFallback } from '@/shared/components/page/PageSuspenseFallback';
import { PageTransition } from '@/shared/components/page/PageTransition';
import { BondDefinitionsBoundary } from '@/shared/components/providers/BondDefinitionsBoundary';

interface CalculatorRouteBoundaryProps {
  children: ReactNode;
  suspense?: boolean;
  transition?: boolean;
  initialDefinitions?: Record<BondType, BondDefinition>;
}

/** Shared server-page composition for calculator routes that need bond terms. */
export function CalculatorRouteBoundary({
  children,
  suspense = false,
  transition = false,
  initialDefinitions,
}: CalculatorRouteBoundaryProps) {
  const content = suspense ? (
    <Suspense fallback={<PageSuspenseFallback />}>
      <BondDefinitionsBoundary initialDefinitions={initialDefinitions}>
        {children}
      </BondDefinitionsBoundary>
    </Suspense>
  ) : (
    <BondDefinitionsBoundary initialDefinitions={initialDefinitions}>
      {children}
    </BondDefinitionsBoundary>
  );
  return transition ? <PageTransition>{content}</PageTransition> : content;
}
