import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const calculate = vi.fn();

vi.mock('@/lib/server/calculation/composition', () => ({
  calculationService: { calculate: (...args: unknown[]) => calculate(...args) },
}));

import { POST } from './route';

function request(payload: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/calculate/retirement', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

describe('retirement calculation API boundary', () => {
  const base = {
    initialCapital: 100,
    monthlyWithdrawal: 10,
    expectedInflation: 3,
    bondType: 'ROR',
    taxStrategy: 'STANDARD',
    horizonYears: 1,
  };

  it.each([
    ['unsupported family', { ...base, bondType: 'ROS' }],
    ['missing tax policy', { ...base, taxStrategy: undefined }],
  ])('returns a client error before calculation for %s', async (_case, payload) => {
    calculate.mockClear();
    const response = await POST(request(payload), { params: Promise.resolve({}) });
    expect(response.status).toBe(400);
    expect(calculate).not.toHaveBeenCalled();
  });
});
