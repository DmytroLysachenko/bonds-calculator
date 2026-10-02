import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import { BondInputs, BondType } from '@/features/bond-core/types';
import { getWithdrawalDateFromMonths } from '@/shared/lib/date-timing';

import {
  type PersistedSingleCalculatorState,
  type RestoredSingleCalculatorState,
  restoreSingleCalculatorState,
} from './single-calculator-persistence';
import { resolveBondTypeInputUpdate } from './single-calculator-state';

export type RestoredSingleCalculatorSession = RestoredSingleCalculatorState;

/**
 * Chooses the first client state after definitions are available. A URL-selected
 * bond is an explicit user journey and deliberately takes precedence over a
 * locally persisted draft.
 */
export function resolveSingleCalculatorRestoration({
  bondFromUrl,
  fallbackInputs,
  persistedState,
  definitions = BOND_DEFINITIONS,
}: {
  bondFromUrl?: BondType | null;
  fallbackInputs: BondInputs;
  persistedState: PersistedSingleCalculatorState | null;
  definitions?: typeof BOND_DEFINITIONS;
}): RestoredSingleCalculatorSession | null {
  if (bondFromUrl && definitions[bondFromUrl]) {
    const inputs = resolveBondTypeInputUpdate(
      fallbackInputs,
      bondFromUrl,
      definitions[bondFromUrl],
    );
    const horizonMonths = Math.round(definitions[bondFromUrl].duration * 12);
    inputs.investmentHorizonMonths = horizonMonths;
    inputs.withdrawalDate = getWithdrawalDateFromMonths(inputs.purchaseDate, horizonMonths);

    return {
      inputs,
      envelope: null,
      selectedSeriesId: 'current',
      lastCommittedInputs: null,
      isDirty: true,
      restoredFromPersistence: false,
    };
  }

  return restoreSingleCalculatorState(persistedState);
}
