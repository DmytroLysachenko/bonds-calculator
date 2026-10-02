import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BondInputs } from '@/features/bond-core/types';

const mocks = vi.hoisted(() => ({
  createLot: vi.fn(),
  createPortfolio: vi.fn(),
  exportPdf: vi.fn(),
  getCurrentPortfolioId: vi.fn(),
  listPortfolios: vi.fn(),
  logClientError: vi.fn(),
  saveScenarioRecord: vi.fn(),
  scenarioShare: vi.fn(),
  setCurrentPortfolioId: vi.fn(),
}));

vi.mock('@/shared/lib/portfolio-client', () => ({
  portfolioClient: {
    createLot: mocks.createLot,
    createPortfolio: mocks.createPortfolio,
    listPortfolios: mocks.listPortfolios,
  },
}));
vi.mock('@/shared/lib/scenario-share-client', () => ({
  scenarioShareClient: { createSingleScenario: mocks.scenarioShare },
}));
vi.mock('@/shared/lib/workspace/current-portfolio', () => ({
  getStoredCurrentPortfolioId: mocks.getCurrentPortfolioId,
  setStoredCurrentPortfolioId: mocks.setCurrentPortfolioId,
}));
vi.mock('@/shared/lib/client-logger', () => ({ logClientError: mocks.logClientError }));
vi.mock('@/shared/lib/single-scenario-share', () => ({
  buildSharedSingleScenarioPayload: vi.fn((sharedInputs, description) => ({
    title: 'Single EDO 120M',
    description,
    inputs: sharedInputs,
  })),
}));
vi.mock('./scenario-storage', () => ({
  createSavedScenario: vi.fn((inputs, metadata) => ({ inputs, ...metadata })),
  saveScenarioRecord: mocks.saveScenarioRecord,
}));
vi.mock('./single-calculator-container-model', () => ({
  buildSavedSingleScenarioMeta: vi.fn(() => ({ name: 'Saved scenario', description: 'Saved' })),
  buildSingleReportFilename: vi.fn(() => 'report.pdf'),
}));
vi.mock('@/shared/lib/pdf-utils', () => ({ generateSingleBondReportPdf: mocks.exportPdf }));

import {
  createSingleCalculatorActions,
  solveReverseSavingsGoal,
} from './single-calculator-actions';

const inputs = {
  bondType: 'EDO',
  initialInvestment: 1000,
  purchaseDate: '2026-08-01',
  isRebought: false,
} as BondInputs;
const results = { netPayoutValue: 1100 } as never;
const t = (key: string) => key;

function createActions(
  overrides: Partial<Parameters<typeof createSingleCalculatorActions>[0]> = {},
) {
  const setStatus = vi.fn();
  return {
    actions: createSingleCalculatorActions({
      results,
      lastCommittedInputs: inputs,
      selectedSeriesId: 'current',
      language: 'pl',
      canManageWorkspace: true,
      t,
      setStatus,
      ...overrides,
    }),
    setStatus,
  };
}

describe('single calculator result actions', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a missing notebook portfolio before adding the calculated lot', async () => {
    mocks.listPortfolios.mockResolvedValue([]);
    mocks.createPortfolio.mockResolvedValue({ id: 'portfolio-1', name: 'First portfolio' });

    const { actions, setStatus } = createActions();
    await actions.addToNotebook();

    expect(mocks.createPortfolio).toHaveBeenCalledWith({
      name: 'notebook.my_first_portfolio',
      description: '',
    });
    expect(mocks.setCurrentPortfolioId).toHaveBeenCalledWith('portfolio-1');
    expect(mocks.createLot).toHaveBeenCalledWith({
      portfolioId: 'portfolio-1',
      bondType: 'EDO',
      selectedSeriesId: null,
      purchaseDate: '2026-08-01',
      bondQuantity: 10,
      isRebought: false,
    });
    expect(setStatus).toHaveBeenCalledWith('success', 'notebook.current_lot_added_to_active');
  });

  it('does not access a workspace without a committed result and capability', async () => {
    const { actions } = createActions({ results: null, canManageWorkspace: false });
    await actions.addToNotebook();

    expect(mocks.listPortfolios).not.toHaveBeenCalled();
    expect(mocks.createLot).not.toHaveBeenCalled();
  });

  it('turns notebook failures into a safe user-facing status', async () => {
    mocks.listPortfolios.mockRejectedValue(new Error('database connection leaked'));
    const { actions, setStatus } = createActions();

    await actions.addToNotebook();

    expect(mocks.logClientError).toHaveBeenCalledWith(
      'Notebook lot save failed:',
      expect.any(Error),
    );
    expect(setStatus).toHaveBeenCalledWith('error', 'notebook.create_error');
  });

  it('keeps saved scenarios local and reports success', () => {
    const { actions, setStatus } = createActions();
    actions.saveScenario();

    expect(mocks.saveScenarioRecord).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Saved scenario', description: 'Saved' }),
    );
    expect(setStatus).toHaveBeenCalledWith('success', 'bonds.results.scenario_save_success');
  });

  it('loads PDF code only when export is requested', async () => {
    const { actions, setStatus } = createActions();
    await actions.exportPdf();

    expect(mocks.exportPdf).toHaveBeenCalledWith(results, inputs, 'pl', 'report.pdf', undefined);
    expect(setStatus).toHaveBeenCalledWith('success', 'bonds.results.pdf_export_success');
  });

  it('shares only a committed result snapshot', async () => {
    mocks.scenarioShare.mockResolvedValue({ shareUrl: '/shared/s1' });
    const { actions } = createActions();

    await expect(actions.shareScenario()).resolves.toBe('/shared/s1');
    expect(mocks.scenarioShare).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Committed single-bond scenario for EDO.' }),
    );
  });
});

describe('reverse minimum-purchase solver', () => {
  it('returns the first whole-bond quantity that reaches a threshold', async () => {
    const solved = await solveReverseSavingsGoal(
      {
        ...inputs,
        calculatorMode: 'reverse',
        savingsGoal: 901,
        rebuyDiscount: 0,
      },
      async (candidate) => candidate.initialInvestment * 0.9,
    );

    expect(solved.initialInvestment).toBe(1100);
    expect(solved.initialInvestment * 0.9).toBeGreaterThanOrEqual(901);
    expect((solved.initialInvestment - 100) * 0.9).toBeLessThan(901);
  });

  it('leaves non-reverse inputs unchanged', async () => {
    await expect(solveReverseSavingsGoal(inputs, async () => 0)).resolves.toEqual(inputs);
  });
});
