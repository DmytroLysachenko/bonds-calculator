import { afterEach, describe, expect, it, vi } from 'vitest';

import { ScenarioKind } from '@/features/bond-core/types/scenarios';
import { getCalculationEndpoint } from '@/shared/lib/calculation-endpoints';

class MockWorker extends EventTarget {
  messages: unknown[] = [];
  terminated = false;
  postMessage(value: unknown) {
    this.messages.push(value);
  }
  terminate() {
    this.terminated = true;
  }
}

describe('calculation worker client failures', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('rejects a failed worker and tears it down', async () => {
    const worker = new MockWorker();
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          return worker;
        }
      },
    );
    const { postCalculationInWorker } = await import('./calculation-worker-client');
    const pending = postCalculationInWorker(getCalculationEndpoint(ScenarioKind.SINGLE_BOND), {});
    worker.dispatchEvent(new Event('error'));
    await expect(pending).rejects.toThrow('Calculation worker failed');
    expect(worker.terminated).toBe(true);
  });

  it('times out a missing reply and aborts its request', async () => {
    vi.useFakeTimers();
    const worker = new MockWorker();
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          return worker;
        }
      },
    );
    const { postCalculationInWorker } = await import('./calculation-worker-client');
    const pending = postCalculationInWorker(getCalculationEndpoint(ScenarioKind.SINGLE_BOND), {});
    const rejection = expect(pending).rejects.toThrow('Calculation timed out');
    await vi.advanceTimersByTimeAsync(60_000);
    await rejection;
    expect(worker.messages).toContainEqual(expect.objectContaining({ type: 'abort' }));
  });
});
