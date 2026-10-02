import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { RETIREMENT_SUPPORTED_BOND_TYPES } from '@/features/bond-core/support-matrix';
import { RetirementPlannerContainer } from '@/features/retirement/components/RetirementPlannerContainer';
import { getLocalizedPageMetadata } from '@/lib/page-metadata';
import { FeatureStatusNotice } from '@/shared/components/feedback/FeatureStatusNotice';
import { PageSuspenseFallback } from '@/shared/components/page/PageSuspenseFallback';
import { PageTransition } from '@/shared/components/page/PageTransition';

export async function generateMetadata() {
  return getLocalizedPageMetadata('retirement');
}

export default function RetirementPlannerPage() {
  return (
    <Suspense fallback={<PageSuspenseFallback />}>
      <RetirementPlannerPageContent />
    </Suspense>
  );
}

async function RetirementPlannerPageContent() {
  const t = await getTranslations('retirement');
  return (
    <PageTransition>
      <div className="space-y-8">
        <FeatureStatusNotice
          status="limited"
          eyebrow={t('page_notice_eyebrow')}
          title={t('page_notice_title')}
        >
          {t('page_notice_desc', {
            supportedBondTypes: RETIREMENT_SUPPORTED_BOND_TYPES.join(', '),
          })}
        </FeatureStatusNotice>
        <RetirementPlannerContainer />
      </div>
    </PageTransition>
  );
}
