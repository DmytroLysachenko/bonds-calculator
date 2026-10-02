import type { CalculationDiagnostic } from '../../types/scenarios';

export function shouldStopSingleBondSimulation({
  rollover,
  isEarlyWithdrawal,
  actualCycleEndDate,
  targetWithdrawalDate,
}: {
  rollover: boolean;
  isEarlyWithdrawal: boolean;
  actualCycleEndDate: Date;
  targetWithdrawalDate: Date;
}) {
  return (
    !rollover ||
    isEarlyWithdrawal ||
    actualCycleEndDate.getTime() === targetWithdrawalDate.getTime()
  );
}

export function buildSingleBondTerminalNotes({
  rollover,
  cycleIndex,
  isEarlyWithdrawal,
}: {
  rollover: boolean;
  cycleIndex: number;
  isEarlyWithdrawal: boolean;
}) {
  const notes = [
    rollover
      ? `Simulation covered ${cycleIndex} bond cycle${cycleIndex === 1 ? '' : 's'} across the selected horizon.`
      : 'Rollover is disabled; the simulation stops at the first bond cycle or selected withdrawal date.',
  ];

  if (isEarlyWithdrawal) {
    notes.push('Early redemption fee logic was applied before the native maturity date.');
  }

  return notes;
}

export function buildSingleBondTerminalDiagnostics({
  rollover,
  cycleIndex,
  isEarlyWithdrawal,
}: {
  rollover: boolean;
  cycleIndex: number;
  isEarlyWithdrawal: boolean;
}): CalculationDiagnostic[] {
  return [
    rollover
      ? { code: 'rollover_cycles', severity: 'assumption', params: { count: cycleIndex } }
      : { code: 'rollover_disabled', severity: 'assumption' },
    ...(isEarlyWithdrawal
      ? [{ code: 'early_redemption_applied' as const, severity: 'assumption' as const }]
      : []),
  ];
}
