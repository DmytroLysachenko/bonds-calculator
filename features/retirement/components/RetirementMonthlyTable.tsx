import type { RetirementPlannerResult } from '@/features/bond-core/types/scenarios';

interface Props {
  timeline: RetirementPlannerResult['timeline'];
  title: string;
  description: string;
  dateLabel: string;
  balanceLabel: string;
  withdrawalLabel: string;
  formatCurrency: (value: number) => string;
}

export function RetirementMonthlyTable({
  timeline,
  title,
  description,
  dateLabel,
  balanceLabel,
  withdrawalLabel,
  formatCurrency,
}: Props) {
  return (
    <details className="rounded-lg border border-border bg-card">
      <summary className="ui-focus-ring cursor-pointer px-4 py-3 font-semibold">{title}</summary>
      <div className="border-t border-border px-4 pb-4 pt-3">
        <p className="mb-3 text-sm text-muted-foreground">{description}</p>
        <div className="max-h-96 overflow-auto">
          <table className="w-full min-w-[420px] text-left text-sm tabular-nums">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="p-2">
                  {dateLabel}
                </th>
                <th scope="col" className="p-2 text-right">
                  {withdrawalLabel}
                </th>
                <th scope="col" className="p-2 text-right">
                  {balanceLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((point) => (
                <tr key={point.date} className="border-b border-border last:border-b-0">
                  <th scope="row" className="p-2 font-medium">
                    {point.date}
                  </th>
                  <td className="p-2 text-right">{formatCurrency(point.withdrawal)}</td>
                  <td className="p-2 text-right">{formatCurrency(point.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}
