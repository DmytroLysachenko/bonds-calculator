import {
  createEngineFailureError,
  createNumericFaultError,
  isCalculationDomainError,
} from '../errors';
import { BondInputs, RegularInvestmentInputs } from '../types';

type SanitizeTarget =
  Partial<BondInputs> | Partial<RegularInvestmentInputs> | Record<string, unknown>;

/**
 * Sanitizes calculation inputs to prevent edge cases or malicious values
 * that could lead to NaN, Infinity, or memory exhaustion.
 */
export const sanitizeInputs = <T extends SanitizeTarget>(inputs: T): T => {
  const sanitized = { ...inputs } as Record<string, unknown>;

  const clamp = (val: number | undefined, min = -20, max = 500, fallback = 0) => {
    if (val === undefined || typeof val !== 'number' || isNaN(val)) return fallback;
    return Math.max(min, Math.min(max, val));
  };

  if (sanitized.firstYearRate !== undefined) {
    sanitized.firstYearRate = clamp(sanitized.firstYearRate as number, 0, 100);
  }
  if (sanitized.margin !== undefined) {
    sanitized.margin = clamp(sanitized.margin as number, -5, 20);
  }
  if (sanitized.initialInvestment !== undefined) {
    sanitized.initialInvestment = clamp(sanitized.initialInvestment as number, 0, 100_000_000_000); // 100 Billion limit
  }
  if (sanitized.contributionAmount !== undefined) {
    sanitized.contributionAmount = clamp(sanitized.contributionAmount as number, 0, 10_000_000);
  }
  if (sanitized.expectedInflation !== undefined) {
    sanitized.expectedInflation = clamp(sanitized.expectedInflation as number, -20, 500);
  }
  if (sanitized.expectedNbpRate !== undefined) {
    sanitized.expectedNbpRate = clamp(sanitized.expectedNbpRate as number, -5, 100);
  }
  if (sanitized.taxRate !== undefined) {
    sanitized.taxRate = clamp(sanitized.taxRate as number, 0, 100, 19);
  }

  // Paths for custom scenarios
  if (Array.isArray(sanitized.inflationPath)) {
    sanitized.inflationPath = (sanitized.inflationPath as number[]).map((v: number) => clamp(v));
  }
  if (Array.isArray(sanitized.wiborPath)) {
    sanitized.wiborPath = (sanitized.wiborPath as number[]).map((v: number) => clamp(v));
  }
  if (Array.isArray(sanitized.ratePath)) {
    sanitized.ratePath = (sanitized.ratePath as number[]).map((v: number) => clamp(v));
  }

  return sanitized as unknown as T;
};

function isUnsafeNumber(value: unknown): value is number {
  return typeof value === 'number' && (!Number.isFinite(value) || Number.isNaN(value));
}

function assertFiniteNumber(value: unknown, path: string) {
  if (isUnsafeNumber(value)) {
    throw createNumericFaultError(`Unsafe numeric value detected at ${path}`, {
      details: { path, value: String(value) },
    });
  }
}

function assertNoUnsafeNumbers(value: unknown, path = 'result') {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === 'number') {
    assertFiniteNumber(value, path);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoUnsafeNumbers(item, `${path}[${index}]`));
    return;
  }

  if (typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      assertNoUnsafeNumbers(child, `${path}.${key}`);
    });
  }
}

function assertNonEmptyTimeline(result: Record<string, unknown>) {
  if ('timeline' in result && Array.isArray(result.timeline) && result.timeline.length === 0) {
    throw createNumericFaultError('Calculation produced an empty timeline.', {
      details: { field: 'timeline' },
    });
  }
}

export function assertCalculationResultIntegrity(result: unknown) {
  if (!result || typeof result !== 'object') {
    throw createNumericFaultError('Calculation did not return an object result.');
  }

  assertNoUnsafeNumbers(result);
  assertNonEmptyTimeline(result as Record<string, unknown>);
}

/**
 * Higher-order function that wraps a calculation engine with sanity guards.
 * It rejects runtime errors and unsafe results instead of returning fake success.
 */
export function withMathGuard<T, R>(fn: (inputs: T) => R): (inputs: T) => R {
  return (inputs: T): R => {
    try {
      const sanitized = sanitizeInputs(inputs as unknown as SanitizeTarget) as unknown as T;
      const result = fn(sanitized);
      assertCalculationResultIntegrity(result);

      return result;
    } catch (err) {
      if (isCalculationDomainError(err)) {
        throw err;
      }

      throw createEngineFailureError(
        'Calculation failed before a trustworthy result could be produced.',
        { cause: err },
      );
    }
  };
}
