import { describe, expect, it } from 'vitest';

import type { PortfolioOwnerContext } from './access';
import { createPortfolioAccessPayload } from './access-payload';

function owner(overrides: Partial<PortfolioOwnerContext> = {}): PortfolioOwnerContext {
  return {
    ownerId: 'owner-1',
    isGuest: false,
    shouldPersistGuestCookie: false,
    authMode: 'authenticated',
    ...overrides,
  };
}

describe('portfolio access payload', () => {
  it('marks authenticated non-guest owners as workspace managers', () => {
    expect(createPortfolioAccessPayload(owner())).toEqual({
      ownerId: 'owner-1',
      isGuest: false,
      authMode: 'authenticated',
      canManageWorkspace: true,
    });
  });

  it('keeps guest owners read-only for workspace management', () => {
    expect(
      createPortfolioAccessPayload(
        owner({
          isGuest: true,
          authMode: 'guest',
          shouldPersistGuestCookie: true,
        }),
      ),
    ).toEqual({
      ownerId: 'owner-1',
      isGuest: true,
      authMode: 'guest',
      canManageWorkspace: false,
    });
  });
});
