'use client';
import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  type HomeToolDefinition,
  primaryHomeTools,
  secondaryHomeTools,
} from '@/features/home/constants/dashboard';
import { useAppI18n } from '@/i18n/client';
import { SectionHeading } from '@/shared/components/page/SectionHeading';

import { HomeDecisionSlip } from './HomeDecisionSlip';
import { HomeSupportingRoutes } from './HomeRouteSections';
type ToolItem = {
  href: string;
  title: string;
  description: string;
  icon: HomeToolDefinition['icon'];
  status: HomeToolDefinition['status'];
};
function HeroTrustStrip() {
  const { t } = useAppI18n();
  return (
    <p className="border-l-2 border-success/70 pl-3 text-xs font-semibold leading-5 text-muted-foreground">
      {t('landing.hero_trust_note')}
    </p>
  );
}
export function LandingDashboardClient({ offerProvenance }: { offerProvenance?: ReactNode }) {
  const { t } = useAppI18n();
  const primaryTools: ToolItem[] = primaryHomeTools.map((item) => ({
    ...item,
    title: t(item.titleKey),
    description: t(item.descriptionKey),
  }));
  const secondaryTools: ToolItem[] = secondaryHomeTools.map((item) => ({
    ...item,
    title: t(item.titleKey),
    description: t(item.descriptionKey),
  }));
  const secondaryTitle = t('landing.secondary_tools.title');
  const secondaryDesc = t('landing.secondary_tools.description');
  const supportingTools = primaryTools.filter((item) => item.href !== '/single-calculator');
  return (
    <div className="ui-page-flow">
      <section className="pb-5 md:pb-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start xl:gap-12">
          <div className="max-w-4xl space-y-6 md:space-y-8">
            <p className="inline-flex items-center gap-2 border-l-2 border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {t('landing.recovery_home.eyebrow')}
            </p>

            <div className="space-y-4">
              <h1 className="ui-page-title max-w-3xl xl:text-[46px]">
                {t('landing.recovery_home.title')}
              </h1>
              <p className="ui-body max-w-3xl text-muted-foreground md:text-base md:leading-8">
                {t('landing.recovery_home.description')}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="gap-2 rounded-lg text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2"
              >
                <Link href="/single-calculator">
                  {t('landing.recovery_home.primary_cta')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="gap-2 rounded-lg text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2"
              >
                <Link href="/education">{t('landing.recovery_home.secondary_cta')}</Link>
              </Button>
            </div>

            <div className="max-w-4xl space-y-3">
              <HeroTrustStrip />
              {offerProvenance}
            </div>
          </div>

          <HomeDecisionSlip />
        </div>
      </section>

      <section className="space-y-5 bg-muted/20 px-4 py-7 md:rounded-md md:px-6 md:py-8">
        <SectionHeading
          title={t('landing.home_routes.supporting_title')}
          description={t('landing.home_routes.supporting_description')}
        />
        <HomeSupportingRoutes items={supportingTools} />
      </section>

      <section className="space-y-5 pb-8">
        <SectionHeading title={secondaryTitle} description={secondaryDesc} />
        <HomeSupportingRoutes items={secondaryTools} optional />
      </section>
    </div>
  );
}
