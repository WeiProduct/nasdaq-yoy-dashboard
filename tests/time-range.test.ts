import { describe, expect, it } from "vitest";
import type { NasdaqYoYPoint } from "@/lib/types";
import {
  filterPointsByRange,
  shiftUtcMonthsBack,
  summarizeRange,
} from "@/lib/time-range";

function point(date: string, yoyPct: number): NasdaqYoYPoint {
  return {
    date,
    close: 100,
    comparisonDate: "2024-01-01",
    comparisonClose: 90,
    changePoints: 10,
    yoyPct,
  };
}

describe("shiftUtcMonthsBack", () => {
  it("clamps month-end dates instead of overflowing into the next month", () => {
    expect(shiftUtcMonthsBack("2024-03-31", 1)).toBe("2024-02-29");
    expect(shiftUtcMonthsBack("2025-03-31", 1)).toBe("2025-02-28");
  });
});

describe("filterPointsByRange", () => {
  const points = [
    point("2021-08-23", 1),
    point("2021-08-24", 2),
    point("2023-08-24", 3),
    point("2025-08-24", 4),
    point("2026-07-24", 5),
    point("2026-08-24", 6),
  ];

  it("returns inclusive calendar windows anchored to the latest trading date", () => {
    expect(filterPointsByRange(points, "1M").map((item) => item.date)).toEqual([
      "2026-07-24",
      "2026-08-24",
    ]);
    expect(filterPointsByRange(points, "1Y").map((item) => item.date)).toEqual([
      "2025-08-24",
      "2026-07-24",
      "2026-08-24",
    ]);
    expect(filterPointsByRange(points, "5Y").map((item) => item.date)).toEqual(
      points.slice(1).map((item) => item.date),
    );
  });
});

describe("summarizeRange", () => {
  it("recalculates high, low, and positive share for the visible window", () => {
    expect(summarizeRange([point("2026-01-01", -2), point("2026-01-02", 4)])).toEqual({
      highYoyPct: 4,
      lowYoyPct: -2,
      positiveDayShare: 50,
    });
    expect(summarizeRange([])).toBeNull();
  });
});
