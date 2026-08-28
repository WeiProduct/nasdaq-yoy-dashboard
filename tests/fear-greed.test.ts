import { describe, expect, it } from "vitest";
import { parseFearGreedPayload } from "@/lib/fear-greed";

describe("parseFearGreedPayload", () => {
  it("normalizes, deduplicates, validates, and sorts CNN history", () => {
    const result = parseFearGreedPayload({
      fear_and_greed: { score: 63.4, rating: "greed" },
      fear_and_greed_historical: {
        data: [
          { x: Date.parse("2026-08-27T00:00:00Z"), y: 58, rating: "greed" },
          { x: Date.parse("2026-08-26T00:00:00Z"), y: 49, rating: "neutral" },
          { x: Date.parse("2026-08-27T23:59:00Z"), y: 63.4, rating: "greed" },
          { x: Date.parse("2026-08-25T00:00:00Z"), y: 120, rating: "invalid" },
        ],
      },
    });

    expect(result.available).toBe(true);
    expect(result.asOf).toBe("2026-08-27");
    expect(result.latestScore).toBe(63.4);
    expect(result.latestRating).toBe("greed");
    expect(result.points).toEqual([
      { date: "2026-08-26", score: 49, rating: "neutral" },
      { date: "2026-08-27", score: 63.4, rating: "greed" },
    ]);
  });

  it("returns an unavailable series for a malformed response", () => {
    expect(parseFearGreedPayload({})).toMatchObject({
      available: false,
      asOf: null,
      latestScore: null,
      points: [],
    });
  });
});
