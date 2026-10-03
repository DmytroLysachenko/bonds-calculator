import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getIndexableRoutes, pageRouteByKey, pageRoutePolicy } from '@/lib/page-metadata';
import { getCanonicalBaseUrl, getCanonicalUrl, isIndexableDeployment } from '@/lib/site-url';

import robots from './robots';
import sitemap from './sitemap';

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

describe('SEO metadata contract', () => {
  it('uses one canonical base URL for production metadata routes', () => {
    const env = {
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://example.test/',
    } as NodeJS.ProcessEnv;

    expect(getCanonicalBaseUrl(env)).toBe('https://example.test');
    expect(getCanonicalUrl('/single-calculator', env)).toBe(
      'https://example.test/single-calculator',
    );
  });

  it.each([undefined, 'not-a-url', 'javascript:alert(1)', 'https://example.test/?user=secret'])(
    'falls back when the configured production base URL is missing or unsafe: %s',
    (configured) => {
      const env = { NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: configured } as NodeJS.ProcessEnv;
      const base = getCanonicalBaseUrl(env);
      expect(base).toBe('https://obligacje-calculator-738965529859.europe-west1.run.app');
      expect(getCanonicalUrl('/education', env)).toBe(`${base}/education`);
    },
  );

  it('keeps robots and sitemap on the configured public app URL', () => {
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    const previousTier = process.env.NEXT_PUBLIC_DEPLOYMENT_TIER;
    process.env.NEXT_PUBLIC_APP_URL = 'https://seo.example';
    process.env.NEXT_PUBLIC_DEPLOYMENT_TIER = 'production';

    try {
      expect(robots().sitemap).toBe('https://seo.example/sitemap.xml');
      expect(sitemap().map((item) => item.url)).toEqual(
        expect.arrayContaining([
          'https://seo.example',
          'https://seo.example/single-calculator',
          'https://seo.example/economic-data',
        ]),
      );
      expect(sitemap().every((item) => item.lastModified === undefined)).toBe(true);
      expect(sitemap().map((item) => item.url)).toEqual(
        getIndexableRoutes().map((route) => `https://seo.example${route === '/' ? '' : route}`),
      );
      expect(sitemap().some((item) => item.url.includes('/notebook'))).toBe(false);
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = previous;
      process.env.NEXT_PUBLIC_DEPLOYMENT_TIER = previousTier;
    }
  });

  it('keeps private previews out of search indexes', () => {
    expect(
      isIndexableDeployment({ NODE_ENV: 'test', NEXT_PUBLIC_DEPLOYMENT_TIER: 'preview' }),
    ).toBe(false);
    expect(
      isIndexableDeployment({ NODE_ENV: 'test', NEXT_PUBLIC_DEPLOYMENT_TIER: 'production' }),
    ).toBe(true);
  });

  it('gives previews and production-like deployments distinct robots directives', () => {
    const previousTier = process.env.NEXT_PUBLIC_DEPLOYMENT_TIER;
    const previousUrl = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://seo.example';

    try {
      process.env.NEXT_PUBLIC_DEPLOYMENT_TIER = 'preview';
      expect(robots().rules).toEqual({ userAgent: '*', disallow: '/' });
      expect(sitemap()).toEqual([]);

      process.env.NEXT_PUBLIC_DEPLOYMENT_TIER = 'production';
      expect(robots().rules).toEqual({
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/'],
      });
      expect(robots().sitemap).toBe('https://seo.example/sitemap.xml');
    } finally {
      process.env.NEXT_PUBLIC_DEPLOYMENT_TIER = previousTier;
      process.env.NEXT_PUBLIC_APP_URL = previousUrl;
    }
  });

  it('maps every localized metadata page to a unique canonical public route', () => {
    const routes = Object.values(pageRouteByKey);

    expect(routes).toHaveLength(new Set(routes).size);
    expect(routes).toEqual(
      expect.arrayContaining([
        '/',
        '/single-calculator',
        '/compare',
        '/economic-data',
        '/education',
        '/regular-investment',
        '/ladder',
        '/retirement',
      ]),
    );
  });

  it('keeps private and experimental routes explicitly nonindexable', () => {
    for (const key of ['notebook', 'login', 'multi_asset', 'retirement', 'recovery_lab'] as const) {
      expect(pageRoutePolicy[key].indexable).toBe(false);
    }
  });

  it('defines non-empty, unique metadata for every routed page key', () => {
    for (const locale of ['en', 'pl']) {
      const messages = JSON.parse(read(`i18n/translations/${locale}.json`)) as {
        metadata: { pages: Record<string, { title: string; description: string }> };
      };
      const entries = Object.keys(pageRouteByKey).map((key) => messages.metadata.pages[key]);

      expect(entries).toHaveLength(Object.keys(pageRouteByKey).length);
      expect(entries.every((entry) => entry?.title.trim() && entry.description.trim())).toBe(true);
      expect(new Set(entries.map((entry) => entry.title)).size).toBe(entries.length);
    }
  });

  it('keeps root layout metadata and JSON-LD free of legacy Vercel URLs', () => {
    const layout = read('app/layout.tsx');
    const robotsSource = read('app/robots.ts');
    const sitemapSource = read('app/sitemap.ts');

    for (const source of [layout, robotsSource, sitemapSource]) {
      expect(source).not.toContain('obligacje-calculator.vercel.app');
    }

    expect(layout).toContain('getCanonicalBaseUrl');
    expect(layout).toContain('createAppJsonLd');
  });
});
