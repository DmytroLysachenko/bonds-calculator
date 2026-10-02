import { parseISO } from 'date-fns';

import { differenceInMonths, getWithdrawalDateFromMonths } from '@/shared/lib/date-timing';

import { BondInputs, BondType, TaxStrategy } from '../types';
import {
  BondOptimizerCalculationEnvelope,
  BondOptimizerPayload,
  BondOptimizerResult,
  BondOptimizerResultItem,
  ScenarioKind,
} from '../types/scenarios';
import { buildAssumptionDiagnostics } from '../utils/calculation-evidence';
import { calculateBondInvestment } from '../utils/calculations';

import { BaseHandler, HandlerContext, ScenarioHandler } from './base';
import { resolveScenarioInputs } from './resolved-inputs';

export class OptimizerHandler
  extends BaseHandler
  implements ScenarioHandler<ScenarioKind.BOND_OPTIMIZER, BondOptimizerPayload, BondOptimizerResult>
{
  readonly kind: ScenarioKind.BOND_OPTIMIZER = ScenarioKind.BOND_OPTIMIZER;

  async handle(
    payload: BondOptimizerPayload,
    context: HandlerContext,
  ): Promise<BondOptimizerCalculationEnvelope> {
    const allBondTypes = Object.keys(context.dbDefinitions) as BondType[];
    const withdrawalDate =
      payload.withdrawalDate ??
      (payload.investmentHorizonMonths
        ? getWithdrawalDateFromMonths(payload.purchaseDate, payload.investmentHorizonMonths)
        : undefined);

    if (!withdrawalDate) {
      throw new Error('Withdrawal date or investment horizon is required for optimization');
    }

    const horizonMonths = differenceInMonths(
      parseISO(payload.purchaseDate),
      parseISO(withdrawalDate),
    );
    const horizonYears = horizonMonths / 12;

    const rankedBonds: BondOptimizerResultItem[] = [];

    for (const bondType of allBondTypes) {
      const def = context.dbDefinitions[bondType];

      if (def.isFamilyOnly && !payload.includeFamilyBonds) {
        continue;
      }

      const { inputs: resolvedInputs } = await resolveScenarioInputs({
        data: this.data,
        inputs: {
          bondType,
          purchaseDate: payload.purchaseDate,
        },
        context,
      });
      const enrichedInputs = await this.withHistoricalData({
        ...resolvedInputs,
        initialInvestment: payload.initialInvestment,
        expectedInflation: payload.expectedInflation,
        expectedNbpRate: payload.expectedNbpRate ?? 5.25,
        taxRate: 19,
        withdrawalDate,
        isRebought: false,
        taxStrategy: payload.taxStrategy ?? TaxStrategy.STANDARD,
        rollover: true,
      });

      const result = calculateBondInvestment(enrichedInputs as BondInputs & { rollover: boolean });

      let reason = '';
      if (def.duration === horizonYears) {
        reason = `Duration closely matches the ${horizonYears}-year horizon.`;
      } else if (def.duration < horizonYears) {
        reason = `Shorter duration (${def.duration}y) requires rollover to cover the full horizon.`;
      } else {
        reason = `Longer duration (${def.duration}y) implies early redemption around year ${horizonYears.toFixed(1)}.`;
      }

      if (def.isInflationIndexed) {
        reason += ' Includes inflation linkage in later years.';
      }

      rankedBonds.push({
        bondType,
        name: def.fullName.en,
        netPayoutValue: result.netPayoutValue,
        totalProfit: result.totalProfit,
        effectiveTaxRate: result.totalProfit > 0 ? (result.totalTax / result.totalProfit) * 100 : 0,
        isHighestPayout: false,
        scenarioReason: reason,
        result,
      });
    }

    rankedBonds.sort((a, b) => b.netPayoutValue - a.netPayoutValue);

    if (rankedBonds.length > 0) {
      rankedBonds[0].isHighestPayout = true;
    }

    const assumptions = this.generateAssumptions(payload);
    assumptions.push(
      `Ranking metric: Highest projected net payout after ${horizonYears.toFixed(1)} years in this scenario.`,
    );

    return this.createEnvelope(
      {
        rankedBonds,
        highestPayout: rankedBonds[0],
      },
      [],
      assumptions,
      context.dataFreshness,
      undefined,
      [
        ...buildAssumptionDiagnostics(payload),
        {
          code: 'ranking_net_payout',
          severity: 'assumption',
          params: { years: horizonYears.toFixed(1) },
        },
      ],
    );
  }
}
