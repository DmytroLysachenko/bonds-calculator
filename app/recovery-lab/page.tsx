import { RecoveryLabPageClient } from '@/features/recovery-lab/components/RecoveryLabPageClient';
import { getLocalizedPageMetadata } from '@/lib/page-metadata';
import { LocalizedMetadataMarker } from '@/shared/components/page/LocalizedMetadataMarker';

export async function generateMetadata() {
  return getLocalizedPageMetadata('recovery_lab');
}

export default function RecoveryLabPage() {
  return (
    <>
      <RecoveryLabPageClient />
      <LocalizedMetadataMarker />
    </>
  );
}
