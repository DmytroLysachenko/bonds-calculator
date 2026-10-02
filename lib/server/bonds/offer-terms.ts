import { addMonths, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';

import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import { BondDefinition } from '@/features/bond-core/constants/bond-definitions';
import { BondType } from '@/features/bond-core/types';
import {
  findActiveBondSeriesForDate,
  findBondDefinitionBySymbol,
  findBondSeriesByCodeForBond,
  findBondSeriesByIdForBond,
} from '@/lib/server/bonds/offer-terms-repository';
import { createServerLogger } from '@/lib/server/logging';

const logger = createServerLogger('BondOfferTerms');

export interface ResolvedBondOfferTerms {
  firstYearRate: number;
  margin: number;
  earlyWithdrawalFee?: number;
  redemptionFeeCap?: string;
  termsSourceUrl?: string;
  termsRevision?: string;
  termsAreVerified: boolean;
  source: 'series' | 'definition' | 'unresolved';
  seriesCode?: string;
  emissionMonth?: string;
  requestedSeriesId?: string;
}

export interface ResolvedStoredBondLotContext {
  bondTypeId: string | null;
  bondSeriesId: string | null;
  seriesCode?: string;
}

function getBondDurationMonths(definition: BondDefinition) {
  return Math.max(1, Math.round(definition.duration * 12));
}

function isPurchaseWithinSeriesWindow(
  purchaseDate: string,
  series: { sellStartDate: string; sellEndDate: string },
) {
  return purchaseDate >= series.sellStartDate && purchaseDate <= series.sellEndDate;
}

export function deriveSeriesCode(
  symbol: BondType,
  emissionMonth: string,
  definition: BondDefinition,
) {
  const maturityDate = addMonths(parseISO(emissionMonth), getBondDurationMonths(definition));
  return `${symbol}${format(maturityDate, 'MMyy')}`;
}

export function isValidSeriesCodeForEmission(
  symbol: BondType,
  emissionMonth: string,
  seriesCode: string,
  definition: BondDefinition,
) {
  return seriesCode.toUpperCase() === deriveSeriesCode(symbol, emissionMonth, definition);
}

export function deriveSeriesWindow(emissionMonth: string, definition: BondDefinition) {
  const emissionStart = startOfMonth(parseISO(emissionMonth));
  const sellStartDate = format(emissionStart, 'yyyy-MM-dd');
  const sellEndDate = format(endOfMonth(emissionStart), 'yyyy-MM-dd');
  const maturityDate = format(
    addMonths(emissionStart, getBondDurationMonths(definition)),
    'yyyy-MM-dd',
  );

  return {
    sellStartDate,
    sellEndDate,
    maturityDate,
  };
}

export async function resolveBondOfferTerms(
  bondType: BondType,
  purchaseDate: string,
  definitions: Record<BondType, BondDefinition>,
  selectedSeriesId?: string | null,
): Promise<ResolvedBondOfferTerms> {
  const definition = definitions[bondType] ?? BOND_DEFINITIONS[bondType];
  const fallback: ResolvedBondOfferTerms = {
    firstYearRate: definition.firstYearRate,
    margin: definition.margin,
    termsAreVerified: false,
    source: 'definition',
  };

  try {
    const bond = await findBondDefinitionBySymbol(bondType);

    if (!bond) {
      return fallback;
    }

    if (selectedSeriesId && selectedSeriesId !== 'current') {
      const exactSeries = await findBondSeriesByIdForBond(selectedSeriesId, bond.id);

      if (exactSeries && isPurchaseWithinSeriesWindow(purchaseDate, exactSeries)) {
        return {
          firstYearRate: Number(exactSeries.firstYearRate),
          margin: Number(exactSeries.baseMargin ?? 0),
          earlyWithdrawalFee:
            exactSeries.earlyWithdrawalFee === null
              ? undefined
              : Number(exactSeries.earlyWithdrawalFee),
          redemptionFeeCap: exactSeries.redemptionFeeCap ?? undefined,
          termsSourceUrl: exactSeries.termsSourceUrl ?? undefined,
          termsRevision: exactSeries.termsRevision ?? undefined,
          termsAreVerified: Boolean(exactSeries.termsSourceUrl && exactSeries.termsRevision),
          source: 'series',
          seriesCode: exactSeries.seriesCode,
          emissionMonth: exactSeries.emissionMonth,
        };
      }

      // A recorded or explicitly selected series is historical fact. Do not
      // silently replace it with the active offer when the catalogue cannot
      // verify it, or when its sale window does not cover the supplied date.
      return {
        ...fallback,
        source: 'unresolved',
        requestedSeriesId: selectedSeriesId,
      };
    }

    const activeSeries = await findActiveBondSeriesForDate(bond.id, purchaseDate);

    if (!activeSeries) {
      return fallback;
    }

    if (
      !isValidSeriesCodeForEmission(
        bondType,
        activeSeries.emissionMonth,
        activeSeries.seriesCode,
        definition,
      )
    ) {
      logger.warn('Ignoring stored bond series with mismatched emission metadata', {
        bondType,
        emissionMonth: activeSeries.emissionMonth,
        seriesCode: activeSeries.seriesCode,
      });
      return fallback;
    }

    return {
      firstYearRate: Number(activeSeries.firstYearRate),
      margin: Number(activeSeries.baseMargin ?? 0),
      earlyWithdrawalFee:
        activeSeries.earlyWithdrawalFee === null
          ? undefined
          : Number(activeSeries.earlyWithdrawalFee),
      redemptionFeeCap: activeSeries.redemptionFeeCap ?? undefined,
      termsSourceUrl: activeSeries.termsSourceUrl ?? undefined,
      termsRevision: activeSeries.termsRevision ?? undefined,
      termsAreVerified: Boolean(activeSeries.termsSourceUrl && activeSeries.termsRevision),
      source: 'series',
      seriesCode: activeSeries.seriesCode,
      emissionMonth: activeSeries.emissionMonth,
    };
  } catch (error) {
    logger.error('Failed to resolve bond offer terms', error);
    if (selectedSeriesId && selectedSeriesId !== 'current') {
      return {
        ...fallback,
        source: 'unresolved',
        requestedSeriesId: selectedSeriesId,
      };
    }
    return fallback;
  }
}

export async function resolveStoredBondLotContext(
  bondType: BondType,
  purchaseDate: string,
  selectedSeriesId?: string | null,
  selectedSeriesCode?: string | null,
): Promise<ResolvedStoredBondLotContext> {
  try {
    const bond = await findBondDefinitionBySymbol(bondType);

    if (!bond) {
      return { bondTypeId: null, bondSeriesId: null };
    }

    if (selectedSeriesId && selectedSeriesId !== 'current') {
      const exactSeries = await findBondSeriesByIdForBond(selectedSeriesId, bond.id);
      if (exactSeries && isPurchaseWithinSeriesWindow(purchaseDate, exactSeries)) {
        return {
          bondTypeId: bond.id,
          bondSeriesId: exactSeries.id,
          seriesCode: exactSeries.seriesCode,
        };
      }
      // UUIDs are database-local. A portable package may contain its source
      // UUID as trace metadata, but its public series code is authoritative.
      if (!selectedSeriesCode) return { bondTypeId: bond.id, bondSeriesId: null };
    }

    if (selectedSeriesCode) {
      const exactSeries = await findBondSeriesByCodeForBond(selectedSeriesCode, bond.id);
      return {
        bondTypeId: bond.id,
        bondSeriesId:
          exactSeries && isPurchaseWithinSeriesWindow(purchaseDate, exactSeries)
            ? exactSeries.id
            : null,
        seriesCode:
          exactSeries && isPurchaseWithinSeriesWindow(purchaseDate, exactSeries)
            ? exactSeries.seriesCode
            : undefined,
      };
    }

    const activeSeries = await findActiveBondSeriesForDate(bond.id, purchaseDate);

    return {
      bondTypeId: bond.id,
      bondSeriesId: activeSeries?.id ?? null,
      seriesCode: activeSeries?.seriesCode,
    };
  } catch (error) {
    logger.error('Failed to resolve stored bond lot context', error);
    return { bondTypeId: null, bondSeriesId: null };
  }
}
