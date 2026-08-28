"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  area,
  bisector,
  curveLinear,
  extent,
  line,
  scaleLinear,
  scaleUtc,
} from "d3";
import type {
  FearGreedPoint,
  NasdaqMovingAveragePoint,
  NasdaqYoYPoint,
} from "@/lib/types";
import {
  mapClientXToRange,
  pointAxisDomainValues,
  selectFirstSeriesBelowPointer,
} from "@/lib/chart-coordinates";
import type { YtdPoint } from "@/lib/ytd";
import { fearGreedRatingLabel } from "@/lib/fear-greed-rating";
import {
  buildFearGreedExtremeRegion,
  fearGreedZoneForScore,
  findFearGreedZoneRun,
} from "@/lib/fear-greed-distribution";

type ChartPoint = NasdaqYoYPoint & {
  timestamp: number;
  dateValue: Date;
};

type YtdChartPoint = YtdPoint & {
  timestamp: number;
  dateValue: Date;
};

type FearGreedChartPoint = FearGreedPoint & {
  timestamp: number;
  dateValue: Date;
};

type MovingAverageChartPoint = NasdaqMovingAveragePoint & {
  timestamp: number;
  dateValue: Date;
};

type HoverSeriesKey = "yoy" | "ytd" | "index" | "moving-average" | "fear-greed";

type HoverSeries = {
  key: HoverSeriesKey;
  x: number;
  y: number;
  valueText: string;
  detailText?: string;
  ariaText: string;
  textClassName: string;
  dotClassName?: string;
  dotFill?: string;
};

const fullDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  timeZone: "UTC",
});

const shortDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

const rangeBoundaryDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const axisNumberFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 0,
});

function percent(value: number, digits = 2) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function formatXAxisTick(date: Date, spanDays: number) {
  if (spanDays <= 62) return shortDateFormatter.format(date);
  if (spanDays <= 550) {
    return date.getUTCMonth() === 0
      ? `${date.getUTCFullYear()}年`
      : monthFormatter.format(date);
  }

  return date.getUTCMonth() === 0
    ? `${date.getUTCFullYear()}年`
    : `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月`;
}

