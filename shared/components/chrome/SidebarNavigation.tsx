'use client';

import {
  BarChart2,
  BookOpen,
  Calculator,
  ChevronRight,
  Layers,
  Scale,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { getFeaturesForNavigation } from '@/shared/lib/feature-catalog';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

type SidebarTranslate = (key: string) => string;

export function buildSidebarNavSections(
  t: SidebarTranslate,
  canManageWorkspace = false,
): NavSection[] {
  const iconByRoute: Record<string, NavItem['icon']> = {
    '/education': BookOpen,
    '/single-calculator': Calculator,
    '/compare': Scale,
    '/economic-data': BarChart2,
    '/regular-investment': TrendingUp,
    '/ladder': Layers,
    '/notebook': Wallet,
  };
  const toNavItem = ({ route, titleKey }: { route: string; titleKey: string }): NavItem => ({
    href: route,
    label: t(titleKey),
    icon: iconByRoute[route],
  });

  return [
    {
      label: t('sidebar.sections.core'),
      items: getFeaturesForNavigation('core').map(toNavItem),
    },
    {
      label: t('sidebar.sections.conditional'),
      items: getFeaturesForNavigation('conditional')
        .filter((feature) => feature.route !== '/notebook' || canManageWorkspace)
        .map(toNavItem),
    },
  ];
}

function SidebarSectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="ui-kicker px-2">{children}</p>;
}

function NavLinkItem({
  item,
  isActive,
  onItemClick,
}: {
  item: NavItem;
  isActive: boolean;
  onItemClick?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onItemClick}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'ui-interactive-surface group relative block rounded-md px-3 py-2.5',
        isActive
          ? 'bg-background text-foreground before:absolute before:left-0 before:top-1/2 before:h-7 before:w-0.5 before:-translate-y-1/2 before:bg-primary'
          : 'text-muted-foreground hover:bg-background hover:text-foreground',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn('transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="min-w-0 flex-1 break-words text-sm font-medium leading-5">
            {item.label}
          </span>
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 transition-transform duration-150',
              isActive ? 'text-foreground' : 'text-muted-foreground group-hover:translate-x-0.5',
            )}
            aria-hidden="true"
          />
        </div>
      </div>
    </Link>
  );
}

function NavSectionBlock({
  section,
  pathname,
  onItemClick,
}: {
  section: NavSection;
  pathname: string;
  onItemClick?: () => void;
}) {
  return (
    <section className="space-y-2.5" aria-label={section.label}>
      <SidebarSectionLabel>{section.label}</SidebarSectionLabel>
      <div className="space-y-1.5">
        {section.items.map((item) => (
          <NavLinkItem
            key={item.href}
            item={item}
            isActive={pathname === item.href}
            onItemClick={onItemClick}
          />
        ))}
      </div>
    </section>
  );
}

export function SidebarNavigation({
  navSections,
  pathname,
  onItemClick,
}: {
  navSections: NavSection[];
  pathname: string;
  onItemClick?: () => void;
}) {
  return (
    <>
      {navSections.map((section) => (
        <NavSectionBlock
          key={section.label}
          section={section}
          pathname={pathname}
          onItemClick={onItemClick}
        />
      ))}
    </>
  );
}
