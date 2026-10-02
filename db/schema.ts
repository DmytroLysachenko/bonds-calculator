import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { type AdapterAccountType } from 'next-auth/adapters';

export const instrumentTypeEnum = pgEnum('instrument_type', [
  'bond',
  'equity',
  'commodity',
  'crypto',
]);
export const interestTypeEnum = pgEnum('interest_type', [
  'fixed',
  'floating_nbp',
  'inflation_linked',
]);
export const seriesCategoryEnum = pgEnum('series_category', [
  'macro',
  'instrument',
  'index',
  'currency',
  'commodity',
]);

/**
 * Metadata for any time-series data (Inflation, NBP Rate, S&P500, etc.)
 */
export const dataSeries = pgTable('data_series', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(), // e.g. 'pl-cpi', 'nbp-ref-rate', 'sp500'
  name: text('name').notNull(),
  description: text('description'),
  category: seriesCategoryEnum('category').notNull().default('macro'),
  unit: text('unit').notNull(), // %, PLN, USD, etc.
  frequency: text('frequency').notNull().default('monthly'), // daily, monthly, quarterly, yearly
  displayPrecision: integer('display_precision').default(2),
  displayStepDefault: text('display_step_default').default('monthly'),
  timezone: text('timezone').default('Europe/Warsaw'),
  sourcePriority: integer('source_priority').default(1),
  freshnessPolicy: text('freshness_policy'), // how often it should be synced
  lastSyncStatus: text('last_sync_status'), // 'success', 'failed', 'partial'
  lastSyncError: text('last_sync_error'),
  dataSource: text('data_source'),
  lastDataPointDate: date('last_data_point_date'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * The actual data points for all series
 */
export const dataPoints = pgTable(
  'data_points',
  {
    id: serial('id').primaryKey(),
    seriesId: uuid('series_id')
      .references(() => dataSeries.id, { onDelete: 'cascade' })
      .notNull(),
    date: date('date').notNull(),
    value: numeric('value', { precision: 20, scale: 8 }).notNull(),
    open: numeric('open', { precision: 20, scale: 8 }),
    high: numeric('high', { precision: 20, scale: 8 }),
    low: numeric('low', { precision: 20, scale: 8 }),
    close: numeric('close', { precision: 20, scale: 8 }),
    adjustedClose: numeric('adjusted_close', { precision: 20, scale: 8 }),
    volume: numeric('volume', { precision: 20, scale: 0 }),
    qualityFlag: text('quality_flag'), // 'verified', 'estimated', 'projected'
    sourceMetadata: text('source_metadata'), // any extra info about this point
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => {
    return {
      seriesDateIdx: uniqueIndex('series_date_idx').on(table.seriesId, table.date),
    };
  },
);

export const polishBonds = pgTable('polish_bonds', {
  id: uuid('id').primaryKey().defaultRandom(),
  symbol: text('symbol').notNull().unique(),
  fullName: text('full_name').notNull(),
  fullNameEn: text('full_name_en'),
  description: text('description'), // Simplified, could be JSON
  descriptionEn: text('description_en'),
  durationDays: integer('duration_days').notNull(),
  nominalValue: numeric('nominal_value', { precision: 10, scale: 2 }).default('100.00'),
  capitalizationFreqDays: integer('capitalization_freq_days').default(0),
  payoutFreqDays: integer('payout_freq_days').default(0),
  interestType: interestTypeEnum('interest_type').notNull(),
  firstYearRate: numeric('first_year_rate', { precision: 5, scale: 2 }),
  baseMargin: numeric('base_margin', { precision: 5, scale: 2 }),
  withdrawalFee: numeric('withdrawal_fee', { precision: 5, scale: 2 }),
  withdrawalFeeCap: boolean('withdrawal_fee_cap').default(true),
  rolloverDiscount: numeric('rollover_discount', { precision: 5, scale: 2 }),
  isFamilyOnly: boolean('is_family_only').default(false),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const syncRuns = pgTable(
  'sync_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: text('scope').notNull(),
    provider: text('provider'),
    seriesSlug: text('series_slug'),
    mode: text('mode').notNull(),
    status: text('status').notNull(),
    rangeStart: date('range_start'),
    rangeEnd: date('range_end'),
    inserted: integer('inserted').default(0).notNull(),
    updated: integer('updated').default(0).notNull(),
    skipped: integer('skipped').default(0).notNull(),
    latestDataPointDate: date('latest_data_point_date'),
    message: text('message'),
    error: text('error'),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    finishedAt: timestamp('finished_at'),
  },
  (table) => ({
    scopeIdx: index('sync_runs_scope_idx').on(table.scope),
    seriesSlugIdx: index('sync_runs_series_slug_idx').on(table.seriesSlug),
    startedAtIdx: index('sync_runs_started_at_idx').on(table.startedAt),
  }),
);

export type PolishBond = typeof polishBonds.$inferSelect;

export const taxRules = pgTable(
  'tax_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    year: integer('year').notNull(),
    ikeLimit: numeric('ike_limit', { precision: 12, scale: 2 }).notNull(),
    ikzeLimit: numeric('ikze_limit', { precision: 12, scale: 2 }).notNull(),
    standardTaxRate: numeric('standard_tax_rate', { precision: 5, scale: 2 }).default('19.00'),
    ikzePayoutTaxRate: numeric('ikze_payout_tax_rate', { precision: 5, scale: 2 }).default('5.00'),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    yearIdx: uniqueIndex('tax_year_idx').on(table.year),
  }),
);

export const investmentInstruments = pgTable('investment_instruments', {
  id: uuid('id').primaryKey().defaultRandom(),
  seriesId: uuid('series_id').references(() => dataSeries.id),
  ticker: text('ticker').notNull().unique(),
  displayName: text('display_name').notNull(),
  riskScore: integer('risk_score').notNull(),
  currency: text('currency').default('PLN'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const userPortfolios = pgTable('user_portfolios', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  shareId: uuid('share_id').defaultRandom().unique(),
  isPublic: boolean('is_public').default(false).notNull(),
});

export const userInvestmentLots = pgTable(
  'user_investment_lots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    portfolioId: uuid('portfolio_id')
      .notNull()
      .references(() => userPortfolios.id, { onDelete: 'cascade' }),
    bondType: text('bond_type').notNull(),
    bondTypeId: uuid('bond_type_id').references(() => polishBonds.id),
    bondSeriesId: uuid('bond_series_id').references(() => bondSeries.id),
    purchaseDate: date('purchase_date').notNull(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    isRebought: boolean('is_rebought').default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    portfolioIdx: index('lot_portfolio_idx').on(table.portfolioId),
    portfolioPurchaseDateIdx: index('lot_portfolio_purchase_date_idx').on(
      table.portfolioId,
      table.purchaseDate,
    ),
    positiveAmount: check('user_investment_lots_positive_amount', sql`${table.amount} > 0`),
  }),
);

export const bondSeries = pgTable('bond_series', {
  id: uuid('id').primaryKey().defaultRandom(),
  bondTypeId: uuid('bond_type_id')
    .references(() => polishBonds.id, { onDelete: 'cascade' })
    .notNull(),
  seriesCode: text('series_code').notNull().unique(), // e.g. EDO1033
  emissionMonth: date('emission_month').notNull(),
  sellStartDate: date('sell_start_date').notNull(),
  sellEndDate: date('sell_end_date').notNull(),
  maturityDate: date('maturity_date').notNull(),
  firstYearRate: numeric('first_year_rate', { precision: 5, scale: 2 }).notNull(),
  baseMargin: numeric('base_margin', { precision: 5, scale: 2 }),
  earlyWithdrawalFee: numeric('early_withdrawal_fee', { precision: 8, scale: 2 }),
  redemptionFeeCap: text('redemption_fee_cap'),
  termsSourceUrl: text('terms_source_url'),
  termsRevision: text('terms_revision'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userTransactions = pgTable('user_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  lotId: uuid('lot_id')
    .references(() => userInvestmentLots.id, { onDelete: 'cascade' })
    .notNull(),
  transactionType: text('transaction_type').notNull(), // 'buy', 'sell', 'interest_payout', 'tax_withheld'
  date: date('date').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const sharedSingleScenarios = pgTable(
  'shared_single_scenarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shareId: uuid('share_id').defaultRandom().notNull().unique(),
    title: text('title').notNull(),
    description: text('description'),
    scenarioKind: text('scenario_kind').notNull().default('single-bond'),
    payloadJson: text('payload_json').notNull(),
    calculationVersion: text('calculation_version'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (table) => ({
    expiresAtIdx: index('shared_single_scenarios_expires_at_idx').on(table.expiresAt),
    nonemptyTitle: check(
      'shared_single_scenarios_nonempty_title',
      sql`length(trim(${table.title})) > 0`,
    ),
  }),
);

export const adminAuditEvents = pgTable(
  'admin_audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    action: text('action').notNull(),
    actorEmail: text('actor_email'),
    requestId: text('request_id'),
    detail: text('detail'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index('admin_audit_events_created_at_idx').on(table.createdAt),
    requestIdIdx: index('admin_audit_events_request_id_idx').on(table.requestId),
  }),
);

export const rateLimitWindows = pgTable('rate_limit_windows', {
  bucketKey: text('bucket_key').primaryKey(),
  count: integer('count').notNull(),
  resetAt: timestamp('reset_at').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Privacy-preserving field-vital aggregates. This schema intentionally has no
 * primary identifier, account, URL query, payload, or user-agent column.
 */
export const webVitalAggregates = pgTable(
  'web_vital_aggregates',
  {
    metric: text('metric').notNull(),
    path: text('path').notNull(),
    rating: text('rating').notNull(),
    timeBucket: timestamp('time_bucket').notNull(),
    sampleCount: integer('sample_count').notNull().default(0),
    valueSum: numeric('value_sum', { precision: 20, scale: 4 }).notNull().default('0'),
    valueMin: numeric('value_min', { precision: 20, scale: 4 }).notNull(),
    valueMax: numeric('value_max', { precision: 20, scale: 4 }).notNull(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    primary: primaryKey({ columns: [table.metric, table.path, table.rating, table.timeBucket] }),
    timeBucketIdx: index('web_vital_aggregates_time_bucket_idx').on(table.timeBucket),
  }),
);

export const communityInsights = pgTable(
  'community_insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bondType: text('bond_type').notNull(),
    popularityScore: integer('popularity_score').default(0).notNull(), // number of users holding this bond
    sentimentScore: numeric('sentiment_score', { precision: 3, scale: 2 })
      .default('0.00')
      .notNull(), // -1.0 to 1.0
    totalVolume: numeric('total_volume', { precision: 20, scale: 2 }).default('0.00').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    bondTypeIdx: uniqueIndex('insight_bond_type_idx').on(table.bondType),
  }),
);

export type NewDataSeries = typeof dataSeries.$inferInsert;
export type DataSeries = typeof dataSeries.$inferSelect;

export type NewDataPoint = typeof dataPoints.$inferInsert;
export type DataPoint = typeof dataPoints.$inferSelect;

export type NewSyncRun = typeof syncRuns.$inferInsert;
export type SyncRun = typeof syncRuns.$inferSelect;

export type NewUserPortfolio = typeof userPortfolios.$inferInsert;
export type UserPortfolio = typeof userPortfolios.$inferSelect;

export type NewUserInvestmentLot = typeof userInvestmentLots.$inferInsert;
export type UserInvestmentLot = typeof userInvestmentLots.$inferSelect;

export type NewBondSeries = typeof bondSeries.$inferInsert;
export type BondSeries = typeof bondSeries.$inferSelect;

export type NewUserTransaction = typeof userTransactions.$inferInsert;
export type UserTransaction = typeof userTransactions.$inferSelect;

export type NewSharedSingleScenario = typeof sharedSingleScenarios.$inferInsert;
export type SharedSingleScenario = typeof sharedSingleScenarios.$inferSelect;

export type NewCommunityInsight = typeof communityInsights.$inferInsert;
export type CommunityInsight = typeof communityInsights.$inferSelect;

export const userSettings = pgTable('user_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  currency: text('currency').default('PLN').notNull(),
  theme: text('theme').default('system').notNull(),
  defaultInflationScenario: text('default_inflation_scenario').default('base').notNull(),
  chartType: text('chart_type').default('area').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;

// --- NEXTAUTH (AUTH.JS) REQUIRED TABLES --- //
export const users = pgTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
});

export const accounts = pgTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (verificationToken) => ({
    compositePk: primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  }),
);
