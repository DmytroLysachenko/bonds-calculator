import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import BondOptimizerClient from '@/features/optimizer/components/BondOptimizerClient';
import { getLocalizedPageMetadata } from '@/lib/page-metadata';
import { FeatureStatusNotice } from '@/shared/components/feedback/FeatureStatusNotice';
import { PageTransition } from '@/shared/components/page/PageTransition';

export async function generateMetadata() {
  return getLocalizedPageMetadata('optimize');
}

export default function BondOptimizerPage() {
  return (
    <Suspense fallback={null}>
      <BondOptimizerPageContent />
    </Suspense>
  );
}

async function BondOptimizerPageContent() {
  const t = await getTranslations('optimizer_page');
  return (
    <PageTransition>
      <div className="space-y-8 py-8">
        <FeatureStatusNotice
          status="experimental"
          eyebrow={t('page_notice_eyebrow')}
          title={t('page_notice_title')}
        >
          {t('page_notice_desc')}
        </FeatureStatusNotice>

        <BondOptimizerClient />
      </div>
    </PageTransition>
  );
}
