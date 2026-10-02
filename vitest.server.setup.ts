import { vi } from 'vitest';

// All unit suites, including the default DOM suite, must not inherit a
// developer's live Neon connection. Authenticated database checks run in the
// separate isolated integration workflow.
vi.stubEnv('DATABASE_URL', '');
