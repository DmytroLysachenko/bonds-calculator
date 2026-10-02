'use client';

import { BarChart2, Calendar, ShieldAlert, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { useAppI18n } from '@/i18n/client';
import {
  FeatureStatusNotice,
  FeatureStatusPill,
} from '@/shared/components/feedback/FeatureStatusNotice';
import { InfoTooltip } from '@/shared/components/feedback/InfoTooltip';
import { SecondarySurfaceIntro } from '@/shared/components/page/SecondarySurfaceIntro';

const recoveryLabPages = [
  {
    href: '/optimize',
    i18nKey: 'optimize',
    status: 'experimental' as const,
    icon: TrendingUp,
  },
  {
    href: '/multi-asset',
    i18nKey: 'multi_asset',
    status: 'experimental' as const,
    icon: BarChart2,
  },
  {
    href: '/retirement',
    i18nKey: 'retirement',
    status: 'limited' as const,
    icon: Calendar,
  },
];

export function RecoveryLabPageClient() {
  const { t } = useAppI18n();
  const intro = t('recovery_lab_page.description_long');

  return (
    <div className="space-y-8">
      <SecondarySurfaceIntro
        eyebrow={t('recovery_lab_page.eyebrow')}
        title={t('recovery_lab_page.title')}
        description={intro}
        actions={[
          {
            href: '/single-calculator',
            label: t('recovery_lab_page.back_to_core'),
          },
          {
            href: '/',
            label: t('recovery_lab_page.back_home'),
            variant: 'outline',
          },
        ]}
        tone="amber"
      />

      <FeatureStatusNotice
        status="experimental"
        eyebrow={t('recovery_lab_page.eyebrow')}
        title={t('recovery_lab_page.why_separated')}
      >
        {t('recovery_lab_page.why_separated_desc')}
      </FeatureStatusNotice>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {recoveryLabPages.map((page) => (
          <div key={page.href} className="relative h-full">
            <Link href={page.href} className="group block h-full">
              <article className="flex h-full flex-col gap-5 border-t border-border py-5 pr-10 transition-colors group-hover:border-foreground">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-lg bg-muted p-2.5 text-foreground">
                    <page.icon className="h-4.5 w-4.5" />
                  </div>
                  <FeatureStatusPill status={page.status} />
                </div>
                <div className="space-y-2">
                  <p className="ui-section-title">
                    {t(`recovery_lab_page.pages.${page.i18nKey}.title`)}
                  </p>
                  <p className="ui-body text-muted-foreground">
                    {t(`recovery_lab_page.pages.${page.i18nKey}.description`)}
                  </p>
                </div>
              </article>
            </Link>
            <InfoTooltip
              content={
                <>
                  <p>{t('recovery_lab_page.card_support_notice')}</p>
                  <p className="mt-2">{t('recovery_lab_page.card_notice')}</p>
                </>
              }
              className="absolute right-0 top-5"
            />
          </div>
        ))}
      </div>

      <section className="space-y-4 border-t border-border py-6">
        <div className="flex items-center gap-2 text-foreground">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <p className="ui-section-title">{t('recovery_lab_page.what_stays_core')}</p>
          <InfoTooltip
            content={
              <>
                <p>{t('recovery_lab_page.what_stays_core_desc')}</p>
                <p className="mt-2">{t('recovery_lab_page.core_emphasis')}</p>
                <p className="mt-2">{t('recovery_lab_page.core_improve_later')}</p>
              </>
            }
          />
        </div>
      </section>
    </div>
  );
}
