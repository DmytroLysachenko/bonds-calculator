'use client';
import { Loader2, RotateCcw } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { useAppI18n } from '@/i18n/client';
import { cn } from '@/lib/utils';
interface RecalculateButtonProps {
  formId?: string;
  isDirty: boolean;
  loading: boolean;
  hasResults?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  placement?: 'floating' | 'inline-desktop' | 'mobile-only';
}
export const RecalculateButton = ({
  formId,
  isDirty,
  loading,
  hasResults = true,
  disabled = false,
  onClick,
  className,
  placement = 'floating',
}: RecalculateButtonProps) => {
  const { t } = useAppI18n();
  const showButton = loading || isDirty || !hasResults;
  if (!showButton) {
    return null;
  }
  const isInitialRun = !hasResults && !loading;
  const isActionable = !loading && !disabled;
  const helperText = loading
    ? t('common.calculation_in_progress')
    : isInitialRun
      ? t('common.initial_calculation_hint')
      : t('common.recalculation_hint');
  return (
    <div
      className={cn(
        'fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50',
        placement === 'floating' &&
          'sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[min(23rem,calc(100vw-2.5rem))]',
        placement === 'inline-desktop' && 'sm:static sm:z-auto sm:w-full sm:max-w-md',
        placement === 'mobile-only' && 'sm:hidden',
        className,
      )}
    >
      <div className="ui-action-dock px-4 py-4 text-foreground">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="ui-kicker">
              {isInitialRun ? t('common.calculate') : t('common.recalculate')}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">{helperText}</p>
          </div>
        </div>

        <div className="mt-3 sm:mt-4">
          <Button
            type={formId ? 'submit' : 'button'}
            form={formId}
            size="default"
            className={cn(
              'h-11 w-full rounded-md px-5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isActionable
                ? 'bg-foreground text-background hover:bg-foreground/90'
                : 'bg-muted text-muted-foreground hover:bg-muted',
            )}
            onClick={formId ? undefined : onClick}
            disabled={loading || disabled}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('common.calculating')}
              </>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                {isInitialRun ? t('common.calculate') : t('common.recalculate')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
