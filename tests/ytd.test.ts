import { describe, expect, it } from "vitest";
import { computeYearlyYtd } from "@/lib/ytd";

describe("computeYearlyYtd", () => {
  it("uses each calendar year's first trading close as that year's baseline", () => {
    const result = computeYearlyYtd([
      { date: "2025-01-03", close: 100 },
      { date: "2025-12-31", close: 120 },
      { date: "2026-01-02", close: 110 },
      { date: "2026-08-24", close: 132 },
    ]);

    expect(result).toEqual([
      {
        date: "2025-01-03",
        close: 100,
        yearStartDate: "2025-01-03",
        yearStartClose: 100,
        ytdPct: 0,
      },
      {
        date: "2025-12-31",
        close: 120,
        yearStartDate: "2025-01-03",
        yearStartClose: 100,
        ytdPct: 20,
      },
      {
        date: "2026-01-02",
        close: 110,
        yearStartDate: "2026-01-02",
        yearStartClose: 110,
        ytdPct: 0,
      },
      {
        date: "2026-08-24",
        close: 132,
        yearStartDate: "2026-01-02",
        yearStartClose: 110,
        ytdPct: 20,
      },
    ]);
  });

  it("keeps a pre-window baseline when returning a partial first visible year", () => {
    const result = computeYearlyYtd([
      { date: "2022-08-24", close: 120 },
      { date: "2021-08-24", close: 110 },
      { date: "2021-01-04", close: 100 },
      { date: "2022-01-03", close: 150 },
    ], "2021-08-24");

    expect(result).toEqual([
      {
        date: "2021-08-24",
        close: 110,
        yearStartDate: "2021-01-04",
        yearStartClose: 100,
        ytdPct: 10,
      },
      {
        date: "2022-01-03",
        close: 150,
        yearStartDate: "2022-01-03",
        yearStartClose: 150,
        ytdPct: 0,
      },
      {
        date: "2022-08-24",
        close: 120,
        yearStartDate: "2022-01-03",
        yearStartClose: 150,
        ytdPct: -20,
      },
    ]);
  });

  it("returns an empty series for empty input", () => {
    expect(computeYearlyYtd([])).toEqual([]);
  });
});
