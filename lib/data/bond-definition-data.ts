import { differenceInDays } from 'date-fns';
import { desc, eq } from 'drizzle-orm';
import { cache } from 'react';

import { db, isDatabaseConfigured } from '@/db';
import { type BondSeries, bondSeries, type PolishBond, taxRules } from '@/db/schema';
import { BOND_DEFINITIONS, BondDefinition } from '@/features/bond-core/constants/bond-definitions';
import { BondType, InterestPayout } from '@/features/bond-core/types';
import { isIsoCalendarDate } from '@/features/bond-core/types/iso-calendar-date';

import { getCached, setCache } from './market-data-cache';

function parseNumeric(value: string | null | undefined, fallback: number) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildActiveSeriesMap(series: BondSeries[], asOfDate: string) {
  return series.reduce<Record<string, BondSeries>>((acc, item) => {
    if (
      !isIsoCalendarDate(item.sellStartDate) ||
      !isIsoCalendarDate(item.sellEndDate) ||
      item.sellStartDate > item.sellEndDate ||
      item.sellStartDate > asOfDate ||
      item.sellEndDate < asOfDate ||
      item.firstYearRate === null ||
      !Number.isFinite(Number(item.firstYearRate))
    ) {
      return acc;
    }

    const existing = acc[item.bondTypeId];
    if (!existing || existing.emissionMonth < item.emissionMonth) {
      acc[item.bondTypeId] = item;
    }

    return acc;
  }, {});
}

function shouldPreferBootstrapFirstPeriodRate(bond: PolishBond, symbol: BondType) {
  return (
    bond.interestType === 'floating_nbp' && (symbol === BondType.ROR || symbol === BondType.DOR)
  );
}

function isBondOfferFresh(updatedAt: Date | null | undefined, asOfDate: string) {
  if (!updatedAt) {
    return false;
  }

  const ageDays = differenceInDays(new Date(`${asOfDate}T00:00:00.000Z`), updatedAt);
  return ageDays >= 0 && ageDays <= 45;
}

function curatedRateProvenance(bootstrap: BondDefinition, asOfDate: string) {
  const provenance = bootstrap.rateProvenance;
  return provenance?.asOf && provenance.asOf <= asOfDate
    ? provenance
    : ({ kind: 'curated-reference' } as const);
}

export function mergeBondDefinitionsWithSeries(
  bonds: PolishBond[],
  series: BondSeries[],
  fallbackDefinitions: Record<BondType, BondDefinition>,
  asOfDate = new Date().toISOString().slice(0, 10),
): BondDefinition[] {
  if (bonds.length === 0) {
    return Object.values(fallbackDefinitions).map((definition) => ({
      ...definition,
      rateProvenance: curatedRateProvenance(definition, asOfDate),
    }));
  }

  const activeSeriesByBondTypeId = buildActiveSeriesMap(series, asOfDate);

  return bonds.map((bond) => {
    const symbol = bond.symbol as BondType;
    const bootstrap = fallbackDefinitions[symbol];
    const activeSeries = activeSeriesByBondTypeId[bond.id];
    const useDatabaseFallback = isBondOfferFresh(bond.updatedAt, asOfDate);
    const useDatabaseRate =
      useDatabaseFallback &&
      bond.firstYearRate !== null &&
      Number.isFinite(Number(bond.firstYearRate));
    const fallbackFirstYearRate = useDatabaseRate
      ? parseNumeric(bond.firstYearRate, bootstrap.firstYearRate)
      : bootstrap.firstYearRate;
    const fallbackMargin = useDatabaseFallback
      ? parseNumeric(bond.baseMargin, bootstrap.margin)
      : bootstrap.margin;
    const firstPeriodUsesCuratedReference =
      !activeSeries && shouldPreferBootstrapFirstPeriodRate(bond, symbol);
    const rateProvenance: BondDefinition['rateProvenance'] = activeSeries
      ? {
          kind: 'issued-series',
          asOf: activeSeries.sellStartDate,
          seriesCode: activeSeries.seriesCode,
        }
      : useDatabaseRate && !firstPeriodUsesCuratedReference
        ? { kind: 'database-reference', asOf: bond.updatedAt?.toISOString().slice(0, 10) }
        : curatedRateProvenance(bootstrap, asOfDate);

    return {
      type: symbol,
      name: bond.symbol,
      fullName: {
        pl: bond.fullName || bootstrap.fullName.pl,
        en: bond.fullNameEn || bond.fullName || bootstrap.fullName.en,
      },
      description: {
        pl: bond.description || bootstrap.description.pl,
        en: bond.descriptionEn || bootstrap.description.en,
      },
      duration: bond.durationDays ? bond.durationDays / 365 : bootstrap.duration,
      nominalValue: parseNumeric(bond.nominalValue, bootstrap.nominalValue),
      isCapitalized:
        bond.capitalizationFreqDays === null || bond.capitalizationFreqDays === undefined
          ? bootstrap.isCapitalized
          : bond.capitalizationFreqDays > 0,
      payoutFrequency:
        (bond.payoutFreqDays || 0) === 30
          ? InterestPayout.MONTHLY
          : (bond.payoutFreqDays || 0) === 365
            ? InterestPayout.YEARLY
            : InterestPayout.MATURITY,
      firstYearRate: activeSeries
        ? parseNumeric(activeSeries.firstYearRate, bootstrap.firstYearRate)
        : shouldPreferBootstrapFirstPeriodRate(bond, symbol)
          ? bootstrap.firstYearRate
          : fallbackFirstYearRate,
      rateProvenance,
      margin: activeSeries
        ? parseNumeric(activeSeries.baseMargin, bootstrap.margin)
        : fallbackMargin,
      earlyWithdrawalFee: parseNumeric(bond.withdrawalFee, bootstrap.earlyWithdrawalFee),
      isInflationIndexed:
        bond.interestType === 'inflation_linked'
          ? true
          : bond.interestType === 'floating_nbp'
            ? false
            : bootstrap.isInflationIndexed,
      isFloating:
        bond.interestType === 'floating_nbp'
          ? true
          : bond.interestType === 'inflation_linked'
            ? false
            : bootstrap.isFloating,
      isFamilyOnly: bond.isFamilyOnly ?? bootstrap.isFamilyOnly ?? false,
      rebuyDiscount: parseNumeric(bond.rolloverDiscount, bootstrap.rebuyDiscount),
    };
  });
}

