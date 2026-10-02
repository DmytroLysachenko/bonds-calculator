import 'dotenv/config';

import { eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { dataPoints, dataSeries, investmentInstruments } from '@/db/schema';
import { GusCpiApiClient } from '@/lib/api-clients/gus-cpi';

import { YahooFinanceSyncProvider } from './providers/yahoo-finance';
import { fetchSyncResponse } from './http-gateway';
import { createSyncLogger } from './sync-logger';

const logger = createSyncLogger('SeedProductionData');

interface NbpRateItem {
  obowiazuje_od: string;
  oprocentowanie: string;
}

async function seedMacroAndMarket() {
  const gusCpiClient = new GusCpiApiClient();
  const sp500Provider = new YahooFinanceSyncProvider({
    name: 'Yahoo Finance S&P 500',
    symbol: '^GSPC',
    seriesSlug: 'sp500',
  });

  const seriesMetadata = [
    {
      slug: 'pl-cpi',
      name: 'Poland Inflation (CPI)',
      category: 'macro' as const,
      unit: '%',
      frequency: 'monthly',
      dataSource: 'GUS official CPI monthly archive CSV',
    },
    {
      slug: 'nbp-ref-rate',
      name: 'NBP Reference Rate',
      category: 'macro' as const,
      unit: '%',
      frequency: 'irregular',
      dataSource: 'NBP',
    },
    {
      slug: 'sp500',
      name: 'S&P 500 Index',
      category: 'index' as const,
      unit: 'USD',
      frequency: 'monthly',
      dataSource: 'Yahoo Finance',
    },
    {
      slug: 'gold-usd',
      name: 'Gold Price (USD)',
      category: 'instrument' as const,
      unit: 'USD',
      frequency: 'daily',
      dataSource: 'Yahoo Finance',
    },
  ];

  logger.info('Seeding metadata series');

  for (const s of seriesMetadata) {
    await db
      .insert(dataSeries)
      .values({
        ...s,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: dataSeries.slug,
        set: { ...s, updatedAt: new Date() },
      });
  }

  // 1. Fetch and seed NBP Rate
  logger.info('Fetching NBP Reference Rate');
  try {
    const rateSeries = await db.query.dataSeries.findFirst({
      where: eq(dataSeries.slug, 'nbp-ref-rate'),
    });
    if (rateSeries) {
      const response = await fetchSyncResponse(
        'https://api.nbp.pl/api/statystyka/stopy/ref?format=json',
        { throwOnHttpError: false },
      );
      if (response.ok) {
        const data = (await response.json()) as NbpRateItem[];
        const points = data.map((item) => ({
          seriesId: rateSeries.id,
          date: item.obowiazuje_od,
          value: parseFloat(item.oprocentowanie.replace(',', '.')).toString(),
        }));

        await db.insert(dataPoints).values(points).onConflictDoNothing();
        logger.info(`Seeded ${points.length} NBP rate points`);
      }
    }
  } catch (e) {
    logger.error('Failed to fetch NBP rates', e);
  }

  // 2. Fetch and seed S&P 500 (Yahoo Finance)
  logger.info('Fetching S&P 500 data');
  try {
    const spxSeries = await db.query.dataSeries.findFirst({ where: eq(dataSeries.slug, 'sp500') });
    if (spxSeries) {
      const spxData = await sp500Provider.fetchData(
        '2000-01-01',
        new Date().toISOString().slice(0, 10),
      );
      const points = spxData.map((d) => ({
        seriesId: spxSeries.id,
        date: d.date,
        value: d.value.toString(),
      }));

      for (let i = 0; i < points.length; i += 100) {
        await db
          .insert(dataPoints)
          .values(points.slice(i, i + 100))
          .onConflictDoNothing();
      }
      logger.info(`Seeded ${points.length} S&P 500 points`);

      await db
        .insert(investmentInstruments)
        .values({
          seriesId: spxSeries.id,
          ticker: '^GSPC',
          displayName: 'S&P 500 Index',
          riskScore: 4,
          currency: 'USD',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: investmentInstruments.ticker,
          set: { seriesId: spxSeries.id, updatedAt: new Date() },
        });
    }
  } catch (e) {
    logger.error('Failed to fetch S&P 500 data', e);
  }

  // 3. Seed official CPI history from the GUS monthly archive CSV.
  logger.info('Fetching official GUS CPI history');
  const cpiSeries = await db.query.dataSeries.findFirst({ where: eq(dataSeries.slug, 'pl-cpi') });
  if (cpiSeries) {
    const inflationPoints = await gusCpiClient.fetchHistoricalData();

    await db
      .insert(dataPoints)
      .values(
        inflationPoints.map((p) => ({
          seriesId: cpiSeries.id,
          date: p.date,
          value: p.value.toString(),
          qualityFlag: 'verified',
          sourceMetadata: GusCpiApiClient.archivePageUrl,
        })),
      )
      .onConflictDoUpdate({
        target: [dataPoints.seriesId, dataPoints.date],
        set: {
          value: sql`EXCLUDED.value`,
          qualityFlag: 'verified',
          sourceMetadata: GusCpiApiClient.archivePageUrl,
        },
      });
    logger.info(`Seeded ${inflationPoints.length} historical CPI points from GUS`);
  }

  const monthlyCpiSeries = await db.query.dataSeries.findFirst({
    where: eq(dataSeries.slug, 'pl-cpi-mom'),
  });
  if (monthlyCpiSeries) {
    const monthlyPoints = await gusCpiClient.fetchMonthlyHistoricalData();
    if (monthlyPoints.length) {
      await db
        .insert(dataPoints)
        .values(
          monthlyPoints.map((point) => ({
            seriesId: monthlyCpiSeries.id,
            date: point.date,
            value: point.value.toString(),
            qualityFlag: 'verified',
            sourceMetadata: GusCpiApiClient.archivePageUrl,
          })),
        )
        .onConflictDoUpdate({
          target: [dataPoints.seriesId, dataPoints.date],
          set: {
            value: sql`EXCLUDED.value`,
            qualityFlag: 'verified',
            sourceMetadata: GusCpiApiClient.archivePageUrl,
          },
        });
    }
    logger.info(`Seeded ${monthlyPoints.length} monthly CPI points from GUS`);
  }

  logger.info('Data seeding completed');
}

seedMacroAndMarket().then(() => process.exit(0));
