import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import type { HomeToolDefinition } from '@/features/home/constants/dashboard';

type HomeRouteItem = Omit<HomeToolDefinition, 'titleKey' | 'descriptionKey'> & {
  title: string;
  description: string;
};

export function HomeSupportingRoutes({
  items,
  supportingActionLabel,
  optional = false,
}: {
  items: HomeRouteItem[];
  supportingActionLabel: string;
  optional?: boolean;
}) {
  return (
    <div className="grid gap-x-8 md:grid-cols-2">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="block ui-focus-ring">
          <article className="group rounded-md px-3 py-5 transition-colors duration-150 hover:bg-muted/35">
            <div className="flex items-start gap-3">
              <item.icon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                {!optional ? (
                  <span className="mt-3 inline-flex text-xs font-semibold text-foreground">
                    {supportingActionLabel}
                  </span>
                ) : null}
              </div>
              <ArrowRight
                className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </div>
          </article>
        </Link>
      ))}
    </div>
  );
}
