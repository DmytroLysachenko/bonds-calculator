'use client';

import { ArrowDownRight } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';

import { educationDecisionRoutes } from '@/features/education/constants/education-content';
import { getIssueAvailability } from '@/features/education/lib/issue-availability';
import { useAppI18n } from '@/i18n/client';
import { bondSeriesClient, type BondSeriesMetadata } from '@/shared/lib/bond-series-client';

export function EducationDecisionRail() {
  const { t } = useAppI18n();
  const { data: issues, error } = useSWR<BondSeriesMetadata[]>(
    '/api/calculate/bond-series',
    () => bondSeriesClient.listAll(),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  return (
    <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {educationDecisionRoutes.map((route, index) => (
        <li key={route.key} className="min-w-0">
          <div className="h-full">
            <Link
              href={`#offers-${route.groupKey}`}
              className="ui-interactive-surface group flex h-full gap-3 rounded-md border border-border bg-card px-4 py-4 hover:border-foreground/30 hover:bg-muted/30 xl:relative xl:block"
            >
              <span
                className="font-mono text-[11px] font-semibold text-muted-foreground"
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1 xl:mt-5">
                <span className="flex items-center gap-2">
                  <route.icon className="size-3.5 shrink-0 text-foreground" aria-hidden="true" />
                  <span className="text-sm font-semibold text-foreground">
                    {t(`education.decision.${route.key}.label`)}
                  </span>
                </span>
                <span className="mt-2 block font-mono text-lg font-semibold tracking-tight text-foreground">
                  {route.bondTypes.join(' / ')}
                </span>
                <span className="mt-3 block text-base leading-6 text-muted-foreground">
                  {t(`education.decision.${route.key}.description`)}
                </span>
                <span className="mt-3 block border-t border-border pt-2 text-sm font-medium text-muted-foreground">
                  {issues
                    ? t(
                        issues.some(
                          (issue) =>
                            route.bondTypes.some((type) =>
                              issue.seriesCode.toUpperCase().startsWith(type),
                            ) && getIssueAvailability(issue) === 'current',
                        )
                          ? 'education.decision.stored_current_issue'
                          : 'education.decision.no_stored_current_issue',
                      )
                    : error
                      ? t('education.decision.availability_unknown')
                      : t('education.decision.checking_availability')}
                </span>
              </span>
              <ArrowDownRight
                className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none group-hover:translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </div>
        </li>
      ))}
    </ol>
  );
}
