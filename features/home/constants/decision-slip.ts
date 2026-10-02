import { getFeaturesForPlacement } from '@/shared/lib/feature-catalog';

const decisionCopyByTitleKey = {
  'nav.education': 'learn',
  'nav.economic_data': 'check-context',
} as const;

const decisionTitleKeys = ['nav.education', 'nav.economic_data'] as const;

const primaryFeatures = getFeaturesForPlacement('primary');

export const homeDecisionRoutes = decisionTitleKeys.flatMap((titleKey) => {
  const feature = primaryFeatures.find((candidate) => candidate.titleKey === titleKey);

  return feature ? [{ id: decisionCopyByTitleKey[titleKey], href: feature.route }] : [];
});
