import type { BondInputs } from '@/features/bond-core/types';
import type { SingleBondCalculationEnvelope } from '@/features/bond-core/types/scenarios';

/** Facts shared by exported records; never infer an absent model or issuer revision. */
export function buildSingleBondReportProvenance(
  inputs: BondInputs,
  envelope?: SingleBondCalculationEnvelope | null,
) {
  const cashPolicy = envelope?.diagnostics?.some((item) => item.code === 'auto_rollover')
    ? 'rollover'
    : envelope?.diagnostics?.some((item) => item.code === 'single_cycle')
      ? 'single_cycle'
      : undefined;

  return {
    calculationVersion: envelope?.calculationVersion,
    taxRulesRevision: envelope?.taxRulesRevision,
    offerSource: envelope?.offerTerms?.source,
    offerSeries: envelope?.offerTerms?.seriesCode,
    offerRevision: envelope?.offerTerms?.termsRevision,
    offerDocument: envelope?.offerTerms?.termsSourceUrl,
    offerVerified: envelope?.offerTerms?.termsAreVerified,
    dataStatus: envelope?.dataFreshness?.status,
    coverageAsOf: envelope?.dataFreshness?.coverageAsOf,
    dataSource: envelope?.dataFreshness?.bondOfferSource,
    dataLastSyncedAt: envelope?.dataFreshness?.lastSyncedAt,
    purchaseDate: inputs.purchaseDate,
    withdrawalDate: inputs.withdrawalDate,
    taxStrategy: inputs.taxStrategy,
    cashPolicy,
  } as const;
}