const getBondDefinitions = cache(async (): Promise<BondDefinition[]> => {
  if (!isDatabaseConfigured || process.env.PLAYWRIGHT_SMOKE === '1') {
    return Object.values(BOND_DEFINITIONS);
  }

  const cacheKey = 'bond-definitions';
  const cached = getCached<BondDefinition[]>(cacheKey);
  if (cached) return cached;

  try {
    const [bonds, series] = await Promise.all([
      db.query.polishBonds.findMany(),
      db.query.bondSeries.findMany({
        orderBy: [desc(bondSeries.emissionMonth)],
      }),
    ]);

    if (bonds.length === 0) {
      return Object.values(BOND_DEFINITIONS);
    }

    const result = mergeBondDefinitionsWithSeries(bonds, series, BOND_DEFINITIONS);
    setCache(cacheKey, result);
    return result;
  } catch {
    return Object.values(BOND_DEFINITIONS);
  }
});

export const getBondDefinitionsMap = cache(async (): Promise<Record<BondType, BondDefinition>> => {
  const defs = await getBondDefinitions();
  return defs.reduce(
    (acc, def) => {
      acc[def.type] = def;
      return acc;
    },
    {} as Record<BondType, BondDefinition>,
  );
});

export interface BondDefinitionRepository {
  listDefinitions(): Promise<BondDefinition[]>;
  getDefinitionsMap(): Promise<Record<BondType, BondDefinition>>;
}

export const bondDefinitionRepository: BondDefinitionRepository = {
  listDefinitions: getBondDefinitions,
  getDefinitionsMap: getBondDefinitionsMap,
};

export const getTaxRulesForYear = cache(async (year: number) => {
  if (!isDatabaseConfigured || process.env.PLAYWRIGHT_SMOKE === '1') {
    return null;
  }

  const cacheKey = `tax-rules-${year}`;
  const cached = getCached<typeof taxRules.$inferSelect>(cacheKey);
  if (cached) return cached;

  try {
    const rules = await db.query.taxRules.findFirst({
      where: eq(taxRules.year, year),
    });

    if (!rules) {
      return db.query.taxRules.findFirst({
        orderBy: [desc(taxRules.year)],
      });
    }

    setCache(cacheKey, rules);
    return rules;
  } catch {
    return null;
  }
});

/**
 * A compact revision token for cache identity. It intentionally contains no
 * tax values, only the latest persisted rule version that can affect results.
 */
export async function getTaxRulesRevision() {
  if (!isDatabaseConfigured || process.env.PLAYWRIGHT_SMOKE === '1') {
    return 'bootstrap-tax-rules';
  }

  const cacheKey = 'tax-rules-revision';
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  try {
    const latest = await db.query.taxRules.findFirst({
      orderBy: [desc(taxRules.updatedAt), desc(taxRules.year)],
      columns: { year: true, updatedAt: true },
    });
    const revision = latest
      ? `${latest.year}:${latest.updatedAt?.toISOString() ?? 'unknown'}`
      : 'no-tax-rules';
    setCache(cacheKey, revision);
    return revision;
  } catch {
    return 'tax-rules-unavailable';
  }
}
