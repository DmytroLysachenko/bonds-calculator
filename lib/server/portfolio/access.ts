import { auth } from '@/auth';
import { createServerLogger } from '@/lib/server/logging';
import { findOwnedLotByOwner, findPortfolioByOwner } from '@/lib/server/portfolio/repository';

const logger = createServerLogger('PortfolioAccess');

export interface PortfolioOwnerContext {
  ownerId: string;
  isGuest: boolean;
  shouldPersistGuestCookie: boolean;
  authMode: 'authenticated' | 'guest' | 'auth_unavailable_guest_fallback';
}

function isAuthConfigured() {
  return Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET);
}

function isMissingSecretError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('MissingSecret');
}

function isMissingAuthTableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('relation "user" does not exist') ||
    error.message.includes('relation "session" does not exist') ||
    error.message.includes('relation "account" does not exist') ||
    error.message.includes('relation "verificationToken" does not exist')
  );
}

async function resolveAuthenticatedOwner() {
  if (!isAuthConfigured()) {
    return null;
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return null;
    }

    return {
      ownerId: session.user.id,
      isGuest: false,
      shouldPersistGuestCookie: false,
      authMode: 'authenticated' as const,
    };
  } catch (error) {
    if (isMissingSecretError(error) || isMissingAuthTableError(error)) {
      logger.warn('Auth unavailable, falling back to guest notebook mode');
      return null;
    }

    throw error;
  }
}

/** Guest preview is not a persistence principal; legacy cookies confer no access. */
export async function resolvePortfolioOwner(): Promise<PortfolioOwnerContext> {
  const authenticatedOwner = await resolveAuthenticatedOwner();
  return (
    authenticatedOwner ?? {
      ownerId: 'guest',
      isGuest: true,
      shouldPersistGuestCookie: false,
      authMode: isAuthConfigured() ? 'guest' : 'auth_unavailable_guest_fallback',
    }
  );
}

export async function getOwnedPortfolio(ownerId: string, portfolioId: string) {
  return findPortfolioByOwner(ownerId, portfolioId);
}

export async function getOwnedLot(ownerId: string, lotId: string) {
  return findOwnedLotByOwner(ownerId, lotId);
}
