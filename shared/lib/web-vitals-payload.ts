import { telemetryRoute } from './telemetry-route';

type WebVitalName = 'CLS' | 'INP' | 'LCP';

export interface WebVitalPayload {
  name: WebVitalName;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  path: string;
  navigationType: string;
}

type WebVitalMetric = Pick<WebVitalPayload, 'name' | 'value' | 'rating'> & Record<string, unknown>;

/**
 * Deliberately serializes only the anonymous fields accepted by the telemetry
 * endpoint. `web-vitals` metrics also contain browser performance entries.
 */
export function toWebVitalPayload(
  metric: WebVitalMetric,
  path: string,
  navigationType: string,
): WebVitalPayload {
  return {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    path: telemetryRoute(path),
    navigationType,
  };
}
