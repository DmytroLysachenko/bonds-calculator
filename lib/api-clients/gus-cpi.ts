import { parseISO, startOfMonth } from 'date-fns';

import { fetchSyncArrayBuffer, fetchSyncText } from '@/lib/sync/http-gateway';

export interface GusCpiPoint {
  date: string;
  value: number;
}

const GUS_CPI_ARCHIVE_PAGE_URL =
  'https://stat.gov.pl/obszary-tematyczne/ceny-handel/wskazniki-cen/wskazniki-cen-towarow-i-uslug-konsumpcyjnych-pot-inflacja-/miesieczne-wskazniki-cen-towarow-i-uslug-konsumpcyjnych-od-1982-roku/';

const GUS_CPI_PRESENTATION_LABEL = 'Analogiczny miesiac poprzedniego roku = 100';
const GUS_CPI_MONTHLY_PRESENTATION_LABEL = 'Poprzedni miesiac = 100';

function normalizePolishText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDecimal(value: string) {
  return Number.parseFloat(value.replace(',', '.'));
}

function buildMonthDate(year: string, month: string) {
  return `${year}-${month.padStart(2, '0')}-01`;
}

export function parseGusCpiCsvContent(
  csvText: string,
  startDate?: string,
  endDate?: string,
): GusCpiPoint[] {
  return parseGusCpiPresentation(csvText, GUS_CPI_PRESENTATION_LABEL, startDate, endDate);
}

/** Month-on-month CPI change, distinct from the yearly CPI assumption series. */
export function parseGusCpiMonthlyCsvContent(
  csvText: string,
  startDate?: string,
  endDate?: string,
): GusCpiPoint[] {
  return parseGusCpiPresentation(csvText, GUS_CPI_MONTHLY_PRESENTATION_LABEL, startDate, endDate);
}

function parseGusCpiPresentation(
  csvText: string,
  presentationLabel: string,
  startDate?: string,
  endDate?: string,
): GusCpiPoint[] {
  const start = startDate ? startOfMonth(parseISO(startDate)) : null;
  const end = endDate ? startOfMonth(parseISO(endDate)) : null;
  const rows = csvText.split(/\r?\n/);
  const points: GusCpiPoint[] = [];

  for (const row of rows.slice(1)) {
    if (!row.trim()) continue;

    const parts = row.split(';');
    if (parts.length < 6) continue;

    const presentation = normalizePolishText(parts[2] ?? '');
    const year = (parts[3] ?? '').trim();
    const month = (parts[4] ?? '').trim();
    const rawValue = (parts[5] ?? '').trim();

    if (presentation !== presentationLabel) continue;
    if (!year || !month || !rawValue) continue;

    const indexValue = parseDecimal(rawValue);
    if (!Number.isFinite(indexValue)) continue;

    const date = buildMonthDate(year, month);
    const monthDate = startOfMonth(parseISO(date));

    if (start && monthDate < start) continue;
    if (end && monthDate > end) continue;

    // The selected presentation has a 100-based index. Its period is encoded
    // by presentationLabel; the two series must never share a data-series slug.
    points.push({
      date,
      value: Number((indexValue - 100).toFixed(2)),
    });
  }

  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export class GusCpiApiClient {
  static readonly archivePageUrl = GUS_CPI_ARCHIVE_PAGE_URL;

  async fetchHistoricalData(startDate?: string, endDate?: string): Promise<GusCpiPoint[]> {
    const csvText = await this.fetchArchiveCsv();
    return parseGusCpiCsvContent(csvText, startDate, endDate);
  }

  async fetchMonthlyHistoricalData(startDate?: string, endDate?: string): Promise<GusCpiPoint[]> {
    const csvText = await this.fetchArchiveCsv();
    return parseGusCpiMonthlyCsvContent(csvText, startDate, endDate);
  }

  private async fetchArchiveCsv() {
    const archiveHtml = await fetchSyncText(GUS_CPI_ARCHIVE_PAGE_URL, {
      cache: 'no-store',
    });
    const csvPathMatch = archiveHtml.match(
      /\/download\/gfx\/[^"'<>]*miesieczne[_-]?wskazniki[_-]?cen[_-]?towarow[_-]?i[_-]?uslug[_-]?konsumpcyjnych[_-]?od[_-]?1982[_-]?roku[^"'<>]*\.csv/i,
    );

    if (!csvPathMatch) {
      throw new Error('Could not locate official GUS CPI CSV link on archive page.');
    }

    const csvUrl = new URL(csvPathMatch[0], GUS_CPI_ARCHIVE_PAGE_URL).toString();
    const buffer = await fetchSyncArrayBuffer(csvUrl, {
      cache: 'no-store',
    });
    const decoder = new TextDecoder('windows-1250');
    const csvText = decoder.decode(buffer);

    return csvText;
  }
}
