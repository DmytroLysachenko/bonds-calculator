import { getWithdrawalDateFromMonths } from '@/shared/lib/date-timing';

import { BondInputs, TaxStrategy } from '../types';
import {
  BondComparisonCalculationEnvelope,
  BondComparisonScenarioItem,
  CalculationDiagnostic,
  IndependentBondComparisonPayload,
  NormalizedBondComparisonPayload,
  ScenarioKind,
} from '../types/scenarios';
import { BondComparisonScenarioRequestSchema } from '../types/schemas';
import {
  buildAssumptionDiagnostics,
  mergeHistoricalDiagnostics,
} from '../utils/calculation-evidence';

import { BaseHandler, HandlerContext, ScenarioHandler } from './base';
import { calculateComparisonScenarioItem } from './comparison-result';
import { resolveScenarioInputs } from './resolved-inputs';

export class ComparisonHandler
  extends BaseHandler
  implements
    ScenarioHandler<
      ScenarioKind.BOND_COMPARISON,
      NormalizedBondComparisonPayload | IndependentBondComparisonPayload,
      BondComparisonScenarioItem[]
    >
{
  readonly kind: ScenarioKind.BOND_COMPARISON = ScenarioKind.BOND_COMPARISON;

  async handle(
    payload: NormalizedBondComparisonPayload | IndependentBondComparisonPayload,
    context: HandlerContext,
  ): Promise<BondComparisonCalculationEnvelope> {
    const request = BondComparisonScenarioRequestSchema.parse({
      kind: ScenarioKind.BOND_COMPARISON,
      payload,
    });

    if (request.payload.mode === 'independent') {
      return this.calculateIndependentComparison(
        request.payload as IndependentBondComparisonPayload,
        context,
      );
    }

    return this.calculateNormalizedComparison(
      request.payload as NormalizedBondComparisonPayload,
      context,
    );
  }

  private async calculateNormalizedComparison(
    payload: NormalizedBondComparisonPayload,
    context: HandlerContext,
  ): Promise<BondComparisonCalculationEnvelope> {
    const scenarioInputs = await this.buildComparisonScenarioInputs(payload, context);
    const enrichedScenarios = await Promise.all(
      scenarioInputs.map((scenarioInput) => this.withHistoricalData(scenarioInput)),
    );

    const results = enrichedScenarios.map((enrichedInputs): BondComparisonScenarioItem => {
      const def = context.dbDefinitions[enrichedInputs.bondType];
      return calculateComparisonScenarioItem({
        inputs: enrichedInputs,
        definition: def,
        expectedInflation: this.applyInflationScenario(
          enrichedInputs.expectedInflation,
          enrichedInputs.inflationScenario,
        ),
      });
    });

    const warnings = this.collectHistoricalWarnings(
      enrichedScenarios.map((scenario) => scenario.historicalData),
    );
    const assumptions = this.generateAssumptions(payload);
    assumptions.push('Comparison scenarios are normalized through the shared comparison service.');
    assumptions.push(
      'Each bond uses the nearest issued series available for the shared purchase date when present.',
    );
    assumptions.push(
      'Rollover is inferred automatically when the shared horizon exceeds a bond’s native term.',
    );

    return this.createEnvelope(results, warnings, assumptions, context.dataFreshness, undefined, [
      ...buildAssumptionDiagnostics(payload),
      ...mergeHistoricalDiagnostics(enrichedScenarios.map((scenario) => scenario.historicalData)),
      { code: 'comparison_normalized', severity: 'assumption' },
      { code: 'comparison_nearest_issue', severity: 'assumption' },
      { code: 'comparison_rollover_inferred', severity: 'assumption' },
    ]);
  }

  private async calculateIndependentComparison(
    payload: IndependentBondComparisonPayload,
    context: HandlerContext,
  ): Promise<BondComparisonCalculationEnvelope> {
    const [resolvedA, resolvedB] = await Promise.all([
      this.buildIndependentScenarioInputs(payload.sharedConfig, payload.scenarioA, context),
      this.buildIndependentScenarioInputs(payload.sharedConfig, payload.scenarioB, context),
    ]);
    const [scenarioA, scenarioB] = await Promise.all([
      this.withHistoricalData(resolvedA.inputs),
      this.withHistoricalData(resolvedB.inputs),
    ]);

    const resultA = calculateComparisonScenarioItem({
      scenarioKey: 'scenarioA',
      inputs: scenarioA,
      definition: context.dbDefinitions[scenarioA.bondType],
      expectedInflation: this.applyInflationScenario(
        scenarioA.expectedInflation,
        scenarioA.inflationScenario,
      ),
      maturityMode: payload.scenarioA.strategyPolicy ?? payload.sharedConfig.strategyPolicy,
      couponDisposition:
        payload.scenarioA.couponDisposition ?? payload.sharedConfig.couponDisposition,
      offerTerms: resolvedA.offerTerms,
    });

    const resultB = calculateComparisonScenarioItem({
      scenarioKey: 'scenarioB',
      inputs: scenarioB,
      definition: context.dbDefinitions[scenarioB.bondType],
      expectedInflation: this.applyInflationScenario(
        scenarioB.expectedInflation,
        scenarioB.inflationScenario,
      ),
      maturityMode: payload.scenarioB.strategyPolicy ?? payload.sharedConfig.strategyPolicy,
      couponDisposition:
        payload.scenarioB.couponDisposition ?? payload.sharedConfig.couponDisposition,
      offerTerms: resolvedB.offerTerms,
    });

    const results: BondComparisonScenarioItem[] = [resultA, resultB];

    const warnings = this.collectHistoricalWarnings([
      scenarioA.historicalData,
      scenarioB.historicalData,
    ]);
    const assumptions = [
      ...this.generateScenarioAssumptions('Scenario A', payload.scenarioA),
      ...this.generateScenarioAssumptions('Scenario B', payload.scenarioB),
    ];
    assumptions.push(
      'Independent comparison resolves issued-series terms per scenario purchase date when present.',
    );
    if (
      payload.scenarioA.strategyPolicy === undefined &&
      payload.scenarioB.strategyPolicy === undefined
    ) {
      assumptions.push(
        `Maturity handling: ${describeMaturityMode(payload.sharedConfig.strategyPolicy)}.`,
      );
    }
    if (
      payload.scenarioA.couponDisposition === undefined &&
      payload.scenarioB.couponDisposition === undefined
    ) {
      assumptions.push(
        `Coupon handling: ${payload.sharedConfig.couponDisposition === 'cash' ? 'paid coupons are held as zero-rate cash' : 'eligible coupons remain available to the strategy'}.`,
      );
    }
    for (const [label, override] of [
      ['Scenario A', payload.scenarioA],
      ['Scenario B', payload.scenarioB],
    ] as const) {
      assumptions.push(
        `${label} maturity handling: ${describeMaturityMode(override.strategyPolicy ?? payload.sharedConfig.strategyPolicy)}.`,
      );
      assumptions.push(
        `${label} coupon handling: ${(override.couponDisposition ?? payload.sharedConfig.couponDisposition) === 'cash' ? 'paid coupons are held as zero-rate cash' : 'eligible coupons remain available to the strategy'}.`,
      );
    }

    const maturityCode: CalculationDiagnostic['code'] =
      payload.sharedConfig.strategyPolicy === 'cash_after_maturity'
        ? 'maturity_cash_after_maturity'
        : payload.sharedConfig.strategyPolicy === 'hold_to_maturity'
          ? 'maturity_hold_to_maturity'
          : payload.sharedConfig.strategyPolicy === 'reinvest_until_horizon'
            ? 'maturity_reinvest_until_horizon'
            : 'maturity_auto';
    const hasSidePolicy =
      payload.scenarioA.strategyPolicy !== undefined ||
      payload.scenarioB.strategyPolicy !== undefined ||
      payload.scenarioA.couponDisposition !== undefined ||
      payload.scenarioB.couponDisposition !== undefined;
    const sidePolicyDiagnostics: CalculationDiagnostic[] = hasSidePolicy
      ? (
          [
            ['A', payload.scenarioA],
            ['B', payload.scenarioB],
          ] as const
        ).flatMap(([side, override]) => {
          const policy = override.strategyPolicy ?? payload.sharedConfig.strategyPolicy;
          const coupon = override.couponDisposition ?? payload.sharedConfig.couponDisposition;
          const sideMaturityCode: CalculationDiagnostic['code'] =
            policy === 'cash_after_maturity'
              ? 'comparison_side_maturity_cash_after_maturity'
              : policy === 'hold_to_maturity'
                ? 'comparison_side_maturity_hold_to_maturity'
                : policy === 'reinvest_until_horizon'
                  ? 'comparison_side_maturity_reinvest_until_horizon'
                  : 'comparison_side_maturity_auto';
          return [
            { code: sideMaturityCode, severity: 'assumption' as const, params: { side } },
            {
              code:
                coupon === 'cash'
                  ? ('comparison_side_coupon_cash' as const)
                  : ('comparison_side_coupon_reinvest' as const),
              severity: 'assumption' as const,
              params: { side },
            },
          ];
        })
      : [];
    return this.createEnvelope(results, warnings, assumptions, context.dataFreshness, undefined, [
      ...buildAssumptionDiagnostics(payload.sharedConfig),
      ...mergeHistoricalDiagnostics([scenarioA.historicalData, scenarioB.historicalData]),
      { code: 'comparison_independent', severity: 'assumption' },
      ...(!hasSidePolicy ? [{ code: maturityCode, severity: 'assumption' as const }] : []),
      ...(!hasSidePolicy
        ? [
            {
              code:
                payload.sharedConfig.couponDisposition === 'cash'
                  ? ('coupon_cash' as const)
                  : ('coupon_reinvest' as const),
              severity: 'assumption' as const,
            },
          ]
        : []),
      ...sidePolicyDiagnostics,
    ]);
  }

  private async buildComparisonScenarioInputs(
    request: NormalizedBondComparisonPayload,
    context: HandlerContext,
  ): Promise<BondInputs[]> {
    return Promise.all(
      request.bondTypes.map(async (type) => {
        const { inputs: resolvedInputs } = await resolveScenarioInputs({
          data: this.data,
          inputs: {
            bondType: type,
            purchaseDate: request.purchaseDate,
          },
          context,
        });

        return {
          ...resolvedInputs,
          initialInvestment: request.initialInvestment,
          expectedInflation: request.expectedInflation,
          expectedNbpRate: request.expectedNbpRate ?? 5.25,
          customInflation: request.customInflation,
          customNbpRate: request.customNbpRate,
          inflationScenario: request.inflationScenario,
          taxRate: 19,
          withdrawalDate: request.withdrawalDate,
          isRebought: false,
          taxStrategy: request.taxStrategy ?? TaxStrategy.STANDARD,
          timingMode: 'exact' as import('@/shared/lib/date-timing').TimingMode,
          investmentHorizonMonths: undefined,
        };
      }),
    );
  }

  private async buildIndependentScenarioInputs(
    sharedConfig: IndependentBondComparisonPayload['sharedConfig'],
    scenario: IndependentBondComparisonPayload['scenarioA'],
    context: HandlerContext,
  ): Promise<{
    inputs: BondInputs;
    offerTerms: BondComparisonScenarioItem['offerTerms'];
  }> {
    const purchaseDate = scenario.purchaseDate ?? sharedConfig.purchaseDate;
    const { inputs: resolvedInputs, resolvedOffer } = await resolveScenarioInputs({
      data: this.data,
      inputs: {
        bondType: scenario.bondType,
        selectedSeriesId: scenario.selectedSeriesId,
        purchaseDate,
      },
      context,
      selectedSeriesId: scenario.selectedSeriesId,
    });
    const timingMode = scenario.timingMode ?? sharedConfig.timingMode ?? 'general';
    const investmentHorizonMonths =
      scenario.investmentHorizonMonths ?? sharedConfig.investmentHorizonMonths;
    const withdrawalDate =
      scenario.withdrawalDate ??
      (timingMode === 'general' && investmentHorizonMonths
        ? getWithdrawalDateFromMonths(purchaseDate, investmentHorizonMonths)
        : sharedConfig.withdrawalDate);

    return {
      offerTerms: resolvedOffer,
      inputs: {
        ...resolvedInputs,
        initialInvestment: sharedConfig.initialInvestment,
        expectedInflation: sharedConfig.expectedInflation,
        expectedNbpRate: sharedConfig.expectedNbpRate ?? 5.25,
        customInflation: sharedConfig.customInflation,
        customNbpRate: sharedConfig.customNbpRate,
        inflationScenario: sharedConfig.inflationScenario,
        taxRate: 19,
        withdrawalDate,
        isRebought: false,
        taxStrategy: scenario.taxStrategy ?? sharedConfig.taxStrategy ?? TaxStrategy.STANDARD,
        timingMode,
        investmentHorizonMonths,
      },
    };
  }

  private generateScenarioAssumptions(
    label: string,
    inputs: Partial<BondInputs> & {
      expectedInflation?: number;
      expectedNbpRate?: number;
      customInflation?: number[];
    },
  ): string[] {
    return this.generateAssumptions(inputs).map((assumption) => `${label}: ${assumption}`);
  }
}

function describeMaturityMode(
  mode: IndependentBondComparisonPayload['sharedConfig']['strategyPolicy'],
) {
  switch (mode) {
    case 'cash_after_maturity':
      return 'matured principal is held as zero-rate cash';
    case 'hold_to_maturity':
      return 'each scenario stops at its native maturity';
    case 'reinvest_until_horizon':
      return 'matured principal is reinvested until the selected horizon';
    default:
      return 'automatic rollover to the selected shared horizon';
  }
}
