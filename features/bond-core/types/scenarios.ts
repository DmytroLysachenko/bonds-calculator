import { TimingMode } from '@/shared/lib/date-timing';

import {
  BondInputs,
  BondType,
  CalculationResult,
  RegularInvestmentInputs,
  RegularInvestmentResult,
  TaxStrategy,
} from './index';

/** Caller-owned facts for a one-time bond projection. */
export type SingleBondCalculationIntent = Pick<
  BondInputs,
  | 'bondType'
  | 'initialInvestment'
  | 'expectedInflation'
  | 'expectedNbpRate'
  | 'purchaseDate'
  | 'withdrawalDate'
  | 'isRebought'
  | 'taxStrategy'
  | 'savingsGoal'
  | 'customInflation'
  | 'customNbpRate'
  /** Legacy input marker only: single-bond rollover is determined by the effective horizon. */
  | 'rollover'
  | 'timingMode'
  | 'investmentHorizonMonths'
  | 'useTaxWrapperLimit'
  | 'inflationScenario'
  | 'selectedSeriesId'
>;

/** Caller-owned facts for a recurring bond-contribution projection. */
export type RegularInvestmentCalculationIntent = Pick<
  RegularInvestmentInputs,
  | 'contributionAmount'
  | 'initialLumpSum'
  | 'annualContributionIncreasePercent'
  | 'skippedContributionDates'
  | 'oneOffContributions'
  | 'contributionOverrides'
  | 'allocationTargets'
  | 'cashBenchmark'
  | 'frequency'
  | 'investmentHorizonMonths'
  | 'bondType'
  | 'expectedInflation'
  | 'expectedNbpRate'
  | 'purchaseDate'
  | 'withdrawalDate'
  | 'isRebought'
  | 'taxStrategy'
  | 'savingsGoal'
  | 'customInflation'
  | 'customNbpRate'
  | 'rollover'
  | 'timingMode'
  | 'inflationScenario'
>;

export enum ScenarioKind {
  SINGLE_BOND = 'single-bond',
  REGULAR_INVESTMENT = 'regular-investment',
  BOND_COMPARISON = 'bond-comparison',
  PORTFOLIO_SIMULATION = 'portfolio-simulation',
  BOND_OPTIMIZER = 'bond-optimizer',
  RETIREMENT_PLANNER = 'retirement-planner',
}

type DataFreshnessStatus = 'fresh' | 'stale' | 'projected' | 'unknown' | 'fallback';
type BondOfferSource = 'gov.pl' | 'obligacjeskarbowe.pl' | 'curated-fallback';
type BondOfferSyncStatus = 'success' | 'partial' | 'failed' | 'up-to-date' | 'no-new-data';

export interface CalculationDataFreshness {
  status: DataFreshnessStatus;
  /**
   * Backward-compatible coverage date used by older display components.
   * Prefer coverageAsOf for new UI because lastSyncedAt carries a different meaning.
   */
  asOf?: string;
  coverageAsOf?: string;
  lastSyncedAt?: string;
  lastCheck?: string;
  bondOfferSource?: BondOfferSource | string;
  bondOfferAttemptAt?: string;
  bondOfferStatus?: BondOfferSyncStatus | string;
  usedFallback: boolean;
}

export interface HistoricalAverages {
  inflation: {
    '1y': number;
    '5y': number;
    '10y': number;
  };
  nbpRate: {
    '1y': number;
    '5y': number;
    '10y': number;
  };
}

export interface CalculationEnvelope<T> {
  result: T;
  warnings: string[];
  assumptions: string[];
  calculationNotes: string[];
  dataQualityFlags: string[];
  dataFreshness: CalculationDataFreshness;
  calculationVersion: string;
  taxRulesRevision?: string;
  offerTerms?: {
    source: 'series' | 'definition' | 'unresolved';
    seriesCode?: string;
    termsRevision?: string;
    termsSourceUrl?: string;
    termsAreVerified: boolean;
  };
  diagnostics?: CalculationDiagnostic[];
  historicalAverages?: HistoricalAverages;
}

export const CALCULATION_DIAGNOSTIC_CODES = [
  'expected_inflation',
  'expected_nbp_rate',
  'custom_inflation',
  'custom_nbp',
  'missing_inflation_history',
  'missing_nbp_history',
  'missing_history',
  'issued_series_resolved',
  'issued_series_unverified',
  'issued_series_unresolved',
  'generic_offer_definition',
  'auto_rollover',
  'single_cycle',
  'rollover_disabled',
  'rollover_cycles',
  'early_redemption_applied',
  'ikze_tax_relief',
  'wrapper_limit_unavailable',
  'wrapper_limit_split',
  'comparison_normalized',
  'comparison_independent',
  'comparison_nearest_issue',
  'comparison_rollover_inferred',
  'maturity_cash_after_maturity',
  'maturity_hold_to_maturity',
  'maturity_reinvest_until_horizon',
  'maturity_auto',
  'coupon_cash',
  'coupon_reinvest',
  'comparison_side_maturity_cash_after_maturity',
  'comparison_side_maturity_hold_to_maturity',
  'comparison_side_maturity_reinvest_until_horizon',
  'comparison_side_maturity_auto',
  'comparison_side_coupon_cash',
  'comparison_side_coupon_reinvest',
  'ranking_net_payout',
  'retirement_horizon',
  'retirement_withdrawal',
  'retirement_steady_rate',
  'retirement_rate',
  'retirement_approximation',
  'portfolio_sparse_checkpoints',
  'portfolio_fee_semantics',
  'portfolio_unresolved_issue',
] as const;

