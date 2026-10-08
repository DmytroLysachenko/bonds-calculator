'use client';

import type { ReactNode } from 'react';

import type { BondDefinition } from '@/features/bond-core/constants/bond-definitions';
import type { BondType } from '@/features/bond-core/types';
import { BondDefinitionsProvider } from '@/shared/context/BondDefinitionsContext';

/**
 * Loads offer definitions only on routes that need interactive bond terms.
 * Navigation, authentication, and informational routes stay outside this
 * client resource boundary.
 */
export function BondDefinitionsBoundary({
  children,
  initialDefinitions,
}: {
  children: ReactNode;
  initialDefinitions?: Record<BondType, BondDefinition>;
}) {
  return (
    <BondDefinitionsProvider initialDefinitions={initialDefinitions}>
      {children}
    </BondDefinitionsProvider>
  );
}
