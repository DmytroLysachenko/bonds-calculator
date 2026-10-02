import { ScenarioKind } from '../types/scenarios';

import { HandlerData } from './base';
import { ComparisonHandler } from './comparison';
import { OptimizerHandler } from './optimizer';
import { PortfolioSimulationHandler } from './portfolio-simulation';
import { RegularInvestmentHandler } from './regular-investment';
import { RetirementPlannerHandler } from './retirement-planner';
import { SingleBondHandler } from './single-bond';

export * from './base';
export * from './comparison';
export * from './optimizer';
export * from './portfolio-simulation';
export * from './regular-investment';
export * from './retirement-planner';
export * from './single-bond';

export class HandlerFactory {
  /** Exhaustive registry: each kind retains its request/result pairing. */
  private readonly handlers: {
    [ScenarioKind.SINGLE_BOND]: SingleBondHandler;
    [ScenarioKind.REGULAR_INVESTMENT]: RegularInvestmentHandler;
    [ScenarioKind.BOND_COMPARISON]: ComparisonHandler;
    [ScenarioKind.PORTFOLIO_SIMULATION]: PortfolioSimulationHandler;
    [ScenarioKind.BOND_OPTIMIZER]: OptimizerHandler;
    [ScenarioKind.RETIREMENT_PLANNER]: RetirementPlannerHandler;
  };

  constructor(data: HandlerData) {
    this.handlers = {
      [ScenarioKind.SINGLE_BOND]: new SingleBondHandler(data),
      [ScenarioKind.REGULAR_INVESTMENT]: new RegularInvestmentHandler(data),
      [ScenarioKind.BOND_COMPARISON]: new ComparisonHandler(data),
      [ScenarioKind.PORTFOLIO_SIMULATION]: new PortfolioSimulationHandler(data),
      [ScenarioKind.BOND_OPTIMIZER]: new OptimizerHandler(data),
      [ScenarioKind.RETIREMENT_PLANNER]: new RetirementPlannerHandler(data),
    };
  }

  getHandler<TKind extends ScenarioKind>(kind: TKind): (typeof this.handlers)[TKind] {
    return this.handlers[kind];
  }
}
