import { BondInputs, BondType, CalculationResult } from '@/features/bond-core/types';
import { ScenarioKind, SingleBondCalculationEnvelope } from '@/features/bond-core/types/scenarios';
import type { Language } from '@/i18n/config';
import { bondSeriesClient } from '@/shared/lib/bond-series-client';
import { CalculationCancelled } from '@/shared/lib/calculation-cancelled';
import { getCalculationEndpoint } from '@/shared/lib/calculation-endpoints';
import { logClientError } from '@/shared/lib/client-logger';
import { portfolioClient } from '@/shared/lib/portfolio-client';
import { createSingleScenarioPackage, encodeScenarioForUrl } from '@/shared/lib/scenario-codec';
import { scenarioShareClient } from '@/shared/lib/scenario-share-client';
import { buildSharedSingleScenarioPayload } from '@/shared/lib/single-scenario-share';
import {
  getStoredCurrentPortfolioId,
  setStoredCurrentPortfolioId,
} from '@/shared/lib/workspace/current-portfolio';
import { getWorkspaceSaveTarget } from '@/shared/lib/workspace/portfolio-selection';

import { createSavedScenario, saveScenarioRecord } from './scenario-storage';
import {
  buildSavedSingleScenarioMeta,
  buildSingleReportFilename,
} from './single-calculator-container-model';

type PostCalculation = <TResponse>(
  endpoint: string,
  payload: unknown,
  options?: { preferWorker?: boolean },
) => Promise<TResponse>;

export function isCalculationAbort(error: unknown) {
  return (
    error instanceof Error &&
    (error instanceof CalculationCancelled ||
      error.name === 'AbortError' ||
      error.message === 'Calculation aborted')
  );
}

export async function runSingleBondCalculation({
  inputs,
  post,
}: {
  inputs: BondInputs;
  post: PostCalculation;
}) {
  let finalInputs = { ...inputs };

  if (inputs.calculatorMode === 'reverse' && inputs.savingsGoal) {
    finalInputs = await solveReverseSavingsGoal(inputs, async (candidateInputs) => {
      const envelope = await post<SingleBondCalculationEnvelope>(
        getCalculationEndpoint(ScenarioKind.SINGLE_BOND),
        candidateInputs,
      );
      return envelope.result.netPayoutValue;
    });
  }

  const envelope = await post<SingleBondCalculationEnvelope>(
    getCalculationEndpoint(ScenarioKind.SINGLE_BOND),
    finalInputs,
  );

  return { envelope, finalInputs };
}

/** Searches integer purchasable bond counts and verifies the lower neighbour. */
export async function solveReverseSavingsGoal(
  inputs: BondInputs,
  calculatePayout: (candidate: BondInputs) => Promise<number>,
) {
  if (inputs.calculatorMode !== 'reverse' || !inputs.savingsGoal || inputs.savingsGoal <= 0) {
    return { ...inputs };
  }

  const bondPrice = inputs.isRebought ? 100 - (inputs.rebuyDiscount || 0) : 100;
  const target = inputs.savingsGoal;
  const payoutFor = async (quantity: number) =>
    calculatePayout({ ...inputs, initialInvestment: quantity * bondPrice });

  let low = 0;
  let high = 1;
  const MAX_BONDS = 10_000_000;
  while ((await payoutFor(high)) < target) {
    low = high;
    high *= 2;
    if (high > MAX_BONDS) {
      throw new Error('The target exceeds the supported reverse-calculation range.');
    }
  }

  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if ((await payoutFor(middle)) >= target) high = middle;
    else low = middle;
  }

  // The binary-search invariant proves `high` meets the target and `low`
  // does not, including denomination and tax-rounding thresholds.
  return { ...inputs, initialInvestment: high * bondPrice };
}

export function fetchBondSeriesForSymbol(symbol: BondType) {
  return bondSeriesClient.listBySymbol(symbol);
}

type Translate = (key: string, values?: Record<string, string | number>) => string;
type StatusTone = 'success' | 'error';

