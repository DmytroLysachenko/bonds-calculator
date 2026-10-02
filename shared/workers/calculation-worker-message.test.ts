import { describe, expect, it } from 'vitest';

import { ApiEnvelopeError } from '@/shared/lib/api-response-codec';

import { calculationWorkerFailure } from './calculation-worker-message';

describe('calculation worker failure transport', () => {
  it('keeps reviewed public failure metadata and correlation', () => {
    expect(
      calculationWorkerFailure(
        'request-1',
        new ApiEnvelopeError(
          'Invalid bond input',
          422,
          'CALCULATION_INVALID_INPUT',
          { field: 'x' },
          'id-1',
        ),
      ),
    ).toEqual({
      id: 'request-1',
      ok: false,
      error: 'Invalid bond input',
      status: 422,
      code: 'CALCULATION_INVALID_INPUT',
      details: { field: 'x' },
      requestId: 'id-1',
    });
  });

  it('does not pass raw transport failures to browser code', () => {
    expect(calculationWorkerFailure('request-1', new Error('socket password=secret'))).toEqual({
      id: 'request-1',
      ok: false,
      error: 'Worker calculation failed',
    });
  });
});
