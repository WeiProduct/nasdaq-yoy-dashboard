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
      {
        date: "2026-01-05",
        value: 20,
        period: 3,
        windowStartDate: "2026-01-01",
        windowEndDate: "2026-01-05",
      },
      {
        date: "2026-01-06",
        value: 30,
        period: 3,
        windowStartDate: "2026-01-02",
        windowEndDate: "2026-01-06",
      },
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
      {
        date: "2026-01-06",
        value: 30,
        period: 3,
        windowStartDate: "2026-01-02",
        windowEndDate: "2026-01-06",
      },
    ]);
  });

  it("computes SMA50 from exactly 50 trading observations", () => {
    const observations = Array.from({ length: 51 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
      close: index + 1,
    }));
    const result = computeSimpleMovingAverage(observations, 50);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      value: 25.5,
      period: 50,
      windowStartDate: "2026-01-01",
      windowEndDate: "2026-02-19",
    });
    expect(result[1]).toMatchObject({
      value: 26.5,
      period: 50,
      windowStartDate: "2026-01-02",
      windowEndDate: "2026-02-20",
    });
  });

  it("rejects incomplete or invalid windows", () => {
    expect(computeSimpleMovingAverage([{ date: "2026-01-01", close: 10 }], 3)).toEqual([]);
    expect(computeSimpleMovingAverage([], 0)).toEqual([]);
  });
});
