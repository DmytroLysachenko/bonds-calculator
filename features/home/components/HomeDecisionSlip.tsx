'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

import { homeDecisionRoutes } from '@/features/home/constants/decision-slip';
import { useAppI18n } from '@/i18n/client';
import { InfoTooltip } from '@/shared/components/feedback/InfoTooltip';

export function HomeDecisionSlip() {
  const { t } = useAppI18n();

  return (
    <aside data-testid="home-decision-slip" className="bg-muted/25 px-4 py-5 lg:rounded-md lg:px-5">
      <p className="ui-kicker text-muted-foreground">{t('landing.decision_slip.eyebrow')}</p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
        {t('landing.decision_slip.title')}
      </h2>
      <p className="mt-2 text-base leading-6 text-muted-foreground">
        {t('landing.decision_slip.description')}
      </p>
      <ol className="mt-5 space-y-1" aria-label={t('landing.decision_slip.title')}>
        {homeDecisionRoutes.map((item, index) => (
          <li key={item.id} className="flex items-center gap-1">
            <Link
              href={item.href}
              className="ui-interactive-surface ui-focus-ring group flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-3 text-left hover:bg-background"
            >
              <span
                className="font-mono text-[11px] font-semibold text-muted-foreground"
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {t(`landing.decision_slip.options.${item.id}.title`)}
                </span>
                <span className="mt-0.5 block text-base leading-6 text-muted-foreground">
                  {t(`landing.decision_slip.options.${item.id}.description`)}
                </span>
              </span>
              <ArrowUpRight
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            <InfoTooltip content={t(`landing.decision_slip.options.${item.id}.detail`)} />
          </li>
        ))}
      </ol>
    </aside>
  );
}
