import type { CalculationDiagnostic } from './scenarios';

export enum BondType {
  OTS = 'OTS', // 3-month fixed
  ROR = 'ROR', // 1-year variable
  DOR = 'DOR', // 2-year variable
  TOS = 'TOS', // 3-year fixed
  COI = 'COI', // 4-year inflation-indexed
  ROS = 'ROS', // 6-year inflation-indexed (family)
  EDO = 'EDO', // 10-year inflation-indexed
  ROD = 'ROD', // 12-year inflation-indexed (family)
}

export enum InterestPayout {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  MATURITY = 'MATURITY',
}

export enum TaxStrategy {
  STANDARD = 'STANDARD', // 19% Belka
  IKE = 'IKE', // 0% tax (Individual Retirement Account)
  IKZE = 'IKZE', // 5% tax at payout (Individual Tax Saving Account)
}

export type HistoricalDataMap = Record<string, { inflation?: number; nbpRate?: number }>;

export type RateSource =
  | 'initial_principal'
  | 'fixed_rate'
  | 'first_year_fixed'
  | 'historical_cpi_lag'
  | 'projected_cpi'
  | 'historical_nbp'
  | 'projected_nbp'
  | 'cash_after_maturity';

export type ChartStep = 'daily' | 'monthly' | 'quarterly' | 'yearly';

export interface BondInputs {
  bondType: BondType;
  initialInvestment: number;
  firstYearRate: number;
  expectedInflation: number;
  expectedNbpRate?: number; // Optional to distinguish from inflation for ROR/DOR
  margin: number;
  duration: number; // in years (OTS will be 0.25)
  nominalValue?: number; // Added to decouple from hardcoded constants
  isInflationIndexed?: boolean; // Added to decouple from hardcoded constants
  earlyWithdrawalFee: number; // per bond (100 PLN)
  /** Issued-series redemption rule; absent means the issue terms are unresolved. */
  redemptionFeeCap?: 'interest' | 'principal' | 'first-interest-then-principal';
  taxRate: number;
  isCapitalized: boolean;
  payoutFrequency: InterestPayout;
  purchaseDate: string; // ISO string
  withdrawalDate: string; // ISO string
  isRebought: boolean;
  rebuyDiscount: number;
  taxStrategy: TaxStrategy;
  savingsGoal?: number;
  historicalData?: HistoricalDataMap;
  showRealValue?: boolean;
  calculatorMode?: 'standard' | 'reverse';
  targetNetSum?: number;
  ikzeTaxBracket?: 0.12 | 0.32;
  customInflation?: number[];
  customNbpRate?: number[];
  rollover?: boolean;
  /** Whether non-capitalized coupon payouts remain investable or stay in cash. */
  couponDisposition?: 'reinvest' | 'cash';
  timingMode?: import('@/shared/lib/date-timing').TimingMode;
  investmentHorizonMonths?: number;
  chartStep?: ChartStep;
  useTaxWrapperLimit?: boolean;
  inflationScenario?: 'low' | 'base' | 'high';
  selectedSeriesId?: string | null;
}

export interface YearlyTimelinePoint {
  year: number;
  periodLabel: string; // e.g., "Year 1", "Maturity"
  cycleIndex: number;
  cycleStartDate: string;
  cycleEndDate: string;
  interestRate: number;
  rateSource: RateSource;
  rateReferenceValue?: number;
  rateMarginApplied?: number;
  usedProjectedRate: boolean;
  nominalValueBeforeInterest: number;
  interestEarned: number;
  taxDeducted: number;
  netInterest: number;
  nominalValueAfterInterest: number;
  accumulatedNetInterest: number; // For non-capitalized bonds, this stores payouts
  totalValue: number; // nominalValue + accumulatedNetInterest
  realValue: number;
  netProfit: number;
  earlyWithdrawalValue: number;
  cumulativeInflation: number;
  isMaturity: boolean;
  isWithdrawal: boolean;
  isProjected?: boolean;
  inflationReference?: number;
  nbpReference?: number;
  events?: import('./simulation').SimulationEvent[];
}

