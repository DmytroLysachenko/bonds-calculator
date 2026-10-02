import { createRequire } from 'node:module';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { pageRoutePolicy } from '@/lib/route-policy';

const cjsRequire = createRequire(import.meta.url);

type LighthouseConfig = {
  ci: {
    assert: {
      assertMatrix: {
        matchingUrlPattern?: string;
        assertions: Record<string, unknown>;
      }[];
    };
    collect: { url: string[] };
  };
};

function loadConfig(tier: 'preview' | 'production') {
  vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_TIER', tier);
  const configPath = cjsRequire.resolve('../lighthouserc.cjs');
  delete cjsRequire.cache[configPath];
  return cjsRequire(configPath) as LighthouseConfig;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Lighthouse assertions', () => {
  it('scores SEO only on routes intended for indexing', () => {
    const config = loadConfig('production');
    const seoAssertion = config.ci.assert.assertMatrix.find(
      ({ assertions }) => 'categories:seo' in assertions,
    );
    expect(seoAssertion?.matchingUrlPattern).toBeTruthy();
    const seoRoutes = new RegExp(seoAssertion!.matchingUrlPattern!);

    for (const route of Object.values(pageRoutePolicy)) {
      expect(seoRoutes.test(`http://127.0.0.1:3100${route.path}`), route.path).toBe(
        route.indexable,
      );
    }
    expect(config.ci.collect.url).toHaveLength(6);
    expect(config.ci.assert.assertMatrix[0].assertions).toHaveProperty('categories:accessibility');
  });

  it('does not demand crawlability in private preview', () => {
    const config = loadConfig('preview');
    expect(config.ci.assert.assertMatrix).toHaveLength(1);
    expect(config.ci.assert.assertMatrix[0].assertions['is-crawlable']).toBe('off');
  });
});