function formatShortDate(date: string) {
  return shortDateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateWidth = () => setWidth(Math.round(element.getBoundingClientRect().width));
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

type RollingYoYChartProps = {
  points: NasdaqYoYPoint[];
  ytdPoints: YtdPoint[];
  movingAveragePoints: NasdaqMovingAveragePoint[];
  fearGreedPoints: FearGreedPoint[];
  showYoY: boolean;
  showYtd: boolean;
  showIndex: boolean;
  showMovingAverage: boolean;
  showFearGreed: boolean;
};

export function RollingYoYChart({
  points: rawPoints,
  ytdPoints: rawYtdPoints,
  movingAveragePoints: rawMovingAveragePoints,
  fearGreedPoints: rawFearGreedPoints,
  showYoY,
  showYtd,
  showIndex,
  showMovingAverage,
  showFearGreed,
}: RollingYoYChartProps) {
  const { ref: containerRef, width } = useContainerWidth();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredPointerY, setHoveredPointerY] = useState<number | null>(null);
  const gradientId = useId().replaceAll(":", "");

  const points = useMemo<ChartPoint[]>(
    () =>
      rawPoints.map((point) => {
        const dateValue = new Date(`${point.date}T00:00:00.000Z`);
        return { ...point, dateValue, timestamp: dateValue.getTime() };
      }),
    [rawPoints],
  );
  const ytdPoints = useMemo<YtdChartPoint[]>(
    () =>
      rawYtdPoints.map((point) => {
        const dateValue = new Date(`${point.date}T00:00:00.000Z`);
        return { ...point, dateValue, timestamp: dateValue.getTime() };
      }),
    [rawYtdPoints],
  );
  const fearGreedPoints = useMemo<FearGreedChartPoint[]>(
    () =>
      rawFearGreedPoints.map((point) => {
        const dateValue = new Date(`${point.date}T00:00:00.000Z`);
        return { ...point, dateValue, timestamp: dateValue.getTime() };
      }),
    [rawFearGreedPoints],
  );
  const movingAveragePoints = useMemo<MovingAverageChartPoint[]>(
    () =>
      rawMovingAveragePoints.map((point) => {
        const dateValue = new Date(`${point.date}T00:00:00.000Z`);
        return { ...point, dateValue, timestamp: dateValue.getTime() };
      }),
    [rawMovingAveragePoints],
  );
  const ytdByDate = useMemo(
    () => new Map(ytdPoints.map((point) => [point.date, point])),
    [ytdPoints],
  );
  const movingAverageByDate = useMemo(
    () => new Map(movingAveragePoints.map((point) => [point.date, point])),
    [movingAveragePoints],
  );
  const ytdSeries = useMemo(() => {
    const seriesByYear = new Map<string, YtdChartPoint[]>();

    for (const point of ytdPoints) {
      const series = seriesByYear.get(point.yearStartDate) ?? [];
      series.push(point);
      seriesByYear.set(point.yearStartDate, series);
    }

    return Array.from(seriesByYear, ([yearStartDate, seriesPoints]) => ({
      yearStartDate,
      points: seriesPoints,
    }));
  }, [ytdPoints]);

  const isCompact = width < 620;
  const height = width > 0 && isCompact ? 350 : 430;
  const showPointAxis = showIndex || showMovingAverage;
  const leftMargin = isCompact
    ? showPointAxis && showFearGreed
      ? 86
      : showPointAxis
        ? 48
        : showFearGreed
          ? 42
          : 10
    : showPointAxis && showFearGreed
      ? 104
      : showPointAxis
        ? 64
        : showFearGreed
          ? 52
          : 16;
  const margin = isCompact
    ? { top: 18, right: 48, bottom: 42, left: leftMargin }
    : { top: 24, right: 64, bottom: 46, left: leftMargin };
  const showPercentAxis = showYoY || showYtd;

  const chart = useMemo(() => {
    if (width <= 0 || points.length === 0) return null;

    const [dateMin, dateMax] = extent(points, (point) => point.dateValue);
    const pointAxisValues = pointAxisDomainValues(
      points.map((point) => point.close),
      showMovingAverage ? movingAveragePoints.map((point) => point.value) : [],
    );
    const [closeMin = 0, closeMax = 0] = extent(pointAxisValues);
    const visibleValues = showYoY ? points.map((point) => point.yoyPct) : [];
    if (showYtd) visibleValues.push(...ytdPoints.map((point) => point.ytdPct));
    if (visibleValues.length === 0) visibleValues.push(...points.map((point) => point.yoyPct));
    const [valueMin = 0, valueMax = 0] = extent(visibleValues);
    if (!dateMin || !dateMax) return null;
    const spanDays = Math.max(
      1,
      (dateMax.getTime() - dateMin.getTime()) / 86_400_000,
    );

    const rawSpan = Math.max(valueMax - valueMin, 1);
    const padding = Math.max(rawSpan * 0.14, 1.5);
    const domainMin = Math.min(0, valueMin - padding);
    const domainMax = Math.max(0, valueMax + padding);

    const xScale = scaleUtc()
      .domain([dateMin, dateMax])
      .range([margin.left, width - margin.right]);
    const yScale = scaleLinear()
      .domain([domainMin, domainMax])
      .nice(5)
      .range([height - margin.bottom, margin.top]);
    const closeSpan = Math.max(closeMax - closeMin, 1);
    const closePadding = Math.max(closeSpan * 0.08, 100);
    const indexYScale = scaleLinear()
      .domain([
        Math.max(0, closeMin - closePadding),
        closeMax + closePadding,
      ])
      .nice(5)
      .range([height - margin.bottom, margin.top]);

    const linePath = showYoY
      ? line<ChartPoint>()
          .x((point) => xScale(point.dateValue))
          .y((point) => yScale(point.yoyPct))
          .curve(curveLinear)(points)
      : null;
    const areaPath = showYoY
      ? area<ChartPoint>()
          .x((point) => xScale(point.dateValue))
          .y0(yScale(0))
          .y1((point) => yScale(point.yoyPct))
          .curve(curveLinear)(points)
      : null;
    const ytdLinePaths = showYtd
      ? ytdSeries.map((series) => ({
          yearStartDate: series.yearStartDate,
          path: line<YtdChartPoint>()
            .x((point) => xScale(point.dateValue))
            .y((point) => yScale(point.ytdPct))
            .curve(curveLinear)(series.points),
        }))
      : [];
    const indexLinePath = showIndex
      ? line<ChartPoint>()
          .x((point) => xScale(point.dateValue))
          .y((point) => indexYScale(point.close))
          .curve(curveLinear)(points)
      : null;
    const movingAverageLinePath = showMovingAverage && movingAveragePoints.length > 0
      ? line<MovingAverageChartPoint>()
          .x((point) => xScale(point.dateValue))
          .y((point) => indexYScale(point.value))
          .curve(curveLinear)(movingAveragePoints)
      : null;
    const fearGreedYScale = scaleLinear()
      .domain([0, 100])
      .range([height - margin.bottom, margin.top]);
    const fearGreedLinePath = showFearGreed && fearGreedPoints.length > 0
      ? line<FearGreedChartPoint>()
          .x((point) => xScale(point.dateValue))
          .y((point) => fearGreedYScale(point.score))
          .curve(curveLinear)(fearGreedPoints)
      : null;

    const innerHeight = height - margin.top - margin.bottom;
    const xTickCount = width < 620 && spanDays > 800 ? 3 : width < 620 ? 4 : 7;
    const zeroOffset = Math.max(
      0,
      Math.min(100, ((yScale(0) - margin.top) / innerHeight) * 100),
    );

    return {
      xScale,
      yScale,
      linePath,
      areaPath,
      ytdLinePaths,
      indexLinePath,
      movingAverageLinePath,
      indexYScale,
      fearGreedLinePath,
      fearGreedYScale,
      zeroOffset,
      xTicks: xScale.ticks(xTickCount),
      yTicks: yScale.ticks(width < 620 ? 4 : 5),
      indexTicks: indexYScale.ticks(width < 620 ? 4 : 5),
      fearGreedTicks: [0, 25, 50, 75, 100],
      spanDays,
    };
  }, [fearGreedPoints, height, margin.bottom, margin.left, margin.right, margin.top, movingAveragePoints, points, showFearGreed, showIndex, showMovingAverage, showYoY, showYtd, width, ytdPoints, ytdSeries]);

  const nearestIndex = useMemo(
    () => bisector<ChartPoint, number>((point) => point.timestamp).center,
    [],
  );
  const nearestFearGreedIndex = useMemo(
    () => bisector<FearGreedChartPoint, number>((point) => point.timestamp).center,
    [],
  );

  function indexFromClientX(clientX: number, element: SVGRectElement) {
    if (!chart) return 0;
    const bounds = element.getBoundingClientRect();
    const svgX = mapClientXToRange(
      clientX,
      bounds.left,
      bounds.width,
      margin.left,
      width - margin.right,
    );
    const timestamp = chart.xScale.invert(svgX).getTime();
    return nearestIndex(points, timestamp);
  }

  function handlePointerMove(event: PointerEvent<SVGRectElement>) {
    const nextIndex = indexFromClientX(event.clientX, event.currentTarget);
    const bounds = event.currentTarget.getBoundingClientRect();
    const nextPointerY = mapClientXToRange(
      event.clientY,
      bounds.top,
      bounds.height,
      margin.top,
      height - margin.bottom,
    );
    setHoveredIndex((current) => (current === nextIndex ? current : nextIndex));
    setHoveredPointerY((current) => current === nextPointerY ? current : nextPointerY);
  }

  function handlePointerDown(event: PointerEvent<SVGRectElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    handlePointerMove(event);
  }

  function handleKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const current = hoveredIndex ?? points.length - 1;
    let next = current;

    if (event.key === "ArrowLeft") next = Math.max(0, current - 1);
    else if (event.key === "ArrowRight") next = Math.min(points.length - 1, current + 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = points.length - 1;
    else return;

    event.preventDefault();
    setHoveredPointerY(null);
    setHoveredIndex(next);
  }

  const hovered = hoveredIndex === null ? null : points[hoveredIndex];
  const hoveredYtd = hovered && showYtd ? ytdByDate.get(hovered.date) : undefined;
  const hoveredMovingAverage = hovered && showMovingAverage
    ? movingAverageByDate.get(hovered.date)
    : undefined;
  const hoveredFearGreed = hovered && showFearGreed && fearGreedPoints.length > 0
    ? fearGreedPoints[nearestFearGreedIndex(fearGreedPoints, hovered.timestamp)]
    : undefined;
  const hoveredX = hovered && chart ? chart.xScale(hovered.dateValue) : 0;
  const hoveredY = hovered && chart ? chart.yScale(hovered.yoyPct) : 0;
  const hoveredYtdY = hoveredYtd && chart ? chart.yScale(hoveredYtd.ytdPct) : 0;
  const hoveredIndexY = hovered && chart ? chart.indexYScale(hovered.close) : 0;
  const hoveredMovingAverageY = hoveredMovingAverage && chart
    ? chart.indexYScale(hoveredMovingAverage.value)
    : 0;
  const hoveredFearGreedX = hoveredFearGreed && chart ? chart.xScale(hoveredFearGreed.dateValue) : 0;
  const hoveredFearGreedY = hoveredFearGreed && chart ? chart.fearGreedYScale(hoveredFearGreed.score) : 0;
  const hoverSeriesCandidates: HoverSeries[] = [];

  if (hovered && chart && showYoY) {
    hoverSeriesCandidates.push({
      key: "yoy",
      x: hoveredX,
      y: hoveredY,
      valueText: `同比 ${percent(hovered.yoyPct)}`,
      ariaText: `同比 ${percent(hovered.yoyPct)}`,
      textClassName: hovered.yoyPct >= 0
        ? "tooltip-value positive-fill"
        : "tooltip-value negative-fill",
      dotFill: hovered.yoyPct >= 0 ? "var(--positive)" : "var(--negative)",
    });
  }
  if (hoveredYtd) {
    hoverSeriesCandidates.push({
      key: "ytd",
      x: hoveredX,
      y: hoveredYtdY,
      valueText: `YTD ${percent(hoveredYtd.ytdPct)}`,
      detailText: `年初 ${numberFormatter.format(hoveredYtd.yearStartClose)} · 当时 ${numberFormatter.format(hoveredYtd.close)}`,
      ariaText: `年初至今 ${percent(hoveredYtd.ytdPct)}，年初点位 ${numberFormatter.format(hoveredYtd.yearStartClose)}，当时点位 ${numberFormatter.format(hoveredYtd.close)}`,
      textClassName: "tooltip-value ytd-fill",
      dotClassName: "ytd-hover-dot",
    });
  }
  if (hovered && chart && showIndex) {
    hoverSeriesCandidates.push({
      key: "index",
      x: hoveredX,
      y: hoveredIndexY,
      valueText: `指数 ${numberFormatter.format(hovered.close)}`,
      ariaText: `指数收盘 ${numberFormatter.format(hovered.close)}`,
      textClassName: "tooltip-value index-fill",
      dotClassName: "index-hover-dot",
    });
  }
  if (hoveredMovingAverage) {
    hoverSeriesCandidates.push({
      key: "moving-average",
      x: hoveredX,
      y: hoveredMovingAverageY,
      valueText: `SMA125 ${numberFormatter.format(hoveredMovingAverage.value)}`,
      detailText: `${hoveredMovingAverage.period}个交易日 · ${formatShortDate(hoveredMovingAverage.windowStartDate)}–${formatShortDate(hoveredMovingAverage.windowEndDate)}`,
      ariaText: `125 日均线 ${numberFormatter.format(hoveredMovingAverage.value)}`,
      textClassName: "tooltip-value moving-average-fill",
      dotClassName: "moving-average-hover-dot",
    });
  }
  if (hoveredFearGreed) {
    hoverSeriesCandidates.push({
      key: "fear-greed",
      x: hoveredFearGreedX,
      y: hoveredFearGreedY,
      valueText: `CNN 情绪 ${hoveredFearGreed.score.toFixed(0)} · ${fearGreedRatingLabel(hoveredFearGreed.rating)}`,
      ariaText: `CNN 恐惧与贪婪指数 ${hoveredFearGreed.score.toFixed(0)}，${fearGreedRatingLabel(hoveredFearGreed.rating)}`,
      textClassName: "tooltip-value fear-greed-fill",
      dotClassName: "fear-greed-hover-dot",
    });
  }

  const selectedHoverSeries = selectFirstSeriesBelowPointer(
    hoverSeriesCandidates,
    hoveredPointerY,
  );
  const hoveredFearGreedZone = hoveredFearGreed
    ? fearGreedZoneForScore(hoveredFearGreed.score)
    : null;
  const highlightedExtremeZone = hoveredFearGreedZone === "extreme-fear"
    || hoveredFearGreedZone === "extreme-greed"
    ? hoveredFearGreedZone
    : null;
  const extremeZoneRun = hoveredFearGreed && highlightedExtremeZone
    ? findFearGreedZoneRun(fearGreedPoints, hoveredFearGreed.date, highlightedExtremeZone)
    : null;
  const extremeZoneHighlight = extremeZoneRun && chart && highlightedExtremeZone
    ? (() => {
        const region = buildFearGreedExtremeRegion(fearGreedPoints, extremeZoneRun);
        if (!region) return null;
        const baselineY = chart.fearGreedYScale(region.threshold);
        const fillPath = area<(typeof region.points)[number]>()
          .x((point) => chart.xScale(new Date(point.timestamp)))
          .y0(baselineY)
          .y1((point) => chart.fearGreedYScale(point.score))
          .curve(curveLinear)(region.points);
        const startX = chart.xScale(new Date(region.startTimestamp));
        const endX = chart.xScale(new Date(region.endTimestamp));

        return {
          zone: highlightedExtremeZone,
          fillPath,
          baselineY,
          startX,
          endX,
          labelY: highlightedExtremeZone === "extreme-fear" ? baselineY - 9 : baselineY + 17,
          startLabel: rangeBoundaryDateFormatter.format(new Date(region.startTimestamp)),
          endLabel: rangeBoundaryDateFormatter.format(new Date(region.endTimestamp)),
        };
      })()
    : null;
  const tooltipWidth = width < 620 ? 218 : 240;
  const tooltipHeight = selectedHoverSeries?.detailText ? 72 : 55;
  const tooltipX = Math.max(
    4,
    Math.min(
      width - tooltipWidth - 4,
      hoveredX - tooltipWidth / 2,
    ),
  );
  const tooltipY = margin.top + 8;
  const activePoint = hovered ?? points.at(-1)!;
  const activeYtd = showYtd ? ytdByDate.get(activePoint.date) : undefined;
  const activeMovingAverage = showMovingAverage
    ? movingAverageByDate.get(activePoint.date)
    : undefined;
  const activeFearGreed = showFearGreed && fearGreedPoints.length > 0
    ? fearGreedPoints[nearestFearGreedIndex(fearGreedPoints, activePoint.timestamp)]
    : undefined;
  const defaultAriaValue = [
    showYoY ? `同比 ${percent(activePoint.yoyPct)}` : null,
    activeYtd
      ? `年初至今 ${percent(activeYtd.ytdPct)}，年初点位 ${numberFormatter.format(activeYtd.yearStartClose)}，当时点位 ${numberFormatter.format(activeYtd.close)}`
      : null,
    showIndex ? `指数收盘 ${numberFormatter.format(activePoint.close)}` : null,
    activeMovingAverage
      ? `125 日均线 ${numberFormatter.format(activeMovingAverage.value)}`
      : null,
    activeFearGreed
      ? `CNN 恐惧与贪婪指数 ${activeFearGreed.score.toFixed(0)}，${fearGreedRatingLabel(activeFearGreed.rating)}`
      : null,
  ].find(Boolean);
  const activeAriaValue = selectedHoverSeries?.ariaText ?? defaultAriaValue;

  return (
    <div
      className="chart-wrap"
      ref={containerRef}
      tabIndex={0}
      role="slider"
      aria-label="逐日查看纳斯达克综合指数与可选对比走势"
      aria-valuemin={0}
      aria-valuemax={points.length - 1}
      aria-valuenow={hoveredIndex ?? points.length - 1}
      aria-valuetext={`${fullDateFormatter.format(activePoint.dateValue)}${activeAriaValue ? `，${activeAriaValue}` : ""}`}
      onFocus={() => setHoveredIndex((current) => current ?? points.length - 1)}
      onBlur={() => {
        setHoveredIndex(null);
        setHoveredPointerY(null);
      }}
      onKeyDown={handleKeyboard}
    >
      {width > 0 && chart ? (
        <svg
          className="trend-chart"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient
              id={`${gradientId}-line`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              x2="0"
              y1={margin.top}
              y2={height - margin.bottom}
            >
              <stop offset="0%" stopColor="var(--positive)" />
              <stop offset={`${chart.zeroOffset}%`} stopColor="var(--positive)" />
              <stop offset={`${chart.zeroOffset}%`} stopColor="var(--negative)" />
              <stop offset="100%" stopColor="var(--negative)" />
            </linearGradient>
            <linearGradient
              id={`${gradientId}-area`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              x2="0"
              y1={margin.top}
              y2={height - margin.bottom}
            >
              <stop offset="0%" stopColor="var(--positive)" stopOpacity="0.24" />
              <stop offset={`${chart.zeroOffset}%`} stopColor="var(--positive)" stopOpacity="0.025" />
              <stop offset={`${chart.zeroOffset}%`} stopColor="var(--negative)" stopOpacity="0.025" />
              <stop offset="100%" stopColor="var(--negative)" stopOpacity="0.22" />
            </linearGradient>
            <filter id={`${gradientId}-shadow`} x="-30%" y="-30%" width="160%" height="180%">
              <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0b1728" floodOpacity="0.14" />
            </filter>
          </defs>

          <g aria-hidden="true">
            {showPercentAxis ? chart.yTicks.map((tick) => (
              <g key={tick}>
                <line
                  className={Math.abs(tick) < 0.0001 ? "zero-line" : "grid-line"}
                  x1={margin.left}
                  x2={width - margin.right}
                  y1={chart.yScale(tick)}
                  y2={chart.yScale(tick)}
                />
                <text
                  className="axis-label y-label"
                  x={width - margin.right + 10}
                  y={chart.yScale(tick)}
                  dominantBaseline="middle"
                >
                  {Math.abs(tick) < 0.0001 ? "0%" : percent(tick, 0)}
                </text>
              </g>
            )) : null}
            {showFearGreed ? (
              <>
                <text
                  className="axis-unit fear-greed-axis-unit"
                  x={margin.left - 8}
                  y={margin.top - 7}
                  textAnchor="end"
                >
                  情绪
                </text>
                {chart.fearGreedTicks.map((tick) => (
                  <g key={`fear-greed-${tick}`}>
                    {!showPercentAxis ? (
                      <line
                        className={tick === 50 ? "fear-greed-mid-line" : "grid-line"}
                        x1={margin.left}
                        x2={width - margin.right}
                        y1={chart.fearGreedYScale(tick)}
                        y2={chart.fearGreedYScale(tick)}
                      />
                    ) : null}
                    <line
                      className="fear-greed-axis-tick"
                      x1={margin.left - 5}
                      x2={margin.left}
                      y1={chart.fearGreedYScale(tick)}
                      y2={chart.fearGreedYScale(tick)}
                    />
                    <text
                      className="axis-label fear-greed-axis-label"
                      x={margin.left - 8}
                      y={chart.fearGreedYScale(tick)}
                      dominantBaseline="middle"
                      textAnchor="end"
                    >
                      {tick}
                    </text>
                  </g>
                ))}
              </>
            ) : null}
            {showPointAxis ? (
              <>
                <text
                  className={`axis-unit ${showIndex ? "index-axis-unit" : "moving-average-axis-unit"}`}
                  x={margin.left - (showFearGreed ? (isCompact ? 38 : 48) : 8)}
                  y={margin.top - 7}
                  textAnchor="end"
                >
                  点位
                </text>
                {chart.indexTicks.map((tick) => (
                  <g key={`index-${tick}`}>
                    <line
                      className={showIndex ? "index-axis-tick" : "moving-average-axis-tick"}
                      x1={margin.left - (showFearGreed ? (isCompact ? 43 : 53) : 5)}
                      x2={margin.left - (showFearGreed ? (isCompact ? 38 : 48) : 0)}
                      y1={chart.indexYScale(tick)}
                      y2={chart.indexYScale(tick)}
                    />
                    <text
                      className={`axis-label ${showIndex ? "index-axis-label" : "moving-average-axis-label"}`}
                      x={margin.left - (showFearGreed ? (isCompact ? 46 : 56) : 8)}
                      y={chart.indexYScale(tick)}
                      dominantBaseline="middle"
                      textAnchor="end"
                    >
                      {axisNumberFormatter.format(tick)}
                    </text>
                  </g>
                ))}
              </>
            ) : null}
            {chart.xTicks.map((tick, index) => (
              <g key={tick.getTime()}>
                <line
                  className="tick-mark"
                  x1={chart.xScale(tick)}
                  x2={chart.xScale(tick)}
                  y1={height - margin.bottom}
                  y2={height - margin.bottom + 6}
                />
                <text
                  className="axis-label x-label"
                  x={chart.xScale(tick)}
                  y={height - margin.bottom + 26}
                  textAnchor={index === 0 ? "start" : index === chart.xTicks.length - 1 ? "end" : "middle"}
                >
                  {formatXAxisTick(tick, chart.spanDays)}
                </text>
              </g>
            ))}

            {chart.areaPath ? (
              <path className="area-path" d={chart.areaPath} fill={`url(#${gradientId}-area)`} />
            ) : null}
            {extremeZoneHighlight ? (
              <g className={`extreme-zone-highlight ${extremeZoneHighlight.zone}`}>
                <path
                  className={`extreme-zone-fill ${extremeZoneHighlight.zone}`}
                  d={extremeZoneHighlight.fillPath ?? undefined}
                />
                <circle
                  className={`extreme-zone-boundary ${extremeZoneHighlight.zone}`}
                  cx={extremeZoneHighlight.startX}
                  cy={extremeZoneHighlight.baselineY}
                  r="4"
                />
                <circle
                  className={`extreme-zone-boundary ${extremeZoneHighlight.zone}`}
                  cx={extremeZoneHighlight.endX}
                  cy={extremeZoneHighlight.baselineY}
                  r="4"
                />
                <text
                  className={`extreme-zone-label ${extremeZoneHighlight.zone}`}
                  x={extremeZoneHighlight.startX + 7}
                  y={extremeZoneHighlight.labelY}
                  textAnchor="start"
                >
                  开始 {extremeZoneHighlight.startLabel}
                </text>
                <text
                  className={`extreme-zone-label ${extremeZoneHighlight.zone}`}
                  x={extremeZoneHighlight.endX - 7}
                  y={extremeZoneHighlight.labelY}
                  textAnchor="end"
                >
                  结束 {extremeZoneHighlight.endLabel}
                </text>
              </g>
            ) : null}
            {chart.linePath ? (
              <path
                className="line-path"
                d={chart.linePath}
                stroke={`url(#${gradientId}-line)`}
              />
            ) : null}
            {chart.ytdLinePaths.map((series) => series.path ? (
              <path
                key={series.yearStartDate}
                className="ytd-line-path"
                d={series.path}
              />
            ) : null)}
            {chart.indexLinePath ? (
              <path className="index-line-path" d={chart.indexLinePath} />
            ) : null}
            {chart.movingAverageLinePath ? (
              <path className="moving-average-line-path" d={chart.movingAverageLinePath} />
            ) : null}
            {chart.fearGreedLinePath ? (
              <path className="fear-greed-line-path" d={chart.fearGreedLinePath} />
            ) : null}
          </g>

          <rect
            className="interaction-layer"
            x={margin.left}
            y={margin.top}
            width={width - margin.left - margin.right}
            height={height - margin.top - margin.bottom}
            fill="transparent"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") {
                setHoveredIndex(null);
                setHoveredPointerY(null);
              }
            }}
          />

          {hovered && selectedHoverSeries ? (
            <g className="hover-layer" aria-hidden="true" pointerEvents="none">
              <line
                className="crosshair-line"
                x1={hoveredX}
                x2={hoveredX}
                y1={margin.top}
                y2={height - margin.bottom}
              />
              <circle
                className={`hover-dot-ring${selectedHoverSeries.dotClassName ? ` ${selectedHoverSeries.dotClassName}` : ""}`}
                cx={selectedHoverSeries.x}
                cy={selectedHoverSeries.y}
                r="7"
                fill={selectedHoverSeries.dotFill}
              />
              <circle
                cx={selectedHoverSeries.x}
                cy={selectedHoverSeries.y}
                r="3"
                fill="white"
              />
              <g transform={`translate(${tooltipX}, ${tooltipY})`} filter={`url(#${gradientId}-shadow)`}>
                <rect className="tooltip-box" width={tooltipWidth} height={tooltipHeight} rx="12" />
                <text className="tooltip-date" x="14" y="20">
                  {fullDateFormatter.format(hovered.dateValue)}
                </text>
                <text
                  className={selectedHoverSeries.textClassName}
                  x="14"
                  y={selectedHoverSeries.detailText ? 42 : 45}
                >
                  {selectedHoverSeries.valueText}
                </text>
                {selectedHoverSeries.detailText ? (
                  <text className="tooltip-detail" x="14" y="62">
                    {selectedHoverSeries.detailText}
                  </text>
                ) : null}
              </g>
            </g>
          ) : null}
        </svg>
      ) : (
        <div className="chart-placeholder" aria-hidden="true" />
      )}
      <p className="interaction-hint">移动鼠标或触摸拖动查看每日数据 · 键盘可使用 ← →</p>
    </div>
  );
}
