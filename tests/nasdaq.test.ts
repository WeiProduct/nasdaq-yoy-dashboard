import { describe, expect, it } from "vitest";
import { computeRollingYoY, parseFredCsv, shiftOneYearBack } from "@/lib/nasdaq";

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

describe("shiftOneYearBack", () => {
  it("clamps leap day to the last day of February", () => {
    expect(shiftOneYearBack(new Date("2024-02-29T00:00:00Z")).toISOString()).toBe(
      "2023-02-28T00:00:00.000Z",
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

  it("returns only the most recent rolling year", () => {
    const result = computeRollingYoY([
      { date: "2023-01-03", close: 80 },
      { date: "2024-01-03", close: 100 },
      { date: "2024-06-03", close: 110 },
      { date: "2025-01-03", close: 125 },
    ]);

    expect(result.map((point) => point.date)).toEqual(["2024-01-03", "2025-01-03"]);
    expect(result.at(-1)?.yoyPct).toBe(25);
  });
});
