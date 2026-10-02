import { addMonths, compareAsc, format, isBefore, parseISO } from 'date-fns';

import { BondInputs, TaxStrategy } from '../types';
import {
  CalculationDiagnostic,
  PortfolioSimulationCalculationEnvelope,
  PortfolioSimulationItem,
  PortfolioSimulationPayload,
  PortfolioSimulationResult,
  ScenarioKind,
} from '../types/scenarios';
import {
  buildAssumptionDiagnostics,
  buildHistoricalDiagnostics,
} from '../utils/calculation-evidence';
import { calculateBondInvestment } from '../utils/calculations';
import { priceIndexPathForProjection } from '../utils/engine/price-index';

import { BaseHandler, HandlerContext, ScenarioHandler } from './base';
import { resolveScenarioInputs } from './resolved-inputs';

function getEarliestPurchaseDate(investments: PortfolioSimulationPayload['investments']) {
  return investments.reduce(
    (min, investment) =>
      isBefore(parseISO(investment.purchaseDate), parseISO(min)) ? investment.purchaseDate : min,
    investments[0].purchaseDate,
  );
}

function getPointDate(point: PortfolioSimulationItem['result']['timeline'][number]) {
  return parseISO(point.cycleEndDate);
}

function buildAggregateDates(items: PortfolioSimulationItem[], minDate: Date, maxDate: Date) {
  const dates = new Map<string, Date>();
  for (let cursor = minDate; !isBefore(maxDate, cursor); cursor = addMonths(cursor, 1)) {
    dates.set(format(cursor, 'yyyy-MM-dd'), cursor);
  }
  dates.set(format(maxDate, 'yyyy-MM-dd'), maxDate);
  for (const item of items) {
    for (const point of item.result.timeline) {
      const date = getPointDate(point);
      if (!isBefore(date, minDate) && !isBefore(maxDate, date)) {
        dates.set(format(date, 'yyyy-MM-dd'), date);
      }
    }
  }
  return Array.from(dates.values()).sort(compareAsc);
}

