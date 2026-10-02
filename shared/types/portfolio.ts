import type { UserInvestmentLot as StoredUserInvestmentLot, UserPortfolio } from '@/db/schema';

/** Browser-facing holding record. The database's legacy `amount` column is a bond quantity. */
export type UserInvestmentLot = Omit<StoredUserInvestmentLot, 'amount'> & {
  bondQuantity: string;
};

export type { UserPortfolio };

export function toHoldingLot(lot: StoredUserInvestmentLot): UserInvestmentLot {
  const { amount, ...holding } = lot;
  return { ...holding, bondQuantity: amount };
}
