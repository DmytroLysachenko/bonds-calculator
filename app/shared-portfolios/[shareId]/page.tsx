import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { PublicPortfolioView } from '@/features/notebook/components/PublicPortfolioView';
import { getSharedPageMetadata } from '@/lib/page-metadata';
import { portfolioApplication } from '@/lib/server/portfolio/application';

interface Props {
  params: Promise<{ shareId: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getTranslations('metadata.pages.shared_portfolio');
  const common = await getTranslations('common');
  return getSharedPageMetadata(page('title'), page('description'), common('title'));
}

export default function SharedPortfolioPage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <SharedPortfolioContent params={params} />
    </Suspense>
  );
}

async function SharedPortfolioContent({ params }: Props) {
  const page = await getTranslations('shared_portfolio_page');
  const { shareId } = await params;
  const portfolio = await portfolioApplication.loadSharedPortfolio(shareId);

  if (!portfolio) {
    notFound();
  }

  return (
    <div className="py-8">
      <div className="mb-8 flex items-center justify-between gap-4 border-y border-border py-4">
        <p className="text-sm font-semibold text-muted-foreground">{page('public_notice')}</p>
        <div className="border-l-2 border-border pl-3 text-[10px] font-semibold uppercase tracking-widest text-foreground">
          {page('read_only')}
        </div>
      </div>
      <PublicPortfolioView portfolio={portfolio} />
    </div>
  );
}
