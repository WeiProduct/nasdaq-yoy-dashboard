import type { NasdaqObservation } from "@/lib/types";

const NASDAQ_CHART_URL =
  "https://api.nasdaq.com/api/quote/COMP/chart?assetclass=index";
const LIVE_TIMEOUT_MS = 4_000;

type NasdaqChartPayload = {
  data?: {
    chart?: Array<{ x?: number; y?: number }>;
    isRealTime?: boolean;
  };
};

export type LiveNasdaqObservation = NasdaqObservation & {
  updatedAt: string;
  isRealTime: boolean;
};

function formatNewYorkDate(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function nasdaqWallClockToUtc(timestamp: number) {
  const wallClock = new Date(timestamp);
  const targetUtc = Date.UTC(
    wallClock.getUTCFullYear(),
    wallClock.getUTCMonth(),
    wallClock.getUTCDate(),
    wallClock.getUTCHours(),
    wallClock.getUTCMinutes(),
    wallClock.getUTCSeconds(),
  );

  let instant = targetUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const representedAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
    instant += targetUtc - representedAsUtc;
  }

  return instant;
}

export function parseNasdaqChartPayload(
  payload: NasdaqChartPayload,
): LiveNasdaqObservation {
  const latest = payload.data?.chart
    ?.filter(
      (point): point is { x: number; y: number } =>
        Number.isFinite(point.x) && Number.isFinite(point.y) && point.y! > 0,
    )
    .at(-1);

  if (!latest) {
    throw new Error("Nasdaq chart response did not contain a valid index value");
  }

  const updatedAt = nasdaqWallClockToUtc(latest.x);

  return {
    date: formatNewYorkDate(updatedAt),
    close: latest.y,
    updatedAt: new Date(updatedAt).toISOString(),
    isRealTime: payload.data?.isRealTime === true,
  };
}

export async function getLiveNasdaqObservation(): Promise<LiveNasdaqObservation> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);

  try {
    const response = await fetch(NASDAQ_CHART_URL, {
      headers: {
        Accept: "application/json, text/plain, */*",
        Origin: "https://www.nasdaq.com",
        Referer: "https://www.nasdaq.com/",
        "User-Agent": "Mozilla/5.0 (compatible; MarketLens/1.0)",
      },
      next: { revalidate: 600 },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Nasdaq returned HTTP ${response.status}`);
    }

    return parseNasdaqChartPayload((await response.json()) as NasdaqChartPayload);
  } finally {
    clearTimeout(timeout);
  }
}
