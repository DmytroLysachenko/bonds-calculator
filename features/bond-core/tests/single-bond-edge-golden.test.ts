import { beforeEach, describe, expect, it, vi } from 'vitest';

import { calculationService } from '@/lib/server/calculation/composition';
import { getWithdrawalDateFromMonths } from '@/shared/lib/date-timing';

import { BOND_DEFINITIONS } from '../constants/bond-definitions';
import { BondType, CalculationResult, TaxStrategy } from '../types';
import { ScenarioKind } from '../types/scenarios';
import { calculationCache } from '../utils/calculation-cache';

vi.mock('@/lib/data/market-data', async () => {
  const runtimeDefinitionsModule = await import('../constants/bond-definitions');
  const runtimeDefinitions = runtimeDefinitionsModule.BOND_DEFINITIONS;

  const historicalMap: Record<string, { inflation?: number; nbpRate?: number }> = {};
  const baseDate = new Date('2026-05-05T00:00:00.000Z');

  for (let offset = -24; offset <= 180; offset += 1) {
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() + offset);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    historicalMap[key] = {
      inflation: 3 + (offset % 6) * 0.1,
      nbpRate: 5 + (offset % 4) * 0.15,
    };
  }

  return {
    getHistoricalDataMap: vi.fn().mockImplementation(async () => historicalMap),
    getBondDefinitions: vi.fn().mockResolvedValue(Object.values(runtimeDefinitions)),
    getBondDefinitionsMap: vi.fn().mockResolvedValue(runtimeDefinitions),
    getGlobalDataFreshness: vi.fn().mockResolvedValue({
      status: 'fresh',
      asOf: '2026-04',
      lastCheck: '2026-05-05T00:00:00.000Z',
      usedFallback: false,
    }),
    getTaxRulesRevision: vi.fn().mockResolvedValue('tax-rules-2026'),
    getHistoricalAverages: vi.fn().mockResolvedValue({
      inflation: { '1y': 3.2, '5y': 4.1, '10y': 3.6 },
      nbpRate: { '1y': 5.4, '5y': 4.7, '10y': 4.1 },
    }),
    getTaxRulesForYear: vi.fn().mockResolvedValue({
      ikeLimit: '999999.00',
      ikzeLimit: '999999.00',
    }),
    getMultiAssetHistory: vi.fn(),
  };
});

vi.mock('@/lib/server/bonds/offer-terms', async () => {
  const { BOND_DEFINITIONS: runtimeDefinitions } = await import('../constants/bond-definitions');

  return {
    resolveBondOfferTerms: vi.fn().mockImplementation((bondType: BondType) => {
      const definition = runtimeDefinitions[bondType];

      return Promise.resolve({
        firstYearRate: definition.firstYearRate,
        margin: definition.margin,
        source: 'definition-fallback',
      });
    }),
  };
});

function buildSingleBondPayload(
  bondType: BondType,
  withdrawalMonths: number,
  taxStrategy = TaxStrategy.STANDARD,
) {
  const definition = BOND_DEFINITIONS[bondType];
  const purchaseDate = '2026-05-05';

  return {
    bondType,
    initialInvestment: 10000,
    firstYearRate: definition.firstYearRate,
    expectedInflation: 3.5,
    expectedNbpRate: 5.25,
    margin: definition.margin,
    duration: definition.duration,
    earlyWithdrawalFee: definition.earlyWithdrawalFee,
    taxRate: 19,
    isCapitalized: definition.isCapitalized,
    payoutFrequency: definition.payoutFrequency,
    purchaseDate,
    withdrawalDate: getWithdrawalDateFromMonths(purchaseDate, withdrawalMonths),
    isRebought: false,
    rebuyDiscount: definition.rebuyDiscount,
    taxStrategy,
    timingMode: 'exact' as const,
    investmentHorizonMonths: withdrawalMonths,
    rollover: false,
  };
}

