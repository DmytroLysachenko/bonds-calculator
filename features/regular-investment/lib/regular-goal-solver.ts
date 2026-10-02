/** Integer-grosz binary search; callers supply the authoritative simulation. */
export async function solveRequiredRecurringContribution({
  target,
  calculate,
  minContribution = 0,
  maxContribution = 1_000_000,
}: {
  target: number;
  calculate: (contribution: number) => Promise<number>;
  minContribution?: number;
  maxContribution?: number;
}) {
  if (
    !Number.isFinite(target) ||
    !Number.isFinite(minContribution) ||
    !Number.isFinite(maxContribution) ||
    minContribution < 0 ||
    maxContribution < 0 ||
    minContribution > maxContribution ||
    maxContribution > Number.MAX_SAFE_INTEGER / 100
  ) {
    throw new RangeError('Contribution bounds and target must be finite and ordered');
  }
  if (target <= 0) return { contribution: minContribution, achieved: 0, reachable: true };
  const minCents = Math.ceil(minContribution * 100);
  const maxCents = Math.floor(maxContribution * 100);
  if (minCents > maxCents) throw new RangeError('Contribution bounds contain no whole grosz');
  const evaluate = async (cents: number) => {
    const achieved = await calculate(cents / 100);
    if (!Number.isFinite(achieved)) throw new RangeError('Calculated goal value must be finite');
    return achieved;
  };
  const minimumAchieved = await evaluate(minCents);
  if (minimumAchieved >= target) {
    return { contribution: minCents / 100, achieved: minimumAchieved, reachable: true };
  }
  if (maxCents === minCents)
    return { contribution: null, achieved: minimumAchieved, reachable: false };
  let low = minCents;
  let high = Math.min(maxCents, Math.max(minCents + 1, minCents * 2, 10_000));
  let achieved = await evaluate(high);
  while (high < maxCents && achieved < target) {
    low = high;
    high = Math.min(maxCents, Math.max(high + 1, high * 2));
    achieved = await evaluate(high);
  }
  if (achieved < target) return { contribution: null, achieved, reachable: false };
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if ((await evaluate(middle)) >= target) high = middle;
    else low = middle;
  }
  return { contribution: high / 100, achieved: await evaluate(high), reachable: true };
}
