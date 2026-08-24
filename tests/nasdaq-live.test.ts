import { describe, expect, it } from "vitest";
import { parseNasdaqChartPayload } from "@/lib/nasdaq-live";

describe("parseNasdaqChartPayload", () => {
  it("uses the latest valid chart value and the New York trading date", () => {
    // Nasdaq encodes the 4:00 PM ET wall clock as if it were 16:00 UTC.
    const timestamp = Date.parse("2026-08-24T16:00:00.000Z");

    expect(
      parseNasdaqChartPayload({
        data: {
          isRealTime: false,
          chart: [
            { x: timestamp - 60_000, y: 25_975 },
            { x: timestamp, y: 25_980.19 },
          ],
        },
      }),
    ).toEqual({
      date: "2026-08-24",
      close: 25_980.19,
      updatedAt: "2026-08-24T20:00:00.000Z",
      isRealTime: false,
    });
  });

  it("rejects a payload without a valid chart value", () => {
    expect(() => parseNasdaqChartPayload({ data: { chart: [] } })).toThrow(
      "valid index value",
    );
  });
});
