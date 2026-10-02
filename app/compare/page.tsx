import { ComparePageClient } from '@/features/comparison-engine/components/ComparePageClient';
import { getBondDefinitionsMap } from '@/lib/data/bond-definition-data';
import { getLocalizedPageMetadata } from '@/lib/page-metadata';
import { CalculatorRouteBoundary } from '@/shared/components/page/CalculatorRouteBoundary';
import { LocalizedMetadataMarker } from '@/shared/components/page/LocalizedMetadataMarker';

export async function generateMetadata() {
  return getLocalizedPageMetadata('comparison');
}

export default async function ComparisonPage() {
  const initialDefinitions = await getBondDefinitionsMap();

  return (
    <>
      <CalculatorRouteBoundary initialDefinitions={initialDefinitions}>
        <ComparePageClient />
      </CalculatorRouteBoundary>
      <LocalizedMetadataMarker />
    </>
  );
}
