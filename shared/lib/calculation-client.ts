import { ApiEnvelopeError, decodeEnvelopeResponse } from './api-response-codec';

export interface CalculationClientErrorPayload {
  error?: string;
  details?: unknown;
}

export class CalculationClientError extends Error {
  details?: unknown;
  code?: string;

  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'CalculationClientError';
    this.code = code;
    this.details = details;
  }
}

export async function postCalculation<TResponse>(
  url: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<TResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  try {
    return await decodeEnvelopeResponse<TResponse>(response);
  } catch (error) {
    if (!(error instanceof ApiEnvelopeError)) {
      throw error;
    }

    throw new CalculationClientError(
      error.message === `Request failed with status ${response.status}`
        ? 'Calculation failed'
        : error.message,
      error.code,
      error.details,
    );
  }
}
