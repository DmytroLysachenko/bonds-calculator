'use client';

import {
  ArrowLeft,
  Check,
  Download,
  Loader2,
  Pencil,
  Share2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { UserPortfolio } from '@/shared/types/portfolio';

function PortfolioMiniStat({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="border-t border-border py-4">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-[13px] leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

type PortfolioOverviewHeaderProps = {
  portfolio: UserPortfolio;
  lotsCount: number;
  nextMaturityDate: Date | null;
  nextMaturityType: string | null;
  totalInvestedValue: string;
  isPublic: boolean;
  isSharing: boolean;
  justCopied: boolean;
  formatDate: (value: Date) => string;
  onBack: () => void;
  onExport: (formatName: 'portfolio' | 'package') => void;
  onToggleShare: () => void;
  onCopyLink: () => void;
  onDeleteRequest: () => void;
  canDelete: boolean;
  onUpdatePortfolio: (input: { name: string; description: string }) => Promise<void>;
  t: (key: string, values?: Record<string, string>) => string;
};

export function PortfolioOverviewHeader({
  portfolio,
  lotsCount,
  nextMaturityDate,
  nextMaturityType,
  totalInvestedValue,
  isPublic,
  isSharing,
  justCopied,
  formatDate,
  onBack,
  onExport,
  onToggleShare,
  onCopyLink,
  onDeleteRequest,
  canDelete,
  onUpdatePortfolio,
  t,
}: PortfolioOverviewHeaderProps) {
  return (
    <>
      <section className="space-y-6 border-t border-border py-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="ui-meta font-semibold">{t('notebook.record_view')}</p>
            <h3 className="ui-section-title">{t('notebook.record_intro_title')}</h3>
            <p className="ui-body">{t('notebook.record_intro_desc')}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
            <PortfolioMiniStat
              label={t('notebook.stored_lots_label')}
              value={String(lotsCount)}
              description={t('notebook.stored_lots_card_desc')}
            />
            <PortfolioMiniStat
              label={t('notebook.next_maturity_label')}
              value={nextMaturityDate ? formatDate(nextMaturityDate) : '-'}
              description={t('notebook.next_maturity_card_desc')}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <PortfolioMiniStat
            label={t('notebook.total_invested')}
            value={totalInvestedValue}
            description={t('notebook.total_invested_desc')}
          />
          <PortfolioMiniStat
            label={t('notebook.next_maturity')}
            value={nextMaturityType ?? '-'}
            description={
              nextMaturityDate
                ? `${formatDate(nextMaturityDate)} ${t('notebook.next_maturity_suffix')}`
                : t('notebook.no_upcoming_maturity')
            }
          />
          <PortfolioMiniStat
            label={t('notebook.sharing_mode')}
            value={isPublic ? t('notebook.public') : t('notebook.private')}
            description={
              isPublic ? t('notebook.public_share_desc') : t('notebook.private_share_desc')
            }
          />
        </div>
      </section>

      <div className="flex flex-col gap-4 border-t border-border py-5 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="min-h-11 min-w-11 rounded-md"
            aria-label={t('notebook.back_to_portfolios')}
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="ui-section-title">{portfolio.name}</h2>
              <details>
                <summary
                  className="cursor-pointer list-none rounded p-1"
                  aria-label={t('common.edit')}
                >
                  <Pencil className="h-4 w-4" />
                </summary>
                <PortfolioMetadataEditor portfolio={portfolio} onUpdate={onUpdatePortfolio} t={t} />
              </details>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {portfolio.description || t('notebook.portfolio_details')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => onExport('package')}>
            <Download className="h-4 w-4" />
            {t('notebook.export_package')}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => onExport('portfolio')}>
            <Download className="h-4 w-4" />
            {t('notebook.export_summary')}
          </Button>
          {canDelete ? (
            <Button
              variant="outline"
              className="gap-2 border-destructive/20 bg-background text-destructive hover:bg-destructive/5 hover:text-destructive"
              onClick={onDeleteRequest}
            >
              <Trash2 className="h-4 w-4" />
              {t('notebook.delete_portfolio')}
            </Button>
          ) : null}
          {isPublic ? (
            <Button variant="outline" className="gap-2" onClick={onCopyLink}>
              {justCopied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              {justCopied ? t('common.copied') : t('common.copy_link')}
            </Button>
          ) : null}
          <Button
            variant={isPublic ? 'default' : 'outline'}
            className="gap-2"
            onClick={onToggleShare}
            disabled={isSharing}
          >
            {isSharing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {isPublic ? t('notebook.public') : t('notebook.private')}
          </Button>
        </div>
      </div>
    </>
  );
}

function PortfolioMetadataEditor({
  portfolio,
  onUpdate,
  t,
}: {
  portfolio: UserPortfolio;
  onUpdate: (input: { name: string; description: string }) => Promise<void>;
  t: PortfolioOverviewHeaderProps['t'];
}) {
  const [name, setName] = React.useState(portfolio.name);
  const [description, setDescription] = React.useState(portfolio.description ?? '');
  const [saving, setSaving] = React.useState(false);
  return (
    <form
      className="absolute z-20 mt-2 w-72 space-y-2 rounded border border-border bg-background p-3 shadow-lg"
      onSubmit={(event) => {
        event.preventDefault();
        setSaving(true);
        void onUpdate({ name: name.trim(), description: description.trim() }).finally(() =>
          setSaving(false),
        );
      }}
    >
      <label className="block text-xs">
        {t('notebook.portfolio_name')}
        <input
          required
          className="mt-1 h-8 w-full rounded border border-input bg-background px-2"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="block text-xs">
        {t('notebook.description')}
        <input
          className="mt-1 h-8 w-full rounded border border-input bg-background px-2"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <Button size="sm" type="submit" disabled={saving}>
        {t('common.save')}
      </Button>
    </form>
  );
}
