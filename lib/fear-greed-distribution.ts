import type { FearGreedPoint } from "@/lib/types";

export const FEAR_GREED_ZONES = [
  { key: "extreme-fear", label: "极度恐惧", min: 0, max: 24 },
  { key: "fear", label: "恐惧", min: 25, max: 44 },
  { key: "neutral", label: "中性", min: 45, max: 55 },
  { key: "greed", label: "贪婪", min: 56, max: 75 },
  { key: "extreme-greed", label: "极度贪婪", min: 76, max: 100 },
] as const;

export type FearGreedZoneKey = (typeof FEAR_GREED_ZONES)[number]["key"];

export type FearGreedZoneShare = {
  key: FearGreedZoneKey;
  label: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
};

export type FearGreedDistribution = {
  total: number;
  zones: FearGreedZoneShare[];
};

export type FearGreedZoneRun = {
  zone: FearGreedZoneKey;
  startDate: string;
  endDate: string;
  startIndex: number;
  endIndex: number;
};

export type FearGreedHighlightRegionPoint = {
  timestamp: number;
  score: number;
};

type FearGreedDirectionalHighlightRegion = {
  zone: Exclude<FearGreedZoneKey, "neutral">;
  threshold: number;
  points: FearGreedHighlightRegionPoint[];
  startTimestamp: number;
  endTimestamp: number;
  startHasCrossing: boolean;
  endHasCrossing: boolean;
};

type FearGreedNeutralHighlightRegion = {
  zone: "neutral";
  lowerThreshold: 45;
  upperThreshold: 55;
  startTimestamp: number;
  endTimestamp: number;
  startBoundaryScore: number;
  endBoundaryScore: number;
  startHasCrossing: boolean;
  endHasCrossing: boolean;
};

export type FearGreedHighlightRegion =
  | FearGreedDirectionalHighlightRegion
  | FearGreedNeutralHighlightRegion;

type FearGreedDirectionalZone = Exclude<FearGreedZoneKey, "neutral">;

const HIGHLIGHT_DEFINITIONS: Record<
  FearGreedDirectionalZone,
  { threshold: number; contains: (score: number) => boolean }
> = {
  "extreme-fear": { threshold: 25, contains: (score) => score < 25 },
  fear: { threshold: 45, contains: (score) => score < 45 },
  greed: { threshold: 55, contains: (score) => score > 55 },
  "extreme-greed": { threshold: 75, contains: (score) => score > 75 },
};

export function fearGreedZoneForScore(score: number): FearGreedZoneKey | null {
  if (!Number.isFinite(score) || score < 0 || score > 100) return null;
  return FEAR_GREED_ZONES.find((zone) => score >= zone.min && score <= zone.max)?.key ?? null;
}

export function resolveFearGreedHighlightZone(
  dataZone: FearGreedZoneKey | null,
  pointerY: number | null,
  extremeFearThresholdY: number,
): FearGreedZoneKey | null {
  if (!dataZone) return null;
  if (
    dataZone === "extreme-fear"
    && pointerY !== null
    && Number.isFinite(pointerY)
    && pointerY < extremeFearThresholdY
  ) {
    return "fear";
  }
  return dataZone;
}

export function summarizeFearGreedDistribution(
  points: FearGreedPoint[],
): FearGreedDistribution {
  const counts = new Map<FearGreedZoneKey, number>(
    FEAR_GREED_ZONES.map((zone) => [zone.key, 0]),
  );
  let total = 0;

  for (const point of points) {
    const zone = fearGreedZoneForScore(point.score);
    if (!zone) continue;
    counts.set(zone, (counts.get(zone) ?? 0) + 1);
    total += 1;
  }

  return {
    total,
    zones: FEAR_GREED_ZONES.map((zone) => ({
      ...zone,
      count: counts.get(zone.key) ?? 0,
      percentage: total === 0 ? 0 : ((counts.get(zone.key) ?? 0) / total) * 100,
    })),
  };
}

export function findFearGreedZoneRun(
  points: FearGreedPoint[],
  targetDate: string,
  zone: FearGreedZoneKey,
): FearGreedZoneRun | null {
  const targetIndex = points.findIndex((point) => point.date === targetDate);
  if (targetIndex < 0 || fearGreedZoneForScore(points[targetIndex].score) !== zone) {
    return null;
  }

  let startIndex = targetIndex;
  let endIndex = targetIndex;

  while (
    startIndex > 0
    && fearGreedZoneForScore(points[startIndex - 1].score) === zone
  ) {
    startIndex -= 1;
  }

  while (
    endIndex < points.length - 1
    && fearGreedZoneForScore(points[endIndex + 1].score) === zone
  ) {
    endIndex += 1;
  }

  return {
    zone,
    startDate: points[startIndex].date,
    endDate: points[endIndex].date,
    startIndex,
    endIndex,
  };
}

