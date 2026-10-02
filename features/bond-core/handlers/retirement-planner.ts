import { addMonths, format, parseISO } from 'date-fns';
import Decimal from 'decimal.js';

import { supportsRetirementBondType } from '../support-matrix';
import { BondType, TaxStrategy } from '../types';
import {
  RetirementPlannerCalculationEnvelope,
  RetirementPlannerPayload,
  RetirementPlannerResult,
  ScenarioKind,
} from '../types/scenarios';
import { buildAssumptionDiagnostics } from '../utils/calculation-evidence';

import { BaseHandler, HandlerContext, ScenarioHandler } from './base';

export class RetirementPlannerHandler
  extends BaseHandler
  implements
    ScenarioHandler<
      ScenarioKind.RETIREMENT_PLANNER,
      RetirementPlannerPayload,
      RetirementPlannerResult
    >
{
  readonly kind: ScenarioKind.RETIREMENT_PLANNER = ScenarioKind.RETIREMENT_PLANNER;

  private resolveModeledAnnualRate(payload: RetirementPlannerPayload, context: HandlerContext) {
    const bondDef = context.dbDefinitions[payload.bondType];

    if (payload.bondType === BondType.ROR || payload.bondType === BondType.DOR) {
      return payload.expectedNbpRate ?? bondDef.firstYearRate;
    }

    if (
      payload.bondType === BondType.EDO ||
      payload.bondType === BondType.COI ||
      payload.bondType === BondType.ROS ||
      payload.bondType === BondType.ROD
    ) {
      return payload.expectedInflation + bondDef.margin;
    }

    return bondDef.firstYearRate;
  }

  async handle(
    payload: RetirementPlannerPayload,
    context: HandlerContext,
  ): Promise<RetirementPlannerCalculationEnvelope> {
    if (!supportsRetirementBondType(payload.bondType)) {
      throw new Error(`Unsupported retirement bond family: ${payload.bondType}`);
    }
    if (payload.taxStrategy === undefined) {
      throw new Error('A retirement tax strategy is required');
    }
    const horizonMonths = payload.horizonYears * 12;
    // ApplicationService normalizes legacy requests before cache identity is
    // computed. The fallback keeps direct handler tests deterministic only
    // when they deliberately supply a date.
    const purchaseDate = payload.projectionStartDate ?? format(new Date(), 'yyyy-MM-dd');
    const modeledAnnualRate = this.resolveModeledAnnualRate(payload, context);

    let currentBalance = payload.initialCapital;
    const timeline: RetirementPlannerResult['timeline'] = [];
    let totalWithdrawn = 0;
    let totalTaxPaid = 0;
    let exhaustionMonth: number | undefined;
    let exhaustionDate: string | undefined;

    const monthlyWithdrawal = payload.monthlyWithdrawal;
    const start = parseISO(purchaseDate);

    for (let m = 0; m <= horizonMonths; m++) {
      const currentDate = addMonths(start, m);
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      let withdrawalAmount = 0;
      if (m > 0) {
        // A completed month earns interest before its end-of-month withdrawal.
        const monthlyRate = new Decimal(modeledAnnualRate).dividedBy(1200);
        const interest = new Decimal(currentBalance).times(monthlyRate);
        const tax =
          payload.taxStrategy === TaxStrategy.STANDARD && interest.isPositive()
            ? interest.times(0.19)
            : new Decimal(0);
        totalTaxPaid += tax.toNumber();
        currentBalance += interest.minus(tax).toNumber();
        withdrawalAmount = Math.min(Math.max(0, currentBalance), monthlyWithdrawal);
        currentBalance -= withdrawalAmount;
        totalWithdrawn += withdrawalAmount;
        if (currentBalance <= 0 && exhaustionMonth === undefined) {
          exhaustionMonth = m;
          exhaustionDate = dateStr;
        }
      }

      timeline.push({
        year: Math.floor(m / 12),
        month: m % 12,
        date: dateStr,
        balance: Math.max(0, currentBalance),
        withdrawal: withdrawalAmount,
        isProjected: true,
      });

      if (currentBalance <= 0 && m > 0) {
        break;
      }
    }

    const result: RetirementPlannerResult = {
      isSustainable: currentBalance > 0 && exhaustionMonth === undefined,
      exhaustionYear: exhaustionMonth !== undefined ? Math.floor(exhaustionMonth / 12) : undefined,
      exhaustionMonth: exhaustionMonth !== undefined ? exhaustionMonth % 12 : undefined,
      exhaustionDate,
      finalBalance: Math.max(0, currentBalance),
      totalWithdrawn,
      totalTaxPaid,
      modeledAnnualRate,
      modeledMonthlyNetRate:
        payload.taxStrategy === TaxStrategy.STANDARD
          ? (modeledAnnualRate / 12) * 0.81
          : modeledAnnualRate / 12,
      modeledBondType: payload.bondType,
      modelType: 'steady-rate',
      timeline,
    };

    const assumptions = this.generateAssumptions(payload);
    assumptions.push(`Retirement horizon: ${payload.horizonYears} years`);
    assumptions.push(`Desired monthly withdrawal: ${payload.monthlyWithdrawal} PLN`);
    assumptions.push(`Model type: steady-rate depletion model using ${payload.bondType}.`);
    assumptions.push(`Modeled annual rate: ${modeledAnnualRate.toFixed(2)}%.`);
    assumptions.push(
      'Steady-rate approximation: each completed month accrues interest, then pays the available withdrawal; no issuer-exact bond liquidation is modeled.',
    );

    return this.createEnvelope(result, [], assumptions, context.dataFreshness, undefined, [
      ...buildAssumptionDiagnostics(payload),
      {
        code: 'retirement_horizon',
        severity: 'assumption',
        params: { years: payload.horizonYears },
      },
      {
        code: 'retirement_withdrawal',
        severity: 'assumption',
        params: { amount: payload.monthlyWithdrawal },
      },
      {
        code: 'retirement_steady_rate',
        severity: 'assumption',
        params: { bond: payload.bondType },
      },
      {
        code: 'retirement_rate',
        severity: 'assumption',
        params: { rate: modeledAnnualRate.toFixed(2) },
      },
      { code: 'retirement_approximation', severity: 'assumption' },
    ]);
  }
}
