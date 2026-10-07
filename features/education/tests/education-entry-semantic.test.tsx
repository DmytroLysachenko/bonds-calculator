import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';
import { BondType } from '@/features/bond-core/types';
import { BondEducationCard } from '@/features/education/components/BondEducationCard';
import { educationOfferGroups } from '@/features/education/constants/education-content';
import { OfferProvenance } from '@/shared/components/data/OfferProvenance';

vi.mock('@/i18n/client', () => ({
  useAppI18n: () => ({ t: (key: string) => key, locale: 'en' }),
}));

describe('education entry semantics', () => {
  it('renders each supported offer once with a calculator journey link', () => {
    const assigned = educationOfferGroups.flatMap((group) => group.bondTypes);
    expect(new Set(assigned)).toEqual(new Set(Object.values(BondType)));
    expect(assigned).toHaveLength(Object.values(BondType).length);

    render(
      <div>
        {assigned.map((bondType) => (
          <BondEducationCard key={bondType} bond={BOND_DEFINITIONS[bondType]} />
        ))}
      </div>,
    );

    const hrefs = screen
      .getAllByRole('link', { name: 'education.calculate_this_bond' })
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(assigned.map((bondType) => `/single-calculator?bond=${bondType}`));
  });

  it('discloses the official offer source and warns when offer data is degraded', () => {
    render(
      <OfferProvenance
        dataFreshness={{
          status: 'fallback',
          usedFallback: true,
          bondOfferSource: 'curated-fallback',
          bondOfferStatus: 'partial',
        }}
      />,
    );

    expect(screen.getByText('landing.offer_provenance.label:', { exact: false })).toBeTruthy();
    expect(screen.getByText(/sidebar.freshness.offer_sources.curated-fallback/)).toBeTruthy();
    expect(screen.getByText('sidebar.freshness.offer_degraded_warning')).toBeTruthy();
    expect(screen.getByText('landing.offer_provenance.reference')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'landing.offer_provenance.verify' }).getAttribute('href'),
    ).toBe('https://www.obligacjeskarbowe.pl/');
  });

  it('repeats rate provenance at a family card rather than relying on the page warning', () => {
    render(
      <BondEducationCard
        bond={BOND_DEFINITIONS[BondType.EDO]}
        dataFreshness={{
          status: 'fallback',
          usedFallback: true,
          coverageAsOf: '2026-08-01',
          bondOfferAttemptAt: '2026-08-21T00:00:00Z',
          bondOfferSource: 'curated-fallback',
          bondOfferStatus: 'partial',
        }}
      />,
    );
    expect(screen.getByText('landing.offer_provenance.reference')).toBeTruthy();
    expect(screen.getByText(/2026-08-21/)).toBeTruthy();
    expect(screen.queryByText(/2026-08-01/)).toBeNull();
    expect(screen.getByText(/landing.offer_provenance.reference_rates_as_of/)).toBeTruthy();
    expect(screen.getByText(/2026-09-01/)).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'landing.offer_provenance.reference_source' })
        .getAttribute('href'),
    ).toBe(
      'https://www.gov.pl/web/finanse/podaz-skarbowych-papierow-wartosciowych-we-wrzesniu-2026',
    );
    expect(screen.getByRole('link', { name: 'landing.offer_provenance.verify' })).toBeTruthy();
  });

  it('labels a recorded issued series with its sale-window start instead of macro coverage', () => {
    render(
      <BondEducationCard
        bond={{
          ...BOND_DEFINITIONS[BondType.EDO],
          rateProvenance: { kind: 'issued-series', asOf: '2026-09-01', seriesCode: 'EDO0936' },
        }}
        dataFreshness={{
          status: 'stale',
          usedFallback: true,
          coverageAsOf: '2026-08',
          bondOfferStatus: 'failed',
        }}
      />,
    );
    expect(screen.getByText('landing.offer_provenance.issued_series')).toBeTruthy();
    expect(screen.getByText(/2026-09-01/)).toBeTruthy();
    expect(screen.getByText(/EDO0936/)).toBeTruthy();
    expect(screen.queryByText(/2026-08/)).toBeNull();
  });

  it('does not certify a static card rate from a global successful offer check', () => {
    render(
      <BondEducationCard
        bond={BOND_DEFINITIONS[BondType.EDO]}
        dataFreshness={{
          status: 'fresh',
          usedFallback: false,
          bondOfferSource: 'obligacjeskarbowe.pl',
          bondOfferStatus: 'success',
        }}
      />,
    );
    expect(screen.getByText('landing.offer_provenance.reference')).toBeTruthy();
    expect(screen.queryByText('landing.offer_provenance.verified')).toBeNull();
  });
});
