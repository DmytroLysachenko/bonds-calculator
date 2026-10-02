import { Suspense } from 'react';

import { HomeOfferProvenance } from '@/features/home/components/HomeOfferProvenance';
import { LandingDashboardClient } from '@/features/home/components/LandingDashboardClient';
import { getGlobalDataFreshness } from '@/lib/data/market-data';
import { getLocalizedPageMetadata } from '@/lib/page-metadata';
import { LocalizedMetadataMarker } from '@/shared/components/page/LocalizedMetadataMarker';

export async function generateMetadata() {
  return getLocalizedPageMetadata('home');
}

async function HomeOfferProvenanceBoundary() {
  const dataFreshness = await getGlobalDataFreshness();

  return <HomeOfferProvenance dataFreshness={dataFreshness} />;
}

export default function LandingDashboardPage() {
  return (
    <>
      <LandingDashboardClient
        offerProvenance={
          <Suspense
            fallback={<div className="h-[68px] animate-pulse border-y border-border bg-muted/40" />}
          >
            <HomeOfferProvenanceBoundary />
          </Suspense>
        }
      />
      <LocalizedMetadataMarker />
    </>
  );
}
