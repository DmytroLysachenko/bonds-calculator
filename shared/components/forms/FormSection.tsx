'use client';

import { ChevronDown } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';
import { InfoTooltip } from '@/shared/components/feedback/InfoTooltip';

interface FormSectionProps {
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  className?: string;
  contentClassName?: string;
  headingLevel?: 'h2' | 'h3';
}

export function FormSection({
  id,
  title,
  description,
  children,
  aside,
  defaultOpen = true,
  collapsible = false,
  className,
  contentClassName,
  headingLevel: Heading = 'h3',
}: FormSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const contentId = React.useId();
  const visible = !collapsible || open;

  return (
    <section id={id} className={cn('ui-control-group', className)}>
      <div className="ui-section-header gap-3">
        <div className="ui-section-intro">
          {collapsible ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="ui-disclosure-summary ui-interactive-surface min-w-0 flex-1 rounded-md text-left motion-reduce:transition-none"
                aria-expanded={open}
                aria-controls={contentId}
                onClick={() => setOpen((current) => !current)}
              >
                <span>{title}</span>
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform duration-150', open && 'rotate-180')}
                  aria-hidden="true"
                />
              </button>
              {description ? <InfoTooltip content={description} /> : null}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Heading className="ui-card-title">{title}</Heading>
              {description ? <InfoTooltip content={description} /> : null}
            </div>
          )}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <div
        id={contentId}
        className={cn('ui-control-stack pt-1', contentClassName)}
        hidden={!visible}
      >
        {children}
      </div>
    </section>
  );
}
