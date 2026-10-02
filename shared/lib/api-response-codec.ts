import { z } from 'zod';

const envelope = z.object({
  data: z.unknown().optional(),
  error: z
    .object({ message: z.string(), code: z.string().optional(), details: z.unknown().optional() })
    .nullable()
    .optional(),
  requestId: z.string().optional(),
});
const problem = z.object({
  detail: z.string().optional(),
  title: z.string().optional(),
  code: z.string().optional(),
  requestId: z.string().optional(),
  details: z.unknown().optional(),
});

export class ApiEnvelopeError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiEnvelopeError';
  }
}

async function readPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiEnvelopeError(
      'The server returned an invalid JSON response.',
      response.status,
      'INVALID_RESPONSE',
      undefined,
      response.headers.get('x-request-id') ?? undefined,
    );
  }
}
function failure(response: Response, payload: unknown): ApiEnvelopeError {
  const wrapped = envelope.safeParse(payload);
  const details = problem.safeParse(payload);
  return new ApiEnvelopeError(
    wrapped.success && wrapped.data.error
      ? wrapped.data.error.message
      : details.success
        ? (details.data.detail ??
          details.data.title ??
          `Request failed with status ${response.status}`)
        : `Request failed with status ${response.status}`,
    response.status,
    wrapped.success && wrapped.data.error
      ? wrapped.data.error.code
      : details.success
        ? details.data.code
        : undefined,
    wrapped.success && wrapped.data.error
      ? wrapped.data.error.details
      : details.success
        ? details.data.details
        : undefined,
    response.headers.get('x-request-id') ?? (details.success ? details.data.requestId : undefined),
  );
}
export async function decodeEnvelopeResponse<T>(response: Response): Promise<T> {
  const payload = await readPayload(response);
  const parsed = envelope.safeParse(payload);
  if (!response.ok || (parsed.success && parsed.data.error)) throw failure(response, payload);
  if (!parsed.success || !Object.prototype.hasOwnProperty.call(payload, 'data')) {
    throw new ApiEnvelopeError(
      'The server returned an invalid response envelope.',
      response.status,
      'INVALID_RESPONSE',
      undefined,
      response.headers.get('x-request-id') ?? undefined,
    );
  }
  return parsed.data.data as T;
}

export async function decodeRawResponse<T>(response: Response): Promise<T> {
  const payload = await readPayload(response);
  if (!response.ok) throw failure(response, payload);
  return payload as T;
}
