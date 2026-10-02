import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadPersistedCalculatorState,
  savePersistedCalculatorState,
} from './calculator-persistence';

describe('calculator persistence', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('stores a versioned draft envelope', () => {
    expect(savePersistedCalculatorState('calculator', { amount: 100 })).toBe(true);
    expect(loadPersistedCalculatorState('calculator')).toEqual({ amount: 100 });
  });

  it('keeps the calculator usable when local storage rejects a write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });

    expect(savePersistedCalculatorState('calculator', { amount: 100 })).toBe(false);
  });
});