export interface CalculationDiagnostic {
  code: (typeof CALCULATION_DIAGNOSTIC_CODES)[number];
  severity: 'assumption' | 'warning';
  params?: Record<string, string | number>;
  sourceRef?: string;
}

interface SingleBondScenarioRequest {
  kind: ScenarioKind.SINGLE_BOND;
  payload: SingleBondCalculationIntent;
}

interface RegularInvestmentScenarioRequest {
  kind: ScenarioKind.REGULAR_INVESTMENT;
  payload: RegularInvestmentCalculationIntent;
}

export interface RetirementPlannerPayload {
  initialCapital: number;
  monthlyWithdrawal: number;
  expectedInflation: number;
  expectedNbpRate?: number;
  bondType: BondType;
  taxStrategy: TaxStrategy;
  horizonYears: number;
  /**
   * Declared projection origin. Legacy callers may omit it; the application
   * service supplies today's calendar date before cache-key construction.
   */
  projectionStartDate?: string;
}

interface RetirementPlannerRequest {
  kind: ScenarioKind.RETIREMENT_PLANNER;
  payload: RetirementPlannerPayload;
}

export interface RetirementPlannerResult {
  isSustainable: boolean;
  exhaustionYear?: number;
  exhaustionMonth?: number;
  exhaustionDate?: string;
  finalBalance: number;
  totalWithdrawn: number;
  totalTaxPaid: number;
  modeledAnnualRate: number;
  modeledMonthlyNetRate: number;
  modeledBondType: BondType;
  modelType: 'steady-rate';
  timeline: {
    year: number;
    month: number;
    date: string;
    balance: number;
    withdrawal: number;
    isProjected?: boolean;
  }[];
}

export type RetirementPlannerCalculationEnvelope = CalculationEnvelope<RetirementPlannerResult>;

export interface BondComparisonScenarioItem {
  scenarioKey?: 'scenarioA' | 'scenarioB';
  type: BondType;
  name: string;
  offerTerms?: CalculationEnvelope<unknown>['offerTerms'];
  /** Declared post-maturity treatment used for this calculation. */
  strategyPolicy?: 'hold_to_maturity' | 'reinvest_until_horizon' | 'cash_after_maturity';
  result: CalculationResult;
}

type ComparisonMaturityMode =
  | 'hold_to_maturity'
  | 'reinvest_until_horizon'
  | 'cash_after_maturity'
  | 'align_to_shorter_duration';

export interface NormalizedBondComparisonPayload {
  mode?: 'normalized';
  bondTypes: BondType[];
  initialInvestment: number;
  purchaseDate: string;
  withdrawalDate: string;
  expectedInflation: number;
  expectedNbpRate?: number;
  customInflation?: number[];
  customNbpRate?: number[];
  inflationScenario?: 'low' | 'base' | 'high';
  taxStrategy?: TaxStrategy;
  /** Legacy true marker retains automatic handling; false is rejected. Use independent strategyPolicy for explicit choices. */
  reinvest?: boolean;
}

export interface IndependentBondComparisonPayload {
  mode: 'independent';
  sharedConfig: {
    initialInvestment: number;
    purchaseDate: string;
    withdrawalDate: string;
    expectedInflation: number;
    expectedNbpRate?: number;
    customInflation?: number[];
    customNbpRate?: number[];
    inflationScenario?: 'low' | 'base' | 'high';
    taxStrategy?: TaxStrategy;
    timingMode?: TimingMode;
    investmentHorizonMonths?: number;
    maturityMode?: ComparisonMaturityMode;
    /** Explicit F17 policy; legacy maturityMode remains decode-only. */
    strategyPolicy?: 'hold_to_maturity' | 'reinvest_until_horizon' | 'cash_after_maturity';
    couponDisposition?: 'reinvest' | 'cash';
  };
  scenarioA: {
    bondType: BondType;
    selectedSeriesId?: string | null;
    /** Legacy false-only marker; strategyPolicy owns maturity behavior. */
    rollover?: false;
    /** Legacy false-only marker; rebuy discount is not a comparison policy. */
    isRebought?: false;
    taxStrategy?: TaxStrategy;
    strategyPolicy?: 'hold_to_maturity' | 'reinvest_until_horizon' | 'cash_after_maturity';
    couponDisposition?: 'reinvest' | 'cash';
    purchaseDate?: string;
    withdrawalDate?: string;
    timingMode?: TimingMode;
    investmentHorizonMonths?: number;
  };
  scenarioB: {
    bondType: BondType;
    selectedSeriesId?: string | null;
    rollover?: false;
    isRebought?: false;
    taxStrategy?: TaxStrategy;
    strategyPolicy?: 'hold_to_maturity' | 'reinvest_until_horizon' | 'cash_after_maturity';
    couponDisposition?: 'reinvest' | 'cash';
    purchaseDate?: string;
    withdrawalDate?: string;
    timingMode?: TimingMode;
    investmentHorizonMonths?: number;
  };
}

