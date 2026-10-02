import { and, desc, eq, gte, lte } from 'drizzle-orm';

import { db } from '@/db';
import { bondSeries, polishBonds } from '@/db/schema';
import type { BondType } from '@/features/bond-core/types';

export async function findBondDefinitionBySymbol(bondType: BondType) {
  return db.query.polishBonds.findFirst({
    where: eq(polishBonds.symbol, bondType),
  });
}

export async function findBondSeriesByIdForBond(seriesId: string, bondTypeId: string) {
  return db.query.bondSeries.findFirst({
    where: and(eq(bondSeries.id, seriesId), eq(bondSeries.bondTypeId, bondTypeId)),
  });
}

export async function findBondSeriesByCodeForBond(seriesCode: string, bondTypeId: string) {
  return db.query.bondSeries.findFirst({
    where: and(eq(bondSeries.seriesCode, seriesCode), eq(bondSeries.bondTypeId, bondTypeId)),
  });
}

export async function findActiveBondSeriesForDate(bondTypeId: string, purchaseDate: string) {
  return db.query.bondSeries.findFirst({
    // An issued series is purchasable only during its actual sale window.
    // Selecting the latest prior emission month incorrectly represented a
    // missing month as an older offer still being for sale.
    where: and(
      eq(bondSeries.bondTypeId, bondTypeId),
      lte(bondSeries.sellStartDate, purchaseDate),
      gte(bondSeries.sellEndDate, purchaseDate),
    ),
    orderBy: [desc(bondSeries.emissionMonth)],
  });
}

export async function updatePolishBondOfferTerms(
  bondType: BondType,
  offer: {
    firstYearRate: string;
    margin: string;
  },
) {
  await db
    .update(polishBonds)
    .set({
      firstYearRate: offer.firstYearRate,
      baseMargin: offer.margin,
      updatedAt: new Date(),
    })
    .where(eq(polishBonds.symbol, bondType));
}

export interface BondSeriesOfferUpsert {
  bondTypeId: string;
  seriesCode: string;
  emissionMonth: string;
  sellStartDate: string;
  sellEndDate: string;
  maturityDate: string;
  firstYearRate: string;
  margin: string;
  earlyWithdrawalFee?: string;
  redemptionFeeCap?: string;
  termsSourceUrl?: string;
  termsRevision?: string;
}

/** A rate-only sync must not clear reviewed historical fee or source evidence. */
export function bondSeriesOfferConflictValues(offer: BondSeriesOfferUpsert) {
  return {
    firstYearRate: offer.firstYearRate,
    baseMargin: offer.margin,
    sellStartDate: offer.sellStartDate,
    sellEndDate: offer.sellEndDate,
    maturityDate: offer.maturityDate,
    ...(offer.earlyWithdrawalFee !== undefined
      ? { earlyWithdrawalFee: offer.earlyWithdrawalFee }
      : {}),
    ...(offer.redemptionFeeCap !== undefined ? { redemptionFeeCap: offer.redemptionFeeCap } : {}),
    ...(offer.termsSourceUrl !== undefined ? { termsSourceUrl: offer.termsSourceUrl } : {}),
    ...(offer.termsRevision !== undefined ? { termsRevision: offer.termsRevision } : {}),
  };
}

export async function upsertBondSeriesOffer(offer: BondSeriesOfferUpsert) {
  await db
    .insert(bondSeries)
    .values({
      bondTypeId: offer.bondTypeId,
      seriesCode: offer.seriesCode,
      emissionMonth: offer.emissionMonth,
      sellStartDate: offer.sellStartDate,
      sellEndDate: offer.sellEndDate,
      maturityDate: offer.maturityDate,
      firstYearRate: offer.firstYearRate,
      baseMargin: offer.margin,
      earlyWithdrawalFee: offer.earlyWithdrawalFee,
      redemptionFeeCap: offer.redemptionFeeCap,
      termsSourceUrl: offer.termsSourceUrl,
      termsRevision: offer.termsRevision,
    })
    .onConflictDoUpdate({
      target: bondSeries.seriesCode,
      set: bondSeriesOfferConflictValues(offer),
    });
}
