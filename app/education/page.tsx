import EducationClient from '@/features/education/components/EducationClient';
import { getBondDefinitionsMap } from '@/lib/data/bond-definition-data';
import { getGlobalDataFreshness } from '@/lib/data/market-data';
import { getLocalizedPageMetadata } from '@/lib/page-metadata';
import { LocalizedMetadataMarker } from '@/shared/components/page/LocalizedMetadataMarker';
import { BondDefinitionsBoundary } from '@/shared/components/providers/BondDefinitionsBoundary';

export async function generateMetadata() {
  return getLocalizedPageMetadata('education');
}

export default async function EducationPage() {
  const [dataFreshness, initialDefinitions] = await Promise.all([
    getGlobalDataFreshness(),
    getBondDefinitionsMap(),
  ]);

  return (
    <>
      <BondDefinitionsBoundary initialDefinitions={initialDefinitions}>
        <EducationClient dataFreshness={dataFreshness} />
      </BondDefinitionsBoundary>
      <LocalizedMetadataMarker />
    </>
  );
}
