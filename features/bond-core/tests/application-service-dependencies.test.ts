import { describe, expect, it, vi } from 'vitest';

import {
  CalculationApplicationService,
  CalculationServiceDependencies,
} from '../application-service';
import { BOND_DEFINITIONS, type BondDefinition } from '../constants/bond-definitions';
import { BondType, InterestPayout, TaxStrategy } from '../types';
import { CalculationDataFreshness, CalculationEnvelope, ScenarioKind } from '../types/scenarios';
import { SingleBondCalculationIntentSchema } from '../types/schemas';

const basePayload = {
  bondType: BondType.EDO,
  initialInvestment: 1000,
  firstYearRate: 5.35,
  expectedInflation: 3,
  expectedNbpRate: 5.25,
  margin: 2,
  duration: 10,
  earlyWithdrawalFee: 2,
  taxRate: 19,
  isCapitalized: true,
  payoutFrequency: InterestPayout.MATURITY,
  purchaseDate: '2026-06-01',
  withdrawalDate: '2036-06-01',
  isRebought: false,
  rebuyDiscount: 0,
  taxStrategy: TaxStrategy.STANDARD,
};

describe('CalculationApplicationService dependencies', () => {
  it('uses injected cache, definitions, freshness, and handler dependencies', async () => {
    const envelope: CalculationEnvelope<{ ok: true }> = {
      result: { ok: true },
      warnings: [],
      assumptions: [],
      calculationNotes: [],
      dataQualityFlags: [],
      dataFreshness: { status: 'fresh', usedFallback: false },
      calculationVersion: 'test-model',
    };
    const handler = {
      kind: ScenarioKind.SINGLE_BOND,
      handle: vi.fn(async () => envelope),
    };
    const freshness: CalculationDataFreshness = { status: 'fresh', usedFallback: false };
    const dependencies: CalculationServiceDependencies = {
      cache: {
        generateKey: vi.fn(() => 'cache-key'),
        get: vi.fn(() => null),
        set: vi.fn(),
        invalidateNamespace: vi.fn(),
      },
      getDataFreshness: vi.fn(async () => freshness),
      getTaxRulesRevision: vi.fn(async () => '2026:revision'),
      getDefinitions: vi.fn(async () => BOND_DEFINITIONS),
      getHandler: vi.fn(() => handler) as unknown as CalculationServiceDependencies['getHandler'],
    };

    const service = new CalculationApplicationService(dependencies);
    const result = await service.calculate({
      kind: ScenarioKind.SINGLE_BOND,
      payload: basePayload,
    });

    expect(result).toEqual({ ...envelope, taxRulesRevision: '2026:revision' });
    expect(dependencies.getHandler).toHaveBeenCalledWith(ScenarioKind.SINGLE_BOND);
    expect(handler.handle).toHaveBeenCalledWith(
      SingleBondCalculationIntentSchema.parse(basePayload),
      {
        dataFreshness: freshness,
        dbDefinitions: BOND_DEFINITIONS,
      },
    );
    expect(dependencies.cache.set).toHaveBeenCalledWith(
      'cache-key',
      { ...envelope, taxRulesRevision: '2026:revision' },
      5 * 60_000,
    );
  });

  it('uses the authoritative freshness revision as part of the cache identity', async () => {
    const envelope: CalculationEnvelope<{ ok: true }> = {
      result: { ok: true },
      warnings: [],
      assumptions: [],
      calculationNotes: [],
      dataQualityFlags: [],
      dataFreshness: { status: 'fresh', usedFallback: false },
      calculationVersion: 'test-model',
    };
    const freshness: CalculationDataFreshness = {
      status: 'fresh',
      usedFallback: false,
      bondOfferAttemptAt: '2026-07-01T00:00:00.000Z',
      coverageAsOf: '2026-07-01',
    };
    const handler = { kind: ScenarioKind.SINGLE_BOND, handle: vi.fn(async () => envelope) };
    const dependencies: CalculationServiceDependencies = {
      cache: {
        generateKey: vi.fn(() => 'revision-aware-key'),
        get: vi.fn(() => envelope),
        set: vi.fn(),
        invalidateNamespace: vi.fn(),
      },
      getDataFreshness: vi.fn(async () => freshness),
      getTaxRulesRevision: vi.fn(async () => '2026:revision'),
      getDefinitions: vi.fn(async () => BOND_DEFINITIONS),
      getHandler: vi.fn(() => handler) as unknown as CalculationServiceDependencies['getHandler'],
    };

    await new CalculationApplicationService(dependencies).calculate({
      kind: ScenarioKind.SINGLE_BOND,
      payload: basePayload,
    });

    const cacheInput = vi.mocked(dependencies.cache.generateKey).mock.calls[0][0] as {
      dataRevision: string;
    };
    const dataRevision = JSON.parse(cacheInput.dataRevision) as Record<string, unknown>;
    expect(dataRevision).toMatchObject({
      dataFreshness: freshness,
      taxRulesRevision: '2026:revision',
    });
    expect(dataRevision.definitions).toEqual(expect.any(String));
    expect(handler.handle).not.toHaveBeenCalled();
    expect(dependencies.cache.set).not.toHaveBeenCalled();
  });

  it('loads definitions and freshness concurrently before choosing a cache entry', async () => {
    let releaseFreshness!: () => void;
    let releaseDefinitions!: () => void;
    const freshnessPromise = new Promise<CalculationDataFreshness>((resolve) => {
      releaseFreshness = () => resolve({ status: 'fresh', usedFallback: false });
    });
    const definitionsPromise = new Promise<Record<BondType, BondDefinition>>((resolve) => {
      releaseDefinitions = () => resolve(BOND_DEFINITIONS);
    });
    const envelope: CalculationEnvelope<{ ok: true }> = {
      result: { ok: true },
      warnings: [],
      assumptions: [],
      calculationNotes: [],
      dataQualityFlags: [],
      dataFreshness: { status: 'fresh', usedFallback: false },
      calculationVersion: 'test-model',
    };
    const dependencies: CalculationServiceDependencies = {
      cache: {
        generateKey: vi.fn(() => 'key'),
        get: vi.fn(() => null),
        set: vi.fn(),
        invalidateNamespace: vi.fn(),
      },
      getDataFreshness: vi.fn(() => freshnessPromise),
      getTaxRulesRevision: vi.fn(async () => '2026:revision'),
      getDefinitions: vi.fn(() => definitionsPromise),
      getHandler: vi.fn(() => ({
        kind: ScenarioKind.SINGLE_BOND,
        handle: vi.fn(async () => envelope),
      })) as unknown as CalculationServiceDependencies['getHandler'],
    };
    const calculation = new CalculationApplicationService(dependencies).calculate({
      kind: ScenarioKind.SINGLE_BOND,
      payload: basePayload,
    });

    expect(dependencies.getDataFreshness).toHaveBeenCalledOnce();
    expect(dependencies.getDefinitions).toHaveBeenCalledOnce();
    expect(dependencies.getTaxRulesRevision).toHaveBeenCalledOnce();
    expect(dependencies.cache.generateKey).not.toHaveBeenCalled();

    releaseFreshness();
    releaseDefinitions();
    await calculation;
    expect(dependencies.cache.generateKey).toHaveBeenCalledOnce();
  });
});
