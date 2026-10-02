import {
  ApiEnvelopeError,
  decodeEnvelopeResponse,
  decodeRawResponse,
} from '@/shared/lib/api-response-codec';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

interface ApiRequestOptions {
  signal?: AbortSignal;
  headers?: HeadersInit;
}

type ResponseDecoder<T> = (response: Response) => Promise<T>;

async function requestJson<T>(
  url: string,
  init: RequestInit,
  decoder: ResponseDecoder<T> = decodeEnvelopeResponse,
): Promise<{ data: T; response: Response }> {
  const response = await fetch(url, init);

  try {
    return { data: await decoder(response), response };
  } catch (error) {
    if (error instanceof ApiEnvelopeError) {
      throw new ApiClientError(
        error.message,
        error.status,
        error.code,
        error.details,
        error.requestId,
      );
    }

    throw error;
  }
}

export async function apiGet<T>(url: string, options: ApiRequestOptions = {}): Promise<T> {
  return (
    await requestJson<T>(url, {
      method: 'GET',
      headers: options.headers,
      signal: options.signal,
    })
  ).data;
}

export async function apiGetWithResponse<T>(
  url: string,
  options: ApiRequestOptions = {},
): Promise<{ data: T; response: Response }> {
  return requestJson<T>(url, {
    method: 'GET',
    headers: options.headers,
    signal: options.signal,
  });
}

export async function apiPost<T>(
  url: string,
  payload: unknown,
  options: ApiRequestOptions = {},
): Promise<T> {
  return (
    await requestJson<T>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(payload),
      signal: options.signal,
    })
  ).data;
}

export async function apiPatch<T>(
  url: string,
  payload: unknown,
  options: ApiRequestOptions = {},
): Promise<T> {
  return (
    await requestJson<T>(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(payload),
      signal: options.signal,
    })
  ).data;
}

export async function apiDelete<T>(url: string, options: ApiRequestOptions = {}): Promise<T> {
  return (
    await requestJson<T>(url, {
      method: 'DELETE',
      headers: options.headers,
      signal: options.signal,
    })
  ).data;
}

export async function apiGetRaw<T>(url: string, options: ApiRequestOptions = {}): Promise<T> {
  return (
    await requestJson<T>(
      url,
      {
        method: 'GET',
        headers: options.headers,
        signal: options.signal,
      },
      decodeRawResponse,
    )
  ).data;
}

export async function fetchPublicTextAsset(path: `/fonts/${string}`): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) throw new ApiClientError('Report font is unavailable', response.status);
  return response.text();
}