async function getSingleResult(
  bondType: BondType,
  withdrawalMonths: number,
  taxStrategy = TaxStrategy.STANDARD,
) {
  const envelope = await calculationService.calculate({
    kind: ScenarioKind.SINGLE_BOND,
    payload: buildSingleBondPayload(bondType, withdrawalMonths, taxStrategy),
  });

  return envelope.result as CalculationResult;
}

describe('Single-bond edge golden regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calculationCache.clear();
  });

  it('keeps early-withdrawal and family-bond edge cases trustworthy', async () => {
    const coiEarly = await getSingleResult(BondType.COI, 24);
    const edoEarly = await getSingleResult(BondType.EDO, 60);
    const otsMaturity = await getSingleResult(BondType.OTS, 3);
    const rosMaturity = await getSingleResult(BondType.ROS, 72);
    const rodMaturity = await getSingleResult(BondType.ROD, 144);

    expect(coiEarly.netPayoutValue).toBeGreaterThan(10700);
    expect(coiEarly.netPayoutValue).toBeLessThan(10950);
    expect(coiEarly.totalProfit).toBeGreaterThan(700);
    expect(coiEarly.totalProfit).toBeLessThan(980);
    expect(coiEarly.totalTax).toBeGreaterThan(80);
    // The final unpaid coupon period is now taxed at redemption as well.
    expect(coiEarly.totalTax).toBe(170.05);
    expect(coiEarly.totalEarlyWithdrawalFee).toBe(70);
    expect(coiEarly.isEarlyWithdrawal).toBe(true);

    expect(edoEarly.netPayoutValue).toBeGreaterThan(12000);
    expect(edoEarly.netPayoutValue).toBeLessThan(13000);
    expect(edoEarly.totalProfit).toBeGreaterThan(1800);
    expect(edoEarly.totalProfit).toBeLessThan(2600);
    expect(edoEarly.totalTax).toBeGreaterThan(400);
    expect(edoEarly.totalTax).toBeLessThan(700);
    expect(edoEarly.totalEarlyWithdrawalFee).toBe(300);
    expect(edoEarly.isEarlyWithdrawal).toBe(true);

    expect(otsMaturity.netPayoutValue).toBeGreaterThan(10030);
    expect(otsMaturity.netPayoutValue).toBeLessThan(10100);
    expect(otsMaturity.totalProfit).toBeGreaterThan(30);
    expect(otsMaturity.totalProfit).toBeLessThan(100);
    expect(otsMaturity.totalTax).toBeGreaterThan(0);
    expect(otsMaturity.totalTax).toBeLessThan(30);
    expect(otsMaturity.totalEarlyWithdrawalFee).toBe(0);
    expect(otsMaturity.nominalAnnualizedReturn).toBeGreaterThan(1.5);
    expect(otsMaturity.nominalAnnualizedReturn).toBeLessThan(3);

    expect(rosMaturity.netPayoutValue).toBeGreaterThan(12500);
    expect(rosMaturity.netPayoutValue).toBeLessThan(14000);
    expect(rosMaturity.totalProfit).toBeGreaterThan(2500);
    expect(rosMaturity.totalProfit).toBeLessThan(4000);
    expect(rosMaturity.totalTax).toBeGreaterThan(500);
    expect(rosMaturity.totalTax).toBeLessThan(900);
    expect(rosMaturity.totalEarlyWithdrawalFee).toBe(0);

    expect(rodMaturity.netPayoutValue).toBeGreaterThan(17000);
    expect(rodMaturity.netPayoutValue).toBeLessThan(19000);
    expect(rodMaturity.totalProfit).toBeGreaterThan(7000);
    expect(rodMaturity.totalProfit).toBeLessThan(9000);
    expect(rodMaturity.totalTax).toBeGreaterThan(1500);
    expect(rodMaturity.totalTax).toBeLessThan(2500);
    expect(rodMaturity.totalEarlyWithdrawalFee).toBe(0);
  });
});
