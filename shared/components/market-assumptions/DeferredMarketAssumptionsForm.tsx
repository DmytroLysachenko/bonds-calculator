'use client';

import dynamic from 'next/dynamic';

import { Skeleton } from '@/components/ui/skeleton';
import type { MarketAssumptionsFormProps } from '@/shared/components/MarketAssumptionsForm';

const MarketAssumptionsForm = dynamic(
  () =>
    import('@/shared/components/MarketAssumptionsForm').then(
      (module) => module.MarketAssumptionsForm,
    ),
  {
    loading: () => <Skeleton className="h-32 w-full rounded-md" />,
  },
);

/** Loads the macro-assumption controls only after an advanced section is expanded. */
export function DeferredMarketAssumptionsForm(props: MarketAssumptionsFormProps) {
  return <MarketAssumptionsForm {...props} />;
}
