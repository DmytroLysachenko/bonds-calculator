import { MultiAssetPageClient } from '@/features/comparison-engine/components/MultiAssetPageClient';
import { getLocalizedPageMetadata } from '@/lib/page-metadata';
import { LocalizedMetadataMarker } from '@/shared/components/page/LocalizedMetadataMarker';

export async function generateMetadata() {
  return getLocalizedPageMetadata('multi_asset');
}

export default function MultiAssetComparisonPage() {
  return (
    <>
      <MultiAssetPageClient />
      <LocalizedMetadataMarker />
    </>
  );
}
