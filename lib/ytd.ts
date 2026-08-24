import type { NasdaqYoYPoint } from "@/lib/types";

export type YtdPoint = {
  date: string;
  close: number;
  ytdPct: number;
};

export type CurrentYearYtd = {
  baselineDate: string | null;
  baselineClose: number | null;
  latestYtdPct: number | null;
  points: YtdPoint[];
};

export function computeCurrentYearYtd(
  points: Pick<NasdaqYoYPoint, "date" | "close">[],
): CurrentYearYtd {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1);

  if (!latest) {
    return { baselineDate: null, baselineClose: null, latestYtdPct: null, points: [] };
  }

  const currentYear = latest.date.slice(0, 4);
  const yearStart = `${currentYear}-01-01`;
  const baseline = sorted.filter((point) => point.date < yearStart).at(-1);

  if (!baseline || baseline.close <= 0) {
    return { baselineDate: null, baselineClose: null, latestYtdPct: null, points: [] };
  }

  const ytdPoints = sorted
    .filter((point) => point.date >= yearStart)
    .map((point) => ({
      date: point.date,
      close: point.close,
      ytdPct: ((point.close - baseline.close) / baseline.close) * 100,
    }));

  const pointsWithBaseline: YtdPoint[] = [
    { date: baseline.date, close: baseline.close, ytdPct: 0 },
    ...ytdPoints,
  ];

  return {
    baselineDate: baseline.date,
    baselineClose: baseline.close,
    latestYtdPct: pointsWithBaseline.at(-1)?.ytdPct ?? null,
    points: pointsWithBaseline,
  };
}
