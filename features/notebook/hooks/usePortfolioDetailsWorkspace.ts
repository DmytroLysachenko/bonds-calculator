'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BondDefinition } from '@/features/bond-core/constants/bond-definitions';
import { BondType } from '@/features/bond-core/types';
import { PortfolioSimulationResult } from '@/features/bond-core/types/scenarios';
import { logClientError } from '@/shared/lib/client-logger';
import { downloadJsonFile } from '@/shared/lib/csv-utils';
import { portfolioClient } from '@/shared/lib/portfolio-client';
import { CreatePortfolioLotInput } from '@/shared/lib/portfolio-client';
import { UserInvestmentLot, UserPortfolio } from '@/shared/types/portfolio';

import { buildPortfolioDetailProjection } from '../lib/portfolio-detail-projection';

export type MaturityWindow = 30 | 90 | 180;

type UsePortfolioDetailsWorkspaceOptions = {
  portfolio: UserPortfolio;
  definitions: Record<BondType, BondDefinition> | null;
  onPortfolioUpdate?: (portfolio: UserPortfolio) => void;
};

export function usePortfolioDetailsWorkspace({
  portfolio,
  definitions,
  onPortfolioUpdate,
}: UsePortfolioDetailsWorkspaceOptions) {
  const [lots, setLots] = useState<UserInvestmentLot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [simulation, setSimulation] = useState<PortfolioSimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(portfolio.isPublic || false);
  const [isSharing, setIsSharing] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [maturityWindowDays, setMaturityWindowDays] = useState<MaturityWindow>(90);
  const requestEpoch = useRef(0);
  const simulationEpoch = useRef(0);
  const mutationRevision = useRef(0);
  const activePortfolioId = useRef(portfolio.id);
  useEffect(() => {
    if (activePortfolioId.current === portfolio.id) return;
    activePortfolioId.current = portfolio.id;
    requestEpoch.current += 1;
    simulationEpoch.current += 1;
    mutationRevision.current = 0;
  }, [portfolio.id]);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/shared-portfolios/${portfolio.shareId}`
      : '';

  const fetchLots = useCallback(async () => {
    const epoch = ++requestEpoch.current;
    const revision = mutationRevision.current;
    setIsLoading(true);
    try {
      const nextLots = await portfolioClient.listLots(portfolio.id);
      if (
        epoch === requestEpoch.current &&
        revision === mutationRevision.current &&
        activePortfolioId.current === portfolio.id
      ) {
        setLots(Array.isArray(nextLots) ? nextLots : []);
        setRequestError(null);
      }
    } catch (caughtError) {
      logClientError('Failed to fetch lots:', caughtError);
      if (epoch === requestEpoch.current && activePortfolioId.current === portfolio.id) {
        setRequestError('Could not refresh holdings.');
      }
    } finally {
      if (epoch === requestEpoch.current && activePortfolioId.current === portfolio.id)
        setIsLoading(false);
    }
  }, [portfolio.id]);

  const lotsRevision = lots
    .map((lot) => `${lot.id}:${lot.bondQuantity}:${lot.purchaseDate}`)
    .join('|');
  const runSimulation = useCallback(async () => {
    const epoch = ++simulationEpoch.current;
    const revision = mutationRevision.current;
    if (lotsRevision.length === 0) {
      if (epoch === simulationEpoch.current && activePortfolioId.current === portfolio.id)
        setSimulation(null);
      return;
    }

    setIsSimulating(true);
    try {
      const nextSimulation = await portfolioClient.simulatePortfolio(portfolio.id);
      if (
        epoch === simulationEpoch.current &&
        revision === mutationRevision.current &&
        activePortfolioId.current === portfolio.id
      ) {
        setSimulation(nextSimulation ?? null);
        setRequestError(null);
      }
    } catch (caughtError) {
      logClientError('Simulation failed:', caughtError);
      if (epoch === simulationEpoch.current && activePortfolioId.current === portfolio.id) {
        setRequestError('Could not refresh the projection.');
      }
    } finally {
      if (epoch === simulationEpoch.current && activePortfolioId.current === portfolio.id) {
        setIsSimulating(false);
      }
    }
  }, [lotsRevision, portfolio.id]);

  const mutateLots = useCallback(
    async (operation: () => Promise<unknown>) => {
      try {
        mutationRevision.current += 1;
        await operation();
        await fetchLots();
        setRequestError(null);
      } catch (caughtError) {
        logClientError('Portfolio lot update failed:', caughtError);
        setRequestError('Could not update this holding.');
        throw caughtError;
      }
    },
    [fetchLots],
  );

  const createLot = useCallback(
    (input: Omit<CreatePortfolioLotInput, 'portfolioId'>) =>
      mutateLots(() => portfolioClient.createLot({ ...input, portfolioId: portfolio.id })),
    [mutateLots, portfolio.id],
  );
  const updateLot = useCallback(
    (lotId: string, input: Partial<CreatePortfolioLotInput>) =>
      mutateLots(() => portfolioClient.updateLot(lotId, input)),
    [mutateLots],
  );
  const deleteLot = useCallback(
    (lotId: string) => mutateLots(() => portfolioClient.deleteLot(lotId)),
    [mutateLots],
  );

  useEffect(() => {
    setIsPublic(portfolio.isPublic || false);
  }, [portfolio.id, portfolio.isPublic]);

  useEffect(() => {
    void fetchLots();
  }, [fetchLots]);

  useEffect(() => {
    void runSimulation();
  }, [runSimulation]);

  const projection = useMemo(
    () =>
      buildPortfolioDetailProjection({
        lots,
        definitions,
        now: new Date(),
        maturityWindowDays,
      }),
    [definitions, lots, maturityWindowDays],
  );

  const handleToggleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const nextIsPublic = !isPublic;
      await portfolioClient.toggleSharing(portfolio.id, nextIsPublic);
      setIsPublic(nextIsPublic);
      onPortfolioUpdate?.({
        ...portfolio,
        isPublic: nextIsPublic,
        updatedAt: new Date(),
      });
    } catch (caughtError) {
      logClientError('Failed to update sharing:', caughtError);
      setRequestError('Could not update sharing.');
    } finally {
      setIsSharing(false);
    }
  }, [isPublic, onPortfolioUpdate, portfolio]);

  const updatePortfolio = useCallback(
    async (input: { name: string; description: string }) => {
      try {
        const updated = await portfolioClient.updatePortfolio(portfolio.id, input);
        onPortfolioUpdate?.(updated);
        setRequestError(null);
      } catch (caughtError) {
        logClientError('Portfolio metadata update failed:', caughtError);
        setRequestError('Could not update portfolio details.');
        throw caughtError;
      }
    },
    [onPortfolioUpdate, portfolio.id],
  );

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    } catch (caughtError) {
      logClientError('Copy failed:', caughtError);
      setRequestError('Could not copy the sharing link.');
    }
  }, [shareUrl]);

  const handleExport = useCallback(
    async (formatName: 'portfolio' | 'package') => {
      try {
        const { data, fileName } = await portfolioClient.exportPortfolio(portfolio, formatName);

        downloadJsonFile(data, fileName);
      } catch (caughtError) {
        logClientError('Export failed:', caughtError);
        setRequestError('Could not export this portfolio.');
      }
    },
    [portfolio],
  );

  const refreshDetails = useCallback(async () => {
    await fetchLots();
    await runSimulation();
  }, [fetchLots, runSimulation]);

  return {
    lots,
    isLoading,
    simulation,
    isSimulating,
    requestError,
    isPublic,
    isSharing,
    justCopied,
    maturityWindowDays,
    setMaturityWindowDays,
    ...projection,
    fetchLots: refreshDetails,
    createLot,
    updateLot,
    deleteLot,
    handleToggleShare,
    updatePortfolio,
    copyToClipboard,
    handleExport,
  };
}
