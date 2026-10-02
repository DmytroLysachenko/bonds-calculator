import { ALL_BOND_TYPES, isFamilyBondType } from './support-matrix';
import { BondType } from './types';

export type CalculationEvidence = {
  bondType: BondType;
  officialRuleReference: string;
  regressionSuites: readonly string[];
  releaseEligible: boolean;
  limitation?: string;
};

const officialRuleReference = 'https://www.obligacjeskarbowe.pl/';

const evidenceByBondType = ALL_BOND_TYPES.reduce<Record<BondType, CalculationEvidence>>(
  (evidence, bondType) => {
    evidence[bondType] = {
      bondType,
      officialRuleReference,
      regressionSuites: [
        'features/bond-core/tests/flagship-calculations.test.ts',
        'features/bond-core/tests/production-scenario-regression.test.ts',
        'features/bond-core/tests/support-matrix.test.ts',
      ],
      releaseEligible: !isFamilyBondType(bondType),
      limitation: isFamilyBondType(bondType)
        ? 'Family-bond eligibility is conditional and remains outside trusted release admission.'
        : undefined,
    };
    return evidence;
  },
  {} as Record<BondType, CalculationEvidence>,
);

export function getCalculationEvidence(bondType: BondType): CalculationEvidence {
  return evidenceByBondType[bondType];
}

export function getTrustedCalculationEvidence(): readonly CalculationEvidence[] {
  return ALL_BOND_TYPES.map(getCalculationEvidence).filter(
    ({ releaseEligible }) => releaseEligible,
  );
}
