'use client';

import dynamic from 'next/dynamic';

const Sidebar = dynamic(() => import('./Sidebar').then((module) => module.Sidebar), {
  loading: () => null,
  ssr: false,
});

/** Keeps non-critical interactive navigation out of the initial route bundle. */
export function DeferredSidebar() {
  return <Sidebar />;
}
