export enum SimulationEventType {
  CONTRIBUTION = 'CONTRIBUTION',
  PURCHASE = 'PURCHASE',
  RATE_RESET = 'RATE_RESET',
  INTEREST_ACCRUAL = 'INTEREST_ACCRUAL',
  PAYOUT = 'PAYOUT',
  TAX_SETTLEMENT = 'TAX_SETTLEMENT',
  EARLY_REDEMPTION_FEE = 'EARLY_REDEMPTION_FEE',
  ROLLOVER_PURCHASE = 'ROLLOVER_PURCHASE',
  MATURITY = 'MATURITY',
  WITHDRAWAL = 'WITHDRAWAL',
}

export interface SimulationEvent {
  type: SimulationEventType;
  date: string;
  description: string;
  value?: number;
  metadata?: Record<string, unknown>;
}
