import { z } from 'zod';

// Run before route chunks hydrate: calculator schemas must never attempt Zod's
// optional new Function probe under the production no-eval CSP.
z.config({ jitless: true });
