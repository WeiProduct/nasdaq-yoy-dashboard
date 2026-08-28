export function mapClientXToRange(
  clientX: number,
  interactionLeft: number,
  interactionWidth: number,
  rangeStart: number,
  rangeEnd: number,
) {
  if (!Number.isFinite(interactionWidth) || interactionWidth <= 0) {
    return rangeStart;
  }

  const pointerRatio = Math.max(
    0,
    Math.min(1, (clientX - interactionLeft) / interactionWidth),
  );

  return rangeStart + pointerRatio * (rangeEnd - rangeStart);
}

export type VerticalSeriesCandidate<T extends string = string> = {
  key: T;
  y: number;
};

export function pointAxisDomainValues(
  indexCloses: number[],
  movingAverageValues: number[],
): number[] {
  return [...indexCloses, ...movingAverageValues].filter(Number.isFinite);
}

export function selectFirstSeriesBelowPointer<T extends VerticalSeriesCandidate>(
  candidates: T[],
  pointerY: number | null,
  tolerance = 3,
): T | undefined {
  const valid = candidates.filter((candidate) => Number.isFinite(candidate.y));
  if (valid.length === 0) return undefined;
  if (pointerY === null || !Number.isFinite(pointerY)) return valid[0];

  const firstBelow = valid
    .filter((candidate) => candidate.y >= pointerY - tolerance)
    .sort((a, b) => a.y - b.y)[0];

  if (firstBelow) return firstBelow;

  return valid.reduce((nearest, candidate) =>
    Math.abs(candidate.y - pointerY) < Math.abs(nearest.y - pointerY)
      ? candidate
      : nearest,
  );
}
