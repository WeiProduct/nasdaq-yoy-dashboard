import { describe, expect, it } from "vitest";
import {
  fearGreedZoneForScore,
  summarizeFearGreedDistribution,
} from "@/lib/fear-greed-distribution";
import type { FearGreedPoint } from "@/lib/types";

function point(score: number): FearGreedPoint {
  return { date: "2026-08-27", score, rating: "" };
}

describe("fearGreedZoneForScore", () => {
  it("uses the five CNN score regions at their exact boundaries", () => {
    expect(fearGreedZoneForScore(0)).toBe("extreme-fear");
    expect(fearGreedZoneForScore(24)).toBe("extreme-fear");
    expect(fearGreedZoneForScore(25)).toBe("fear");
    expect(fearGreedZoneForScore(44)).toBe("fear");
    expect(fearGreedZoneForScore(45)).toBe("neutral");
    expect(fearGreedZoneForScore(55)).toBe("neutral");
    expect(fearGreedZoneForScore(56)).toBe("greed");
    expect(fearGreedZoneForScore(75)).toBe("greed");
    expect(fearGreedZoneForScore(76)).toBe("extreme-greed");
    expect(fearGreedZoneForScore(100)).toBe("extreme-greed");
  });

  it("rejects invalid scores", () => {
    expect(fearGreedZoneForScore(-1)).toBeNull();
    expect(fearGreedZoneForScore(101)).toBeNull();
    expect(fearGreedZoneForScore(Number.NaN)).toBeNull();
  });
});

describe("summarizeFearGreedDistribution", () => {
  it("calculates each region against valid points only", () => {
    const result = summarizeFearGreedDistribution([
      point(10),
      point(30),
      point(40),
      point(50),
      point(60),
      point(80),
      point(120),
    ]);

    expect(result.total).toBe(6);
    expect(result.zones.map(({ key, count }) => ({ key, count }))).toEqual([
      { key: "extreme-fear", count: 1 },
      { key: "fear", count: 2 },
      { key: "neutral", count: 1 },
      { key: "greed", count: 1 },
      { key: "extreme-greed", count: 1 },
    ]);
    expect(result.zones[0].percentage).toBeCloseTo(100 / 6);
    expect(result.zones[1].percentage).toBeCloseTo(200 / 6);
    expect(result.zones[2].percentage).toBeCloseTo(100 / 6);
    expect(result.zones[3].percentage).toBeCloseTo(100 / 6);
    expect(result.zones[4].percentage).toBeCloseTo(100 / 6);
  });

  it("returns zero shares for an empty range", () => {
    const result = summarizeFearGreedDistribution([]);
    expect(result.total).toBe(0);
    expect(result.zones.every((zone) => zone.percentage === 0)).toBe(true);
  });
});
