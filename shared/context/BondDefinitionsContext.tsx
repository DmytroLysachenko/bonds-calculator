'use client';

import React, { createContext, ReactNode, useContext } from 'react';

import { BondDefinition } from '@/features/bond-core/constants/bond-definitions';
import { BondType } from '@/features/bond-core/types';
import { useBondDefinitions as useBondDefinitionsHook } from '@/shared/hooks/useBondDefinitions';

interface BondDefinitionsContextType {
  definitions: Record<BondType, BondDefinition> | null;
  isLoading: boolean;
  error: Error | null;
}

const BondDefinitionsContext = createContext<BondDefinitionsContextType | undefined>(undefined);

export function BondDefinitionsProvider({
  children,
  initialDefinitions,
}: {
  children: ReactNode;
  initialDefinitions?: Record<BondType, BondDefinition>;
}) {
  const { definitions, isLoading, error } = useBondDefinitionsHook(initialDefinitions);

  return (
    <BondDefinitionsContext.Provider value={{ definitions, isLoading, error }}>
      {children}
    </BondDefinitionsContext.Provider>
  );
}

export function useBondDefinitions() {
  const context = useContext(BondDefinitionsContext);
  if (context === undefined) {
    throw new Error('useBondDefinitions must be used within a BondDefinitionsProvider');
  }
  return context;
}
