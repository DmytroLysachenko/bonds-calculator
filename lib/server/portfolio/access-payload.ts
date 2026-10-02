import type { PortfolioOwnerContext } from './access';

export function createPortfolioAccessPayload(owner: PortfolioOwnerContext) {
  return {
    ownerId: owner.ownerId,
    isGuest: owner.isGuest,
    authMode: owner.authMode,
    canManageWorkspace: !owner.isGuest && owner.authMode === 'authenticated',
  };
}
