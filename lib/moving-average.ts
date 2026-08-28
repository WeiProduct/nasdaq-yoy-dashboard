import type { NasdaqMovingAveragePoint, NasdaqObservation } from "@/lib/types";

export function computeSimpleMovingAverage(
  observations: NasdaqObservation[],
  period: number,
  visibleStart?: string,
): NasdaqMovingAveragePoint[] {
  if (!Number.isInteger(period) || period < 1 || observations.length < period) return [];

  const sorted = [...observations].sort((a, b) => a.date.localeCompare(b.date));
  const result: NasdaqMovingAveragePoint[] = [];
  let rollingTotal = 0;

  for (let index = 0; index < sorted.length; index += 1) {
    rollingTotal += sorted[index].close;

    if (index >= period) {
      rollingTotal -= sorted[index - period].close;
    }

    if (index < period - 1 || (visibleStart && sorted[index].date < visibleStart)) continue;

    result.push({
      date: sorted[index].date,
      value: rollingTotal / period,
      period,
      windowStartDate: sorted[index - period + 1].date,
      windowEndDate: sorted[index].date,
    });
  }

  return result;
}
