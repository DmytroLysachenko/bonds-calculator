import { Skeleton } from '@/components/ui/skeleton';

import { pageLayout } from './layout-system';

export function PageSuspenseFallback({ showSidebar = true }: { showSidebar?: boolean }) {
  return (
    <div
      className="grid grid-cols-1 gap-8 xl:grid-cols-12 xl:gap-10"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading page…</span>
      {showSidebar ? (
        <div className="space-y-6 xl:col-span-4">
          <Skeleton className="h-[96px] w-full rounded-lg md:h-[120px]" />
          <Skeleton className="h-[420px] w-full rounded-lg md:h-[640px]" />
        </div>
      ) : null}

      <div
        className={
          showSidebar
            ? `${pageLayout.sectionFlow} xl:col-span-8`
            : `${pageLayout.sectionFlow} xl:col-span-12`
        }
      >
        <div className="space-y-3 border-b border-border pb-8">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-8 w-full max-w-[16rem] rounded-md md:h-10 md:max-w-[20rem]" />
          <Skeleton className="h-4 w-full max-w-2xl rounded-md" />
          <Skeleton className="h-4 w-full max-w-xl rounded-md" />
        </div>
        <Skeleton className="h-[200px] w-full rounded-lg bg-muted md:h-[220px]" />
        <Skeleton className="h-[320px] w-full rounded-lg bg-muted md:h-[420px]" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="h-[160px] w-full rounded-lg bg-muted md:h-[180px]" />
          <Skeleton className="h-[160px] w-full rounded-lg bg-muted md:h-[180px]" />
        </div>
      </div>
    </div>
  );
}
