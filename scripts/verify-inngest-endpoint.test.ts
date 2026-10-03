import { describe, expect, it, vi } from 'vitest';

import { verifyInngestEndpoint } from './verify-inngest-endpoint';

function response(status: number, sdkHandled?: string) {
  return new Response(null, {
    status,
    headers: sdkHandled ? { 'x-inngest-sdk-handled': sdkHandled } : {},
  });
}

describe('Inngest endpoint verification', () => {
  it('accepts the signed SDK rejecting an unsigned metadata request', async () => {
    const fetcher = vi.fn(async () => response(401, 'true'));

    await expect(
      verifyInngestEndpoint('https://app.example.test', fetcher),
    ).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith('https://app.example.test/api/inngest', {
      redirect: 'manual',
      signal: expect.any(AbortSignal),
    });
  });

  it.each([
    [500, 'true'],
    [401, undefined],
    [200, 'true'],
  ])('rejects an HTTP %s response with SDK header %s', async (status, sdkHandled) => {
    await expect(
      verifyInngestEndpoint('https://app.example.test', async () => response(status, sdkHandled)),
    ).rejects.toThrow('Inngest endpoint did not reject an unsigned request through the SDK');
  });
});
