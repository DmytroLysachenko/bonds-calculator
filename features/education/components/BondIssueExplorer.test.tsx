import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { addYears, endOfMonth, format, startOfMonth } from 'date-fns';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import { decodeScenarioFromUrl } from '@/shared/lib/scenario-codec';

import {
  BondIssueExplorer,
  getIssueAvailability,
  getIssueRateDescription,
  getIssueSchedulePreview,
} from './BondIssueExplorer';

const listAll = vi.fn();
const currentSaleStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
const currentSaleEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

vi.mock('@/i18n/client', () => ({
  useAppI18n: () => ({ t: (key: string) => key, locale: 'en' }),
}));
vi.mock('@/shared/context/BondDefinitionsContext', () => ({
  useBondDefinitions: () => ({ definitions: BOND_DEFINITIONS }),
}));
vi.mock('@/shared/lib/bond-series-client', () => ({
  bondSeriesClient: { listAll: (...args: unknown[]) => listAll(...args) },
}));

describe('bond issue explorer', () => {
  it('uses issued rates without inventing a fixed-bond margin or an unresolved reset margin', () => {
    const issue = {
      id: 'issue',
      seriesCode: 'TOS1029',
      emissionMonth: '2026-10-01',
      firstYearRate: '4.40',
      baseMargin: null,
    };
    expect(getIssueRateDescription(issue, BOND_DEFINITIONS.TOS, 'fixed', 'unverified')).toBe(
      '4.40% fixed',
    );
    expect(
      getIssueRateDescription(
        { ...issue, seriesCode: 'COI1030' },
        BOND_DEFINITIONS.COI,
        'fixed',
        'unverified',
      ),
    ).toBe('4.40% → CPI + unverified');
    expect(
      getIssueRateDescription(
        { ...issue, firstYearRate: 'invalid' },
        BOND_DEFINITIONS.TOS,
        'fixed',
        'unverified',
      ),
    ).toBe('unverified');
  });

  it('clips illustrative issuer periods to the stored maturity date', () => {
    expect(
      getIssueSchedulePreview(
        {
          id: 'issue',
          seriesCode: 'ROR1027',
          emissionMonth: '2026-10-01',
          firstYearRate: '5.00',
          baseMargin: '0.00',
          sellStartDate: '2026-10-01',
          maturityDate: '2027-09-15',
        },
        BOND_DEFINITIONS.ROR,
      ),
    ).toEqual(['2026-11-01', '2026-12-01', '2027-09-15']);
  });
  function renderExplorer() {
    return render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <BondIssueExplorer />
      </SWRConfig>,
    );
  }

  it('never labels an issue with missing sale dates as current', () => {
    expect(
      getIssueAvailability(
        {
          id: 'missing-dates',
          seriesCode: 'ROR1027',
          firstYearRate: '5.00',
          baseMargin: '0.00',
          emissionMonth: '2026-10-01',
        },
        '2026-10-01',
      ),
    ).toBe('issue_unavailable');
    expect(
      getIssueAvailability(
        {
          id: 'reversed-dates',
          seriesCode: 'ROR1027',
          firstYearRate: '5.00',
          baseMargin: '0.00',
          emissionMonth: '2026-10-01',
          sellStartDate: '2026-10-31',
          sellEndDate: '2026-10-01',
          maturityDate: '2027-10-31',
        },
        '2026-10-15',
      ),
    ).toBe('issue_unavailable');
    expect(
      getIssueAvailability(
        {
          id: 'invalid-date',
          seriesCode: 'ROR1027',
          firstYearRate: '5.00',
          baseMargin: '0.00',
          emissionMonth: '2026-10-01',
          sellStartDate: '2026-02-30',
          sellEndDate: '2026-10-31',
          maturityDate: '2027-10-31',
        },
        '2026-10-15',
      ),
    ).toBe('issue_unavailable');
  });

  beforeEach(() => {
    listAll.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        seriesCode: 'ROR1027',
        emissionMonth: currentSaleStart,
        sellStartDate: currentSaleStart,
        sellEndDate: currentSaleEnd,
        maturityDate: format(addYears(new Date(`${currentSaleStart}T12:00:00Z`), 1), 'yyyy-MM-dd'),
        firstYearRate: '5.00',
        baseMargin: '0.00',
        earlyWithdrawalFee: '0.50',
        redemptionFeeCap: 'first-interest-then-principal',
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        seriesCode: 'ROS1029',
        emissionMonth: '2023-10-01',
        sellStartDate: '2023-10-01',
        sellEndDate: '2023-10-31',
        maturityDate: '2029-10-01',
        firstYearRate: '6.00',
        baseMargin: '1.50',
        earlyWithdrawalFee: null,
      },
    ]);
  });

  it('filters stored current and historical issues by eligibility and carries exact identity', async () => {
    renderExplorer();
    await waitFor(() => expect(screen.getAllByText(/ROR1027/).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/ROS1029/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/issue_explorer.historical/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/issue_explorer.schedule/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/issue_explorer.payout_monthly/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/issue_explorer.freshness_unknown/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('education.issue_explorer.exit_first_then_principal').length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('education.issue_explorer.exit_unverified').length).toBeGreaterThan(
      0,
    );

    fireEvent.change(screen.getByLabelText('education.issue_explorer.eligibility'), {
      target: { value: 'general' },
    });
    expect(screen.queryByText(/ROS1029/)).toBeNull();

    const href = screen
      .getAllByRole('link', { name: 'education.issue_explorer.calculate' })[0]
      .getAttribute('href');
    const encoded = new URL(href!, 'http://localhost').searchParams.get('scenario');
    const decoded = decodeScenarioFromUrl(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok && decoded.scenario.kind === 'single-bond') {
      expect(decoded.scenario.intent.selectedSeriesId).toBe('11111111-1111-4111-8111-111111111111');
      expect(decoded.scenario.intent.purchaseDate).toBe(currentSaleStart);
      expect(decoded.scenario.intent.withdrawalDate).toBe(
        format(addYears(new Date(`${currentSaleStart}T12:00:00Z`), 1), 'yyyy-MM-dd'),
      );
    }
    const comparisonHref = screen
      .getAllByRole('link', { name: 'education.issue_explorer.compare' })[0]
      .getAttribute('href');
    const comparison = decodeScenarioFromUrl(
      new URL(comparisonHref!, 'http://localhost').searchParams.get('scenario'),
    );
    expect(comparison.ok).toBe(true);
    if (comparison.ok && comparison.scenario.kind === 'bond-comparison') {
      expect(comparison.scenario.intent.scenarioA).toMatchObject({
        bondType: 'ROR',
        selectedSeriesId: '11111111-1111-4111-8111-111111111111',
        purchaseDate: currentSaleStart,
      });
      expect(comparison.scenario.intent.scenarioB.bondType).toBe('DOR');
    }

    fireEvent.change(screen.getByLabelText('education.issue_explorer.eligibility'), {
      target: { value: 'family' },
    });
    expect(screen.queryByText(/ROR1027/)).toBeNull();
    const historicalHref = screen
      .getAllByRole('link', { name: 'education.issue_explorer.calculate' })[0]
      .getAttribute('href');
    const historical = decodeScenarioFromUrl(
      new URL(historicalHref!, 'http://localhost').searchParams.get('scenario'),
    );
    expect(historical.ok).toBe(true);
    if (historical.ok && historical.scenario.kind === 'single-bond') {
      expect(historical.scenario.intent.selectedSeriesId).toBe(
        '22222222-2222-4222-8222-222222222222',
      );
      expect(historical.scenario.intent.purchaseDate).toBe('2023-10-01');
    }
  });

  it('distinguishes an empty stored catalog from a failed catalog request', async () => {
    listAll.mockResolvedValueOnce([]);
    const empty = renderExplorer();
    expect(await screen.findByText('education.issue_explorer.fallback_only')).toBeTruthy();
    empty.unmount();

    listAll.mockRejectedValueOnce(new Error('Unavailable'));
    renderExplorer();
    expect(await screen.findByText('education.issue_explorer.load_failed')).toBeTruthy();
  });

  it('labels a stored issue with an unknown family as unavailable without a calculation link', async () => {
    listAll.mockResolvedValueOnce([
      {
        id: 'unknown',
        seriesCode: 'XYZ1027',
        emissionMonth: '2026-10-01',
        sellStartDate: '2026-10-01',
        sellEndDate: '2026-10-31',
        maturityDate: '2027-10-01',
        firstYearRate: '5.00',
        baseMargin: '0.00',
      },
    ]);
    renderExplorer();
    expect(await screen.findByText(/issue_explorer.unsupported_family/)).toBeTruthy();
    expect(screen.getByText(/XYZ1027/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'education.issue_explorer.calculate' })).toBeNull();
  });
});
