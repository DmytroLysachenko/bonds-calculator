import { describe, expect, it } from 'vitest';

import { BondType, TaxStrategy } from '@/features/bond-core/types';
import { ScenarioKind } from '@/features/bond-core/types/scenarios';
import {
  BondInputsSchema,
  parseCalculationScenarioRequest,
} from '@/features/bond-core/types/schemas';
import { buildDefaultSharedConfig } from '@/features/comparison-engine/lib/comparison-calculator-state';
import { restoreSingleCalculatorState } from '@/features/single-calculator/lib/single-calculator-persistence';
import { buildFallbackInputs } from '@/features/single-calculator/lib/single-calculator-state';

import {
  createComparisonScenarioPackage,
  createSingleScenarioPackage,
  decodeScenarioFromUrl,
  encodeScenarioForUrl,
  parseScenarioPackage,
  serializeScenarioPackage,
} from './scenario-codec';

describe('scenario codec', () => {
  it('round-trips complete advanced single-bond assumptions without historical output', () => {
    const inputs = {
      ...buildFallbackInputs(new Date('2026-01-01')),
      bondType: BondType.EDO,
      customInflation: Array.from({ length: 10 }, (_, index) => 2.1 + index),
      customNbpRate: Array.from({ length: 10 }, (_, index) => 5.1 - index / 10),
      taxStrategy: TaxStrategy.IKE,
      historicalData: { '2025-01': { inflation: 3.1 } },
    };
    const scenario = createSingleScenarioPackage(inputs);
    const encoded = encodeScenarioForUrl(scenario);
    expect(encoded).not.toBeNull();
    const decoded = decodeScenarioFromUrl(encoded);
    expect(decoded).toMatchObject({ ok: true, scenario: { kind: 'single-bond' } });
    if (decoded.ok && decoded.scenario.kind === 'single-bond') {
      expect(decoded.scenario.intent).toMatchObject({
        customInflation: inputs.customInflation,
        customNbpRate: inputs.customNbpRate,
        taxStrategy: TaxStrategy.IKE,
      });
      expect(decoded.scenario.intent).not.toHaveProperty('historicalData');
    }
  });

  it('round-trips same-family comparison strategies independently', () => {
    const scenario = createComparisonScenarioPackage({
      mode: 'independent',
      sharedConfig: {
        ...buildDefaultSharedConfig(new Date('2026-01-01')),
        customInflation: Array.from({ length: 10 }, (_, index) => 2 + index),
      },
      scenarioA: { bondType: BondType.EDO, taxStrategy: TaxStrategy.STANDARD, rollover: false },
      scenarioB: { bondType: BondType.EDO, taxStrategy: TaxStrategy.IKE, rollover: false },
    });
    const decoded = parseScenarioPackage(serializeScenarioPackage(scenario));
    expect(decoded).toMatchObject({ ok: true, scenario: { kind: 'bond-comparison' } });
    if (decoded.ok && decoded.scenario.kind === 'bond-comparison') {
      expect(decoded.scenario.intent.scenarioA).not.toEqual(decoded.scenario.intent.scenarioB);
    }
  });

  it('rejects malformed and unsupported package versions explicitly', () => {
    expect(parseScenarioPackage('{')).toEqual({ ok: false, reason: 'malformed' });
    expect(parseScenarioPackage({ version: 99, kind: 'single-bond', intent: {} })).toEqual({
      ok: false,
      reason: 'unsupported-version',
    });
  });

  it('applies the same date and horizon boundary to API, package, and URL inputs', () => {
    const inputs = {
      ...buildFallbackInputs(new Date('2026-01-31')),
      withdrawalDate: '2056-02-01',
      investmentHorizonMonths: undefined,
      timingMode: 'exact' as const,
    };
    expect(() =>
      parseCalculationScenarioRequest({ kind: ScenarioKind.SINGLE_BOND, payload: inputs }),
    ).toThrow();
    const packageValue = createSingleScenarioPackage(inputs);
    expect(parseScenarioPackage(packageValue)).toEqual({ ok: false, reason: 'malformed' });
    expect(encodeScenarioForUrl(packageValue)).toBeNull();
    expect(
      decodeScenarioFromUrl(encodeURIComponent(serializeScenarioPackage(packageValue))),
    ).toEqual({ ok: false, reason: 'malformed' });
  });

  it.each([
    ['maximum exact horizon', { withdrawalDate: '2056-01-31', investmentHorizonMonths: 360 }, true],
    [
      'overlong exact horizon',
      { withdrawalDate: '2056-02-01', investmentHorizonMonths: 360 },
      false,
    ],
    ['fractional horizon', { investmentHorizonMonths: 12.5 }, false],
    ['minimum supported inflation', { expectedInflation: -20 }, true],
    ['unsupported inflation', { expectedInflation: -20.01 }, false],
    ['minimum supported NBP rate', { expectedNbpRate: -10 }, true],
    ['unsupported NBP rate', { expectedNbpRate: -10.01 }, false],
    ['invalid calendar date', { purchaseDate: '2026-02-30' }, false],
    ['inconsistent horizon', { investmentHorizonMonths: 119 }, false],
  ] as const)(
    'keeps %s aligned across API, portable URL and persisted input',
    (_label, overrides, expected) => {
      const inputs = { ...buildFallbackInputs(new Date('2026-01-31')), ...overrides };
      const apiAccepted = (() => {
        try {
          parseCalculationScenarioRequest({ kind: ScenarioKind.SINGLE_BOND, payload: inputs });
          return true;
        } catch {
          return false;
        }
      })();
      const packageValue = createSingleScenarioPackage(inputs);
      const packageAccepted = parseScenarioPackage(packageValue).ok;
      const urlAccepted = decodeScenarioFromUrl(
        encodeURIComponent(serializeScenarioPackage(packageValue)),
      ).ok;
      const persistedAccepted =
        restoreSingleCalculatorState({
          inputs,
          envelope: null,
          selectedSeriesId: null,
          lastCommittedInputs: null,
          isDirty: true,
        }) !== null;
      expect([
        apiAccepted,
        packageAccepted,
        urlAccepted,
        persistedAccepted,
        BondInputsSchema.safeParse(inputs).success,
      ]).toEqual(Array(5).fill(expected));
    },
  );

  it.each([
    ['maximum comparison horizon', 360, '2056-01-01', true],
    ['overlong comparison horizon', 361, '2056-02-01', false],
    ['fractional comparison horizon', 12.5, '2027-01-01', false],
  ] as const)(
    'keeps %s aligned across comparison API, package and URL',
    (_label, months, withdrawalDate, expected) => {
      const scenario = createComparisonScenarioPackage({
        mode: 'independent',
        sharedConfig: {
          ...buildDefaultSharedConfig(new Date('2026-01-01T12:00:00Z')),
          investmentHorizonMonths: months,
          withdrawalDate,
        },
        scenarioA: { bondType: BondType.EDO },
        scenarioB: { bondType: BondType.ROR },
      });
      const apiAccepted = (() => {
        try {
          parseCalculationScenarioRequest({
            kind: ScenarioKind.BOND_COMPARISON,
            payload: scenario.intent,
          });
          return true;
        } catch {
          return false;
        }
      })();
      const packageAccepted = parseScenarioPackage(scenario).ok;
      const urlAccepted = decodeScenarioFromUrl(
        encodeURIComponent(serializeScenarioPackage(scenario)),
      ).ok;
      expect([apiAccepted, packageAccepted, urlAccepted]).toEqual(Array(3).fill(expected));
    },
  );

  it('rejects an unknown comparison policy consistently at API, package and URL boundaries', () => {
    const scenario = createComparisonScenarioPackage({
      mode: 'independent',
      sharedConfig: buildDefaultSharedConfig(new Date('2026-01-01T12:00:00Z')),
      scenarioA: { bondType: BondType.EDO },
      scenarioB: { bondType: BondType.ROR },
    });
    const malformed = {
      ...scenario,
      intent: { ...scenario.intent, rollover: false },
    };
    expect(() =>
      parseCalculationScenarioRequest({
        kind: ScenarioKind.BOND_COMPARISON,
        payload: malformed.intent,
      }),
    ).toThrow();
    expect(parseScenarioPackage(malformed).ok).toBe(false);
    expect(decodeScenarioFromUrl(encodeURIComponent(JSON.stringify(malformed))).ok).toBe(false);
  });

  it('rejects unsupported single coupon policy at API, package, URL and persisted boundaries', () => {
    const inputs = {
      ...buildFallbackInputs(new Date('2026-01-31')),
      couponDisposition: 'cash' as const,
    };
    const scenario = createSingleScenarioPackage(inputs);
    expect(() =>
      parseCalculationScenarioRequest({ kind: ScenarioKind.SINGLE_BOND, payload: inputs }),
    ).toThrow();
    expect(parseScenarioPackage(scenario).ok).toBe(false);
    expect(decodeScenarioFromUrl(encodeURIComponent(JSON.stringify(scenario))).ok).toBe(false);
    expect(
      restoreSingleCalculatorState({
        inputs,
        envelope: null,
        selectedSeriesId: null,
        lastCommittedInputs: null,
        isDirty: true,
      }),
    ).toBeNull();
  });
});
