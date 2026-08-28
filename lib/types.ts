export type NasdaqObservation = {
  date: string;
  close: number;
};

export type NasdaqYtdPoint = {
  date: string;
  close: number;
  yearStartDate: string;
  yearStartClose: number;
  ytdPct: number;
};

export type NasdaqYoYPoint = {
  date: string;
  close: number;
  comparisonDate: string;
  comparisonClose: number;
  changePoints: number;
  yoyPct: number;
};

export type FearGreedPoint = {
  date: string;
  score: number;
  rating: string;
};

export type FearGreedSeries = {
  available: boolean;
  asOf: string | null;
  latestScore: number | null;
  latestRating: string | null;
  points: FearGreedPoint[];
  source: {
    name: string;
    url: string;
  };
};

export type NasdaqYoYResponse = {
  name: string;
  symbol: string;
  seriesId: string;
  asOf: string;
  periodStart: string;
  frequency: string;
  unit: string;
  deliveryMode: "fresh" | "snapshot";
  intraday: {
    active: boolean;
    updatedAt: string | null;
    refreshIntervalSeconds: number;
    isRealTime: boolean;
    source: {
      name: string;
      url: string;
    };
  };
  source: {
    name: string;
    url: string;
  };
  methodology: string;
  points: NasdaqYoYPoint[];
  ytdPoints: NasdaqYtdPoint[];
  fearGreed: FearGreedSeries;
  stats: {
    latestClose: number;
    latestYoyPct: number;
    latestChangePoints: number;
    comparisonDate: string;
    comparisonClose: number;
    highYoyPct: number;
    lowYoyPct: number;
    positiveDayShare: number;
  };
};
