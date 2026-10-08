import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BOND_DEFINITIONS } from '@/features/bond-core/constants/bond-definitions';

import { BondDefinitionsProvider, useBondDefinitions } from './BondDefinitionsContext';

const mocks = vi.hoisted(() => ({ useBondDefinitions: vi.fn() }));

vi.mock('@/shared/hooks/useBondDefinitions', () => ({
  useBondDefinitions: mocks.useBondDefinitions,
}));

function Consumer() {
  const { definitions, error, isLoading } = useBondDefinitions();
  return (
    <output>{`${definitions?.EDO?.name ?? 'none'}:${isLoading}:${error?.message ?? 'none'}`}</output>
  );
}

describe('bond definitions provider seam', () => {
  beforeEach(() => {
    mocks.useBondDefinitions.mockReturnValue({
      definitions: { EDO: { name: 'EDO' } },
      isLoading: false,
      error: null,
    });
  });

  it('exposes only definitions, loading, and errors to its subtree', () => {
    render(
      <BondDefinitionsProvider>
        <Consumer />
      </BondDefinitionsProvider>,
    );

    expect(screen.getByText('EDO:false:none')).toBeTruthy();
  });

  it('passes a server snapshot into the resource hook', () => {
    render(
      <BondDefinitionsProvider initialDefinitions={BOND_DEFINITIONS}>
        <Consumer />
      </BondDefinitionsProvider>,
    );

    expect(mocks.useBondDefinitions).toHaveBeenCalledWith(BOND_DEFINITIONS);
  });

  it('fails loudly outside the provider', () => {
    expect(() => render(<Consumer />)).toThrow(
      'useBondDefinitions must be used within a BondDefinitionsProvider',
    );
  });
});
