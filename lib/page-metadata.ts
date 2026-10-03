import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import { getMetadataLocale } from '@/i18n/locale-utils';

import { pageRoutePolicy } from './route-policy';
import { getCanonicalUrl } from './site-url';

export { getIndexableRoutes, pageRouteByKey, pageRoutePolicy } from './route-policy';

/** Shared user content stays in the page body, never search/social metadata. */
export function getSharedPageMetadata(
  title: string,
  description: string,
  appTitle: string,
): Metadata {
  return {
    title: `${title} | ${appTitle}`,
    description,
    robots: { index: false, follow: false },
  };
}

export async function getLocalizedPageMetadata(pageKey: string): Promise<Metadata> {
  const route = pageRoutePolicy[pageKey as keyof typeof pageRoutePolicy];
  if (!route) throw new Error(`Unregistered page metadata route: ${pageKey}`);
  const common = await getTranslations('common');
  const site = await getTranslations('site');
  const page = await getTranslations(`metadata.pages.${pageKey}`);
  const title = page('title');
  const socialTitle = `${title} | ${common('title')}`;
  const description = page('description');
  const canonicalUrl = getCanonicalUrl(route.path);
  const locale = await getLocale();

  return {
    title,
    description,
    robots: route.indexable ? undefined : { index: false, follow: false },
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: socialTitle,
      description,
      url: canonicalUrl,
      siteName: common('title'),
      locale: getMetadataLocale(locale === 'en' ? 'en' : 'pl'),
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: socialTitle,
      description: site('twitter_description'),
    },
  };
}
