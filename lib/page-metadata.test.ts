import { getLocale } from 'next-intl/server';
import { describe, expect, it, vi } from 'vitest';

import { getLocalizedPageMetadata, getSharedPageMetadata } from '@/lib/page-metadata';

vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'en'),
  getTranslations: vi.fn(async (namespace: string) => {
    if (namespace === 'common') {
      return (key: string) => ({ title: 'Bonds Calculator' })[key as 'title'];
    }

    if (namespace === 'site') {
      return (key: string) =>
        ({ twitter_description: 'Twitter description' })[key as 'twitter_description'];
    }

    if (
      namespace === 'metadata.pages.single_calculator' ||
      namespace === 'metadata.pages.notebook'
    ) {
      return (key: string) =>
        ({
          title: namespace.endsWith('notebook') ? 'Notebook' : 'Single Calculator',
          description: 'Localized page description',
        })[key as 'title' | 'description'];
    }

    throw new Error(`Unexpected namespace: ${namespace}`);
  }),
}));

describe('getLocalizedPageMetadata', () => {
  it('builds localized page metadata with canonical and social fields', async () => {
    await expect(getLocalizedPageMetadata('single_calculator')).resolves.toEqual({
      title: 'Single Calculator',
      description: 'Localized page description',
      robots: undefined,
      alternates: {
        canonical: 'http://localhost:3000/single-calculator',
      },
      openGraph: {
        title: 'Single Calculator | Bonds Calculator',
        description: 'Localized page description',
        url: 'http://localhost:3000/single-calculator',
        siteName: 'Bonds Calculator',
        locale: 'en_US',
        type: 'website',
      },
      twitter: {
        card: 'summary',
        title: 'Single Calculator | Bonds Calculator',
        description: 'Twitter description',
      },
    });
  });

  it('sets Polish social locale and always keeps private pages out of the index', async () => {
    vi.mocked(getLocale).mockResolvedValueOnce('pl');
    const metadata = await getLocalizedPageMetadata('notebook');
    expect(metadata.alternates).toEqual({ canonical: 'http://localhost:3000/notebook' });
    expect(metadata.openGraph).toMatchObject({
      locale: 'pl_PL',
      url: 'http://localhost:3000/notebook',
    });
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('rejects page metadata keys not in the route policy', async () => {
    await expect(getLocalizedPageMetadata('not_registered')).rejects.toThrow(
      'Unregistered page metadata route: not_registered',
    );
  });

  it('uses generic noindex metadata for shared user content', () => {
    expect(getSharedPageMetadata('Shared portfolio', 'Generic description', 'Calculator')).toEqual({
      title: 'Shared portfolio | Calculator',
      description: 'Generic description',
      robots: { index: false, follow: false },
    });
  });
});
