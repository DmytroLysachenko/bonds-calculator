import { addDays, addMonths, isAfter, parseISO } from 'date-fns';

import { type BondDefinition } from '@/features/bond-core/constants/bond-definitions';
import { type BondType } from '@/features/bond-core/types';
import { type UserInvestmentLot } from '@/shared/types/portfolio';

export type ProjectedMaturity = UserInvestmentLot & { maturityDate: Date; value: number };

export function buildPortfolioDetailProjection({
  lots,
  definitions,
  now,
  maturityWindowDays,
}: {
  lots: UserInvestmentLot[];
  definitions: Record<BondType, BondDefinition> | null;
  now: Date;
  maturityWindowDays: number;
}) {
  const totalValue = lots.reduce((sum, lot) => sum + Number(lot.bondQuantity) * 100, 0);
  const upcomingMaturities: ProjectedMaturity[] = !definitions
    ? []
    : lots
        .map((lot) => {
          const definition = definitions[lot.bondType as BondType];
          if (!definition) return null;
          return {
            ...lot,
            // Bond terms are calendar-month terms, not a fixed number of
            // days. This stays aligned with the engine at leap years and
            // month ends.
            maturityDate: addMonths(
              parseISO(lot.purchaseDate),
              Math.round(definition.duration * 12),
            ),
            value: Number(lot.bondQuantity) * 100,
          };
        })
        .filter(
          (item): item is ProjectedMaturity => item !== null && isAfter(item.maturityDate, now),
        )
        .sort((left, right) => left.maturityDate.getTime() - right.maturityDate.getTime());
  const filteredMaturities = upcomingMaturities.filter(
    (item) => item.maturityDate <= addDays(now, maturityWindowDays),
  );

  return {
    totalValue,
    upcomingMaturities,
    filteredMaturities,
    upcomingCashflow: filteredMaturities.reduce((sum, item) => sum + item.value, 0),
    nextMaturity: upcomingMaturities[0] ?? null,
  };
}
