import { describe, expect, it } from "vitest";
import { computeSimpleMovingAverage } from "@/lib/moving-average";

describe("computeSimpleMovingAverage", () => {
  it("uses complete trading-day windows and handles unsorted input", () => {
    const result = computeSimpleMovingAverage([
      { date: "2026-01-05", close: 30 },
      { date: "2026-01-02", close: 20 },
      { date: "2026-01-01", close: 10 },
      { date: "2026-01-06", close: 40 },
    ], 3);

    expect(result).toEqual([
      { date: "2026-01-05", value: 20, period: 3 },
      { date: "2026-01-06", value: 30, period: 3 },
    ]);
  });

  it("preserves prior observations for the first visible moving average", () => {
    const result = computeSimpleMovingAverage([
      { date: "2026-01-01", close: 10 },
      { date: "2026-01-02", close: 20 },
      { date: "2026-01-05", close: 30 },
      { date: "2026-01-06", close: 40 },
    ], 3, "2026-01-06");

    expect(result).toEqual([
      { date: "2026-01-06", value: 30, period: 3 },
    ]);
  });

  it("rejects incomplete or invalid windows", () => {
    expect(computeSimpleMovingAverage([{ date: "2026-01-01", close: 10 }], 3)).toEqual([]);
    expect(computeSimpleMovingAverage([], 0)).toEqual([]);
  });
});
