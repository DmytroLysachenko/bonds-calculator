import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { dataSeries } from '@/db/schema';

const SERIES = [
  {
    slug: 'pl-cpi',
    name: 'Poland Inflation (CPI)',
    description: 'Consumer Price Index year-over-year change in Poland.',
    category: 'macro' as const,
    unit: '%',
    frequency: 'monthly',
    dataSource: 'GUS official CPI monthly archive CSV',
  },
  {
    slug: 'pl-cpi-mom',
    name: 'Poland CPI month-on-month change',
    description: 'Consumer Price Index change relative to the preceding month in Poland.',
    category: 'macro' as const,
    unit: '%',
    frequency: 'monthly',
    dataSource: 'GUS official CPI monthly archive CSV, previous month = 100 presentation',
  },
  {
    slug: 'nbp-ref-rate',
    name: 'NBP Reference Rate',
    description: 'The main interest rate of the National Bank of Poland.',
    category: 'macro' as const,
    unit: '%',
    frequency: 'irregular',
    dataSource: 'NBP',
  },
  {
    slug: 'sp500',
    name: 'S&P 500 Index',
    description: 'Standard & Poor’s 500 stock market index.',
    category: 'index' as const,
    unit: 'USD',
    frequency: 'monthly',
    dataSource: 'Yahoo Finance',
  },
  {
    slug: 'gold-usd',
    name: 'Gold Price (USD)',
    description: 'Spot price of gold in US Dollars.',
    category: 'instrument' as const,
    unit: 'USD',
    frequency: 'daily',
    dataSource: 'Yahoo Finance',
  },
];

export async function seedSeriesMetadata() {
  for (const series of SERIES) {
    const existing = await db.query.dataSeries.findFirst({
      where: eq(dataSeries.slug, series.slug),
    });

    if (existing) {
      await db.update(dataSeries).set(series).where(eq(dataSeries.id, existing.id));
      continue;
    }

    await db.insert(dataSeries).values(series);
  }
}
