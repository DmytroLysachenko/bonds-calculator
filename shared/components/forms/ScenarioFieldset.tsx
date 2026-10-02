'use client';

import React from 'react';

import { cn } from '@/lib/utils';
import { InfoTooltip } from '@/shared/components/feedback/InfoTooltip';

interface ScenarioFieldsetProps {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  divided?: boolean;
  className?: string;
}

export function ScenarioFieldset({
  id,
  title,
  description,
  children,
  divided = false,
  className,
}: ScenarioFieldsetProps) {
  return (
    <section
      id={id}
      className={cn('ui-control-stack', divided && 'border-t border-border pt-6', className)}
    >
      <div className="ui-section-intro">
        <div className="flex items-center gap-1">
          <h3 className="ui-card-title">{title}</h3>
          {description ? <InfoTooltip content={description} /> : null}
        </div>
      </div>
      {children}
    </section>
  );
}
