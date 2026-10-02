import { describe, expect, it } from 'vitest';

import { decodeEnvelopeResponse, decodeRawResponse } from './api-response-codec';

describe('response wire codecs', () => {
  it.each([null, [], {}, { value: 1 }, { error: { message: 1 } }])(
    'rejects malformed successful envelope %j',
    async (payload) => {
      await expect(decodeEnvelopeResponse(Response.json(payload))).rejects.toMatchObject({
        status: 200,
        code: 'INVALID_RESPONSE',
      });
    },
  );
  it.each([null, false, 0, '', [], {}])('preserves present data %j', async (data) => {
    await expect(decodeEnvelopeResponse(Response.json({ data }))).resolves.toEqual(data);
  });
  it.each([decodeEnvelopeResponse, decodeRawResponse])(
    'normalizes problems and keeps request correlation',
    async (decode) => {
      await expect(
        decode(
          Response.json(
            {
              title: 'Unavailable',
              detail: 'Try later',
              code: 'UNAVAILABLE',
              requestId: 'body-id',
            },
            { status: 503, headers: { 'x-request-id': 'header-id' } },
          ),
        ),
      ).rejects.toMatchObject({
        message: 'Try later',
        status: 503,
        code: 'UNAVAILABLE',
        requestId: 'header-id',
      });
    },
  );
  it('normalizes malformed JSON without discarding HTTP status', async () => {
    await expect(
      decodeEnvelopeResponse(new Response('<html>failure</html>', { status: 502 })),
    ).rejects.toMatchObject({ status: 502, code: 'INVALID_RESPONSE' });
  });
  it('keeps intentional raw payloads', async () => {
    await expect(decodeRawResponse(Response.json({ ok: true }))).resolves.toEqual({ ok: true });
  });
});
