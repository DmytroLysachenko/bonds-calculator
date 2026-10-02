import { ArrowRight, LockKeyhole, ShieldCheck, WalletCards } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getLocalizedPageMetadata } from '@/lib/page-metadata';
import { getConfiguredOAuthProviders } from '@/lib/server/runtime/env';

export async function generateMetadata() {
  return getLocalizedPageMetadata('login');
}

const providerLabels = {
  google: 'login.providers.google',
  facebook: 'login.providers.facebook',
} as const;

const workspaceBenefits = [
  {
    icon: WalletCards,
    titleKey: 'login.benefits.organize.title',
    descriptionKey: 'login.benefits.organize.description',
  },
  {
    icon: ShieldCheck,
    titleKey: 'login.benefits.control.title',
    descriptionKey: 'login.benefits.control.description',
  },
] as const;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

async function LoginPageContent() {
  const t = await getTranslations();
  const providers = getConfiguredOAuthProviders();

  return (
    <section className="flex min-h-[70vh] w-full items-center py-8 md:py-12">
      <div className="grid w-full overflow-hidden border-y border-border lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.78fr)]">
        <div className="space-y-8 px-1 py-8 md:px-8 md:py-12 lg:pr-14">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              {t('login.eyebrow')}
            </div>
            <h1 className="ui-page-title max-w-xl text-balance text-foreground">
              {t('login.title')}
            </h1>
            <p className="ui-body max-w-2xl text-muted-foreground">{t('login.description')}</p>
          </div>

          <div className="grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
            {workspaceBenefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <div key={benefit.titleKey} className="flex gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{t(benefit.titleKey)}</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {t(benefit.descriptionKey)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <Link
            href="/single-calculator"
            className="ui-focus-ring inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-foreground hover:text-primary"
          >
            {t('login.use_calculator')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <Card className="rounded-none border-x-0 border-y border-border bg-muted/20 shadow-none lg:border-y-0 lg:border-l">
          <CardHeader className="space-y-2 border-b border-border px-6 py-6">
            <CardTitle className="text-lg">{t('login.provider_title')}</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">{t('login.oauth_only_note')}</p>
          </CardHeader>
          <CardContent className="space-y-3 px-6 py-6">
            {providers.map((provider) => {
              return (
                <form
                  key={provider}
                  action={async () => {
                    'use server';
                    await signIn(provider, { redirectTo: '/notebook' });
                  }}
                >
                  <Button
                    type="submit"
                    className="ui-focus-ring h-12 w-full justify-between gap-3 rounded-md"
                  >
                    <span>{t(providerLabels[provider])}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </form>
              );
            })}
            {providers.length === 0 ? (
              <div className="border-l-2 border-warning bg-warning/5 px-4 py-3 text-sm leading-6 text-muted-foreground">
                <p className="font-semibold text-foreground">{t('login.unavailable_title')}</p>
                <p>{t('login.unavailable_description')}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
