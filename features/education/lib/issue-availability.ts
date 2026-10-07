import { isIsoCalendarDate } from '@/features/bond-core/types/iso-calendar-date';
import type { BondSeriesMetadata } from '@/shared/lib/bond-series-client';
import { toDateString } from '@/shared/lib/date-timing';

export function getIssueAvailability(issue: BondSeriesMetadata, today = toDateString(new Date())) {
  if (!issue.sellStartDate || !issue.sellEndDate || !issue.maturityDate) return 'issue_unavailable';
  if (
    !isIsoCalendarDate(issue.sellStartDate) ||
    !isIsoCalendarDate(issue.sellEndDate) ||
    !isIsoCalendarDate(issue.maturityDate) ||
    issue.sellStartDate > issue.sellEndDate ||
    issue.maturityDate <= issue.sellStartDate
  )
    return 'issue_unavailable';
  if (issue.sellEndDate < today) return 'historical';
  if (issue.sellStartDate > today) return 'upcoming';
  return 'current';
}
