export type NasdaqObservation = {
  date: string;
  close: number;
};

export type NasdaqYoYPoint = {
  date: string;
  close: number;
  comparisonDate: string;
  comparisonClose: number;
  changePoints: number;
  yoyPct: number;
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
