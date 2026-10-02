import { CalculationClientError } from './calculation-client';

type WorkerSuccessMessage<T> = {
  id: string;
  ok: true;
  data: T;
};

type WorkerErrorMessage = {
  id: string;
  ok: false;
  error: string;
  code?: string;
  details?: unknown;
};

type WorkerResponse<T> = WorkerSuccessMessage<T> | WorkerErrorMessage;

let calculationWorker: Worker | null = null;
const WORKER_REQUEST_TIMEOUT_MS = 60_000;

function getCalculationWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return null;
  }

  if (!calculationWorker) {
    calculationWorker = new Worker(new URL('../workers/calculation.worker.ts', import.meta.url));
  }

  return calculationWorker;
}

export async function postCalculationInWorker<TResponse>(
  url: string,
  payload: unknown,
  signal?: AbortSignal,
  type: 'local' | 'remote' = 'remote',
  kind?: string,
): Promise<TResponse> {
  const worker = getCalculationWorker();

  if (!worker) {
    throw new CalculationClientError('Calculation worker is unavailable');
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return await new Promise<TResponse>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleWorkerError);
      worker.removeEventListener('messageerror', handleWorkerError);
      signal?.removeEventListener('abort', handleAbort);
      clearTimeout(timeout);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const handleAbort = () => {
      try {
        worker.postMessage({ id, type: 'abort' });
      } catch {
        /* worker already terminated */
      }
      fail(new DOMException('Calculation aborted', 'AbortError'));
    };

    const handleWorkerError = () => {
      if (calculationWorker === worker) calculationWorker = null;
      worker.terminate();
      fail(new CalculationClientError('Calculation worker failed. Please retry.'));
    };

    const timeout = setTimeout(() => {
      try {
        worker.postMessage({ id, type: 'abort' });
      } catch {
        /* worker already terminated */
      }
      fail(new CalculationClientError('Calculation timed out. Please retry.'));
    }, WORKER_REQUEST_TIMEOUT_MS);

    if (signal?.aborted) {
      return fail(new DOMException('Calculation aborted', 'AbortError'));
    }

    signal?.addEventListener('abort', handleAbort, { once: true });

    const handleMessage = (event: MessageEvent<WorkerResponse<TResponse>>) => {
      if (event.data.id !== id) return;

      if (settled) return;
      settled = true;
      cleanup();

      if (event.data.ok) {
        resolve(event.data.data);
      } else {
        reject(new CalculationClientError(event.data.error, event.data.code, event.data.details));
      }
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleWorkerError);
    worker.addEventListener('messageerror', handleWorkerError);
    try {
      worker.postMessage({ id, url, payload, type, kind });
    } catch {
      fail(new CalculationClientError('Calculation worker could not receive the request.'));
    }
  });
}
