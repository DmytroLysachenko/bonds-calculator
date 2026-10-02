import { UserPortfolio } from '@/shared/types/portfolio';

type Translate = (key: string) => string;

export type NotebookStepItem = {
  id: string;
  title: string;
  description: string;
};

export interface NotebookErrorPayload {
  error?: string;
  code?: string;
}

export interface NotebookErrorLabels {
  storageUnavailable: string;
  createError: string;
}

export const NOTEBOOK_DEMO_LOTS = [
  { bondType: 'EDO', bondQuantity: 50, purchaseDate: '2023-01-01' },
  { bondType: 'COI', bondQuantity: 100, purchaseDate: '2023-06-15' },
  { bondType: 'TOS', bondQuantity: 200, purchaseDate: '2024-01-10' },
] as const;

export function resolveNotebookPortfolioError(
  payload: NotebookErrorPayload | null | undefined,
  labels: NotebookErrorLabels,
) {
  if (payload?.code === 'portfolio_storage_unavailable') {
    return labels.storageUnavailable;
  }

  return payload?.error || labels.createError;
}

export function buildNotebookCapabilities(t: (key: string) => string): NotebookStepItem[] {
  return [
    {
      id: 'track',
      title: t('notebook.capabilities.track.title'),
      description: t('notebook.capabilities.track.desc'),
    },
    {
      id: 'maturities',
      title: t('notebook.capabilities.maturities.title'),
      description: t('notebook.capabilities.maturities.desc'),
    },
    {
      id: 'export',
      title: t('notebook.capabilities.export.title'),
      description: t('notebook.capabilities.export.desc'),
    },
    {
      id: 'projection',
      title: t('notebook.capabilities.projection.title'),
      description: t('notebook.capabilities.projection.desc'),
    },
  ];
}

export function getNotebookPortfolioCounts(portfolios: UserPortfolio[]) {
  const publicCount = portfolios.filter((portfolio) => portfolio.isPublic).length;

  return {
    totalCount: portfolios.length,
    publicCount,
    privateCount: portfolios.length - publicCount,
  };
}

export function buildNotebookStats({
  counts,
  labels,
}: {
  counts: ReturnType<typeof getNotebookPortfolioCounts>;
  labels: {
    portfolios: string;
    portfoliosDescription: string;
    publicLinks: string;
    publicLinksDescription: string;
    privateDrafts: string;
    privateDraftsDescription: string;
  };
}) {
  return [
    {
      label: labels.portfolios,
      value: String(counts.totalCount),
      description: labels.portfoliosDescription,
    },
    {
      label: labels.publicLinks,
      value: String(counts.publicCount),
      description: labels.publicLinksDescription,
    },
    {
      label: labels.privateDrafts,
      value: String(counts.privateCount),
      description: labels.privateDraftsDescription,
    },
  ];
}

export function buildNotebookWorkspaceViewModel({
  portfolios,
  detailPortfolioId,
  t,
}: {
  portfolios: UserPortfolio[];
  detailPortfolioId: string | null;
  t: Translate;
}) {
  const portfolioCounts = getNotebookPortfolioCounts(portfolios);

  return {
    detailPortfolio: detailPortfolioId
      ? (portfolios.find((portfolio) => portfolio.id === detailPortfolioId) ?? null)
      : null,
    emptyStateSteps: buildNotebookCapabilities(t),
    notebookIntro: t('notebook.workspace_intro'),
    notebookStats: buildNotebookStats({
      counts: portfolioCounts,
      labels: {
        portfolios: t('notebook.portfolios_label'),
        portfoliosDescription: t('notebook.portfolios_label_desc'),
        publicLinks: t('notebook.public_links_label'),
        publicLinksDescription: t('notebook.public_links_label_desc'),
        privateDrafts: t('notebook.private_drafts_label'),
        privateDraftsDescription: t('notebook.private_drafts_label_desc'),
      },
    }),
    portfolioCounts,
  };
}
