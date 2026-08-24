import { describe, expect, it } from "vitest";
import { computeCurrentYearYtd } from "@/lib/ytd";

describe("computeCurrentYearYtd", () => {
  it("uses the previous calendar year's final trading close as the baseline", () => {
    const result = computeCurrentYearYtd([
      { date: "2025-12-30", close: 100 },
      { date: "2025-12-31", close: 105 },
      { date: "2026-01-02", close: 110.25 },
      { date: "2026-08-24", close: 126 },
    ]);

    expect(result.baselineDate).toBe("2025-12-31");
    expect(result.baselineClose).toBe(105);
    expect(result.points).toEqual([
      { date: "2025-12-31", close: 105, ytdPct: 0 },
      { date: "2026-01-02", close: 110.25, ytdPct: 5 },
      { date: "2026-08-24", close: 126, ytdPct: 20 },
    ]);
    expect(result.latestYtdPct).toBe(20);
  });

  it("sorts input and does not mix the prior year's partial YTD into the series", () => {
    const result = computeCurrentYearYtd([
      { date: "2026-02-02", close: 110 },
      { date: "2025-08-01", close: 90 },
      { date: "2025-12-31", close: 100 },
      { date: "2026-01-02", close: 102 },
    ]);

    expect(result.points.map((point) => point.date)).toEqual([
      "2025-12-31",
      "2026-01-02",
      "2026-02-02",
    ]);
  });

  it("returns an empty series when the prior year-end baseline is unavailable", () => {
    expect(
      computeCurrentYearYtd([{ date: "2026-01-02", close: 100 }]),
    ).toEqual({
      baselineDate: null,
      baselineClose: null,
      latestYtdPct: null,
      points: [],
    });
  });
});
