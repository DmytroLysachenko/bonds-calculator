import { describe, expect, it } from 'vitest';

import {
  expectContains,
  expectNotContains,
  readSource,
} from '@/tests/contracts/test-utils/source-contract';

const routeFiles = [
  'app/compare/page.tsx',
  'app/economic-data/page.tsx',
  'app/education/page.tsx',
  'app/ladder/page.tsx',
  'app/notebook/page.tsx',
  'app/regular-investment/page.tsx',
  'app/single-calculator/page.tsx',
  'app/shared-scenarios/[shareId]/page.tsx',
] as const;

const providerConsumers = [
  'features/single-calculator/hooks/useBondCalculator.ts',
  'features/regular-investment/hooks/useRegularInvestmentCalculator.ts',
  'features/ladder-strategy/hooks/useLadder.ts',
  'features/comparison-engine/hooks/useComparison.ts',
  'features/economic-data/components/EconomicDataPageClient.tsx',
  'features/single-calculator/components/BondInputsForm.tsx',
  'features/regular-investment/components/RegularInvestmentInputsForm.tsx',
  'features/comparison-engine/components/ScenarioOverrideCard.tsx',
  'features/education/components/EducationClient.tsx',
  'features/notebook/components/portfolio-details/PortfolioDetails.tsx',
] as const;

describe('provider boundary contract', () => {
  it('keeps client provider composition behind one root-layout boundary', () => {
    const layout = readSource('app/layout.tsx');
    const providers = readSource('shared/components/providers/ClientAppProviders.tsx');

    expectContains(layout, "from '@/shared/components/providers/ClientAppProviders'");
    expectContains(layout, '<ClientAppProviders');
    expectNotContains(layout, 'NextIntlClientProvider');
    expectContains(providers, '<NextIntlClientProvider');
    expectContains(providers, 'timeZone={appTimeZone}');
    expectContains(providers, '<AppLocaleProvider>');
    expectContains(providers, '<ThemeProvider>');
    expectContains(providers, '<ErrorBoundary>');
  });

  it('loads bond definitions only on routes with interactive offer consumers', () => {
    const layout = readSource('app/layout.tsx');

    expectNotContains(layout, 'BondDefinitionsProvider');
    for (const routeFile of routeFiles) {
      const source = readSource(routeFile);
      const isDirectBoundary = /<BondDefinitionsBoundary(?:\s|>)/.test(source);
      const isCalculatorRouteBoundary = source.includes('<CalculatorRouteBoundary');
      if (!isDirectBoundary && !isCalculatorRouteBoundary) {
        throw new Error(`${routeFile} must scope bond definitions to its interactive route.`);
      }
    }
  });

  it('keeps every UI caller behind the scoped definition provider seam', () => {
    for (const consumer of providerConsumers) {
      const source = readSource(consumer);
      expectContains(source, "from '@/shared/context/BondDefinitionsContext'");
      expectNotContains(source, "from '@/shared/hooks/useBondDefinitions'");
    }
  });

  it('keeps resource loading internal to the provider implementation', () => {
    const provider = readSource('shared/context/BondDefinitionsContext.tsx');
    const boundary = readSource('shared/components/providers/BondDefinitionsBoundary.tsx');
    const resourceHook = readSource('shared/hooks/useBondDefinitions.ts');

    expectContains(provider, 'useBondDefinitions as useBondDefinitionsHook');
    expectContains(provider, 'BondDefinitionsProvider');
    expect(boundary).toMatch(/<BondDefinitionsProvider(?:\s|>)/);
    expectContains(resourceHook, 'useSWR');
    expectContains(resourceHook, "'/api/bond-definitions'");
  });

  it('keeps route files free of definition resource loading details', () => {
    for (const routeFile of routeFiles) {
      const source = readSource(routeFile);
      expectNotContains(source, '/api/bond-definitions');
    }
  });
});
