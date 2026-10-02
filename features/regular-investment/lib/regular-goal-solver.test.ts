import { describe, expect, it } from 'vitest';

import { solveRequiredRecurringContribution } from './regular-goal-solver';
describe('regular goal solver', () => {
  it('proves the minimal cent contribution meets the target', async () => {
    const result = await solveRequiredRecurringContribution({
      target: 100,
      calculate: async (value) => value * 2,
    });
    expect(result).toMatchObject({ contribution: 50, achieved: 100, reachable: true });
  });
  it('reports bounded unreachable goals honestly', async () =>
    expect(
      await solveRequiredRecurringContribution({
        target: 100,
        maxContribution: 10,
        calculate: async (value) => value,
      }),
    ).toMatchObject({ contribution: null, reachable: false }));

  it('terminates at an exact grosz boundary and proves the preceding cent misses', async () => {
    const seen: number[] = [];
    const result = await solveRequiredRecurringContribution({
      target: 49.99,
      calculate: async (value) => {
        seen.push(value);
        return value;
      },
    });
    expect(result).toMatchObject({ contribution: 49.99, achieved: 49.99, reachable: true });
    expect(seen.every((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8)).toBe(
      true,
    );
    expect(result.contribution! - 0.01).toBeLessThan(49.99);
  });

  it('never evaluates above the maximum and accepts a sufficient zero contribution', async () => {
    const seen: number[] = [];
    const unreachable = await solveRequiredRecurringContribution({
      target: 100,
      maxContribution: 10,
      calculate: async (value) => {
        seen.push(value);
        return value;
      },
    });
    expect(unreachable).toMatchObject({ contribution: null, achieved: 10, reachable: false });
    expect(Math.max(...seen)).toBe(10);
    expect(
      await solveRequiredRecurringContribution({
        target: 100,
        calculate: async () => 120,
      }),
    ).toMatchObject({ contribution: 0, achieved: 120, reachable: true });
  });

  it('honors the calculator minimum instead of sending invalid zero-contribution requests', async () => {
    const seen: number[] = [];
    const result = await solveRequiredRecurringContribution({
      target: 250,
      minContribution: 100,
      maxContribution: 200,
      calculate: async (value) => {
        seen.push(value);
        return value * 2;
      },
    });
    expect(result).toMatchObject({ contribution: 125, achieved: 250, reachable: true });
    expect(Math.min(...seen)).toBe(100);
    expect(Math.max(...seen)).toBeLessThanOrEqual(200);
  });
});
