import type { FearGreedPoint, FearGreedSeries } from "@/lib/types";

const CNN_FEAR_GREED_PAGE = "https://www.cnn.com/markets/fear-and-greed";
const CNN_FEAR_GREED_ENDPOINT =
  "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";
const EARLIEST_VERIFIED_DATE = "2021-02-01";
const UPSTREAM_TIMEOUT_MS = 3_500;

type CnnFearGreedPayload = {
  fear_and_greed?: {
    score?: unknown;
    rating?: unknown;
    timestamp?: unknown;
  };
  fear_and_greed_historical?: {
    data?: Array<{
      x?: unknown;
      y?: unknown;
      rating?: unknown;
    }>;
  };
};

function emptySeries(): FearGreedSeries {
  return {
    available: false,
    asOf: null,
    latestScore: null,
    latestRating: null,
    points: [],
    source: {
      name: "CNN Fear & Greed Index",
      url: CNN_FEAR_GREED_PAGE,
    },
  };
}

function dateFromTimestamp(value: unknown): string | null {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function parseFearGreedPayload(payload: CnnFearGreedPayload): FearGreedSeries {
  const byDate = new Map<string, FearGreedPoint>();

  for (const entry of payload.fear_and_greed_historical?.data ?? []) {
    const date = dateFromTimestamp(entry.x);
    const score = Number(entry.y);
    if (!date || !Number.isFinite(score) || score < 0 || score > 100) continue;

    byDate.set(date, {
      date,
      score,
      rating: typeof entry.rating === "string" ? entry.rating : "",
    });
  }

  const points = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  if (points.length === 0) return emptySeries();

  const latest = points.at(-1)!;
  const currentScore = Number(payload.fear_and_greed?.score);
  const latestScore = Number.isFinite(currentScore) && currentScore >= 0 && currentScore <= 100
    ? currentScore
    : latest.score;
  const latestRating = typeof payload.fear_and_greed?.rating === "string"
    ? payload.fear_and_greed.rating
    : latest.rating;

  return {
    available: true,
    asOf: latest.date,
    latestScore,
    latestRating,
    points,
    source: {
      name: "CNN Fear & Greed Index",
      url: CNN_FEAR_GREED_PAGE,
    },
  };
}

function fiveYearsAgo(): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - 5);
  const start = date.toISOString().slice(0, 10);
  return start < EARLIEST_VERIFIED_DATE ? EARLIEST_VERIFIED_DATE : start;
}

export async function getFearGreedSeries(): Promise<FearGreedSeries> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(`${CNN_FEAR_GREED_ENDPOINT}/${fiveYearsAgo()}`, {
      headers: {
        Accept: "application/json",
        Referer: CNN_FEAR_GREED_PAGE,
        "User-Agent": "Mozilla/5.0 (compatible; NasdaqYoYDashboard/1.0; +https://weifuandy.com/na/)",
      },
      next: { revalidate: 600 },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`CNN Fear & Greed returned HTTP ${response.status}`);
    }

    return parseFearGreedPayload((await response.json()) as CnnFearGreedPayload);
  } catch (error) {
    console.warn("CNN Fear & Greed unavailable; continuing without sentiment data", error);
    return emptySeries();
  } finally {
    clearTimeout(timeout);
  }
}
