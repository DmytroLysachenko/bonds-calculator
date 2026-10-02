'use client';

import { FolderKanban, LockKeyhole } from 'lucide-react';
import React from 'react';

import { useAppI18n } from '@/i18n/client';
import { InfoTooltip } from '@/shared/components/feedback/InfoTooltip';
import { FormSelect } from '@/shared/components/forms/FormSelect';
import { UserPortfolio } from '@/shared/types/portfolio';

interface WorkspaceStatusCardProps {
  isGuestWorkspace: boolean;
  canManageWorkspace: boolean;
  selectedPortfolio: UserPortfolio | null;
  portfolios: UserPortfolio[];
  onActivePortfolioChange: (portfolioId: string | null) => void;
}

export function WorkspaceStatusCard({
  isGuestWorkspace,
  canManageWorkspace,
  selectedPortfolio,
  portfolios,
  onActivePortfolioChange,
}: WorkspaceStatusCardProps) {
  const { t } = useAppI18n();
  const workspaceStateIcon = canManageWorkspace ? FolderKanban : LockKeyhole;
  const WorkspaceStateIcon = workspaceStateIcon;

  return (
    <section className="space-y-5 border-t border-border py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <p className="ui-meta font-semibold">
            {isGuestWorkspace
              ? t('workspace.guest_preview_badge')
              : t('workspace.active_workspace_badge')}
          </p>
          <p className="text-sm leading-7 text-muted-foreground">
            {isGuestWorkspace
              ? t('workspace.guest_preview_description')
              : t('workspace.active_workspace_description')}
          </p>
        </div>

        <div className="min-w-[280px] border-l-2 border-border px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="pt-0.5 text-foreground">
              <WorkspaceStateIcon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground">
                {t('workspace.active_selection_title')}
              </p>
              <div className="flex items-center gap-1">
                <p className="text-base font-semibold tracking-tight text-foreground">
                  {selectedPortfolio?.name ?? t('workspace.no_active_portfolio')}
                </p>
                <InfoTooltip
                  content={
                    canManageWorkspace
                      ? selectedPortfolio
                        ? t('workspace.active_selection_desc')
                        : t('workspace.create_first_portfolio_desc')
                      : t('workspace.preview_only_desc')
                  }
                />
              </div>

              {canManageWorkspace && portfolios.length > 0 ? (
                <div className="border-t border-border pt-3">
                  <FormSelect
                    label={t('common.portfolio_selector_label')}
                    value={selectedPortfolio?.id ?? 'none'}
                    onValueChange={(value) =>
                      onActivePortfolioChange(value === 'none' ? null : value)
                    }
                    options={[
                      {
                        value: 'none',
                        label: t('common.portfolio_selector_empty'),
                      },
                      ...portfolios.map((portfolio) => ({
                        value: portfolio.id,
                        label: portfolio.name,
                      })),
                    ]}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
