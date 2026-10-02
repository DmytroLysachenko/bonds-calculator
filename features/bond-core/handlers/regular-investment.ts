import { RegularInvestmentInputs, RegularInvestmentResult } from '../types';
import {
  RegularInvestmentCalculationEnvelope,
  RegularInvestmentCalculationIntent,
  ScenarioKind,
} from '../types/scenarios';
import { RegularInvestmentCalculationIntentSchema } from '../types/schemas';
import {
  buildAssumptionDiagnostics,
  buildHistoricalDiagnostics,
  buildOfferDiagnostics,
} from '../utils/calculation-evidence';
import { calculateRegularInvestment } from '../utils/calculations';
import { buildContributionSchedule } from '../utils/engine/contribution-schedule';

import { BaseHandler, HandlerContext, ScenarioHandler } from './base';

export class RegularInvestmentHandler
  extends BaseHandler
  implements
    ScenarioHandler<
      ScenarioKind.REGULAR_INVESTMENT,
      RegularInvestmentCalculationIntent,
      RegularInvestmentResult
    >
{
  readonly kind: ScenarioKind.REGULAR_INVESTMENT = ScenarioKind.REGULAR_INVESTMENT;

  async handle(
    payload: RegularInvestmentCalculationIntent,
    context: HandlerContext,
  ): Promise<RegularInvestmentCalculationEnvelope> {
    const validatedInputs = RegularInvestmentCalculationIntentSchema.parse(payload);
    const def = context.dbDefinitions[validatedInputs.bondType];
    const resolvedOffer = await this.data.resolveBondOfferTerms(
      validatedInputs.bondType,
      validatedInputs.purchaseDate,
      context.dbDefinitions,
    );

    const inputsWithDefaults = {
      ...validatedInputs,
      firstYearRate: resolvedOffer.firstYearRate ?? def.firstYearRate,
      margin: resolvedOffer.margin ?? def.margin,
      duration: def.duration,
      earlyWithdrawalFee: resolvedOffer.earlyWithdrawalFee ?? def.earlyWithdrawalFee,
      taxRate: 19,
      isCapitalized: def.isCapitalized,
      payoutFrequency: def.payoutFrequency,
      rebuyDiscount: def.rebuyDiscount,
    };

    const enrichedInputs = await this.withHistoricalData(inputsWithDefaults);
    const inputsToCalculate = {
      ...enrichedInputs,
      expectedInflation: this.applyInflationScenario(
        enrichedInputs.expectedInflation,
        enrichedInputs.inflationScenario,
      ),
    } as RegularInvestmentInputs;
    const warnings = this.buildHistoricalDataWarnings(inputsToCalculate.historicalData);
    const assumptions = this.generateAssumptions(inputsToCalculate);
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

    const result = calculateRegularInvestment(inputsToCalculate);
    if (inputsToCalculate.allocationTargets?.length) {
      result.mixedAllocation = await this.calculateMixedAllocation(inputsToCalculate, context);
    }

    return this.createEnvelope(result, warnings, assumptions, context.dataFreshness, undefined, [
      ...buildAssumptionDiagnostics(inputsToCalculate),
      ...buildHistoricalDiagnostics(inputsToCalculate.historicalData),
      ...buildOfferDiagnostics(resolvedOffer),
    ]);
  }

  private async calculateMixedAllocation(
    inputs: RegularInvestmentInputs,
    context: HandlerContext,
  ): Promise<NonNullable<RegularInvestmentResult['mixedAllocation']>> {
    const schedule = buildContributionSchedule(inputs);
    const rows = await Promise.all(
      (inputs.allocationTargets ?? []).map(async (target) => {
        const definition = context.dbDefinitions[target.bondType];
        const offer = await this.data.resolveBondOfferTerms(
          target.bondType,
          inputs.purchaseDate,
          context.dbDefinitions,
        );
        const allocatedFlows = schedule.map((flow) => ({
          date: flow.date,
          amount: Number(((flow.amount * target.percent) / 100).toFixed(2)),
        }));
        const familyResult = calculateRegularInvestment({
          ...inputs,
          bondType: target.bondType,
          contributionAmount: 0,
          initialLumpSum: 0,
          annualContributionIncreasePercent: 0,
          skippedContributionDates: [],
          contributionOverrides: [],
          oneOffContributions: allocatedFlows,
          allocationTargets: undefined,
          firstYearRate: offer.firstYearRate ?? definition.firstYearRate,
          margin: offer.margin ?? definition.margin,
          duration: definition.duration,
          earlyWithdrawalFee: offer.earlyWithdrawalFee ?? definition.earlyWithdrawalFee,
          isCapitalized: definition.isCapitalized,
          payoutFrequency: definition.payoutFrequency,
          rebuyDiscount: definition.rebuyDiscount,
        });
        return {
          target,
          value: familyResult.finalNominalValue,
          residual: familyResult.cashBalance,
        };
      }),
    );
    const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
    const benchmark = inputs.cashBenchmark;
    const cashBenchmark = benchmark
      ? calculateCashBenchmark(schedule, benchmark, inputs.purchaseDate, inputs.withdrawalDate)
      : undefined;
    return {
      totalValue,
      residualCash: rows.reduce((sum, row) => sum + row.residual, 0),
      actualWeights: rows.map((row) => ({
        bondType: row.target.bondType,
        targetPercent: row.target.percent,
        value: row.value,
        actualPercent: totalValue > 0 ? (row.value / totalValue) * 100 : 0,
      })),
      cashBenchmark: cashBenchmark
        ? { ...cashBenchmark, annualRate: benchmark!.annualRate, taxRate: benchmark!.taxRate }
        : undefined,
    };
  }
}

function calculateCashBenchmark(
  schedule: ReturnType<typeof buildContributionSchedule>,
  benchmark: NonNullable<RegularInvestmentInputs['cashBenchmark']>,
  start: string,
  end: string,
) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  let balance = 0;
  let previous = startDate;
  for (const flow of schedule) {
    const date = new Date(`${flow.date}T00:00:00`);
    balance *= Math.pow(
      1 + benchmark.annualRate / 100 / (benchmark.capitalization === 'monthly' ? 12 : 1),
      Math.max(
        0,
        (date.getTime() - previous.getTime()) /
          86_400_000 /
          (benchmark.capitalization === 'monthly' ? 30.4375 : 365.25),
      ),
    );
    balance += flow.amount;
    previous = date;
  }
  balance *= Math.pow(
    1 + benchmark.annualRate / 100 / (benchmark.capitalization === 'monthly' ? 12 : 1),
    Math.max(
      0,
      (endDate.getTime() - previous.getTime()) /
        86_400_000 /
        (benchmark.capitalization === 'monthly' ? 30.4375 : 365.25),
    ),
  );
  const contributions = schedule.reduce((sum, flow) => sum + flow.amount, 0);
  return { finalValue: balance - (Math.max(0, balance - contributions) * benchmark.taxRate) / 100 };
}
