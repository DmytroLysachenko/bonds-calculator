import { format, parseISO, subMonths } from 'date-fns';

import { BondDefinition } from '../constants/bond-definitions';
import { MODEL_VERSION } from '../model-version';
import { BondInputs, BondType } from '../types';
import {
  CalculationDataFreshness,
  CalculationDiagnostic,
  CalculationEnvelope,
  HistoricalAverages,
  ScenarioKind,
} from '../types/scenarios';

export interface HandlerContext {
  dataFreshness: CalculationDataFreshness;
  dbDefinitions: Record<BondType, BondDefinition>;
}

export interface ScenarioHandler<TKind extends ScenarioKind, TRequest, TResponse> {
  kind: TKind;
  handle(payload: TRequest, context: HandlerContext): Promise<CalculationEnvelope<TResponse>>;
}

export interface HandlerData {
  getHistoricalDataMap: (
    start: string,
    end: string,
  ) => Promise<NonNullable<BondInputs['historicalData']>>;
  getHistoricalAverages: () => Promise<HistoricalAverages>;
  getTaxRulesForYear: (
    year: number,
  ) => Promise<{ ikeLimit: string | null; ikzeLimit: string | null } | null | undefined>;
  resolveBondOfferTerms: (
    bondType: BondType,
    purchaseDate: string,
    definitions: Record<BondType, BondDefinition>,
    selectedSeriesId?: string | null,
  ) => Promise<{
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
  }>;
}

export abstract class BaseHandler {
  constructor(protected readonly data: HandlerData) {}

  protected applyInflationScenario(
    expectedInflation: number,
    inflationScenario?: 'low' | 'base' | 'high',
  ) {
    if (inflationScenario === 'low') {
      return expectedInflation - 1.5;
    }

    if (inflationScenario === 'high') {
      return expectedInflation + 2.5;
    }

    return expectedInflation;
  }

  protected async withHistoricalData<T extends { purchaseDate: string; withdrawalDate: string }>(
    inputs: T,
  ): Promise<T & { historicalData: BondInputs['historicalData'] }> {
    const historicalData = await this.data.getHistoricalDataMap(
      format(subMonths(parseISO(inputs.purchaseDate), 3), 'yyyy-MM-dd'),
      inputs.withdrawalDate,
    );

    return {
      ...inputs,
      historicalData,
    };
  }

  protected buildHistoricalDataWarnings(historicalData?: BondInputs['historicalData']): string[] {
    if (!historicalData || Object.keys(historicalData).length === 0) {
      return ['Historical data was unavailable; projected assumptions may be used.'];
    }

    const hasInflation = Object.values(historicalData).some(
      (entry) => entry.inflation !== undefined,
    );
    const hasNbpRate = Object.values(historicalData).some((entry) => entry.nbpRate !== undefined);
    const warnings: string[] = [];

    if (!hasInflation) {
      warnings.push('Inflation history is missing; projected assumptions may be used.');
    }
    if (!hasNbpRate) {
      warnings.push('NBP rate history is missing; projected assumptions may be used.');
    }

    return warnings;
  }

  protected collectHistoricalWarnings(
    historicalSets: Array<BondInputs['historicalData'] | undefined>,
  ): string[] {
    return Array.from(
      new Set(
        historicalSets.flatMap((historicalData) =>
          this.buildHistoricalDataWarnings(historicalData),
        ),
      ),
    );
  }

  protected generateAssumptions(
    inputs: Partial<BondInputs> & {
      expectedInflation?: number;
      expectedNbpRate?: number;
      customInflation?: number[];
      customNbpRate?: number[];
    },
  ): string[] {
    const assumptions: string[] = [];
    if (inputs.expectedInflation !== undefined) {
      assumptions.push(`Expected annual inflation: ${inputs.expectedInflation}%`);
    }
    if (inputs.expectedNbpRate !== undefined) {
      assumptions.push(`Expected NBP reference rate: ${inputs.expectedNbpRate}%`);
    }
    if (inputs.customInflation && inputs.customInflation.length > 0) {
      assumptions.push('Using custom user-supplied inflation overrides.');
    }
    if (inputs.customNbpRate && inputs.customNbpRate.length > 0) {
      assumptions.push('Using custom user-supplied NBP rate overrides.');
    }
    return assumptions;
  }

  protected async createEnvelope<T>(
    result: T,
    warnings: string[],
    assumptions: string[],
    dataFreshness: CalculationDataFreshness,
    historicalAverages?: HistoricalAverages,
    diagnostics?: CalculationDiagnostic[],
  ): Promise<CalculationEnvelope<T>> {
    const resultAsRecord = result as Record<string, unknown>;
    const averages = historicalAverages || (await this.data.getHistoricalAverages());

    return {
      result,
      warnings,
      assumptions,
      calculationNotes: Array.isArray(resultAsRecord?.calculationNotes)
        ? (resultAsRecord.calculationNotes as string[])
        : [],
      dataQualityFlags: Array.isArray(resultAsRecord?.dataQualityFlags)
        ? (resultAsRecord.dataQualityFlags as string[])
        : [],
      dataFreshness,
      calculationVersion: MODEL_VERSION,
      historicalAverages: averages,
      ...(diagnostics ? { diagnostics } : {}),
    };
  }
}
