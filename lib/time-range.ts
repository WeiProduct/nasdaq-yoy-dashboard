import type { NasdaqYoYPoint } from "@/lib/types";

export const TIME_RANGE_OPTIONS = [
  { key: "1M", label: "1个月", months: 1 },
  { key: "6M", label: "6个月", months: 6 },
  { key: "1Y", label: "1年", months: 12 },
  { key: "3Y", label: "3年", months: 36 },
  { key: "5Y", label: "5年", months: 60 },
  { key: "10Y", label: "10年", months: 120 },
] as const;

export type TimeRange = (typeof TIME_RANGE_OPTIONS)[number]["key"];

export type RangeSummary = {
  highYoyPct: number;
  lowYoyPct: number;
  positiveDayShare: number;
};

function formatUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function shiftUtcMonthsBack(date: string, months: number): string {
  const source = new Date(`${date}T00:00:00.000Z`);
  const sourceMonthIndex = source.getUTCFullYear() * 12 + source.getUTCMonth();
  const targetMonthIndex = sourceMonthIndex - months;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  return formatUtcDate(
    new Date(Date.UTC(targetYear, targetMonth, Math.min(source.getUTCDate(), lastDay))),
  );
}

export function filterPointsByRange(
  points: NasdaqYoYPoint[],
  range: TimeRange,
): NasdaqYoYPoint[] {
  if (points.length === 0) return [];

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const months = TIME_RANGE_OPTIONS.find((option) => option.key === range)!.months;
  const startDate = shiftUtcMonthsBack(sorted.at(-1)!.date, months);

  return sorted.filter((point) => point.date >= startDate);
}

export function filterPointsByCalendarYear(
  points: NasdaqYoYPoint[],
  year: number,
): NasdaqYoYPoint[] {
  if (!Number.isInteger(year)) return [];
  const prefix = `${year}-`;
  return points
    .filter((point) => point.date.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function recentCalendarYears(
  points: NasdaqYoYPoint[],
  count = 10,
): number[] {
  if (points.length === 0 || count <= 0) return [];
  const latestDate = [...points].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!.date;
  const latestYear = Number(latestDate.slice(0, 4));
  if (!Number.isInteger(latestYear)) return [];
  return Array.from({ length: count }, (_, index) => latestYear - index);
}

export function summarizeRange(points: NasdaqYoYPoint[]): RangeSummary | null {
  if (points.length === 0) return null;

  let highYoyPct = -Infinity;
  let lowYoyPct = Infinity;
  let positiveDays = 0;

  for (const point of points) {
    highYoyPct = Math.max(highYoyPct, point.yoyPct);
    lowYoyPct = Math.min(lowYoyPct, point.yoyPct);
    if (point.yoyPct >= 0) positiveDays += 1;
  }

  return {
    highYoyPct,
    lowYoyPct,
    positiveDayShare: (positiveDays / points.length) * 100,
  };
}
