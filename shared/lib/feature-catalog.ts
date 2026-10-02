import { isNavigationRoute, pageRoutePolicy } from '@/lib/route-policy';
import type { FeatureStatus } from '@/shared/types/feature-status';

export type FeaturePlacement = 'primary' | 'preview' | 'recovery-lab';

export type FeatureDefinition = {
  route: string;
  navigationSection: 'core' | 'conditional' | 'recovery_lab';
  status: FeatureStatus;
  placement: FeaturePlacement;
  admittedToTrustedRelease: boolean;
  titleKey: string;
  descriptionKey: string;
};

const featureCatalog = [
  {
    route: pageRoutePolicy.single_calculator.path,
    navigationSection: 'core',
    status: 'trusted',
    placement: 'primary',
    admittedToTrustedRelease: true,
    titleKey: 'nav.single_calculator',
    descriptionKey: 'landing.cards.single_calculator',
  },
  {
    route: pageRoutePolicy.economic_data.path,
    navigationSection: 'core',
    status: 'reference',
    placement: 'primary',
    admittedToTrustedRelease: true,
    titleKey: 'nav.economic_data',
    descriptionKey: 'landing.cards.economic_data',
  },
  {
    route: pageRoutePolicy.education.path,
    navigationSection: 'core',
    status: 'trusted',
    placement: 'primary',
    admittedToTrustedRelease: true,
    titleKey: 'nav.education',
    descriptionKey: 'landing.cards.education',
  },
  {
    route: pageRoutePolicy.comparison.path,
    navigationSection: 'conditional',
    status: 'conditional',
    placement: 'preview',
    admittedToTrustedRelease: false,
    titleKey: 'nav.comparison',
    descriptionKey: 'landing.cards.comparison',
  },
  {
    route: pageRoutePolicy.regular_investment.path,
    navigationSection: 'conditional',
    status: 'conditional',
    placement: 'preview',
    admittedToTrustedRelease: false,
    titleKey: 'nav.regular_investment',
    descriptionKey: 'landing.cards.regular_investment',
  },
  {
    route: pageRoutePolicy.ladder.path,
    navigationSection: 'conditional',
    status: 'conditional',
    placement: 'preview',
    admittedToTrustedRelease: false,
    titleKey: 'nav.ladder',
    descriptionKey: 'landing.cards.ladder',
  },
  {
    route: pageRoutePolicy.notebook.path,
    navigationSection: 'conditional',
    status: 'conditional',
    placement: 'preview',
    admittedToTrustedRelease: false,
    titleKey: 'nav.notebook',
    descriptionKey: 'landing.recovery_home.notebook_card',
  },
] as const satisfies readonly FeatureDefinition[];

export function getFeaturesForPlacement(placement: FeaturePlacement): readonly FeatureDefinition[] {
  return featureCatalog.filter((feature) => feature.placement === placement);
}

export function getFeaturesForNavigation(
  navigationSection: FeatureDefinition['navigationSection'],
): readonly FeatureDefinition[] {
  return featureCatalog.filter(
    (feature) =>
      feature.navigationSection === navigationSection && isNavigationRoute(feature.route),
  );
}

export function getTrustedReleaseFeatures(): readonly FeatureDefinition[] {
  return featureCatalog.filter((feature) => feature.admittedToTrustedRelease);
}
