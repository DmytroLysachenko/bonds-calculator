'use client';

import { Suspense } from 'react';

import { ComparisonContainer } from '@/features/comparison-engine/components/ComparisonContainer';
import { useAppI18n } from '@/i18n/client';
import { FeatureStatusNotice } from '@/shared/components/feedback/FeatureStatusNotice';
import { PageSuspenseFallback } from '@/shared/components/page/PageSuspenseFallback';
import { PageTransition } from '@/shared/components/page/PageTransition';

export function ComparePageClient() {
  const { t } = useAppI18n();

  return (
    <PageTransition>
      <div className="space-y-8">
        <FeatureStatusNotice
          status="conditional"
          eyebrow={t('comparison.page_notice_eyebrow')}
          title={t('comparison.page_notice_title')}
        >
          {t('comparison.page_notice_desc')}
        </FeatureStatusNotice>
        <Suspense fallback={<PageSuspenseFallback />}>
          <ComparisonContainer />
        </Suspense>
      </div>
    </PageTransition>
  );
}