interface BondComparisonScenarioRequest {
  kind: ScenarioKind.BOND_COMPARISON;
  payload: NormalizedBondComparisonPayload | IndependentBondComparisonPayload;
}

export interface PortfolioSimulationPayload {
  investments: {
    bondType: BondType;
    amount: number;
    purchaseDate: string;
    /** Issued-series identity retained by a recorded holding when available. */
    selectedSeriesId?: string | null;
    isRebought?: boolean;
    taxStrategy?: TaxStrategy;
    rollover?: boolean;
  }[];
  expectedInflation: number;
  expectedNbpRate?: number;
  withdrawalDate: string;
}

interface PortfolioSimulationRequest {
  kind: ScenarioKind.PORTFOLIO_SIMULATION;
  payload: PortfolioSimulationPayload;
}

export interface PortfolioSimulationItem {
  bondType: BondType;
  amount: number;
  purchaseDate: string;
  result: CalculationResult;
}

export interface PortfolioSimulationResult {
  items: PortfolioSimulationItem[];
  aggregatedTimeline: {
    date: string;
    totalNominalValue: number;
    totalNetValue: number;
    /** Net value in purchasing power of the portfolio's earliest purchase date. */
    totalRealValue: number;
    priceIndexFactor: number;
    totalProfit: number;
    totalTax: number;
    totalFees: number;
  }[];
  summary: {
    totalInvested: number;
    totalNetValue: number;
    totalRealValue: number;
    totalProfit: number;
  };
}

export type PortfolioSimulationCalculationEnvelope = CalculationEnvelope<PortfolioSimulationResult>;

export interface BondOptimizerPayload {
  initialInvestment: number;
  purchaseDate: string;
  withdrawalDate?: string;
  investmentHorizonMonths?: number;
  expectedInflation: number;
  expectedNbpRate?: number;
  taxStrategy?: TaxStrategy;
  includeFamilyBonds?: boolean;
}

interface BondOptimizerRequest {
  kind: ScenarioKind.BOND_OPTIMIZER;
  payload: BondOptimizerPayload;
}

export interface BondOptimizerResultItem {
  bondType: BondType;
  name: string;
  netPayoutValue: number;
  totalProfit: number;
  effectiveTaxRate: number;
  isHighestPayout: boolean;
  scenarioReason: string;
  result: CalculationResult;
}

export interface BondOptimizerResult {
  rankedBonds: BondOptimizerResultItem[];
  highestPayout: BondOptimizerResultItem;
}

export type BondOptimizerCalculationEnvelope = CalculationEnvelope<BondOptimizerResult>;

export type CalculationScenarioRequest =
  | SingleBondScenarioRequest
  | RegularInvestmentScenarioRequest
  | BondComparisonScenarioRequest
  | PortfolioSimulationRequest
  | BondOptimizerRequest
  | RetirementPlannerRequest;

/**
 * Makes every time-dependent calculation explicit before it reaches caching
 * or a handler. Kept compatible with existing retirement links/payloads.
 */
export function normalizeCalculationScenarioRequest<TRequest extends CalculationScenarioRequest>(
  request: TRequest,
  projectionStartDate = new Date().toISOString().slice(0, 10),
): TRequest {
  if (
    request.kind === ScenarioKind.RETIREMENT_PLANNER &&
    request.payload.projectionStartDate === undefined
  ) {
    return {
      ...request,
      payload: { ...request.payload, projectionStartDate },
    } as TRequest;
  }

  return request;
}

export type SingleBondCalculationEnvelope = CalculationEnvelope<CalculationResult>;
export type RegularInvestmentCalculationEnvelope = CalculationEnvelope<RegularInvestmentResult>;
export type BondComparisonCalculationEnvelope = CalculationEnvelope<BondComparisonScenarioItem[]>;

/** Maps a declared scenario kind to the envelope exposed at API consumers. */
export type CalculationEnvelopeForKind<TKind extends CalculationScenarioRequest['kind']> =
  TKind extends ScenarioKind.SINGLE_BOND
    ? SingleBondCalculationEnvelope
    : TKind extends ScenarioKind.REGULAR_INVESTMENT
      ? RegularInvestmentCalculationEnvelope
      : TKind extends ScenarioKind.BOND_COMPARISON
        ? BondComparisonCalculationEnvelope
        : TKind extends ScenarioKind.PORTFOLIO_SIMULATION
          ? PortfolioSimulationCalculationEnvelope
          : TKind extends ScenarioKind.BOND_OPTIMIZER
            ? BondOptimizerCalculationEnvelope
            : TKind extends ScenarioKind.RETIREMENT_PLANNER
              ? RetirementPlannerCalculationEnvelope
              : never;
