import { describe, expect, it } from "vitest";
import {
  buildFearGreedExtremeRegion,
  fearGreedZoneForScore,
  findFearGreedZoneRun,
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

describe("findFearGreedZoneRun", () => {
  const points: FearGreedPoint[] = [
    { date: "2026-01-01", score: 70, rating: "greed" },
    { date: "2026-01-02", score: 76, rating: "extreme greed" },
    { date: "2026-01-03", score: 88, rating: "extreme greed" },
    { date: "2026-01-04", score: 100, rating: "extreme greed" },
    { date: "2026-01-05", score: 55, rating: "neutral" },
  ];

  it("returns the complete contiguous region containing the hovered date", () => {
    expect(findFearGreedZoneRun(points, "2026-01-03", "extreme-greed")).toEqual({
      zone: "extreme-greed",
      startDate: "2026-01-02",
      endDate: "2026-01-04",
      startIndex: 1,
      endIndex: 3,
    });
  });

  it("returns null when the hovered date is outside the requested region", () => {
    expect(findFearGreedZoneRun(points, "2026-01-01", "extreme-greed")).toBeNull();
    expect(findFearGreedZoneRun(points, "2026-02-01", "extreme-greed")).toBeNull();
  });

  it("supports the matching extreme-fear region", () => {
    const fearPoints: FearGreedPoint[] = [
      { date: "2026-03-24", score: 30, rating: "fear" },
      { date: "2026-03-25", score: 18, rating: "extreme fear" },
      { date: "2026-03-26", score: 10, rating: "extreme fear" },
      { date: "2026-03-27", score: 20, rating: "extreme fear" },
      { date: "2026-03-28", score: 28, rating: "fear" },
    ];

    const run = findFearGreedZoneRun(fearPoints, "2026-03-26", "extreme-fear");
    expect(run).toEqual({
      zone: "extreme-fear",
      startDate: "2026-03-25",
      endDate: "2026-03-27",
      startIndex: 1,
      endIndex: 3,
    });

    expect(buildFearGreedExtremeRegion(fearPoints, run!)).toEqual({
      zone: "extreme-fear",
      threshold: 25,
      startTimestamp: Date.parse("2026-03-24T10:00:00.000Z"),
      endTimestamp: Date.parse("2026-03-27T15:00:00.000Z"),
      points: [
        { timestamp: Date.parse("2026-03-24T10:00:00.000Z"), score: 25 },
        { timestamp: Date.parse("2026-03-25T00:00:00.000Z"), score: 18 },
        { timestamp: Date.parse("2026-03-26T00:00:00.000Z"), score: 10 },
        { timestamp: Date.parse("2026-03-27T00:00:00.000Z"), score: 20 },
        { timestamp: Date.parse("2026-03-27T15:00:00.000Z"), score: 25 },
      ],
    });
  });

  it("clips extreme greed to the 75 threshold crossings", () => {
    const run = findFearGreedZoneRun(points, "2026-01-03", "extreme-greed");
    const region = buildFearGreedExtremeRegion(points, run!);

    expect(region?.threshold).toBe(75);
    expect(region?.points[0]).toEqual({
      timestamp: Date.parse("2026-01-01T20:00:00.000Z"),
      score: 75,
    });
    expect(region?.points.at(-1)).toEqual({
      timestamp: Date.parse("2026-01-04T13:20:00.000Z"),
      score: 75,
    });
  });
});
