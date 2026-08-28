const RATING_LABELS: Record<string, string> = {
  "extreme fear": "极度恐惧",
  fear: "恐惧",
  neutral: "中性",
  greed: "贪婪",
  "extreme greed": "极度贪婪",
};

export function fearGreedRatingLabel(rating: string | null | undefined): string {
  if (!rating) return "暂无评级";
  return RATING_LABELS[rating.trim().toLowerCase()] ?? rating;
}
