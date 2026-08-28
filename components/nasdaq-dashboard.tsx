"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RollingYoYChart } from "@/components/rolling-yoy-chart";
import {
  filterPointsByCalendarYear,
  filterPointsByRange,
  recentCalendarYears,
  summarizeRange,
  TIME_RANGE_OPTIONS,
  type TimeRange,
} from "@/lib/time-range";
import type { NasdaqYoYResponse } from "@/lib/types";
import { fearGreedRatingLabel } from "@/lib/fear-greed-rating";
import { summarizeFearGreedDistribution } from "@/lib/fear-greed-distribution";

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactPointFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 0,
});

const intradayTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "America/New_York",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const AUTO_REFRESH_MS = 10 * 60 * 1_000;

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function formatPercent(value: number, digits = 2) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function formatPoints(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(value)}`;
}

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function LoadingState() {
  return (
    <main className="page-shell" aria-busy="true" aria-label="正在加载纳斯达克数据">
      <div className="brand-row">
        <span className="brand-mark" aria-hidden="true" />
        <span>MARKET LENS</span>
      </div>
      <section className="dashboard-card loading-card">
        <div className="skeleton skeleton-kicker" />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-value" />
        <div className="skeleton skeleton-chart" />
      </section>
    </main>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="page-shell">
      <div className="brand-row">
        <span className="brand-mark" aria-hidden="true" />
        <span>MARKET LENS</span>
      </div>
      <section className="dashboard-card error-card" role="alert">
        <span className="error-icon" aria-hidden="true">!</span>
        <p className="eyebrow">数据连接中断</p>
        <h1>暂时无法载入指数数据</h1>
        <p>{message}</p>
        <button type="button" onClick={onRetry}>重新加载</button>
      </section>
    </main>
  );
}

export function NasdaqDashboard() {
  const [data, setData] = useState<NasdaqYoYResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [showYoY, setShowYoY] = useState(true);
  const [showYtd, setShowYtd] = useState(false);
  const [showIndex, setShowIndex] = useState(false);
  const [showMovingAverage, setShowMovingAverage] = useState(false);
  const [showFearGreed, setShowFearGreed] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("1Y");
  const [customYear, setCustomYear] = useState<number | null>(null);

  const availableYears = useMemo(
    () => recentCalendarYears(data?.points ?? []),
    [data?.points],
  );
  const yearsWithData = useMemo(
    () => new Set((data?.points ?? []).map((point) => Number(point.date.slice(0, 4)))),
    [data?.points],
  );
  const visiblePoints = useMemo(
    () => customYear === null
      ? filterPointsByRange(data?.points ?? [], timeRange)
      : filterPointsByCalendarYear(data?.points ?? [], customYear),
    [customYear, data?.points, timeRange],
  );
  const visibleYtdPoints = useMemo(() => {
    const visibleStart = visiblePoints[0]?.date;
    const visibleEnd = visiblePoints.at(-1)?.date;
    return visibleStart && visibleEnd
      ? (data?.ytdPoints ?? []).filter(
          (point) => point.date >= visibleStart && point.date <= visibleEnd,
        )
      : [];
  }, [data?.ytdPoints, visiblePoints]);
  const visibleFearGreedPoints = useMemo(() => {
    const visibleStart = visiblePoints[0]?.date;
    const visibleEnd = visiblePoints.at(-1)?.date;
    return visibleStart && visibleEnd
      ? (data?.fearGreed?.points ?? []).filter(
          (point) => point.date >= visibleStart && point.date <= visibleEnd,
        )
      : [];
  }, [data?.fearGreed?.points, visiblePoints]);
  const visibleMovingAveragePoints = useMemo(() => {
    const visibleStart = visiblePoints[0]?.date;
    const visibleEnd = visiblePoints.at(-1)?.date;
    return visibleStart && visibleEnd
      ? (data?.movingAverage125 ?? []).filter(
          (point) => point.date >= visibleStart && point.date <= visibleEnd,
        )
      : [];
  }, [data?.movingAverage125, visiblePoints]);
  const fearGreedDistribution = useMemo(
    () => summarizeFearGreedDistribution(visibleFearGreedPoints),
    [visibleFearGreedPoints],
  );
  const latestYtdPct = visibleYtdPoints.at(-1)?.ytdPct ?? null;
  const latestMovingAverage = visibleMovingAveragePoints.at(-1)?.value ?? null;
  const visibleStats = useMemo(() => summarizeRange(visiblePoints), [visiblePoints]);
  const selectedRange = TIME_RANGE_OPTIONS.find((option) => option.key === timeRange)!;
  const selectedRangeLabel = customYear === null ? `过去${selectedRange.label}` : `${customYear}年`;

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);

      try {
        const response = await fetch(
          process.env.NEXT_PUBLIC_NASDAQ_DATA_URL ?? "/api/nasdaq",
          { signal: controller.signal },
        );
        const payload = (await response.json()) as NasdaqYoYResponse | { error?: string };

        if (!response.ok || !("points" in payload)) {
          throw new Error("error" in payload && payload.error ? payload.error : "未知数据错误");
        }

        setData(payload);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "未知数据错误");
      }
    }

    void loadData();
    return () => controller.abort();
  }, [requestVersion]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRequestVersion((version) => version + 1);
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(interval);
  }, []);

  const retry = useCallback(() => {
    setData(null);
    setRequestVersion((version) => version + 1);
  }, []);

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data) return <LoadingState />;

  const direction = data.stats.latestYoyPct >= 0 ? "positive" : "negative";
  const rangeStats = visibleStats ?? data.stats;

  return (
    <main className="page-shell">
      <header className="brand-row">
        <span className="brand-mark" aria-hidden="true" />
        <span>MARKET LENS</span>
        <span className="brand-separator" aria-hidden="true" />
        <span className="brand-edition">INDEX SERIES</span>
      </header>

      <article className="dashboard-card">
        <header className="instrument-header">
          <div>
            <p className="eyebrow">美国市场 · 滚动一年同比</p>
            <h1>{data.name}</h1>
            <div className="symbol-line">
              <span>INDEXNASDAQ: {data.symbol}</span>
              <span className="live-dot" aria-hidden="true" />
              <span>{data.frequency}</span>
            </div>
          </div>
          <span className="range-chip">ROLLING 1Y</span>
        </header>

        <section className="hero-metric" aria-label="最新滚动一年同比表现">
          <p className={`hero-percent ${direction}`}>
            {formatPercent(data.stats.latestYoyPct)}
          </p>
          <div className={`change-badge ${direction}`}>
            <span aria-hidden="true">{direction === "positive" ? "↗" : "↘"}</span>
            <span>{formatPoints(data.stats.latestChangePoints)} 点</span>
            <span className="change-context">同比</span>
          </div>
          <p className="comparison-copy">
            最新收盘 <strong>{numberFormatter.format(data.stats.latestClose)}</strong>
            <span aria-hidden="true"> · </span>
            对比 {formatDate(data.stats.comparisonDate)} 的 {numberFormatter.format(data.stats.comparisonClose)}
          </p>
        </section>

        <section className="chart-panel" aria-labelledby="chart-title">
          <div className="chart-heading">
            <div>
              <p className="eyebrow">{selectedRangeLabel}的每日同比变化</p>
              <h2 id="chart-title">滚动一年涨跌幅趋势</h2>
            </div>
            <div className="chart-controls">
              <div className="legend" role="list" aria-label="图表图例">
                {showYoY ? (
                  <>
                    <span role="listitem"><i className="legend-swatch positive-bg" />同比为正</span>
                    <span role="listitem"><i className="legend-swatch negative-bg" />同比为负</span>
                  </>
                ) : null}
                {showYtd ? (
                  <span role="listitem"><i className="legend-swatch ytd-bg" />年初至今（逐年重置）</span>
                ) : null}
                {showIndex ? (
                  <span role="listitem"><i className="legend-swatch index-bg" />指数点位</span>
                ) : null}
                {showMovingAverage ? (
                  <span role="listitem"><i className="legend-swatch moving-average-bg" />125日均线</span>
                ) : null}
                {showFearGreed ? (
                  <span role="listitem"><i className="legend-swatch fear-greed-bg" />CNN 恐惧与贪婪</span>
                ) : null}
              </div>
              <div className="chart-toggle-row">
                <button
                  type="button"
                  className={`compare-toggle yoy-toggle${showYoY ? " is-active" : ""}`}
                  aria-pressed={showYoY}
                  onClick={() => setShowYoY((current) => !current)}
                >
                  <span className="toggle-indicator" aria-hidden="true"><i /></span>
                  <span>同步去年</span>
                  <strong>{formatPercent(data.stats.latestYoyPct)}</strong>
                </button>
                <button
                  type="button"
                  className={`compare-toggle ytd-toggle${showYtd ? " is-active" : ""}`}
                  aria-pressed={showYtd}
                  onClick={() => setShowYtd((current) => !current)}
                  disabled={latestYtdPct === null}
                >
                  <span className="toggle-indicator" aria-hidden="true"><i /></span>
                  <span>对比年初至今</span>
                  {latestYtdPct === null ? null : (
                    <strong>{formatPercent(latestYtdPct)}</strong>
                  )}
                </button>
                <button
                  type="button"
                  className={`compare-toggle index-toggle${showIndex ? " is-active" : ""}`}
                  aria-pressed={showIndex}
                  onClick={() => setShowIndex((current) => !current)}
                >
                  <span className="toggle-indicator" aria-hidden="true"><i /></span>
                  <span>显示指数点数</span>
                  <strong>{compactPointFormatter.format(data.stats.latestClose)}</strong>
                </button>
                <button
                  type="button"
                  className={`compare-toggle moving-average-toggle${showMovingAverage ? " is-active" : ""}`}
                  aria-pressed={showMovingAverage}
                  onClick={() => setShowMovingAverage((current) => !current)}
                  disabled={latestMovingAverage === null}
                >
                  <span className="toggle-indicator" aria-hidden="true"><i /></span>
                  <span>125日均线</span>
                  {latestMovingAverage === null ? null : (
                    <strong>{numberFormatter.format(latestMovingAverage)}</strong>
                  )}
                </button>
                <button
                  type="button"
                  className={`compare-toggle fear-greed-toggle${showFearGreed ? " is-active" : ""}`}
                  aria-pressed={showFearGreed}
                  onClick={() => setShowFearGreed((current) => !current)}
                  disabled={!data.fearGreed?.available}
                  title={data.fearGreed?.available ? "显示 CNN Fear & Greed Index" : "CNN 数据暂不可用"}
                >
                  <span className="toggle-indicator" aria-hidden="true"><i /></span>
                  <span>CNN 恐惧贪婪</span>
                  {data.fearGreed?.latestScore === null || data.fearGreed?.latestScore === undefined ? null : (
                    <strong>
                      {data.fearGreed.latestScore.toFixed(0)} · {fearGreedRatingLabel(data.fearGreed.latestRating)}
                    </strong>
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="time-range-controls">
            <div className="time-range-selector" role="group" aria-label="选择图表时间范围">
              {TIME_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={customYear === null && timeRange === option.key ? "is-active" : ""}
                  aria-pressed={customYear === null && timeRange === option.key}
                  onClick={() => {
                    setTimeRange(option.key);
                    setCustomYear(null);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className={`custom-year-picker${customYear === null ? "" : " is-active"}`}>
              <span>自定义年份</span>
              <select
                aria-label="选择最近十年内的自然年份"
                value={customYear ?? ""}
                onChange={(event) => {
                  const year = Number(event.target.value);
                  setCustomYear(Number.isInteger(year) && year > 0 ? year : null);
                }}
              >
                <option value="">选择年份</option>
                {availableYears.map((year) => (
                  <option key={year} value={year} disabled={!yearsWithData.has(year)}>
                    {year}年{yearsWithData.has(year) ? "" : "（暂无数据）"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <RollingYoYChart
            key={customYear === null ? timeRange : `year-${customYear}`}
            points={visiblePoints}
            ytdPoints={visibleYtdPoints}
            movingAveragePoints={visibleMovingAveragePoints}
            fearGreedPoints={visibleFearGreedPoints}
            showYoY={showYoY}
            showYtd={showYtd}
            showIndex={showIndex}
            showMovingAverage={showMovingAverage}
            showFearGreed={showFearGreed}
          />
        </section>

        {showFearGreed ? (
          <section className="fear-greed-distribution" aria-labelledby="fear-greed-distribution-title">
            <div className="fear-greed-distribution-heading">
              <div>
                <p className="eyebrow">{selectedRangeLabel} · 有效情绪日期分布</p>
                <h2 id="fear-greed-distribution-title">CNN 情绪区域占比</h2>
              </div>
              <strong>{fearGreedDistribution.total} 个日期</strong>
            </div>

            {fearGreedDistribution.total > 0 ? (
              <>
                <div
                  className="fear-greed-distribution-bar"
                  role="img"
                  aria-label={fearGreedDistribution.zones
                    .map((zone) => `${zone.label} ${zone.percentage.toFixed(1)}%`)
                    .join("，")}
                >
                  {fearGreedDistribution.zones.map((zone) => (
                    <span
                      key={zone.key}
                      className={`fear-greed-zone-segment ${zone.key}`}
                      style={{ width: `${zone.percentage}%` }}
                      title={`${zone.label} ${zone.percentage.toFixed(1)}%`}
                    />
                  ))}
                </div>

                <div className="fear-greed-zone-grid">
                  {fearGreedDistribution.zones.map((zone) => (
                    <div className={`fear-greed-zone-card ${zone.key}`} key={zone.key}>
                      <span>
                        <i aria-hidden="true" />
                        {zone.label}
                      </span>
                      <strong>{zone.percentage.toFixed(1)}%</strong>
                      <small>{zone.min}–{zone.max} · {zone.count} 日</small>
                    </div>
                  ))}
                </div>

                <p className="fear-greed-distribution-note">
                  百分比以当前范围内 CNN 提供的 {fearGreedDistribution.total} 个有效日期为分母；缺失日期不参与计算。
                </p>
              </>
            ) : (
              <p className="fear-greed-distribution-empty">当前时间范围暂无 CNN 情绪历史数据。</p>
            )}
          </section>
        ) : null}

        <section className="stats-grid" aria-label="趋势摘要">
          <div className="stat-card">
            <span>区间同比高点</span>
            <strong className={rangeStats.highYoyPct >= 0 ? "positive" : "negative"}>
              {formatPercent(rangeStats.highYoyPct)}
            </strong>
          </div>
          <div className="stat-card">
            <span>区间同比低点</span>
            <strong className={rangeStats.lowYoyPct >= 0 ? "positive" : "negative"}>
              {formatPercent(rangeStats.lowYoyPct)}
            </strong>
          </div>
          <div className="stat-card">
            <span>同比为正交易日</span>
            <strong>{rangeStats.positiveDayShare.toFixed(1)}%</strong>
          </div>
          <div className="stat-card">
            <span>最新指数点位</span>
            <strong>{numberFormatter.format(data.stats.latestClose)}</strong>
          </div>
        </section>

        <footer className="data-footer">
          <div>
            <p><strong>计算口径</strong> {data.methodology}</p>
            <p>数据截至 {formatDate(data.asOf)}。历史区间使用日收盘；当日未收盘时，SMA125 含最新公开点位并属于盘中估算。内容不构成投资建议。</p>
            {data.intraday.active && data.intraday.updatedAt ? (
              <p className="intraday-notice">
                当日点位每 10 分钟刷新；最近行情时间（美东）{intradayTimeFormatter.format(new Date(data.intraday.updatedAt))}。Nasdaq 公开展示数据至少延迟 1 分钟。
              </p>
            ) : (
              <p className="snapshot-notice">当日行情暂不可用，当前仅显示 FRED 最近数据。</p>
            )}
            {data.deliveryMode === "snapshot" ? (
              <p className="snapshot-notice">上游数据暂时不可达，当前使用最近同步的 FRED 数据快照。</p>
            ) : null}
          </div>
          <div className="source-links">
            <a href={data.source.url} target="_blank" rel="noreferrer">
              历史：{data.source.name}<span aria-hidden="true">↗</span>
            </a>
            <a href={data.intraday.source.url} target="_blank" rel="noreferrer">
              当日：{data.intraday.source.name}<span aria-hidden="true">↗</span>
            </a>
            {data.fearGreed?.source ? (
              <a href={data.fearGreed.source.url} target="_blank" rel="noreferrer">
                情绪：{data.fearGreed.source.name}<span aria-hidden="true">↗</span>
              </a>
            ) : null}
          </div>
        </footer>
      </article>
    </main>
  );
}