export interface SingleCalculatorActionDependencies {
  results: CalculationResult | null;
  envelope?: SingleBondCalculationEnvelope | null;
  lastCommittedInputs: BondInputs | null;
  selectedSeriesId: string | null | undefined;
  language: Language;
  canManageWorkspace: boolean;
  t: Translate;
  setStatus: (tone: StatusTone, message: string) => void;
}

/**
 * Owns effects initiated from the single-calculator result controls. The
 * container remains responsible for rendering and calculation state only.
 */
export function createSingleCalculatorActions({
  results,
  envelope,
  lastCommittedInputs,
  selectedSeriesId,
  language,
  canManageWorkspace,
  t,
  setStatus,
}: SingleCalculatorActionDependencies) {
  return {
    async addToNotebook() {
      if (!results || !canManageWorkspace) return;

      try {
        if (!lastCommittedInputs) return;

        const portfolioList = await portfolioClient.listPortfolios();
        const saveTarget = getWorkspaceSaveTarget(getStoredCurrentPortfolioId(), portfolioList);
        let portfolioId: string | undefined = saveTarget.portfolioId ?? undefined;
        let portfolioName: string | null = saveTarget.portfolioName;

        if (saveTarget.needsPortfolioCreation) {
          const createdPortfolio = await portfolioClient.createPortfolio({
            name: t('notebook.my_first_portfolio'),
            description: '',
          });
          portfolioId = createdPortfolio?.id;
          portfolioName = createdPortfolio?.name ?? t('notebook.my_first_portfolio');
        }

        if (!portfolioId) throw new Error('Could not resolve a portfolio id for notebook save.');

        setStoredCurrentPortfolioId(portfolioId);
        await portfolioClient.createLot({
          portfolioId,
          bondType: lastCommittedInputs.bondType,
          selectedSeriesId:
            selectedSeriesId && selectedSeriesId !== 'current' ? selectedSeriesId : null,
          purchaseDate: lastCommittedInputs.purchaseDate,
          bondQuantity: Math.floor(lastCommittedInputs.initialInvestment / 100),
          isRebought: lastCommittedInputs.isRebought,
        });
        setStatus(
          'success',
          portfolioName
            ? t('notebook.current_lot_added_to_active', { name: portfolioName })
            : t('notebook.current_lot_added'),
        );
      } catch (error) {
        logClientError('Notebook lot save failed:', error);
        setStatus('error', t('notebook.create_error'));
      }
    },

    saveScenario() {
      try {
        if (!results || !lastCommittedInputs) return;
        const scenarioMeta = buildSavedSingleScenarioMeta(lastCommittedInputs, results);
        saveScenarioRecord(
          createSavedScenario(lastCommittedInputs, {
            name: scenarioMeta.name,
            description: scenarioMeta.description,
          }),
        );
        setStatus('success', t('bonds.results.scenario_save_success'));
      } catch (error) {
        logClientError('Scenario save failed:', error);
        setStatus('error', t('bonds.results.scenario_save_error'));
      }
    },

    async exportPdf() {
      if (!results || !lastCommittedInputs) return;

      try {
        const { generateSingleBondReportPdf } = await import('@/shared/lib/pdf-utils');
        await generateSingleBondReportPdf(
          results,
          lastCommittedInputs,
          language,
          buildSingleReportFilename(lastCommittedInputs, language),
          envelope ?? undefined,
        );
        setStatus('success', t('bonds.results.pdf_export_success'));
      } catch (error) {
        logClientError('PDF export failed:', error);
        setStatus('error', t('bonds.results.pdf_export_error'));
      }
    },

    async shareScenario() {
      if (!results || !lastCommittedInputs) return;

      const encoded = encodeScenarioForUrl(createSingleScenarioPackage(lastCommittedInputs));
      if (encoded && typeof window !== 'undefined') {
        return `${window.location.origin}/single-calculator?scenario=${encoded}`;
      }

      const payload = buildSharedSingleScenarioPayload(
        lastCommittedInputs,
        `Committed single-bond scenario for ${lastCommittedInputs.bondType}.`,
      );
      const shareSnapshot = await scenarioShareClient.createSingleScenario(payload);
      return shareSnapshot.shareUrl;
    },
  };
}
