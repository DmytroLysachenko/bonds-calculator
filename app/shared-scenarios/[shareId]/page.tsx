import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { BondCalculatorContainer } from '@/features/single-calculator/components/BondCalculatorContainer';
import { getSharedPageMetadata } from '@/lib/page-metadata';
import { getSharedSingleScenarioPageData } from '@/lib/server/shared-scenarios/service';
import { PageSuspenseFallback } from '@/shared/components/page/PageSuspenseFallback';
import { PageTransition } from '@/shared/components/page/PageTransition';
import { BondDefinitionsBoundary } from '@/shared/components/providers/BondDefinitionsBoundary';

interface Props {
  params: Promise<{ shareId: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getTranslations('metadata.pages.shared_scenario');
  const common = await getTranslations('common');
  return getSharedPageMetadata(page('title'), page('description'), common('title'));
}

export default function SharedScenarioPage({ params }: Props) {
  return (
    <Suspense fallback={<PageSuspenseFallback />}>
      <SharedScenarioContent params={params} />
    </Suspense>
  );
}

async function SharedScenarioContent({ params }: Props) {
  const { shareId } = await params;

  const scenario = await getSharedSingleScenarioPageData(shareId);

  if (!scenario) {
    notFound();
  }

  return (
    <PageTransition>
      <BondDefinitionsBoundary>
        <BondCalculatorContainer
          initialInputs={scenario.inputs}
          sharedScenarioTitle={scenario.title}
        />
      </BondDefinitionsBoundary>
    </PageTransition>
  );
}
