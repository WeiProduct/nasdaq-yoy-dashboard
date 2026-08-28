import type { NasdaqObservation, NasdaqYtdPoint } from "@/lib/types";

export type YtdPoint = NasdaqYtdPoint;

export function computeYearlyYtd(
  observations: NasdaqObservation[],
  visibleStart?: string,
): YtdPoint[] {
  const sorted = [...observations]
    .filter((point) => Number.isFinite(point.close) && point.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const baselineByYear = new Map<string, NasdaqObservation>();

  for (const point of sorted) {
    const year = point.date.slice(0, 4);
    if (!baselineByYear.has(year)) baselineByYear.set(year, point);
  }

  return sorted.flatMap((point): YtdPoint[] => {
    if (visibleStart && point.date < visibleStart) return [];

    const baseline = baselineByYear.get(point.date.slice(0, 4));
    if (!baseline) return [];

    return [{
      date: point.date,
      close: point.close,
      yearStartDate: baseline.date,
      yearStartClose: baseline.close,
      ytdPct: ((point.close - baseline.close) / baseline.close) * 100,
    }];
  });
}
