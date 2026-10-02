'use client';

import { Settings2 } from 'lucide-react';
import React from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface AdvancedAssumptionsDisclosureProps {
  title: string;
  description: string;
  children: React.ReactNode;
  onOpenChange?: (isOpen: boolean) => void;
}

export function AdvancedAssumptionsDisclosure({
  title,
  description,
  children,
  onOpenChange,
}: AdvancedAssumptionsDisclosureProps) {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue=""
      className="ui-control-group"
      onValueChange={(value) => onOpenChange?.(value === 'advanced-assumptions')}
    >
      <AccordionItem value="advanced-assumptions" className="border-0">
        <AccordionTrigger className="ui-interactive-surface border-0 border-b border-border px-0 py-4 hover:no-underline">
          <span className="flex items-start gap-3 text-left">
            <span className="ui-icon-tile-sm">
              <Settings2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="space-y-1">
              <span className="block ui-label">{title}</span>
              <span className="block max-w-2xl ui-field-description">{description}</span>
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-4">
          <div className="ui-control-stack pt-4">{children}</div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
