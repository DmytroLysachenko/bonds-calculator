'use client';

import { SimulationEvent } from '@/features/bond-core/types/simulation';
import { buildCashFlowRows } from '@/shared/lib/cash-flow-display';

export function CashFlowReconciliation({ events }: { events: SimulationEvent[] }) {
  const rows = buildCashFlowRows(events);
  return (
    <section className="ui-result-panel" aria-labelledby="cash-flow-title">
      <h2 id="cash-flow-title" className="ui-heading-sm">
        Cash-flow reconciliation
      </h2>
      <p className="ui-meta mt-1 text-muted-foreground">
        Each settlement is shown separately; positive values are incoming cash and negative values
        are deductions or purchases.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Date</th>
              <th className="text-left">Event</th>
              <th className="text-right">Gross</th>
              <th className="text-right">Net cash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.date}-${row.kind}-${index}`} className="border-t">
                <td className="py-2">{row.date}</td>
                <td>{row.description}</td>
                <td className="text-right">{row.gross.toFixed(2)}</td>
                <td className="text-right">{row.netCash.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