export interface CalculationResult {
  initialInvestment: number;
  timeline: YearlyTimelinePoint[];
  finalNominalValue: number;
  finalRealValue: number;
  totalProfit: number;
  totalTax: number;
  totalEarlyWithdrawalFee: number;
  grossValue: number;
  netPayoutValue: number;
  isEarlyWithdrawal: boolean;
  maturityDate: string;
  nominalAnnualizedReturn: number;
  realAnnualizedReturn: number;
  calculationNotes?: string[];
  /** Structured engine notes for localized new-result presentation. */
  noteDiagnostics?: CalculationDiagnostic[];
  dataQualityFlags?: string[];
  taxSavings?: number;
  overflowInfo?: {
    limitApplied: number;
    amountInWrapper: number;
    amountInStandard: number;
    standardTaxDeducted: number;
  };
  comparisonScenarios?: {
    low: YearlyTimelinePoint[];
    high: YearlyTimelinePoint[];
  };
}

export enum InvestmentFrequency {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export interface RegularInvestmentInputs extends Omit<BondInputs, 'initialInvestment'> {
  contributionAmount: number;
  frequency: InvestmentFrequency;
  investmentHorizonMonths: number;
  /** Capital available on the plan start date, before recurring deposits. */
  initialLumpSum?: number;
  /** Nominal annual increase applied to future base-cadence contributions. */
  annualContributionIncreasePercent?: number;
  /** Dates on which a base contribution is skipped. */
  skippedContributionDates?: string[];
  /** Dated additions; duplicate dates are intentionally summed. */
  oneOffContributions?: Array<{ date: string; amount: number }>;
  /** Replaces the base contribution on its matching cadence date. */
  contributionOverrides?: Array<{ date: string; amount: number }>;
  allocationTargets?: Array<{ bondType: BondType; percent: number }>;
  cashBenchmark?: { annualRate: number; capitalization: 'monthly' | 'yearly'; taxRate: number };
  showRealValue?: boolean;
}

export interface LotBreakdown {
  purchaseDate: string;
  maturityDate: string;
  isMatured: boolean;
  investedAmount: number;
  accumulatedInterest: number;
  tax: number;
  earlyWithdrawalFee: number;
  grossValue: number;
  netValue: number;
  /** Terminal proceeds moved into the simulation cash account. */
  settledValue?: number;
  /** Issuer period currently applied to this lot; internal trace exposed for audit. */
  ratePeriodIndex?: number;
  lockedAnnualRate?: number;
  /** Completed issuer periods and total interest, retained for incremental valuation. */
  issuerCompletedPeriods?: number;
  issuerAccruedInterest?: number;
}

export interface RegularInvestmentResult {
  totalInvested: number;
  finalNominalValue: number;
  finalRealValue: number;
  totalProfit: number;
  totalTax: number;
  totalEarlyWithdrawalFees: number;
  realAnnualizedReturn: number; // CAGR adjusted for inflation
  /** Money-weighted annual return over dated external contributions; undefined when no root is bracketed. */
  moneyWeightedAnnualizedReturn?: number;
  timeline: RegularTimelinePoint[];
  lots: LotBreakdown[];
  /** Cash retained after purchases and maturity settlements. */
  cashBalance: number;
  /** External contributions, before any bond-price residuals. */
  totalContributions: number;
  /** Amount held in active bond lots, excluding cash. */
  activeHoldingsValue: number;
  /** Net amount paid out at the requested terminal withdrawal, if selected. */
  terminalNetSettlement?: number;
  /** Cash actually paid out by the terminal withdrawal, never active holdings. */
  paidOutValue: number;
  /** Active holdings plus retained cash; zero after a terminal withdrawal. */
  terminalWealth: number;
  mixedAllocation?: {
    totalValue: number;
    residualCash: number;
    actualWeights: Array<{
      bondType: BondType;
      targetPercent: number;
      value: number;
      actualPercent: number;
    }>;
    cashBenchmark?: { finalValue: number; annualRate: number; taxRate: number };
  };
}

export interface RegularTimelinePoint {
  month: number;
  date: string;
  totalInvested: number;
  nominalValue: number;
  realValue: number;
  profit: number;
  tax: number;
  earlyWithdrawalFees: number;
  cashBalance?: number;
  isProjected?: boolean;
  events?: import('./simulation').SimulationEvent[];
}

export * from './scenarios';