export class PortfolioSimulationHandler
  extends BaseHandler
  implements
    ScenarioHandler<
      ScenarioKind.PORTFOLIO_SIMULATION,
      PortfolioSimulationPayload,
      PortfolioSimulationResult
    >
{
  readonly kind: ScenarioKind.PORTFOLIO_SIMULATION = ScenarioKind.PORTFOLIO_SIMULATION;

  async handle(
    payload: PortfolioSimulationPayload,
    context: HandlerContext,
  ): Promise<PortfolioSimulationCalculationEnvelope> {
    const items: PortfolioSimulationItem[] = [];
    const unresolvedOfferWarnings: string[] = [];
    const unresolvedOfferDiagnostics: CalculationDiagnostic[] = [];
    const resolvedByIdentity = new Map<string, ReturnType<typeof resolveScenarioInputs>>();
    const calculatedByInput = new Map<string, PortfolioSimulationItem['result']>();
    const allHistoricalData = await this.withHistoricalData({
      purchaseDate: getEarliestPurchaseDate(payload.investments),
      withdrawalDate: payload.withdrawalDate,
    });

    for (const inv of payload.investments) {
      const identity = JSON.stringify([
        inv.bondType,
        inv.purchaseDate,
        inv.selectedSeriesId ?? null,
      ]);
      let resolution = resolvedByIdentity.get(identity);
      if (!resolution) {
        resolution = resolveScenarioInputs({
          data: this.data,
          inputs: { bondType: inv.bondType, purchaseDate: inv.purchaseDate },
          context,
          selectedSeriesId: inv.selectedSeriesId,
        });
        resolvedByIdentity.set(identity, resolution);
      }
      const { inputs: resolvedInputs, offerIsUnresolved } = await resolution;
      if (offerIsUnresolved) {
        unresolvedOfferWarnings.push(
          `Issued series for ${inv.bondType} could not be verified; this projection uses a labelled family-rule estimate.`,
        );
        unresolvedOfferDiagnostics.push({
          code: 'portfolio_unresolved_issue',
          severity: 'warning',
          params: { bond: inv.bondType },
        });
      }
      const calculationInputs = {
        ...resolvedInputs,
        initialInvestment: inv.amount,
        expectedInflation: payload.expectedInflation,
        expectedNbpRate: payload.expectedNbpRate ?? 5.25,
        taxRate: 19,
        withdrawalDate: payload.withdrawalDate,
        isRebought: inv.isRebought ?? false,
        taxStrategy: inv.taxStrategy ?? TaxStrategy.STANDARD,
        rollover: inv.rollover ?? false,
        historicalData: allHistoricalData.historicalData as BondInputs['historicalData'],
      } as BondInputs & { rollover: boolean };
      const calculationKey = JSON.stringify(calculationInputs);
      let result = calculatedByInput.get(calculationKey);
      if (!result) {
        result = calculateBondInvestment(calculationInputs);
        calculatedByInput.set(calculationKey, result);
      }
      items.push({
        bondType: inv.bondType,
        amount: inv.amount,
        purchaseDate: inv.purchaseDate,
        result,
      });
    }

    const aggregatedTimeline: PortfolioSimulationResult['aggregatedTimeline'] = [];
    const minDate = parseISO(allHistoricalData.purchaseDate);
    const maxDate = parseISO(payload.withdrawalDate);
    // Portfolio aggregation must not sum each holding's already-deflated value:
    // holdings begin on different dates. Deflate the aggregate once against a
    // single portfolio anchor through the same price-index service as single
    // and recurring calculations.
    const priceIndexPath = priceIndexPathForProjection(minDate, payload.expectedInflation);
    const cursors = items.map(() => ({ index: -1, tax: 0 }));
    for (const curr of buildAggregateDates(items, minDate, maxDate)) {
      const dateStr = format(curr, 'yyyy-MM-dd');
      let totalNominalValue = 0;
      let totalNetValue = 0;
      let totalProfit = 0;
      let totalTax = 0;
      let totalFees = 0;

      for (const [itemIndex, item] of items.entries()) {
        const cursor = cursors[itemIndex];
        while (
          cursor.index + 1 < item.result.timeline.length &&
          compareAsc(getPointDate(item.result.timeline[cursor.index + 1]), curr) <= 0
        ) {
          cursor.index += 1;
          cursor.tax += item.result.timeline[cursor.index].taxDeducted;
        }
        const point = cursor.index >= 0 ? item.result.timeline[cursor.index] : null;
        if (point) {
          totalNominalValue += point.nominalValueAfterInterest;
          totalNetValue += point.totalValue;
          totalProfit += point.netProfit;
          const isFinal = compareAsc(curr, getPointDate(item.result.timeline.at(-1)!)) >= 0;
          totalTax += isFinal ? item.result.totalTax : cursor.tax;
          totalFees += isFinal ? item.result.totalEarlyWithdrawalFee : 0;
        }
      }

      aggregatedTimeline.push({
        date: dateStr,
        totalNominalValue,
        totalNetValue,
        totalRealValue: priceIndexPath.deflate(totalNetValue, minDate, curr).toNumber(),
        priceIndexFactor: priceIndexPath.factorBetween(minDate, curr).toNumber(),
        totalProfit,
        totalTax,
        totalFees,
      });
    }

    const result: PortfolioSimulationResult = {
      items,
      aggregatedTimeline,
      summary: {
        totalInvested: items.reduce((sum, item) => sum + item.amount, 0),
        totalNetValue: aggregatedTimeline[aggregatedTimeline.length - 1]?.totalNetValue || 0,
        totalRealValue: aggregatedTimeline[aggregatedTimeline.length - 1]?.totalRealValue || 0,
        totalProfit: aggregatedTimeline[aggregatedTimeline.length - 1]?.totalProfit || 0,
      },
    };

    return this.createEnvelope(
      result,
      unresolvedOfferWarnings,
      [
        'Portfolio simulation aggregates lot timelines by checkpoint date and carries the latest known lot value between sparse engine points.',
        'Total fees are reported as redemption fees, not early-exit payout values.',
      ],
      context.dataFreshness,
      undefined,
      [
        ...buildAssumptionDiagnostics(payload),
        ...buildHistoricalDiagnostics(allHistoricalData.historicalData),
        ...unresolvedOfferDiagnostics,
        { code: 'portfolio_sparse_checkpoints', severity: 'assumption' },
        { code: 'portfolio_fee_semantics', severity: 'assumption' },
      ],
    );
  }
}
