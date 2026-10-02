import { connection } from 'next/server';
import { Suspense } from 'react';

async function RequestConnection() {
  await connection();
  return null;
}

/**
 * Marks a route with cookie-localized metadata as intentionally request-aware
 * while preserving its visible content in the static shell.
 */
export function LocalizedMetadataMarker() {
  return (
    <Suspense fallback={null}>
      <RequestConnection />
    </Suspense>
  );
}
