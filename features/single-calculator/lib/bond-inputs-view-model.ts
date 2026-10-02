import type { BondInputs } from '@/features/bond-core/types';
import { getHorizonMonths } from '@/shared/lib/date-timing';
import {
  isFloatingNbpBondType,
  isInflationIndexedBondType,
} from '@/shared/lib/market-assumption-semantics';

export function buildBondInputsViewModel(inputs: BondInputs) {
  const investmentHorizonMonths =
    inputs.investmentHorizonMonths ?? getHorizonMonths(inputs.purchaseDate, inputs.withdrawalDate);

  return {
    investmentHorizonMonths,
    investmentHorizonYears: Math.max(1 / 12, investmentHorizonMonths / 12),
    assumptionHorizonYears: Math.max(1, Math.ceil(investmentHorizonMonths / 12)),
    usesInflation: isInflationIndexedBondType(inputs.bondType),
    usesNbpRate: isFloatingNbpBondType(inputs.bondType),
  };
}
