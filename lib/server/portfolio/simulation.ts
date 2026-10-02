import { addYears, format } from 'date-fns';

import { BondType, TaxStrategy } from '@/features/bond-core/types';
import { PortfolioSimulationPayload } from '@/features/bond-core/types/scenarios';

type PortfolioLotLike = {
  bondType: string;
  bondSeriesId?: string | null;
  amount: string | number;
  purchaseDate: string;
  isRebought?: boolean | null;
};

export function buildPortfolioSimulationPayload(
  lots: PortfolioLotLike[],
  options?: {
    expectedInflation?: number;
    expectedNbpRate?: number;
    withdrawalDate?: string;
    rollover?: boolean;
    taxStrategy?: TaxStrategy;
  },
): PortfolioSimulationPayload {
  const withdrawalDate = options?.withdrawalDate ?? format(addYears(new Date(), 10), 'yyyy-MM-dd');

  return {
    investments: lots.map((lot) => ({
      bondType: lot.bondType as BondType,
      amount: Number(lot.amount) * 100,
      purchaseDate: lot.purchaseDate,
      selectedSeriesId: lot.bondSeriesId ?? null,
      isRebought: lot.isRebought ?? false,
      taxStrategy: options?.taxStrategy ?? TaxStrategy.STANDARD,
      rollover: options?.rollover ?? true,
    })),
    expectedInflation: options?.expectedInflation ?? 3.5,
    expectedNbpRate: options?.expectedNbpRate ?? 5.25,
    withdrawalDate,
  };
}
