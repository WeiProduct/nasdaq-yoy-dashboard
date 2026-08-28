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

export function fearGreedZoneForScore(score: number): FearGreedZoneKey | null {
  if (!Number.isFinite(score) || score < 0 || score > 100) return null;
  return FEAR_GREED_ZONES.find((zone) => score >= zone.min && score <= zone.max)?.key ?? null;
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
