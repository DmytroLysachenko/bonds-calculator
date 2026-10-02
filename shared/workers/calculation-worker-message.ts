import { ApiEnvelopeError } from '@/shared/lib/api-response-codec';

export interface CalculationWorkerFailure {
  id: string;
  ok: false;
  error: string;
  code?: string;
  details?: unknown;
  requestId?: string;
  status?: number;
}

/** Worker boundary preserves reviewed public API failures, never raw transport text. */
export function calculationWorkerFailure(id: string, error: unknown): CalculationWorkerFailure {
  if (error instanceof ApiEnvelopeError) {
    return {
      id,
      ok: false,
      error: error.message,
      code: error.code,
      details: error.details,
      requestId: error.requestId,
      status: error.status,
    };
  }

  return { id, ok: false, error: 'Worker calculation failed' };
}
