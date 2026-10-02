import { MetadataRoute } from 'next';

import { getIndexableRoutes } from '@/lib/route-policy';
import { getCanonicalBaseUrl, isIndexableDeployment } from '@/lib/site-url';

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isIndexableDeployment()) {
    return [];
  }

  const baseUrl = getCanonicalBaseUrl();
  const routes = getIndexableRoutes().map((route) => ({
    url: `${baseUrl}${route === '/' ? '' : route}`,
    changeFrequency: 'weekly' as const,
    priority: route === '/' ? 1 : 0.8,
  }));

  return routes;
}
