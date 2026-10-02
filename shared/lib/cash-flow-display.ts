import { SimulationEvent, SimulationEventType } from '@/features/bond-core/types/simulation';

export interface CashFlowRow {
  date: string;
  kind: SimulationEventType;
  gross: number;
  netCash: number;
  description: string;
}

/** A display projection only: engine events remain the financial source of truth. */
export function buildCashFlowRows(events: SimulationEvent[]): CashFlowRow[] {
  return events.map((event) => {
    const gross = event.value ?? 0;
    const outflow = [
      SimulationEventType.PURCHASE,
      SimulationEventType.TAX_SETTLEMENT,
      SimulationEventType.EARLY_REDEMPTION_FEE,
      SimulationEventType.WITHDRAWAL,
    ].includes(event.type);
    return {
      date: event.date.slice(0, 10),
      kind: event.type,
      gross,
      netCash: outflow ? -gross : gross,
      description: event.description,
    };
  });
}

export function reconcileCashFlows({
  contributions,
  terminalWealth,
  paidOutValue,
  totalProfit,
}: {
  contributions: number;
  terminalWealth: number;
  paidOutValue: number;
  totalProfit: number;
}) {
  return {
    contributions,
    earnings: totalProfit,
    holdingsAndCash: terminalWealth,
    paidOutValue,
    difference: contributions + totalProfit - terminalWealth - paidOutValue,
  };
}
