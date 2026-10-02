import { addMonths, format, getYear, parseISO } from 'date-fns';
import { z } from 'zod';

import { BondInputs, CalculationResult, TaxStrategy } from '../types';
import {
  ScenarioKind,
  SingleBondCalculationEnvelope,
  SingleBondCalculationIntent,
} from '../types/scenarios';
import { SingleBondCalculationIntentSchema } from '../types/schemas';
import { buildSingleBondDiagnostics } from '../utils/calculation-evidence';
import { calculateBondInvestment } from '../utils/calculations';

import { BaseHandler, HandlerContext, ScenarioHandler } from './base';
import { resolveScenarioInputs } from './resolved-inputs';
import { shouldAutoRollover } from './rollover';

export class SingleBondHandler
  extends BaseHandler
  implements
    ScenarioHandler<ScenarioKind.SINGLE_BOND, SingleBondCalculationIntent, CalculationResult>
{
  readonly kind: ScenarioKind.SINGLE_BOND = ScenarioKind.SINGLE_BOND;

  async handle(
    payload: SingleBondCalculationIntent,
    context: HandlerContext,
  ): Promise<SingleBondCalculationEnvelope> {
    const validatedInputs = SingleBondCalculationIntentSchema.parse(payload);
    const {
      definition: def,
      resolvedOffer,
      inputs: inputsWithDefaults,
    } = await resolveScenarioInputs({
      data: this.data,
      inputs: validatedInputs,
      context,
      selectedSeriesId: validatedInputs.selectedSeriesId,
    });

    const enrichedInputs = await this.withHistoricalData(inputsWithDefaults);

    const inputsToCalculate = {
      ...enrichedInputs,
      expectedInflation: this.applyInflationScenario(
        enrichedInputs.expectedInflation,
        enrichedInputs.inflationScenario,
      ),
    } as unknown as BondInputs & {
      historicalData: import('@/features/bond-core/types').HistoricalDataMap;
    };

    if (
      inputsToCalculate.useTaxWrapperLimit &&
      (inputsToCalculate.taxStrategy === TaxStrategy.IKE ||
        inputsToCalculate.taxStrategy === TaxStrategy.IKZE)
    ) {
      const purchaseYear = getYear(parseISO(inputsToCalculate.purchaseDate));
      const rules = await this.data.getTaxRulesForYear(purchaseYear);
      const limitValue =
        inputsToCalculate.taxStrategy === TaxStrategy.IKE
          ? parseFloat(rules?.ikeLimit || '0')
          : parseFloat(rules?.ikzeLimit || '0');

      if (limitValue <= 0) {
        const result = calculateBondInvestment({
          ...inputsToCalculate,
          taxStrategy: TaxStrategy.STANDARD,
          rollover: shouldAutoRollover(inputsToCalculate, def.duration),
        } as BondInputs & { rollover: boolean });
        const envelope = await this.createEnvelope(
          result,
          [
            'No verified annual wrapper limit is available for this purchase year; standard taxation was used.',
          ],
          [
            'Tax-wrapper illustration was not applied because its year-specific limit is unavailable.',
          ],
          context.dataFreshness,
        );
        return {
          ...envelope,
          offerTerms: resolvedOffer,
          diagnostics: [
            ...buildSingleBondDiagnostics(
              inputsToCalculate,
              resolvedOffer,
              shouldAutoRollover(inputsToCalculate, def.duration),
            ),
            ...(result.noteDiagnostics ?? []),
            { code: 'wrapper_limit_unavailable' as const, severity: 'warning' as const },
          ],
        };
      }

      if (limitValue > 0 && inputsToCalculate.initialInvestment > limitValue) {
        const envelope = await this.calculateSplitTaxWrapper(
          inputsToCalculate,
          limitValue,
          context.dataFreshness,
        );
        return {
          ...envelope,
          offerTerms: resolvedOffer,
          diagnostics: [
            ...buildSingleBondDiagnostics(
              inputsToCalculate,
              resolvedOffer,
              shouldAutoRollover(inputsToCalculate, def.duration),
            ),
            ...(envelope.result.noteDiagnostics ?? []),
            {
              code: 'wrapper_limit_split' as const,
              severity: 'assumption' as const,
              params: { limit: limitValue },
            },
          ],
        };
      }
    }

    const warnings = this.buildHistoricalDataWarnings(inputsToCalculate.historicalData);
    const assumptions = this.generateAssumptions(inputsToCalculate);
    const resolvedRollover = shouldAutoRollover(inputsToCalculate, def.duration);
    if (resolvedOffer.source === 'series' && resolvedOffer.seriesCode) {
      assumptions.push(`Issued series resolved: ${resolvedOffer.seriesCode}`);
      if (!resolvedOffer.termsAreVerified) {
        warnings.push(
          'The issued series rate is known, but its redemption terms are not yet evidenced; the displayed fee is an estimate.',
        );
      }
    } else if (resolvedOffer.source === 'unresolved') {
      assumptions.push(
        'The selected issued series could not be verified; family-rule terms are shown as an unresolved-offer estimate.',
      );
    } else {
      assumptions.push(
        'Using the current generic bond definition because no issued series was resolved.',
      );
    }
    assumptions.push(
      resolvedRollover
        ? 'Automatic rollover enabled because the selected horizon exceeds one native bond cycle.'
        : 'Single-cycle path used because the selected horizon stays within the native bond term.',
    );

    const result = calculateBondInvestment({
      ...inputsToCalculate,
      rollover: resolvedRollover,
    } as BondInputs & { rollover: boolean });

    if (inputsToCalculate.inflationScenario) {
      const lowResult = calculateBondInvestment({
        ...inputsToCalculate,
        expectedInflation: (enrichedInputs.expectedInflation || 0) - 1.5,
        rollover: resolvedRollover,
      } as BondInputs & { rollover: boolean });
      const highResult = calculateBondInvestment({
        ...inputsToCalculate,
        expectedInflation: (enrichedInputs.expectedInflation || 0) + 2.5,
        rollover: resolvedRollover,
      } as BondInputs & { rollover: boolean });
      result.comparisonScenarios = {
        low: lowResult.timeline,
        high: highResult.timeline,
      };
    }

    if (inputsToCalculate.taxStrategy !== TaxStrategy.STANDARD) {
      const standardResult = calculateBondInvestment({
        ...inputsToCalculate,
        taxStrategy: TaxStrategy.STANDARD,
        rollover: resolvedRollover,
      } as BondInputs & { rollover: boolean });
      result.taxSavings = standardResult.totalTax - result.totalTax;
    }

    const historicalAverages = await this.data.getHistoricalAverages();

    const envelope = await this.createEnvelope(
      result,
      warnings,
      assumptions,
      context.dataFreshness,
      historicalAverages,
    );
    return {
      ...envelope,
      offerTerms: resolvedOffer,
      diagnostics: [
        ...buildSingleBondDiagnostics(inputsToCalculate, resolvedOffer, resolvedRollover),
        ...(result.noteDiagnostics ?? []),
      ],
    };
  }

  /**
   * Evaluates a deliberately small parameter sweep from one resolved issuer/data
   * snapshot.  This is intentionally separate from `handle`: a sensitivity run
   * is analysis, not a collection of independently refreshed quotations.
   */
  async calculateSensitivity(
    payload: SensitivityRequest,
    context: HandlerContext,
  ): Promise<SensitivityResponse> {
    const request = SensitivityRequestSchema.parse(payload);
    const validated = SingleBondCalculationIntentSchema.parse(request.inputs);
    const { definition, inputs: resolved } = await resolveScenarioInputs({
      data: this.data,
      inputs: validated,
      context,
      selectedSeriesId: validated.selectedSeriesId,
    });
    const snapshot = await this.withHistoricalData(resolved);
    const values = createSweepValues(request.start, request.end, request.step);
    const points: SensitivityPoint[] = values.map((value) => {
      try {
        const candidate = applySensitivityValue(snapshot, request.variable, value);
        const result = calculateBondInvestment({
          ...candidate,
          expectedInflation: this.applyInflationScenario(
            candidate.expectedInflation,
            candidate.inflationScenario,
          ),
          rollover: shouldAutoRollover(candidate, definition.duration),
        } as BondInputs & { rollover: boolean });
        return { value, netPayoutValue: result.netPayoutValue, totalProfit: result.totalProfit };
      } catch (error) {
        return {
          value,
          error: error instanceof Error ? error.message : 'Unable to calculate point.',
        };
      }
    });

    return {
      variable: request.variable,
      points,
      dataFreshness: context.dataFreshness,
      crossings: findZeroCrossings(points),
    };
  }
  private async calculateSplitTaxWrapper(
    inputs: BondInputs & { historicalData: import('@/features/bond-core/types').HistoricalDataMap },
    limit: number,
    dataFreshness: import('../types/scenarios').CalculationDataFreshness,
  ): Promise<SingleBondCalculationEnvelope> {
    const wrapperPart = calculateBondInvestment({
      ...inputs,
      initialInvestment: limit,
      rollover: shouldAutoRollover(inputs, inputs.duration),
    } as BondInputs & { rollover: boolean });

    const standardPart = calculateBondInvestment({
      ...inputs,
      initialInvestment: inputs.initialInvestment - limit,
      taxStrategy: TaxStrategy.STANDARD,
      rollover: shouldAutoRollover(inputs, inputs.duration),
    } as BondInputs & { rollover: boolean });

    const aggregatedResult: CalculationResult = {
      initialInvestment: inputs.initialInvestment,
      timeline: wrapperPart.timeline.map((point, idx) => {
        const stdPoint = standardPart.timeline[idx];
        if (!stdPoint) return point;
        return {
          ...point,
          nominalValueBeforeInterest:
            point.nominalValueBeforeInterest + stdPoint.nominalValueBeforeInterest,
          interestEarned: point.interestEarned + stdPoint.interestEarned,
          taxDeducted: point.taxDeducted + stdPoint.taxDeducted,
          netInterest: point.netInterest + stdPoint.netInterest,
          nominalValueAfterInterest:
            point.nominalValueAfterInterest + stdPoint.nominalValueAfterInterest,
          accumulatedNetInterest: point.accumulatedNetInterest + stdPoint.accumulatedNetInterest,
          totalValue: point.totalValue + stdPoint.totalValue,
          realValue: point.realValue + stdPoint.realValue,
          netProfit: point.netProfit + stdPoint.netProfit,
          earlyWithdrawalValue: point.earlyWithdrawalValue + stdPoint.earlyWithdrawalValue,
        };
      }),
      finalNominalValue: wrapperPart.finalNominalValue + standardPart.finalNominalValue,
      finalRealValue: wrapperPart.finalRealValue + standardPart.finalRealValue,
      totalProfit: wrapperPart.totalProfit + standardPart.totalProfit,
      totalTax: wrapperPart.totalTax + standardPart.totalTax,
      totalEarlyWithdrawalFee:
        wrapperPart.totalEarlyWithdrawalFee + standardPart.totalEarlyWithdrawalFee,
      grossValue: wrapperPart.grossValue + standardPart.grossValue,
      netPayoutValue: wrapperPart.netPayoutValue + standardPart.netPayoutValue,
      isEarlyWithdrawal: wrapperPart.isEarlyWithdrawal,
      maturityDate: wrapperPart.maturityDate,
      nominalAnnualizedReturn:
        (wrapperPart.nominalAnnualizedReturn * limit +
          standardPart.nominalAnnualizedReturn * (inputs.initialInvestment - limit)) /
        inputs.initialInvestment,
      realAnnualizedReturn:
        (wrapperPart.realAnnualizedReturn * limit +
          standardPart.realAnnualizedReturn * (inputs.initialInvestment - limit)) /
        inputs.initialInvestment,
      calculationNotes: [
        ...(wrapperPart.calculationNotes || []),
        `Investment split: ${limit} PLN in ${inputs.taxStrategy} wrapper, ${inputs.initialInvestment - limit} PLN in Standard account due to annual limit.`,
      ],
      noteDiagnostics: wrapperPart.noteDiagnostics,
      overflowInfo: {
        limitApplied: limit,
        amountInWrapper: limit,
        amountInStandard: inputs.initialInvestment - limit,
        standardTaxDeducted: standardPart.totalTax,
      },
    };

    const fullStandardResult = calculateBondInvestment({
      ...inputs,
      taxStrategy: TaxStrategy.STANDARD,
      rollover: shouldAutoRollover(inputs, inputs.duration),
    } as BondInputs & { rollover: boolean });
    aggregatedResult.taxSavings = fullStandardResult.totalTax - aggregatedResult.totalTax;

    const warnings = this.collectHistoricalWarnings([inputs.historicalData]);
    const assumptions = this.generateAssumptions(inputs);

    const historicalAverages = await this.data.getHistoricalAverages();

    return this.createEnvelope(
      aggregatedResult,
      warnings,
      assumptions,
      dataFreshness,
      historicalAverages,
    );
  }
}

