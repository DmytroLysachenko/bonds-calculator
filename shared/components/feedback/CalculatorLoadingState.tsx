import { Skeleton } from '@/components/ui/skeleton';

type CalculatorLoadingStateProps = {
  metricCount?: 1 | 2 | 3;
  chartClassName?: string;
};

const metricGridClassByCount = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
} as const;

/** Keeps first-calculation feedback consistent without hiding a committed result. */
export function CalculatorLoadingState({
  metricCount = 3,
  chartClassName = 'h-[300px] md:h-[420px]',
}: CalculatorLoadingStateProps) {
  return (
    <div className="ui-control-stack" aria-hidden="true">
      <div className="ui-surface-flush space-y-4 p-5 md:p-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-2/3 max-w-sm" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <div className={`ui-metric-grid grid-cols-1 ${metricGridClassByCount[metricCount]}`}>
        {Array.from({ length: metricCount }, (_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-md" />
        ))}
      </div>
      <Skeleton className={`w-full rounded-md ${chartClassName}`} />
    </div>
  );
}
