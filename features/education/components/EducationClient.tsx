'use client';

import {
  ArrowDown,
  BookOpen,
  Briefcase,
  HelpCircle,
  Info,
  Scale,
  TrendingDown,
} from 'lucide-react';
import Link from 'next/link';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { CalculationDataFreshness } from '@/features/bond-core/types/scenarios';
import { BondEducationCard } from '@/features/education/components/BondEducationCard';
import { BondIssueExplorer } from '@/features/education/components/BondIssueExplorer';
import { EducationDecisionRail } from '@/features/education/components/EducationDecisionRail';
import { EducationOfferComparison } from '@/features/education/components/EducationOfferComparison';
import {
  educationConcepts,
  educationOfferGroups,
  educationSecondaryConcepts,
} from '@/features/education/constants/education-content';
import { useAppI18n } from '@/i18n/client';
import { OfferProvenance } from '@/shared/components/data/OfferProvenance';
import { PageHeader } from '@/shared/components/page/PageHeader';
import { PageTransition } from '@/shared/components/page/PageTransition';
import { SectionBlock } from '@/shared/components/page/SectionBlock';
import { useBondDefinitions } from '@/shared/context/BondDefinitionsContext';

function EducationLoading() {
  return (
    <div className="ui-page-flow" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="space-y-4 border-b border-border pb-10">
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-11 w-full max-w-xl rounded-md" />
        <Skeleton className="h-6 w-full max-w-3xl rounded-md" />
      </div>
      <Skeleton className="h-72 w-full rounded-md" />
      <Skeleton className="h-96 w-full rounded-md" />
    </div>
  );
}

