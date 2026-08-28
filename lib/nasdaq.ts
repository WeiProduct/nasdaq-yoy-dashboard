import type {
  NasdaqObservation,
  NasdaqYoYPoint,
  NasdaqYoYResponse,
} from "@/lib/types";
import {
  getLiveNasdaqObservation,
  type LiveNasdaqObservation,
} from "@/lib/nasdaq-live";
import { NASDAQ_SNAPSHOT_CSV } from "@/lib/nasdaq-snapshot";
import { computeYearlyYtd } from "@/lib/ytd";
import { getFearGreedSeries } from "@/lib/fear-greed";

const FRED_SERIES_ID = "NASDAQCOM";
const FRED_SERIES_URL = `https://fred.stlouisfed.org/series/${FRED_SERIES_ID}`;
const DAY_MS = 86_400_000;
const MAX_COMPARISON_GAP_DAYS = 10;
const UPSTREAM_TIMEOUT_MS = 2_500;

function parseUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function shiftYearsBack(date: Date, years: number): Date {
  const targetYear = date.getUTCFullYear() - years;
  const month = date.getUTCMonth();
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDayOfTargetMonth);

  return new Date(Date.UTC(targetYear, month, day));
}

export function shiftOneYearBack(date: Date): Date {
  return shiftYearsBack(date, 1);
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

export function mergeLatestObservation(
  observations: NasdaqObservation[],
  latest: NasdaqObservation,
) {
  const historicalLatest = observations.at(-1);
  if (historicalLatest && latest.date < historicalLatest.date) return observations;

  return [...observations.filter((observation) => observation.date !== latest.date), latest].sort(
    (a, b) => a.date.localeCompare(b.date),
  );
}

export function computeRollingYoY(
  observations: NasdaqObservation[],
  visibleYears = 5,
): NasdaqYoYPoint[] {
  if (observations.length < 2) return [];

  const sorted = [...observations].sort((a, b) => a.date.localeCompare(b.date));
  const latestDate = parseUtcDate(sorted.at(-1)!.date);
  const visibleStart = shiftYearsBack(latestDate, visibleYears);

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
  start.setUTCFullYear(start.getUTCFullYear() - 6);
  start.setUTCMonth(start.getUTCMonth() - 1);
  return formatUtcDate(start);
}

export async function getNasdaqYoYData(): Promise<NasdaqYoYResponse> {
  const csvUrl = new URL("https://fred.stlouisfed.org/graph/fredgraph.csv");
  csvUrl.searchParams.set("id", FRED_SERIES_ID);
  csvUrl.searchParams.set("cosd", startDateForFredRequest());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let csv = NASDAQ_SNAPSHOT_CSV;
  let deliveryMode: NasdaqYoYResponse["deliveryMode"] = "snapshot";
  const liveObservationPromise = getLiveNasdaqObservation().catch((error) => {
    console.warn("Nasdaq intraday quote unavailable; serving FRED history only", error);
    return null;
  });
  const fearGreedPromise = getFearGreedSeries();

  try {
    const response = await fetch(csvUrl, {
      headers: {
        Accept: "text/csv",
        "User-Agent": "nasdaq-yoy-dashboard/1.0",
      },
      next: { revalidate: 3600 },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`FRED returned HTTP ${response.status}`);
    }

    csv = await response.text();
    deliveryMode = "fresh";
  } catch (error) {
    console.warn("FRED fetch unavailable; serving bundled NASDAQCOM snapshot", error);
  } finally {
    clearTimeout(timeout);
  }

  const historicalObservations = parseFredCsv(csv);
  const liveObservation = await liveObservationPromise;
  const fearGreed = await fearGreedPromise;
  const intradayActive = Boolean(
    liveObservation &&
      (!historicalObservations.at(-1) ||
        liveObservation.date >= historicalObservations.at(-1)!.date),
  );
  const observations = intradayActive
    ? mergeLatestObservation(
        historicalObservations,
        liveObservation as LiveNasdaqObservation,
      )
    : historicalObservations;
  const points = computeRollingYoY(observations);

  if (points.length < 1_000) {
    throw new Error(`Expected at least 200 rolling observations, received ${points.length}`);
  }

  const latest = points.at(-1)!;
  const ytdPoints = computeYearlyYtd(observations, points[0].date);
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
    frequency: intradayActive ? "日收盘 · 当日每10分钟更新" : "日收盘",
    unit: "%",
    deliveryMode,
    intraday: {
      active: intradayActive,
      updatedAt: intradayActive ? liveObservation!.updatedAt : null,
      refreshIntervalSeconds: 600,
      isRealTime: intradayActive ? liveObservation!.isRealTime : false,
      source: {
        name: "Nasdaq · COMP",
        url: "https://www.nasdaq.com/market-activity/index/comp",
      },
    },
    source: {
      name: "FRED · Federal Reserve Bank of St. Louis",
      url: FRED_SERIES_URL,
    },
    methodology:
      "历史点位来自 FRED；当日点位来自 Nasdaq 公开指数行情并每 10 分钟重新验证。同比为每个点位 ÷ 一年前同日或此前最近交易日收盘点位 − 1；年初至今线以每个自然年首个交易日收盘为 0% 逐年重置；市场情绪为 CNN Fear & Greed Index 官方 0–100 分。",
    points,
    ytdPoints,
    fearGreed,
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
