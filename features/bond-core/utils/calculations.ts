import { Decimal } from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export { calculateRegularInvestment } from './engine/regular-investment-engine';
export { calculateBondInvestment } from './engine/single-bond-engine';
