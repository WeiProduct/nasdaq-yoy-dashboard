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
