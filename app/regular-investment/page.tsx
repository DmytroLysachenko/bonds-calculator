import { RegularInvestmentCalculatorContainer } from '@/features/regular-investment/components/RegularInvestmentCalculatorContainer';
import { getBondDefinitionsMap } from '@/lib/data/bond-definition-data';
import { getLocalizedPageMetadata } from '@/lib/page-metadata';
import { CalculatorRouteBoundary } from '@/shared/components/page/CalculatorRouteBoundary';
import { LocalizedMetadataMarker } from '@/shared/components/page/LocalizedMetadataMarker';

export async function generateMetadata() {
  return getLocalizedPageMetadata('regular_investment');
}

export default async function RegularInvestmentPage() {
  const initialDefinitions = await getBondDefinitionsMap();

  return (
    <>
      <CalculatorRouteBoundary suspense transition initialDefinitions={initialDefinitions}>
        <RegularInvestmentCalculatorContainer />
      </CalculatorRouteBoundary>
      <LocalizedMetadataMarker />
    </>
  );
}
