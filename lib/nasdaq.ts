import type {
  NasdaqObservation,
  NasdaqYoYPoint,
  NasdaqYoYResponse,
} from "@/lib/types";

const FRED_SERIES_ID = "NASDAQCOM";
const FRED_SERIES_URL = `https://fred.stlouisfed.org/series/${FRED_SERIES_ID}`;
const DAY_MS = 86_400_000;
const MAX_COMPARISON_GAP_DAYS = 10;

function parseUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function shiftOneYearBack(date: Date): Date {
  const targetYear = date.getUTCFullYear() - 1;
  const month = date.getUTCMonth();
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDayOfTargetMonth);

  return new Date(Date.UTC(targetYear, month, day));
}

function findObservationOnOrBefore(
  observations: NasdaqObservation[],
  targetDate: string,
): NasdaqObservation | undefined {
  let low = 0;
  let high = observations.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (observations[middle].date <= targetDate) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return observations[low - 1];
}

export function parseFredCsv(csv: string): NasdaqObservation[] {
  const observations = new Map<string, number>();
  const lines = csv.trim().split(/\r?\n/);

  for (const line of lines.slice(1)) {
    const [date, rawClose] = line.split(",");
    const close = Number(rawClose);

    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(close) && close > 0) {
      observations.set(date, close);
    }
  }

  return Array.from(observations, ([date, close]) => ({ date, close })).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

export function computeRollingYoY(observations: NasdaqObservation[]): NasdaqYoYPoint[] {
  if (observations.length < 2) return [];

  const sorted = [...observations].sort((a, b) => a.date.localeCompare(b.date));
  const latestDate = parseUtcDate(sorted.at(-1)!.date);
  const visibleStart = shiftOneYearBack(latestDate);

  return sorted.flatMap((observation): NasdaqYoYPoint[] => {
    const currentDate = parseUtcDate(observation.date);
    if (currentDate < visibleStart) return [];

    const anniversaryDate = shiftOneYearBack(currentDate);
    const comparison = findObservationOnOrBefore(sorted, formatUtcDate(anniversaryDate));
    if (!comparison) return [];

    const gapDays = Math.round(
      (anniversaryDate.getTime() - parseUtcDate(comparison.date).getTime()) / DAY_MS,
    );
    if (gapDays < 0 || gapDays > MAX_COMPARISON_GAP_DAYS) return [];

    const changePoints = observation.close - comparison.close;
    const yoyPct = (changePoints / comparison.close) * 100;

    return [
      {
        date: observation.date,
        close: observation.close,
        comparisonDate: comparison.date,
        comparisonClose: comparison.close,
        changePoints,
        yoyPct,
      },
    ];
  });
}

function startDateForFredRequest(): string {
  const start = new Date();
  start.setUTCMonth(start.getUTCMonth() - 27);
  return formatUtcDate(start);
}

export async function getNasdaqYoYData(): Promise<NasdaqYoYResponse> {
  const csvUrl = new URL("https://fred.stlouisfed.org/graph/fredgraph.csv");
  csvUrl.searchParams.set("id", FRED_SERIES_ID);
  csvUrl.searchParams.set("cosd", startDateForFredRequest());

  const response = await fetch(csvUrl, {
    headers: {
      Accept: "text/csv",
      "User-Agent": "nasdaq-yoy-dashboard/1.0",
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`FRED returned HTTP ${response.status}`);
  }

  const observations = parseFredCsv(await response.text());
  const points = computeRollingYoY(observations);

  if (points.length < 200) {
    throw new Error(`Expected at least 200 rolling observations, received ${points.length}`);
  }

  const latest = points.at(-1)!;
  let highYoyPct = -Infinity;
  let lowYoyPct = Infinity;
  let positiveDays = 0;

  for (const point of points) {
    highYoyPct = Math.max(highYoyPct, point.yoyPct);
    lowYoyPct = Math.min(lowYoyPct, point.yoyPct);
    if (point.yoyPct >= 0) positiveDays += 1;
  }

  return {
    name: "Nasdaq Composite",
    symbol: ".IXIC",
    seriesId: FRED_SERIES_ID,
    asOf: latest.date,
    periodStart: points[0].date,
    frequency: "日收盘",
    unit: "%",
    source: {
      name: "FRED · Federal Reserve Bank of St. Louis",
      url: FRED_SERIES_URL,
    },
    methodology:
      "每个交易日收盘点位 ÷ 一年前同日或此前最近交易日收盘点位 − 1；结果以百分比表示。",
    points,
    stats: {
      latestClose: latest.close,
      latestYoyPct: latest.yoyPct,
      latestChangePoints: latest.changePoints,
      comparisonDate: latest.comparisonDate,
      comparisonClose: latest.comparisonClose,
      highYoyPct,
      lowYoyPct,
      positiveDayShare: (positiveDays / points.length) * 100,
    },
  };
}
