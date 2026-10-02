'use client';

interface PersistedEnvelope<T> {
  version: 1;
  updatedAt: string;
  state: T;
}

export function loadPersistedCalculatorState<T>(key: string): T | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PersistedEnvelope<T> | T;
    if (parsed && typeof parsed === 'object' && 'state' in parsed) {
      return (parsed as PersistedEnvelope<T>).state;
    }

    return parsed as T;
  } catch {
    return null;
  }
}

/** Returns false when browser storage is unavailable or quota-restricted. */
export function savePersistedCalculatorState<T>(key: string, state: T): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const payload: PersistedEnvelope<T> = {
    version: 1,
    updatedAt: new Date().toISOString(),
    state,
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
    return true;
  } catch {
    // Draft persistence is best effort. A quota or privacy-mode failure must
    // never take down an otherwise usable calculator session.
    return false;
  }
}