export const SensitivityVariableSchema = z.enum(['inflation', 'nbp_rate', 'horizon_months']);
export const SensitivityRequestSchema = z
  .object({
    inputs: SingleBondCalculationIntentSchema,
    variable: SensitivityVariableSchema,
    start: z.number().finite(),
    end: z.number().finite(),
    step: z.number().finite().positive(),
  })
  .superRefine((value, ctx) => {
    if (value.end < value.start) {
      ctx.addIssue({ code: 'custom', path: ['end'], message: 'end must not precede start' });
    }
    if ((value.end - value.start) / value.step > 12.000001) {
      ctx.addIssue({
        code: 'custom',
        path: ['step'],
        message: 'A sweep may contain at most 13 points',
      });
    }
    if (value.variable === 'horizon_months' && (value.start < 1 || value.end > 360)) {
      ctx.addIssue({
        code: 'custom',
        path: ['start'],
        message: 'Horizon must be between 1 and 360 months',
      });
    }
  });

export type SensitivityRequest = z.infer<typeof SensitivityRequestSchema>;
export type SensitivityVariable = z.infer<typeof SensitivityVariableSchema>;
export interface SensitivityPoint {
  value: number;
  netPayoutValue?: number;
  totalProfit?: number;
  error?: string;
}
export interface SensitivityResponse {
  variable: SensitivityVariable;
  points: SensitivityPoint[];
  crossings: Array<{ from: number; to: number }>;
  dataFreshness: import('../types/scenarios').CalculationDataFreshness;
}

export function createSweepValues(start: number, end: number, step: number) {
  const values: number[] = [];
  for (let value = start; value <= end + step / 1_000_000; value += step) {
    values.push(Number(value.toFixed(8)));
  }
  return values;
}

function applySensitivityValue(
  inputs: BondInputs & { historicalData: BondInputs['historicalData'] },
  variable: SensitivityVariable,
  value: number,
) {
  if (variable === 'inflation') return { ...inputs, expectedInflation: value };
  if (variable === 'nbp_rate') return { ...inputs, expectedNbpRate: value };
  return {
    ...inputs,
    investmentHorizonMonths: value,
    withdrawalDate: format(addMonths(parseISO(inputs.purchaseDate), value), 'yyyy-MM-dd'),
  };
}

/** Reports brackets only; no monotonicity or unique-root claim is made. */
export function findZeroCrossings(points: SensitivityPoint[]) {
  const crossings: Array<{ from: number; to: number }> = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (
      previous.totalProfit === undefined ||
      current.totalProfit === undefined ||
      previous.error ||
      current.error
    )
      continue;
    if (previous.totalProfit >= 0 !== current.totalProfit >= 0) {
      crossings.push({ from: previous.value, to: current.value });
    }
  }
  return crossings;
}
