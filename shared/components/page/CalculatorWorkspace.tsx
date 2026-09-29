import { ChevronUp, Pencil } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAppI18n } from '@/i18n/client';
import { cn } from '@/lib/utils';

import { pageLayout } from './layout-system';

interface CalculatorWorkspaceProps {
  controls: React.ReactNode;
  results: React.ReactNode;
  hasResults?: boolean;
  isDirty?: boolean;
  isCalculating?: boolean;
  scenarioSummary?: ReadonlyArray<{ label: string; value: string; editTargetId?: string }>;
  details?: React.ReactNode;
  className?: string;
  controlsClassName?: string;
  resultsClassName?: string;
  detailsClassName?: string;
}

export function CalculatorWorkspace({
  controls,
  results,
  hasResults = false,
  isDirty = false,
  isCalculating = false,
  scenarioSummary,
  details,
  className,
  controlsClassName,
  resultsClassName,
  detailsClassName,
}: CalculatorWorkspaceProps) {
  const { t } = useAppI18n();
  const [isPlanOpen, setIsPlanOpen] = useState(!hasResults);
  const previousHasResults = useRef(hasResults);
  const previousIsDirty = useRef(isDirty);
  const planRegion = useRef<HTMLElement>(null);
  const resultsRegion = useRef<HTMLElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const focusAfterTransition = useRef<'edit' | 'controls' | 'results' | null>(null);
  const requestedTarget = useRef<string | null>(null);
  const hasScenarioReceipt = Boolean(scenarioSummary?.length);
  const showScenarioReceipt = hasResults && hasScenarioReceipt && !isPlanOpen;

  useEffect(() => {
    const receivedFirstResult = !previousHasResults.current && hasResults;
    const committedEditedPlan = previousIsDirty.current && !isDirty && hasResults;

    if (!hasResults) {
      setIsPlanOpen(true);
    } else if (!isDirty && (receivedFirstResult || committedEditedPlan)) {
      if (planRegion.current?.contains(document.activeElement)) {
        focusAfterTransition.current = 'edit';
      } else if (document.activeElement === document.body) {
        // A submit control outside this workspace may unmount when calculation completes.
        focusAfterTransition.current = 'results';
      }
      setIsPlanOpen(false);
    }

    previousHasResults.current = hasResults;
    previousIsDirty.current = isDirty;
  }, [hasResults, isDirty]);

  useEffect(() => {
    if (focusAfterTransition.current === 'edit' && showScenarioReceipt) {
      editButton.current?.focus();
      focusAfterTransition.current = null;
    } else if (focusAfterTransition.current === 'controls' && isPlanOpen) {
      const section = requestedTarget.current
        ? document.getElementById(requestedTarget.current)
        : null;
      const focusTarget =
        section?.querySelector<HTMLElement>('input, select, textarea, button') ??
        planRegion.current?.querySelector<HTMLElement>(
          'input, select, textarea, button:not([data-close-plan])',
        );
      focusTarget?.focus();
      section?.scrollIntoView({ block: 'start' });
      requestedTarget.current = null;
      focusAfterTransition.current = null;
    } else if (focusAfterTransition.current === 'results' && hasResults && !isDirty) {
      resultsRegion.current?.focus();
      focusAfterTransition.current = null;
    }
  });

  return (
    <div className={cn(pageLayout.compactFlow, className)}>
      <div className={pageLayout.calculatorGrid}>
        <section
          ref={planRegion}
          id="calculator-inputs"
          aria-label={t('common.plan')}
          className={cn(
            'ui-section-anchor ui-plan-region',
            pageLayout.scenarioPlan,
            controlsClassName,
          )}
        >
          {showScenarioReceipt ? (
            <div className="border-y border-border bg-muted/15 px-4 py-4 md:px-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 space-y-3">
                  <p className="ui-kicker">{t('common.scenario_plan')}</p>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:items-start">
                    {scenarioSummary?.map((item) => (
                      <div
                        key={item.label}
                        className="min-w-0 border-l border-border pl-3 first:border-l-0 first:pl-0"
                      >
                        <dt className="ui-kicker">{item.label}</dt>
                        <dd className="mt-1 break-words text-sm font-semibold text-foreground">
                          {item.value}
                        </dd>
                        {item.editTargetId ? (
                          <button
                            type="button"
                            className="ui-focus-ring mt-1 text-xs text-primary underline"
                            onClick={() => {
                              requestedTarget.current = item.editTargetId ?? null;
                              focusAfterTransition.current = 'controls';
                              setIsPlanOpen(true);
                            }}
                          >
                            {t('common.edit_plan')} {item.label}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </dl>
                </div>
                <Button
                  ref={editButton}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 gap-2 self-start"
                  onClick={() => {
                    focusAfterTransition.current = 'controls';
                    setIsPlanOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('common.edit_plan')}
                </Button>
                <a
                  href="#calculator-results"
                  className="ui-focus-ring text-sm font-semibold underline md:hidden"
                >
                  {t('common.jump_to_results')}
                </a>
              </div>
            </div>
          ) : (
            <>
              {hasResults && hasScenarioReceipt ? (
                <div className="flex justify-end">
                  <Button
                    data-close-plan
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-2 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      focusAfterTransition.current = 'edit';
                      setIsPlanOpen(false);
                    }}
                  >
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('common.close_plan')}
                  </Button>
                </div>
              ) : null}
              {controls}
            </>
          )}
        </section>
        <section
          ref={resultsRegion}
          id="calculator-results"
          tabIndex={-1}
          aria-busy={isCalculating || undefined}
          className={cn('ui-section-anchor', pageLayout.sectionFlow, resultsClassName)}
        >
          {results}
        </section>
      </div>
      {details ? (
        <section
          id="calculator-details"
          className={cn(
            'ui-section-anchor ui-content-visibility',
            pageLayout.sectionFlow,
            pageLayout.sectionDivider,
            detailsClassName,
          )}
        >
          {details}
        </section>
      ) : null}
    </div>
  );
}
