'use client';

import { Suspense } from 'react';

import { MultiAssetComparisonContainer } from '@/features/comparison-engine/components/MultiAssetComparisonContainer';
import { useAppI18n } from '@/i18n/client';
import { FeatureStatusNotice } from '@/shared/components/feedback/FeatureStatusNotice';
import { PageSuspenseFallback } from '@/shared/components/page/PageSuspenseFallback';
import { PageTransition } from '@/shared/components/page/PageTransition';
import { SecondarySurfaceIntro } from '@/shared/components/page/SecondarySurfaceIntro';

export function MultiAssetPageClient() {
  const { t } = useAppI18n();

  return (
    <PageTransition>
      <div className="space-y-8">
        <SecondarySurfaceIntro
          eyebrow={t('multi_asset_page.page_notice_eyebrow')}
          title={t('multi_asset_page.hero_title')}
          description={t('multi_asset_page.hero_description')}
          actions={[
            {
              href: '/single-calculator',
              label: t('multi_asset_page.primary_cta'),
            },
            {
              href: '/compare',
              label: t('multi_asset_page.secondary_cta'),
              variant: 'outline',
            },
          ]}
        />

        <FeatureStatusNotice
          status="experimental"
          eyebrow={t('multi_asset_page.page_notice_eyebrow')}
          title={t('multi_asset_page.page_notice_title')}
        >
          {t('multi_asset_page.page_notice_desc')}
        </FeatureStatusNotice>

        <div className="grid gap-4 md:grid-cols-3">
          {(['context_only', 'start_month', 'after_core'] as const).map((itemKey) => (
            <div key={itemKey} className="border-t border-border py-5">
              <p className="ui-body text-muted-foreground">
                {t(`multi_asset_page.guide_cards.${itemKey}`)}
              </p>
            </div>
          ))}
        </div>

        <Suspense fallback={<PageSuspenseFallback />}>
          <MultiAssetComparisonContainer />
        </Suspense>
      </div>
    </PageTransition>
  );
}
