import type { BondInputs } from '../types';
import type { CalculationDiagnostic, CalculationEnvelope } from '../types/scenarios';

type OfferEvidence = NonNullable<CalculationEnvelope<unknown>['offerTerms']>;

type AssumptionInputs = Pick<BondInputs, 'expectedInflation'> &
  Partial<Pick<BondInputs, 'expectedNbpRate' | 'customInflation' | 'customNbpRate'>>;

export function buildAssumptionDiagnostics(inputs: AssumptionInputs): CalculationDiagnostic[] {
  const diagnostics: CalculationDiagnostic[] = [
    {
      code: 'expected_inflation',
      severity: 'assumption',
      params: { value: inputs.expectedInflation },
    },
  ];
  if (inputs.expectedNbpRate !== undefined)
    diagnostics.push({
      code: 'expected_nbp_rate',
      severity: 'assumption',
      params: { value: inputs.expectedNbpRate },
    });
  if (inputs.customInflation?.length)
    diagnostics.push({ code: 'custom_inflation', severity: 'assumption' });
  if (inputs.customNbpRate?.length)
    diagnostics.push({ code: 'custom_nbp', severity: 'assumption' });
  return diagnostics;
}

export function buildHistoricalDiagnostics(
  history?: BondInputs['historicalData'],
): CalculationDiagnostic[] {
  if (!history || Object.keys(history).length === 0)
    return [{ code: 'missing_history', severity: 'warning' }];
  const diagnostics: CalculationDiagnostic[] = [];
  if (!Object.values(history).some((entry) => entry.inflation !== undefined))
    diagnostics.push({ code: 'missing_inflation_history', severity: 'warning' });
  if (!Object.values(history).some((entry) => entry.nbpRate !== undefined))
    diagnostics.push({ code: 'missing_nbp_history', severity: 'warning' });
  return diagnostics;
}

export function mergeHistoricalDiagnostics(
  histories: Array<BondInputs['historicalData'] | undefined>,
): CalculationDiagnostic[] {
  const byCode = new Map<CalculationDiagnostic['code'], CalculationDiagnostic>();
  for (const history of histories) {
    for (const diagnostic of buildHistoricalDiagnostics(history)) {
      byCode.set(diagnostic.code, diagnostic);
    }
  }
  return Array.from(byCode.values());
}

export function buildOfferDiagnostics(offer: OfferEvidence): CalculationDiagnostic[] {
  if (offer.source === 'series' && offer.seriesCode) {
    const diagnostics: CalculationDiagnostic[] = [
      {
        code: 'issued_series_resolved',
        severity: 'assumption',
        params: { series: offer.seriesCode },
        sourceRef: offer.termsSourceUrl,
      },
    ];
    if (!offer.termsAreVerified)
      diagnostics.push({ code: 'issued_series_unverified', severity: 'warning' });
    return diagnostics;
  }
  return [
    {
      code: offer.source === 'unresolved' ? 'issued_series_unresolved' : 'generic_offer_definition',
      severity: offer.source === 'unresolved' ? 'warning' : 'assumption',
    },
  ];
}

export function buildSingleBondDiagnostics(
  inputs: BondInputs,
  offer: OfferEvidence,
  rollover: boolean,
): CalculationDiagnostic[] {
  const diagnostics: CalculationDiagnostic[] = [
    ...buildAssumptionDiagnostics(inputs),
    ...buildHistoricalDiagnostics(inputs.historicalData),
    ...buildOfferDiagnostics(offer),
  ];
  diagnostics.push({ code: rollover ? 'auto_rollover' : 'single_cycle', severity: 'assumption' });
  return diagnostics;
}
