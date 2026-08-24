import { describe, expect, it } from "vitest";
import {
  computeRollingYoY,
  mergeLatestObservation,
  parseFredCsv,
  shiftOneYearBack,
  shiftYearsBack,
} from "@/lib/nasdaq";
import { NASDAQ_SNAPSHOT_CSV } from "@/lib/nasdaq-snapshot";

describe("parseFredCsv", () => {
  it("filters invalid values, deduplicates dates, and sorts observations", () => {
    const csv = [
      "observation_date,NASDAQCOM",
      "2025-01-03,100.5",
      "2025-01-02,.",
      "2025-01-01,99",
      "2025-01-03,101",
    ].join("\n");

    expect(parseFredCsv(csv)).toEqual([
      { date: "2025-01-01", close: 99 },
      { date: "2025-01-03", close: 101 },
    ]);
  });
});

describe("mergeLatestObservation", () => {
  it("appends a newer intraday value and replaces the same trading date", () => {
    const history = [
      { date: "2026-08-20", close: 100 },
      { date: "2026-08-21", close: 101 },
    ];

    expect(
      mergeLatestObservation(history, { date: "2026-08-24", close: 99 }),
    ).toEqual([...history, { date: "2026-08-24", close: 99 }]);
    expect(
      mergeLatestObservation(history, { date: "2026-08-21", close: 102 }),
    ).toEqual([
      { date: "2026-08-20", close: 100 },
      { date: "2026-08-21", close: 102 },
    ]);
  });

  it("ignores an intraday value older than the latest FRED observation", () => {
    const history = [{ date: "2026-08-21", close: 101 }];
    expect(
      mergeLatestObservation(history, { date: "2026-08-20", close: 99 }),
    ).toBe(history);
  });
});

describe("shiftOneYearBack", () => {
  it("clamps leap day to the last day of February", () => {
    expect(shiftOneYearBack(new Date("2024-02-29T00:00:00Z")).toISOString()).toBe(
      "2023-02-28T00:00:00.000Z",
    );
  });

  it("supports multi-year windows while preserving leap-day clamping", () => {
    expect(shiftYearsBack(new Date("2024-02-29T00:00:00Z"), 5).toISOString()).toBe(
      "2019-02-28T00:00:00.000Z",
    );
  });
});

describe("computeRollingYoY", () => {
  it("uses the previous trading day when the anniversary is not a trading day", () => {
    const result = computeRollingYoY([
      { date: "2024-01-05", close: 100 },
      { date: "2024-01-08", close: 105 },
      { date: "2025-01-06", close: 120 },
      { date: "2025-01-08", close: 126 },
    ]);

    expect(result[0]).toMatchObject({
      date: "2025-01-06",
      comparisonDate: "2024-01-05",
      comparisonClose: 100,
      yoyPct: 20,
    });
    expect(result[1]).toMatchObject({
      date: "2025-01-08",
      comparisonDate: "2024-01-08",
      comparisonClose: 105,
      yoyPct: 20,
    });
  });

  it("uses five visible years by default", () => {
    const result = computeRollingYoY([
      { date: "2019-01-03", close: 50 },
      { date: "2020-01-03", close: 60 },
      { date: "2021-01-03", close: 70 },
      { date: "2024-01-03", close: 90 },
      { date: "2025-01-03", close: 100 },
      { date: "2026-01-03", close: 125 },
    ]);

    expect(result.map((point) => point.date)).toEqual([
      "2021-01-03",
      "2025-01-03",
      "2026-01-03",
    ]);
    expect(result.at(-1)?.yoyPct).toBe(25);
  });

  it("keeps five years available in the bundled fallback snapshot", () => {
    const result = computeRollingYoY(parseFredCsv(NASDAQ_SNAPSHOT_CSV));

    expect(result.length).toBeGreaterThan(1_200);
    expect(result[0].date).toMatch(/^2021-/);
    expect(result.at(-1)?.date).toBe("2026-08-21");
  });
});
