import { describe, expect, it } from "vitest";
import { mapClientXToRange } from "../lib/chart-coordinates";

describe("mapClientXToRange", () => {
  it("maps the interaction layer edges and midpoint to the chart range", () => {
    expect(mapClientXToRange(100, 100, 800, 16, 936)).toBe(16);
    expect(mapClientXToRange(500, 100, 800, 16, 936)).toBe(476);
    expect(mapClientXToRange(900, 100, 800, 16, 936)).toBe(936);
  });

  it("clamps pointers outside the interaction layer", () => {
    expect(mapClientXToRange(40, 100, 800, 16, 936)).toBe(16);
    expect(mapClientXToRange(980, 100, 800, 16, 936)).toBe(936);
  });

  it("falls back to the range start for a collapsed interaction layer", () => {
    expect(mapClientXToRange(100, 100, 0, 16, 936)).toBe(16);
  });
});
