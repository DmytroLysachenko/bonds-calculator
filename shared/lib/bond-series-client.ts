import { BondType } from '@/features/bond-core/types';
import { apiGet } from '@/shared/lib/api-client';

export interface BondSeriesMetadata {
  id: string;
  seriesCode: string;
  firstYearRate: string | number;
  baseMargin: string | number | null;
  emissionMonth: string;
  sellStartDate?: string;
  sellEndDate?: string;
  maturityDate?: string;
  earlyWithdrawalFee?: string | number | null;
  termsSourceUrl?: string | null;
  termsRevision?: string | null;
  redemptionFeeCap?: string | null;
}

export const bondSeriesClient = {
  listAll() {
    return apiGet<BondSeriesMetadata[]>('/api/calculate/bond-series');
  },
  listBySymbol(symbol: BondType) {
    const params = new URLSearchParams({ symbol });
    return apiGet<BondSeriesMetadata[]>(`/api/calculate/bond-series?${params.toString()}`);
  },
};
