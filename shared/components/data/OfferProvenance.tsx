'use client';

import type { BondDefinition } from '@/features/bond-core/constants/bond-definitions';
import type { CalculationDataFreshness } from '@/features/bond-core/types/scenarios';
import { useAppI18n } from '@/i18n/client';
import {
  getBondOfferFreshnessState,
  getBondOfferSourceTranslationKey,
} from '@/shared/lib/data-freshness-display';

export function OfferProvenance({
  dataFreshness,
  compact = false,
  genericFamily = false,
  rateProvenance,
}: {
  dataFreshness?: CalculationDataFreshness;
  compact?: boolean;
  genericFamily?: boolean;
  rateProvenance?: BondDefinition['rateProvenance'];
}) {
  const { t } = useAppI18n();
  const bondOffer = getBondOfferFreshnessState(dataFreshness);
  // A global sync signal cannot certify a card's rate when its own series provenance is absent.
  const isReference = compact ? rateProvenance?.kind !== 'issued-series' : bondOffer.isDegraded;
  const source = t(
    `sidebar.freshness.offer_sources.${getBondOfferSourceTranslationKey(bondOffer.source)}`,
  );

  return (
    <div
      className={
        compact
          ? `space-y-2 border-l-2 px-3 py-2 text-base leading-6 ${isReference ? 'border-warning bg-warning/5' : 'border-success bg-success/5'}`
          : 'space-y-2 border-y border-border py-3 text-base leading-6'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-foreground">
          <span
            className={
              isReference
                ? 'font-semibold text-[var(--finance-warning)]'
                : 'font-semibold text-[var(--finance-success)]'
            }
          >
            {t(
              rateProvenance?.kind === 'issued-series'
                ? 'landing.offer_provenance.issued_series'
                : isReference
                  ? 'landing.offer_provenance.reference'
                  : 'landing.offer_provenance.verified',
            )}
          </span>
          {' · '}
          {t('landing.offer_provenance.last_offer_check')}:{' '}
          {bondOffer.attemptLabel ?? t('common.unavailable')}
        </p>
        <a
          href="https://www.obligacjeskarbowe.pl/"
          target="_blank"
          rel="noopener noreferrer"
          className="ui-focus-ring font-semibold text-foreground underline underline-offset-4"
        >
          {t('landing.offer_provenance.verify')}
        </a>
      </div>
      {compact ? (
        <p className="text-muted-foreground">
          {t(
            rateProvenance?.kind === 'database-reference'
              ? 'landing.offer_provenance.recorded_as_of'
              : rateProvenance?.kind === 'curated-reference'
                ? 'landing.offer_provenance.reference_rates_as_of'
                : 'landing.offer_provenance.terms_as_of',
          )}
          : {rateProvenance?.asOf ?? t('common.unavailable')}
          {rateProvenance?.seriesCode ? ` · ${rateProvenance.seriesCode}` : null}.
          {rateProvenance?.sourceUrl ? (
            <>
              {' '}
              <a
                href={rateProvenance.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ui-focus-ring font-semibold text-foreground underline underline-offset-4"
              >
                {t('landing.offer_provenance.reference_source')}
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      {!compact ? (
        <p className="text-muted-foreground">
          {t('landing.offer_provenance.label')}: {source}.
        </p>
      ) : null}
      {genericFamily ? (
        <p className="text-muted-foreground">{t('landing.offer_provenance.generic_family')}</p>
      ) : null}
      {compact && bondOffer.isDegraded && rateProvenance?.kind === 'issued-series' ? (
        <p className="text-[var(--finance-warning)]">
          {t('sidebar.freshness.offer_degraded_warning')}
        </p>
      ) : null}
      {isReference && !compact ? (
        <p className="border-l-2 border-warning pl-3 font-semibold text-[var(--finance-warning)]">
          {t('sidebar.freshness.offer_degraded_warning')}
        </p>
      ) : null}
    </div>
  );
}
