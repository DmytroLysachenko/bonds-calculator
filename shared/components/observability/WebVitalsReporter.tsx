'use client';

import { useEffect } from 'react';

import { shouldReportWebVital } from '@/shared/lib/telemetry-controls';
import { toWebVitalPayload, type WebVitalPayload } from '@/shared/lib/web-vitals-payload';

function send(metric: Omit<WebVitalPayload, 'path' | 'navigationType'>) {
  const navigation = performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined;
  const body = JSON.stringify(
    toWebVitalPayload(metric, window.location.pathname, navigation?.type ?? 'navigate'),
  );

  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      '/api/observability/vitals',
      new Blob([body], { type: 'application/json' }),
    );
    return;
  }

  void fetch('/api/observability/vitals', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
    keepalive: true,
  });
}

export function WebVitalsReporter() {
  useEffect(() => {
    const privacyNavigator = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (
      !shouldReportWebVital({
        doNotTrack: navigator.doNotTrack,
        globalPrivacyControl: privacyNavigator.globalPrivacyControl,
      })
    ) {
      return;
    }

    void import('web-vitals').then(({ onCLS, onINP, onLCP }) => {
      onCLS(send);
      onINP(send);
      onLCP(send);
    });
  }, []);

  return null;
}
