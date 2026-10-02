import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  BondOptimizerPayload,
  CalculationScenarioRequest,
  RegularInvestmentCalculationIntent,
  RetirementPlannerPayload,
  ScenarioKind,
  SingleBondCalculationIntent,
} from '@/features/bond-core/types/scenarios';
import {
  BondComparisonScenarioPayloadSchema,
  BondOptimizerPayloadSchema,
  parseCalculationScenarioRequest,
  RegularInvestmentCalculationIntentSchema,
  RetirementPlannerPayloadSchema,
  SingleBondCalculationIntentSchema,
} from '@/features/bond-core/types/schemas';
import { calculationService } from '@/lib/server/calculation/composition';

import { apiHandler } from './api-handler';
import { calculationRateLimitPolicy } from './rate-limiter';
import { readJsonBody } from './read-json-body';
import { okJson } from './responses';

type PayloadByScenarioKind = {
  [ScenarioKind.SINGLE_BOND]: SingleBondCalculationIntent;
  [ScenarioKind.REGULAR_INVESTMENT]: RegularInvestmentCalculationIntent;
  [ScenarioKind.BOND_COMPARISON]: z.infer<typeof BondComparisonScenarioPayloadSchema>;
  [ScenarioKind.BOND_OPTIMIZER]: BondOptimizerPayload;
  [ScenarioKind.RETIREMENT_PLANNER]: RetirementPlannerPayload;
};

const scenarioSchemas = {
  [ScenarioKind.SINGLE_BOND]: SingleBondCalculationIntentSchema,
  [ScenarioKind.REGULAR_INVESTMENT]: RegularInvestmentCalculationIntentSchema,
  [ScenarioKind.BOND_COMPARISON]: BondComparisonScenarioPayloadSchema,
  [ScenarioKind.BOND_OPTIMIZER]: BondOptimizerPayloadSchema,
  [ScenarioKind.RETIREMENT_PLANNER]: RetirementPlannerPayloadSchema,
} as const;

export function createCalculationRoute<
  TKind extends keyof PayloadByScenarioKind & CalculationScenarioRequest['kind'],
>(kind: TKind) {
  return apiHandler(
    async (req: NextRequest) => {
      const payload = (await readJsonBody(
        req,
        scenarioSchemas[kind],
      )) as PayloadByScenarioKind[TKind];
      const request = parseCalculationScenarioRequest({ kind, payload });

      const envelope = await calculationService.calculate(request as CalculationScenarioRequest);

      return okJson(envelope);
    },
    { rateLimitPolicy: calculationRateLimitPolicy },
  );
}