function interpolateThresholdCrossing(
  from: FearGreedPoint,
  to: FearGreedPoint,
  threshold: number,
): FearGreedHighlightRegionPoint {
  const fromTimestamp = Date.parse(`${from.date}T00:00:00.000Z`);
  const toTimestamp = Date.parse(`${to.date}T00:00:00.000Z`);
  const scoreDelta = to.score - from.score;
  const ratio = scoreDelta === 0
    ? 0
    : Math.max(0, Math.min(1, (threshold - from.score) / scoreDelta));

  return {
    timestamp: Math.round(fromTimestamp + (toTimestamp - fromTimestamp) * ratio),
    score: threshold,
  };
}

export function findFearGreedHighlightRun(
  points: FearGreedPoint[],
  targetDate: string,
  zone: FearGreedZoneKey,
): FearGreedZoneRun | null {
  const targetIndex = points.findIndex((point) => point.date === targetDate);
  const contains = zone === "neutral"
    ? (score: number) => score >= 45 && score <= 55
    : HIGHLIGHT_DEFINITIONS[zone].contains;
  if (targetIndex < 0 || !contains(points[targetIndex].score)) return null;

  let startIndex = targetIndex;
  let endIndex = targetIndex;
  while (startIndex > 0 && contains(points[startIndex - 1].score)) startIndex -= 1;
  while (endIndex < points.length - 1 && contains(points[endIndex + 1].score)) endIndex += 1;

  return {
    zone,
    startDate: points[startIndex].date,
    endDate: points[endIndex].date,
    startIndex,
    endIndex,
  };
}

export function buildFearGreedHighlightRegion(
  points: FearGreedPoint[],
  run: FearGreedZoneRun,
): FearGreedHighlightRegion | null {
  const startPoint = points[run.startIndex];
  const endPoint = points[run.endIndex];
  if (!startPoint || !endPoint) return null;

  const previousPoint = points[run.startIndex - 1];
  const nextPoint = points[run.endIndex + 1];

  if (run.zone === "neutral") {
    const startThreshold = previousPoint?.score !== undefined
      ? (previousPoint.score < 45 ? 45 : 55)
      : startPoint.score;
    const endThreshold = nextPoint?.score !== undefined
      ? (nextPoint.score < 45 ? 45 : 55)
      : endPoint.score;
    const startBoundary = previousPoint
      ? interpolateThresholdCrossing(previousPoint, startPoint, startThreshold)
      : {
          timestamp: Date.parse(`${startPoint.date}T00:00:00.000Z`),
          score: startPoint.score,
        };
    const endBoundary = nextPoint
      ? interpolateThresholdCrossing(endPoint, nextPoint, endThreshold)
      : {
          timestamp: Date.parse(`${endPoint.date}T00:00:00.000Z`),
          score: endPoint.score,
        };

    return {
      zone: "neutral",
      lowerThreshold: 45,
      upperThreshold: 55,
      startTimestamp: startBoundary.timestamp,
      endTimestamp: endBoundary.timestamp,
      startBoundaryScore: startBoundary.score,
      endBoundaryScore: endBoundary.score,
      startHasCrossing: Boolean(previousPoint),
      endHasCrossing: Boolean(nextPoint),
    };
  }

  const threshold = HIGHLIGHT_DEFINITIONS[run.zone].threshold;
  const startBoundary = previousPoint
    ? interpolateThresholdCrossing(previousPoint, startPoint, threshold)
    : { timestamp: Date.parse(`${startPoint.date}T00:00:00.000Z`), score: threshold };
  const endBoundary = nextPoint
    ? interpolateThresholdCrossing(endPoint, nextPoint, threshold)
    : { timestamp: Date.parse(`${endPoint.date}T00:00:00.000Z`), score: threshold };
  const interiorPoints = points
    .slice(run.startIndex, run.endIndex + 1)
    .map((point) => ({
      timestamp: Date.parse(`${point.date}T00:00:00.000Z`),
      score: point.score,
    }));

  return {
    zone: run.zone,
    threshold,
    points: [startBoundary, ...interiorPoints, endBoundary],
    startTimestamp: startBoundary.timestamp,
    endTimestamp: endBoundary.timestamp,
    startHasCrossing: Boolean(previousPoint),
    endHasCrossing: Boolean(nextPoint),
  };
}
