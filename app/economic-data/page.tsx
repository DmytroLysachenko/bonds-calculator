import { Suspense } from 'react';

import { EconomicDataPageClient } from '@/features/economic-data/components/EconomicDataPageClient';
import { type EconomicView, parseEconomicView } from '@/features/economic-data/lib/economic-view';
import { getLocalizedPageMetadata } from '@/lib/page-metadata';
import { BondDefinitionsBoundary } from '@/shared/components/providers/BondDefinitionsBoundary';

export async function generateMetadata() {
  return getLocalizedPageMetadata('economic_data');
}

export default function EconomicDataPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={null}>
      <EconomicDataContent searchParams={searchParams} />
    </Suspense>
  );
}

async function EconomicDataContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, Array.isArray(value) ? value[0] : value]],
    ),
  );
  const initialView: EconomicView = parseEconomicView(params);

  return (
    <BondDefinitionsBoundary>
      <EconomicDataPageClient initialView={initialView} />
    </BondDefinitionsBoundary>
  );
}
