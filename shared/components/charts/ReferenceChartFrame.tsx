'use client';

import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';
import { Notice } from '@/shared/components/feedback/Notice';
import { ReferenceMetaItem } from '@/shared/lib/data-reference';

interface ReferenceChartFrameProps {
  metaItems: ReferenceMetaItem[];
  sourceLabel: string;
  actions?: React.ReactNode;
  notice?: string;
  noticeAction?: React.ReactNode;
  noticeTone?: 'default' | 'warning';
  fallbackNotice?: string;
  fallbackTone?: 'good' | 'warning';
  fallbackStatusLabel?: string;
  syncedStatusLabel?: string;
  verificationHref?: string;
  verificationLabel?: string;
  children: React.ReactNode;
}

export function ReferenceChartFrame({
  metaItems,
  sourceLabel,
  actions,
  notice,
  noticeAction,
  noticeTone = 'default',
  fallbackNotice,
  fallbackTone = 'good',
  fallbackStatusLabel = 'Fallback',
  syncedStatusLabel = 'Synced',
  verificationHref,
  verificationLabel,
  children,
}: ReferenceChartFrameProps) {
  const primaryMeta = metaItems.slice(0, 4);
  const healthToneClass =
    fallbackTone === 'warning' ? 'border-warning text-warning' : 'border-success text-success';

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="space-y-3 border-y border-border py-3">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold leading-5 text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>{sourceLabel}</span>
            </div>
            <dl className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-4">
              {primaryMeta.map((item) => (
                <div
                  key={item.label}
                  className="min-w-0 border-l border-border/70 pl-3 first:border-l-0 first:pl-0"
                >
                  <dt className="text-xs font-semibold text-muted-foreground">{item.label}</dt>
                  <dd className="mt-1 break-words text-sm font-medium leading-5 text-foreground">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>

        {fallbackNotice ? (
          <Notice
            tone={fallbackTone === 'warning' ? 'warning' : 'success'}
            compact
            className="border-0 bg-transparent px-0"
          >
            <div className="flex flex-wrap items-start gap-x-4 gap-y-1.5">
              <div
                className={cn(
                  'inline-flex items-center gap-2 border-l-2 pl-3 text-xs font-semibold',
                  healthToneClass,
                )}
              >
                {fallbackTone === 'warning' ? (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                )}
                {fallbackTone === 'warning' ? fallbackStatusLabel : syncedStatusLabel}
              </div>
              <p className="max-w-4xl text-base leading-6 text-muted-foreground">
                {fallbackNotice}
              </p>
              {verificationHref && verificationLabel ? (
                <a
                  href={verificationHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ui-focus-ring text-base font-semibold text-foreground underline underline-offset-4"
                >
                  {verificationLabel}
                </a>
              ) : null}
            </div>
          </Notice>
        ) : null}
      </div>

      {notice ? (
        <Notice tone={noticeTone === 'warning' ? 'warning' : 'info'} compact>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{notice}</span>
            {noticeAction}
          </div>
        </Notice>
      ) : null}

      <div className="border-t border-border pt-3">{children}</div>
    </div>
  );
}
