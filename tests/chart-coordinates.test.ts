import { describe, expect, it } from "vitest";
import {
  mapClientXToRange,
  pointAxisDomainValues,
  selectFirstSeriesBelowPointer,
} from "../lib/chart-coordinates";

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

describe("selectFirstSeriesBelowPointer", () => {
  const candidates = [
    { key: "top", y: 80 },
    { key: "middle", y: 160 },
    { key: "bottom", y: 240 },
  ];

  it("selects the first visible line vertically below the pointer", () => {
    expect(selectFirstSeriesBelowPointer(candidates, 100)?.key).toBe("middle");
    expect(selectFirstSeriesBelowPointer(candidates, 161)?.key).toBe("middle");
    expect(selectFirstSeriesBelowPointer(candidates, 164)?.key).toBe("bottom");
  });

  it("falls back to the nearest line when the pointer is below every line", () => {
    expect(selectFirstSeriesBelowPointer(candidates, 300)?.key).toBe("bottom");
  });

  it("uses visual-series order for keyboard navigation and empty ties", () => {
    expect(selectFirstSeriesBelowPointer(candidates, null)?.key).toBe("top");
    expect(selectFirstSeriesBelowPointer([], 100)).toBeUndefined();
  });
});

describe("pointAxisDomainValues", () => {
  it("keeps the hidden index range in the scale when only SMA is visible", () => {
    expect(pointAxisDomainValues([100, 120], [104, 108])).toEqual([
      100, 120, 104, 108,
    ]);
  });

  it("drops non-finite upstream values", () => {
    expect(pointAxisDomainValues([100, Number.NaN], [Number.POSITIVE_INFINITY, 105])).toEqual([
      100, 105,
    ]);
  });
});
