import { describe, expect, it, vi } from 'vitest';

import { apiGet, apiGetRaw, apiGetWithResponse, apiPost } from './api-client';

describe('api client', () => {
  it('unwraps typed success payloads', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { value: 42 } }), { status: 200 }),
      );

    await expect(apiGet<{ value: number }>('/api/example')).resolves.toEqual({ value: 42 });
    expect(fetchMock).toHaveBeenCalledWith('/api/example', {
      method: 'GET',
      headers: undefined,
      signal: undefined,
    });

    fetchMock.mockRestore();
  });

  it('throws normalized API errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { message: 'Nope', code: 'NOPE', details: { field: 'x' } },
        }),
        { status: 400 },
      ),
    );

    await expect(apiPost('/api/example', { value: 1 })).rejects.toMatchObject({
      name: 'ApiClientError',
      message: 'Nope',
      status: 400,
      code: 'NOPE',
      details: { field: 'x' },
    });

    vi.restoreAllMocks();
  });

  it('can return unwrapped data with the raw response metadata', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { 'x-test': 'metadata' },
      }),
    );

    const result = await apiGetWithResponse<{ ok: boolean }>('/api/export');

    expect(result.data).toEqual({ ok: true });
    expect(result.response.headers.get('x-test')).toBe('metadata');
    expect(fetchMock).toHaveBeenCalledWith('/api/export', {
      method: 'GET',
      headers: undefined,
      signal: undefined,
    });

    fetchMock.mockRestore();
  });

  it('decodes an explicitly raw endpoint only when requested', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
    );

    await expect(apiGetRaw<{ status: string }>('/api/health')).resolves.toEqual({ status: 'ok' });

    vi.restoreAllMocks();
  });
});
