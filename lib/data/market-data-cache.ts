import { parseISO } from 'date-fns';

const MARKET_DATA_CACHE_TTL_MS = 1000 * 60 * 5;

type Timer = ReturnType<typeof setTimeout>;
type CacheEntry = { data: unknown; expirationTimer: Timer };

/**
 * Bounded-time cache module. Each process owns an instance; callers cannot
 * mistake its contents for a durable data revision.
 */
export function createMarketDataCache(
  ttlMs = MARKET_DATA_CACHE_TTL_MS,
  timers = {
    clear: clearTimeout,
    set: setTimeout,
  },
) {
  const entries = new Map<string, CacheEntry>();

  function get<T>(key: string): T | null {
    const cached = entries.get(key);
    return (cached?.data as T | undefined) ?? null;
  }

  function set(key: string, data: unknown) {
    const existing = entries.get(key);
    if (existing) timers.clear(existing.expirationTimer);

    const expirationTimer = timers.set(() => entries.delete(key), ttlMs);
    expirationTimer.unref?.();
    entries.set(key, { data, expirationTimer });
  }

  function invalidate(prefix = '') {
    for (const key of entries.keys()) {
      if (!key.startsWith(prefix)) continue;
      const cached = entries.get(key);
      if (cached) timers.clear(cached.expirationTimer);
      entries.delete(key);
    }
  }

  return { get, set, invalidate };
}

const macroCache = createMarketDataCache();

export const CPI_SLUGS = ['pl-cpi', 'inflation-pl'];
/** GUS CPI month-over-month change; never interchangeable with CPI_SLUGS. */
export const CPI_MOM_SLUGS = ['pl-cpi-mom'];
export const NBP_RATE_SLUGS = ['nbp-ref-rate', 'nbp-reference-rate', 'nbp-rate'];
export const SP500_SLUGS = ['sp500'];
export const GOLD_SLUGS = ['gold-usd', 'gold'];
export const USD_PLN_SLUGS = ['usd-pln', 'usdpln'];

export function getCached<T>(key: string): T | null {
  return macroCache.get<T>(key);
}

export function setCache(key: string, data: unknown) {
  macroCache.set(key, data);
}

/** Clears a coherent data namespace after an authoritative synchronization. */
export function invalidateCached(prefix = '') {
  macroCache.invalidate(prefix);
}

export function getSeriesReferenceDate(series: {
  slug: string;
  frequency?: string | null;
  lastDataPointDate?: string | null;
  updatedAt?: Date | null;
}) {
  return series.lastDataPointDate
    ? parseISO(series.lastDataPointDate)
    : (series.updatedAt ?? undefined);
}
