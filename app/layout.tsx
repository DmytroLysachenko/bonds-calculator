import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import React from 'react';

import { defaultLocale, type Language } from '@/i18n/config';
import { getMetadataLocale } from '@/i18n/locale-utils';
import { createAppJsonLd, serializeJsonLd } from '@/lib/seo/app-json-ld';
import { getCanonicalBaseUrl, isIndexableDeployment } from '@/lib/site-url';
import { RouteFocusManager } from '@/shared/components/accessibility/RouteFocusManager';
import { DeferredSidebar } from '@/shared/components/chrome/DeferredSidebar';
import { WebVitalsReporter } from '@/shared/components/observability/WebVitalsReporter';
import { ClientAppProviders } from '@/shared/components/providers/ClientAppProviders';
import { THEME_BOOTSTRAP_SCRIPT } from '@/shared/lib/theme-preferences';

import './globals.css';

export const viewport: Viewport = {
  themeColor: '#f8f6f1',
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const language = (locale as Language) || defaultLocale;
  const t = await getTranslations();
  const canonicalBaseUrl = getCanonicalBaseUrl();
  const indexable = isIndexableDeployment();

  return {
    metadataBase: new URL(canonicalBaseUrl),
    title: {
      default: `${t('common.title')} - ${t('site.default_title_suffix')}`,
      template: `%s | ${t('common.title')}`,
    },
    description: t('common.description'),
    icons: {
      icon: [{ url: '/app-icon.svg', type: 'image/svg+xml' }],
      apple: [{ url: '/app-icon.svg', type: 'image/svg+xml' }],
    },
    robots: indexable ? undefined : { index: false, follow: false },
    openGraph: {
      type: 'website',
      locale: getMetadataLocale(language),
      url: canonicalBaseUrl,
      siteName: t('common.title'),
      images: [
        {
          url: '/bonds-preview.png',
          width: 1536,
          height: 1024,
          alt: 'Kalkulator Obligacji Skarbowych — calculator preview',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('common.title'),
      description: t('site.twitter_description'),
      images: ['/bonds-preview.png'],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={defaultLocale} data-scroll-behavior="smooth" suppressHydrationWarning>
      <React.Suspense fallback={<RootLayoutFallback />}>
        <RequestAwareBody>{children}</RequestAwareBody>
      </React.Suspense>
    </html>
  );
}

/**
 * Locale and CSP nonce are request-scoped. Keep their work below the document
 * Suspense boundary so Cache Components can produce a shell instead of
 * attempting to prerender them without a request.
 */
async function RequestAwareBody({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const language = (locale as Language) || defaultLocale;
  const t = await getTranslations();
  const canonicalBaseUrl = getCanonicalBaseUrl();
  const nonce = (await headers()).get('x-csp-nonce') ?? undefined;

  const jsonLd = createAppJsonLd({
    appName: 'Obligacje Calculator',
    description: 'Educational calculator for Polish Treasury Bonds.',
    baseUrl: canonicalBaseUrl,
  });

  return (
    <body
      lang={language}
      className="bg-background text-foreground antialiased"
      data-locale={language}
    >
      <script
        nonce={nonce}
        suppressHydrationWarning
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <script
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
      />
      <ClientAppProviders locale={language} messages={messages} cspNonce={nonce}>
        <div className="flex min-h-screen bg-background">
          <WebVitalsReporter />
          <React.Suspense fallback={null}>
            <RouteFocusManager />
          </React.Suspense>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {t('common.skip_to_content')}
          </a>
          <React.Suspense fallback={null}>
            <DeferredSidebar />
          </React.Suspense>
          <main
            id="main-content"
            tabIndex={-1}
            className="flex min-h-screen flex-1 flex-col overflow-x-hidden bg-background pt-14 outline-none lg:pl-[var(--sidebar-width)] lg:pt-0"
          >
            <div className="flex-1 px-4 py-6 md:px-8 md:py-8 xl:px-10">
              <div className="ui-app-canvas">{children}</div>
            </div>

            <footer className="mt-auto border-t border-border bg-background py-6">
              <div className="px-4 md:px-8 xl:px-10">
                <div className="ui-app-canvas text-center text-sm text-muted-foreground">
                  <p>
                    {'\u00A9'} {new Date().getFullYear()} {t('common.title')}.{' '}
                    {t('site.footer_disclaimer')}
                  </p>
                  <div className="mt-4 flex justify-center gap-4">
                    <a
                      href="https://www.obligacjeskarbowe.pl/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {t('site.official_bonds_link_label')}
                    </a>
                  </div>
                </div>
              </div>
            </footer>
          </main>
        </div>
      </ClientAppProviders>
    </body>
  );
}

function RootLayoutFallback() {
  return (
    <body className="bg-background text-foreground antialiased">
      <main
        id="main-content"
        className="flex min-h-screen flex-1 flex-col overflow-x-hidden bg-background pt-14 outline-none lg:pl-[var(--sidebar-width)] lg:pt-0"
        aria-busy="true"
      >
        <div className="flex-1 px-4 py-6 md:px-8 md:py-8 xl:px-10">
          <div className="mx-auto h-40 w-full max-w-[var(--layout-app-max)] animate-pulse rounded-md bg-muted" />
        </div>
      </main>
    </body>
  );
}
