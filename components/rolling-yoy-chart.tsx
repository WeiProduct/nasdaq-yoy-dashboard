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
import type { NasdaqYoYPoint } from "@/lib/types";
import { mapClientXToRange } from "@/lib/chart-coordinates";
import type { YtdPoint } from "@/lib/ytd";

type ChartPoint = NasdaqYoYPoint & {
  timestamp: number;
  dateValue: Date;
};

type YtdChartPoint = YtdPoint & {
  timestamp: number;
  dateValue: Date;
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
  showYtd: boolean;
  showIndex: boolean;
};

export function RollingYoYChart({
  points: rawPoints,
  ytdPoints: rawYtdPoints,
  showYtd,
  showIndex,
}: RollingYoYChartProps) {
  const { ref: containerRef, width } = useContainerWidth();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
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
  const ytdByDate = useMemo(
    () => new Map(ytdPoints.map((point) => [point.date, point])),
    [ytdPoints],
  );

  const height = width > 0 && width < 620 ? 350 : 430;
  const margin = width < 620
    ? { top: 18, right: 48, bottom: 42, left: showIndex ? 48 : 10 }
    : { top: 24, right: 64, bottom: 46, left: showIndex ? 64 : 16 };

  const chart = useMemo(() => {
    if (width <= 0 || points.length === 0) return null;

    const [dateMin, dateMax] = extent(points, (point) => point.dateValue);
    const [closeMin = 0, closeMax = 0] = extent(points, (point) => point.close);
    const visibleValues = points.map((point) => point.yoyPct);
    if (showYtd) visibleValues.push(...ytdPoints.map((point) => point.ytdPct));
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

    const linePath = line<ChartPoint>()
      .x((point) => xScale(point.dateValue))
      .y((point) => yScale(point.yoyPct))
      .curve(curveLinear)(points);
    const areaPath = area<ChartPoint>()
      .x((point) => xScale(point.dateValue))
      .y0(yScale(0))
      .y1((point) => yScale(point.yoyPct))
      .curve(curveLinear)(points);
    const ytdLinePath = showYtd
      ? line<YtdChartPoint>()
          .x((point) => xScale(point.dateValue))
          .y((point) => yScale(point.ytdPct))
          .curve(curveLinear)(ytdPoints)
      : null;
    const indexLinePath = showIndex
      ? line<ChartPoint>()
          .x((point) => xScale(point.dateValue))
          .y((point) => indexYScale(point.close))
          .curve(curveLinear)(points)
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
      ytdLinePath,
      indexLinePath,
      indexYScale,
      zeroOffset,
      xTicks: xScale.ticks(xTickCount),
      yTicks: yScale.ticks(width < 620 ? 4 : 5),
      indexTicks: indexYScale.ticks(width < 620 ? 4 : 5),
      spanDays,
    };
  }, [height, margin.bottom, margin.left, margin.right, margin.top, points, showIndex, showYtd, width, ytdPoints]);

  const nearestIndex = useMemo(
    () => bisector<ChartPoint, number>((point) => point.timestamp).center,
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
    setHoveredIndex((current) => (current === nextIndex ? current : nextIndex));
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
    setHoveredIndex(next);
  }

  const hovered = hoveredIndex === null ? null : points[hoveredIndex];
  const hoveredYtd = hovered && showYtd ? ytdByDate.get(hovered.date) : undefined;
  const hoveredX = hovered && chart ? chart.xScale(hovered.dateValue) : 0;
  const hoveredY = hovered && chart ? chart.yScale(hovered.yoyPct) : 0;
  const hoveredYtdY = hoveredYtd && chart ? chart.yScale(hoveredYtd.ytdPct) : 0;
  const hoveredIndexY = hovered && chart ? chart.indexYScale(hovered.close) : 0;
  const tooltipWidth = width < 620 ? 202 : 220;
  const tooltipHeight = hoveredYtd ? 134 : 112;
  const tooltipX = hoveredX > width / 2
    ? hoveredX - tooltipWidth - 14
    : hoveredX + 14;
  const tooltipY = Math.max(
    margin.top,
    Math.min(height - margin.bottom - tooltipHeight, hoveredY - tooltipHeight / 2),
  );
  const activePoint = hovered ?? points.at(-1)!;
  const activeYtd = showYtd ? ytdByDate.get(activePoint.date) : undefined;

  return (
    <div
      className="chart-wrap"
      ref={containerRef}
      tabIndex={0}
      role="slider"
      aria-label={`逐日查看纳斯达克综合指数滚动一年同比${showIndex ? "和指数点位" : ""}`}
      aria-valuemin={0}
      aria-valuemax={points.length - 1}
      aria-valuenow={hoveredIndex ?? points.length - 1}
      aria-valuetext={`${fullDateFormatter.format(activePoint.dateValue)}，同比 ${percent(activePoint.yoyPct)}${activeYtd ? `，年初至今 ${percent(activeYtd.ytdPct)}` : ""}，指数收盘 ${numberFormatter.format(activePoint.close)}`}
      onFocus={() => setHoveredIndex((current) => current ?? points.length - 1)}
      onBlur={() => setHoveredIndex(null)}
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
            {chart.yTicks.map((tick) => (
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
            ))}
            {showIndex ? (
              <>
                <text
                  className="axis-unit index-axis-unit"
                  x={margin.left - 8}
                  y={margin.top - 7}
                  textAnchor="end"
                >
                  点位
                </text>
                {chart.indexTicks.map((tick) => (
                  <g key={`index-${tick}`}>
                    <line
                      className="index-axis-tick"
                      x1={margin.left - 5}
                      x2={margin.left}
                      y1={chart.indexYScale(tick)}
                      y2={chart.indexYScale(tick)}
                    />
                    <text
                      className="axis-label index-axis-label"
                      x={margin.left - 8}
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
            {chart.linePath ? (
              <path
                className="line-path"
                d={chart.linePath}
                stroke={`url(#${gradientId}-line)`}
              />
            ) : null}
            {chart.ytdLinePath ? (
              <path className="ytd-line-path" d={chart.ytdLinePath} />
            ) : null}
            {chart.indexLinePath ? (
              <path className="index-line-path" d={chart.indexLinePath} />
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
              if (event.pointerType === "mouse") setHoveredIndex(null);
            }}
          />

          {hovered ? (
            <g className="hover-layer" aria-hidden="true" pointerEvents="none">
              <line
                className="crosshair-line"
                x1={hoveredX}
                x2={hoveredX}
                y1={margin.top}
                y2={height - margin.bottom}
              />
              <circle
                className="hover-dot-ring"
                cx={hoveredX}
                cy={hoveredY}
                r="7"
                fill={hovered.yoyPct >= 0 ? "var(--positive)" : "var(--negative)"}
              />
              <circle cx={hoveredX} cy={hoveredY} r="3" fill="white" />
              {hoveredYtd ? (
                <>
                  <circle
                    className="hover-dot-ring ytd-hover-dot"
                    cx={hoveredX}
                    cy={hoveredYtdY}
                    r="7"
                  />
                  <circle cx={hoveredX} cy={hoveredYtdY} r="3" fill="white" />
                </>
              ) : null}
              {showIndex ? (
                <>
                  <circle
                    className="hover-dot-ring index-hover-dot"
                    cx={hoveredX}
                    cy={hoveredIndexY}
                    r="7"
                  />
                  <circle cx={hoveredX} cy={hoveredIndexY} r="3" fill="white" />
                </>
              ) : null}
              <g transform={`translate(${tooltipX}, ${tooltipY})`} filter={`url(#${gradientId}-shadow)`}>
                <rect className="tooltip-box" width={tooltipWidth} height={tooltipHeight} rx="12" />
                <text className="tooltip-date" x="14" y="23">
                  {fullDateFormatter.format(hovered.dateValue)}
                </text>
                <text
                  className={hovered.yoyPct >= 0 ? "tooltip-value positive-fill" : "tooltip-value negative-fill"}
                  x="14"
                  y="51"
                >
                  滚动一年 {percent(hovered.yoyPct)}
                </text>
                {hoveredYtd ? (
                  <text className="tooltip-ytd-value" x="14" y="75">
                    年初至今 {percent(hoveredYtd.ytdPct)}
                  </text>
                ) : null}
                <text
                  className={showIndex ? "tooltip-index-value" : "tooltip-detail"}
                  x="14"
                  y={hoveredYtd ? 98 : 75}
                >
                  {showIndex ? "指数点位" : "当前收盘"} {numberFormatter.format(hovered.close)}
                </text>
                <text className="tooltip-detail" x="14" y={hoveredYtd ? 119 : 96}>
                  去年对比价 {numberFormatter.format(hovered.comparisonClose)}
                </text>
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