export default function EducationClient({
  dataFreshness,
}: {
  dataFreshness?: CalculationDataFreshness;
}) {
  const { t } = useAppI18n();
  const { definitions, isLoading } = useBondDefinitions();

  if (isLoading || !definitions) return <EducationLoading />;

  return (
    <PageTransition>
      <div className="ui-page-flow">
        <PageHeader
          icon={<BookOpen className="size-5" />}
          eyebrow={t('nav.education')}
          title={t('education.hero_title')}
          description={t('education.subtitle')}
          action={
            <div className="ui-action-row">
              <Button asChild size="lg">
                <Link href="#choose-a-path">
                  {t('education.hero_primary_cta')}
                  <ArrowDown className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#current-offers">{t('education.hero_secondary_cta')}</Link>
              </Button>
            </div>
          }
        />

        <section
          id="choose-a-path"
          className="scroll-mt-6 space-y-5 md:scroll-mt-10"
          aria-labelledby="choose-a-path-title"
        >
          <div className="ui-section-intro">
            <h2 id="choose-a-path-title" className="ui-section-title">
              {t('education.decision_title')}
            </h2>
            <p className="ui-body ui-pretty text-muted-foreground">
              {t('education.decision_subtitle')}
            </p>
          </div>
          <EducationDecisionRail />
        </section>

        <nav aria-label={t('education.section_index')} className="border-y border-border py-3">
          <p className="ui-kicker mb-2">{t('education.section_index')}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
            <a href="#choose-a-path" className="ui-focus-ring underline underline-offset-4">
              {t('education.decision_title')}
            </a>
            <a href="#current-offers" className="ui-focus-ring underline underline-offset-4">
              {t('education.bond_types')}
            </a>
            {educationOfferGroups.map((group) => (
              <a
                key={group.key}
                href={`#offers-${group.key}`}
                className="ui-focus-ring underline underline-offset-4"
              >
                {t(`education.groups.${group.key}.title`)}
              </a>
            ))}
            <a href="#education-compare" className="ui-focus-ring underline underline-offset-4">
              {t('education.comparison.compare_selected')}
            </a>
          </div>
        </nav>

        <SectionBlock
          id="current-offers"
          className="scroll-mt-6 md:scroll-mt-10"
          icon={<Briefcase className="size-5" />}
          title={t('education.bond_types')}
          description={t('education.bond_types_subtitle')}
        >
          <OfferProvenance dataFreshness={dataFreshness} />
          <BondIssueExplorer />
          <div className="space-y-12">
            {educationOfferGroups.map((group) => {
              const bonds = group.bondTypes.map((type) => definitions[type]).filter(Boolean);
              return (
                <section
                  id={`offers-${group.key}`}
                  key={group.key}
                  className="scroll-mt-6 border-t border-border pt-7 md:scroll-mt-10"
                  aria-labelledby={`offers-${group.key}-title`}
                >
                  <div className="ui-section-intro">
                    <h3 id={`offers-${group.key}-title`} className="ui-section-title">
                      {t(`education.groups.${group.key}.title`)}
                    </h3>
                    <p className="ui-body ui-pretty text-muted-foreground">
                      {t(`education.groups.${group.key}.description`)}
                    </p>
                  </div>
                  <div className="mt-5 grid gap-x-8 md:grid-cols-2">
                    {bonds.map((bond) => (
                      <BondEducationCard
                        key={bond.type}
                        bond={bond}
                        dataFreshness={dataFreshness}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
                    <a href="#choose-a-path" className="ui-focus-ring underline underline-offset-4">
                      {t('education.back_to_choices')}
                    </a>
                    <Link href="/compare" className="ui-focus-ring underline underline-offset-4">
                      {t('education.compare_in_calculator')}
                    </Link>
                  </div>
                </section>
              );
            })}
          </div>
          <details id="education-compare" className="scroll-mt-10 border-t border-border pt-5">
            <summary className="ui-focus-ring cursor-pointer text-sm font-semibold text-foreground">
              {t('education.comparison.compare_selected')}
            </summary>
            <div className="mt-5">
              <EducationOfferComparison definitions={definitions} />
            </div>
          </details>
          <div className="ui-status-note border-l-2 border-border bg-muted/20">
            <Info className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
            <p className="ui-field-description">
              {t('education.disclaimer')}{' '}
              <a
                href="https://www.obligacjeskarbowe.pl/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground underline underline-offset-4 hover:text-muted-foreground"
              >
                {t('site.official_bonds_link_label')}
              </a>
            </p>
          </div>
        </SectionBlock>

        <SectionBlock
          icon={<BookOpen className="size-5" />}
          title={t('education.concepts_title')}
          description={t('education.concepts_subtitle')}
        >
          <div className="grid gap-x-8 gap-y-5 md:grid-cols-3">
            {educationConcepts.map((concept) => (
              <article key={concept.key} className="py-3">
                <div className="flex items-center gap-3">
                  <concept.icon className="size-4 text-foreground" aria-hidden="true" />
                  <h3 className="ui-card-title">{t(`education.concepts.${concept.key}.title`)}</h3>
                </div>
                <p className="ui-body ui-pretty mt-3">
                  {t(`education.concepts.${concept.key}.desc`)}
                </p>
                <p className="mt-3 font-mono text-[11px] leading-5 text-muted-foreground">
                  {t(`education.concepts.${concept.key}.formula`)}
                </p>
              </article>
            ))}
          </div>
          <Accordion type="single" collapsible className="border-y border-border">
            <AccordionItem value="secondary-concepts" className="border-0">
              <AccordionTrigger className="ui-focus-ring py-4 text-left text-sm font-semibold">
                {t('education.more_concepts')}
              </AccordionTrigger>
              <AccordionContent className="grid gap-5 pb-5 md:grid-cols-2">
                {educationSecondaryConcepts.map((concept) => (
                  <div key={concept.key}>
                    <h3 className="ui-card-title">
                      {t(`education.concepts.${concept.key}.title`)}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {t(`education.concepts.${concept.key}.desc`)}
                    </p>
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </SectionBlock>

        <SectionBlock icon={<HelpCircle className="size-5" />} title={t('education.faq')}>
          <Accordion type="single" collapsible className="w-full border-t border-border">
            {[
              ['inflation', TrendingDown],
              ['tax', Scale],
              ['early_exit', Info],
              ['monthly_payout', Briefcase],
            ].map(([key, Icon]) => (
              <AccordionItem key={key as string} value={key as string} className="border-b-border">
                <AccordionTrigger className="ui-focus-ring py-5 text-left text-base font-semibold">
                  {t(`education.q_${key}`)}
                </AccordionTrigger>
                <AccordionContent className="leading-relaxed text-muted-foreground">
                  <div className="flex items-start gap-3 py-2">
                    <Icon className="mt-0.5 size-5 shrink-0 text-foreground" aria-hidden="true" />
                    <p>{t(`education.a_${key}`)}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </SectionBlock>
      </div>
    </PageTransition>
  );
}
